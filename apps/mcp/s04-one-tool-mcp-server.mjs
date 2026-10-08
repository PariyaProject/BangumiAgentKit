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
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { gitRepositoryText } from '../../scripts/lib/g26-mcp-bundle.mjs';
import {
  computeMcpBundleSha256,
  readS04McpBundleAttestation,
} from '../../scripts/lib/s04-mcp-bundle.mjs';
import {
  S04_EXPECTED_QUERY_ARGUMENTS,
  S04_RESPONSE_BYTE_LIMIT,
} from '../../scripts/acceptance/s04-agent-answer-check.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_subject_cast';

function parseArguments(argv) {
  const allowed = new Set([
    '--summary-file',
    '--candidate-sha',
    '--bundle-sha256',
    '--base-sha',
    '--reviewer-id',
    '--pr-number',
  ]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!allowed.has(key) || values.has(key) || index + 1 >= argv.length) {
      throw new Error('Invalid S04 one-tool server arguments.');
    }
    values.set(key, argv[++index]);
  }
  const config = {
    summaryPath: values.get('--summary-file'),
    candidateSha: values.get('--candidate-sha'),
    bundleSha256: values.get('--bundle-sha256'),
    baseSha: values.get('--base-sha'),
    reviewerId: values.get('--reviewer-id'),
    prNumber: Number(values.get('--pr-number')),
  };
  if (
    !config.summaryPath ||
    !/^[0-9a-f]{40}$/u.test(config.candidateSha || '') ||
    !/^[0-9a-f]{64}$/u.test(config.bundleSha256 || '') ||
    !/^[0-9a-f]{40}$/u.test(config.baseSha || '') ||
    !/^gpt-6-luna-max-run95-s04-pr\d+-round1$/u.test(config.reviewerId || '') ||
    !Number.isInteger(config.prNumber) ||
    config.prNumber < 1
  ) {
    throw new Error('Exact Candidate, Base, PR, and Luna Max review identities are required.');
  }
  const absolute = path.resolve(config.summaryPath);
  if (!absolute.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) {
    throw new Error('S04 server summary must stay inside the operating-system temp directory.');
  }
  return { ...config, summaryPath: absolute };
}

