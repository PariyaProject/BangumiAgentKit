#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  authorizeToolCall,
  canonicalJson,
  claimSingleToolCall,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
  summarizeToolResult,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { D05_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/d05-current-season-answer-check.mjs';
import {
  computeMcpBundleSha256,
  D05_MCP_BUNDLE_ATTESTATION_PATH,
  D05_MCP_BUNDLE_ATTESTATION_KIND,
  readD05McpBundleAttestation,
} from '../../scripts/lib/d05-mcp-bundle.mjs';
import { gitRepositoryText } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET_TOOL = 'bangumi.query_subjects';

function writeSanitizedSummary(summaryPath, summary, serverInstanceId) {
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error(
      'D05 summary output must stay inside the operating-system temporary directory.',
    );
  }
  const snapshot = { ...summary, serverInstanceId };
  fs.appendFileSync(`${absolute}.events.jsonl`, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (
      ![
        '--tool',
        '--arguments-json',
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
      ].includes(key)
    ) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (values.has(key) || index + 1 >= argv.length) throw new Error(`Invalid ${key} argument.`);
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const toolName = values.get('--tool');
  const encodedArguments = values.get('--arguments-json');
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  if (
    toolName !== TARGET_TOOL ||
    !encodedArguments ||
    !summaryPath ||
    !candidateSha ||
    !bundleSha256
  ) {
    throw new Error(
      'D05 accepts one fixed anonymous query tool and exact-Candidate summary inputs.',
    );
  }
  if (
    !/^[0-9a-f]{40}$/u.test(candidateSha) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256) ||
    canonicalJson(JSON.parse(encodedArguments)) !== canonicalJson(D05_EXPECTED_QUERY_ARGUMENTS)
  ) {
    throw new Error('D05 fixed query or exact runtime hashes do not match.');
  }
  return { summaryPath, candidateSha, bundleSha256 };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === sourceRevision &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readD05McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  const serverInstanceId = randomUUID();
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }
  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TARGET_TOOL);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('D05 only exposes catalogued auth=none, risk=read tools.');
  }
  const sourceRevision = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    sourceRevision !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    readD05McpBundleAttestation(PRODUCT_ROOT) !== bundleSha256 ||
    !runtimeCandidateMatches(sourceRevision, bundleSha256)
  ) {
    throw new Error('D05 MCP server is not running the attested immutable Candidate bundle.');
  }
  const storage = new MemoryStorage();
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10_000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), TARGET_TOOL);
  const mcpTool = { ...toMcpTool(tool), annotations: publicReadOnlyToolAnnotations(tool) };
  const descriptionSha256 = createHash('sha256').update(mcpTool.description, 'utf8').digest('hex');
  const inputSchemaSha256 = createHash('sha256')
    .update(canonicalJson(mcpTool.inputSchema), 'utf8')
    .digest('hex');
  const server = new Server(
    { name: 'bangumi-d05-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  let allowedCalls = 0;
  let deniedCalls = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision,
    bundleSha256,
    bundleAttestationFile: D05_MCP_BUNDLE_ATTESTATION_PATH,
    bundleAttestationKind: D05_MCP_BUNDLE_ATTESTATION_KIND,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: TARGET_TOOL,
    toolDescriptionSha256: descriptionSha256,
    inputSchemaSha256,
    serverToolNames: [TARGET_TOOL],
    serverToolCount: 1,
    expectedArgumentsSha256: createHash('sha256')
      .update(canonicalJson(D05_EXPECTED_QUERY_ARGUMENTS), 'utf8')
      .digest('hex'),
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    result: null,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      communityRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
  };
  writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const authorization = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: TARGET_TOOL,
      expectedArguments: D05_EXPECTED_QUERY_ARGUMENTS,
      completedCalls: allowedCalls,
    });
    if (!authorization.allowed) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [
          { type: 'text', text: `Rejected by D05 one-tool server: ${authorization.code}.` },
        ],
        isError: true,
      };
    }
    if (!claimSingleToolCall(`${path.resolve(config.summaryPath)}.call-claimed`)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: 'Rejected by D05 one-tool server: call limit reached.' }],
        isError: true,
      };
    }
    if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: 'Rejected by D05 one-tool server: candidate drift.' }],
        isError: true,
      };
    }
    allowedCalls += 1;
    summary = { ...summary, allowedCallCount: allowedCalls, argumentMatch: true };
    writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(TARGET_TOOL, D05_EXPECTED_QUERY_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
        summary = { ...summary, serverResultStatus: 'ERROR', errorCode: 'CANDIDATE_DRIFT' };
        writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
        return {
          content: [{ type: 'text', text: 'D05 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        result: summarizeToolResult(TARGET_TOOL, result),
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      const presentation = presentMcpToolResult(TARGET_TOOL, result);
      return {
        content: [{ type: 'text', text: presentation.text }],
        ...(presentation.structuredContent
          ? { structuredContent: presentation.structuredContent }
          : {}),
      };
    } catch (error) {
      const publicError = toPublicError(error);
      summary = {
        ...summary,
        serverResultStatus: 'ERROR',
        errorCode: typeof publicError.code === 'string' ? publicError.code : 'UNKNOWN_ERROR',
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ code: publicError.code, message: publicError.message }),
          },
        ],
        isError: true,
      };
    }
  });

  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('D05 one-tool MCP server could not start.\n');
    process.exitCode = 1;
  });
}