function runtimeCandidateMatches(candidateSha, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === candidateSha &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readS04McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

function writeSanitizedSummary(summaryPath, summary) {
  const temporaryPath = `${summaryPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(summary, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
  fs.renameSync(temporaryPath, summaryPath);
}

function summarizeCastResult(result) {
  const source = result?.source;
  const groups = Array.isArray(result?.multiRoleVoiceActors) ? result.multiRoleVoiceActors : [];
  return {
    status: result?.status === 'ok' ? 'ok' : 'unknown',
    subjectId: Number.isInteger(result?.subjectId) ? result.subjectId : null,
    observed: Number.isInteger(result?.observed) ? result.observed : null,
    selectedRows: Number.isInteger(result?.selectedRows) ? result.selectedRows : null,
    omittedRowsByLimit: Number.isInteger(result?.omittedRowsByLimit)
      ? result.omittedRowsByLimit
      : null,
    returned: Number.isInteger(result?.returned) ? result.returned : null,
    truncated: typeof result?.truncated === 'boolean' ? result.truncated : null,
    schemaDriftRows: Number.isInteger(result?.schemaDriftRows) ? result.schemaDriftRows : null,
    invalidActorIdRows: Number.isInteger(result?.invalidActorIdRows)
      ? result.invalidActorIdRows
      : null,
    duplicateActorCharacterLinks: Number.isInteger(result?.duplicateActorCharacterLinks)
      ? result.duplicateActorCharacterLinks
      : null,
    source: {
      api: source?.api === 'official-v0' ? source.api : null,
      operation:
        source?.operation === 'GET /v0/subjects/{subject_id}/characters' ? source.operation : null,
      status: ['observed', 'partial'].includes(source?.status) ? source.status : null,
      responseBytes: Number.isInteger(source?.responseBytes) ? source.responseBytes : null,
      responseByteLimit: Number.isInteger(source?.responseByteLimit)
        ? source.responseByteLimit === S04_RESPONSE_BYTE_LIMIT
          ? S04_RESPONSE_BYTE_LIMIT
          : null
        : null,
      paginationAvailable: source?.paginationAvailable === false ? false : null,
      totalCountAvailable: source?.totalCountAvailable === false ? false : null,
      retrievedAtValid:
        typeof source?.retrievedAt === 'string' && Number.isFinite(Date.parse(source.retrievedAt)),
    },
    groupCount: groups.length,
    distinctCharactersByGroup: groups.map((group) =>
      Number.isInteger(group?.distinctCharacterCount) ? group.distinctCharacterCount : null,
    ),
  };
}

function writeSummary(config, summary) {
  writeSanitizedSummary(config.summaryPath, summary);
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }
  if (!runtimeCandidateMatches(config.candidateSha, config.bundleSha256)) {
    throw new Error('S04 MCP server is not running the immutable exact Candidate bundle.');
  }

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('S04 permits only the catalogued anonymous read-only subject-cast tool.');
  }

  const storage = new MemoryStorage();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    timeoutMs: 10000,
    userAgent: 'BangumiAgentKit-run95-s04-one-shot/1.0',
  });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), TOOL_NAME);
  const mcpTool = { ...toMcpTool(tool), annotations: publicReadOnlyToolAnnotations(tool) };
  const server = new Server(
    { name: 'bangumi-codex-s04-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const expectedArgumentsSha256 = createHash('sha256')
    .update(canonicalJson(S04_EXPECTED_QUERY_ARGUMENTS), 'utf8')
    .digest('hex');
  const summary = {
    schemaVersion: 1,
    serverProfile: 's04-one-tool-anonymous-public-v1',
    sourceRevision: config.candidateSha,
    bundleSha256: config.bundleSha256,
    baseSha: config.baseSha,
    prNumber: config.prNumber,
    reviewerId: config.reviewerId,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: TOOL_NAME,
    toolDescriptionSha256: createHash('sha256').update(mcpTool.description, 'utf8').digest('hex'),
    inputSchemaSha256: createHash('sha256')
      .update(canonicalJson(mcpTool.inputSchema), 'utf8')
      .digest('hex'),
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    expectedArgumentsSha256,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    resultSummary: null,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      communityRead: false,
      rawAnswerStored: false,
      rawToolResultStored: false,
      credentialsStored: false,
    },
  };
  writeSummary(config, summary);

  let allowedCallCount = 0;
  let deniedCallCount = 0;
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const call = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: TOOL_NAME,
      expectedArguments: S04_EXPECTED_QUERY_ARGUMENTS,
      completedCalls: allowedCallCount,
    });
    if (
      !call.allowed ||
      !claimSingleToolCall(`${config.summaryPath}.call-claimed`) ||
      !runtimeCandidateMatches(config.candidateSha, config.bundleSha256)
    ) {
      deniedCallCount += 1;
      writeSummary(config, { ...summary, allowedCallCount, deniedCallCount });
      return {
        content: [{ type: 'text', text: 'Rejected by the fixed S04 one-tool query server.' }],
        isError: true,
      };
    }

    allowedCallCount += 1;
    writeSummary(config, {
      ...summary,
      allowedCallCount,
      deniedCallCount,
      argumentMatch: true,
    });
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(TOOL_NAME, S04_EXPECTED_QUERY_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(config.candidateSha, config.bundleSha256)) {
        writeSummary(config, {
          ...summary,
          allowedCallCount,
          deniedCallCount,
          argumentMatch: true,
          serverResultStatus: 'ERROR',
          errorCode: 'CANDIDATE_DRIFT',
        });
        return {
          content: [{ type: 'text', text: 'S04 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      const resultSummary = summarizeCastResult(result);
      writeSummary(config, {
        ...summary,
        allowedCallCount,
        deniedCallCount,
        argumentMatch: true,
        serverResultStatus: 'SUCCESS',
        resultSummary,
      });
      const presentation = presentMcpToolResult(TOOL_NAME, result);
      return {
        content: [{ type: 'text', text: presentation.text }],
        ...(presentation.structuredContent
          ? { structuredContent: presentation.structuredContent }
          : {}),
      };
    } catch (error) {
      const publicError = toPublicError(error);
      writeSummary(config, {
        ...summary,
        allowedCallCount,
        deniedCallCount,
        argumentMatch: true,
        serverResultStatus: 'ERROR',
        errorCode: typeof publicError.code === 'string' ? publicError.code : 'UNKNOWN_ERROR',
      });
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      /* Best-effort process cleanup. */
    }
    try {
      await registry.close();
    } catch {
      /* Best-effort process cleanup. */
    }
    try {
      await storage.close();
    } catch {
      /* Best-effort process cleanup. */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('[s04-one-tool-mcp] startup or execution failed.\n');
    process.exitCode = 1;
  });
}
