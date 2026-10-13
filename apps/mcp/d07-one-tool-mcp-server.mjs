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
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';
import {
  createD07QuerySequenceGate,
  summarizeD07QueryResult,
} from '../../scripts/lib/d07-query-sequence.mjs';
import { isD07RunnerProcessActive } from '../../scripts/lib/d07-runner-liveness.mjs';
import {
  computeMcpBundleSha256,
  readG26McpBundleAttestation,
  gitRepositoryText,
} from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET_TOOL = 'bangumi.query_subjects';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function writeSanitizedSummary(summaryPath, summary) {
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error(
      'D07 summary output must stay inside the operating-system temporary directory.',
    );
  }
  const snapshot = { ...summary };
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
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
        '--runner-pid',
        '--claim-id',
      ].includes(key)
    ) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (values.has(key) || index + 1 >= argv.length) throw new Error(`Invalid ${key} argument.`);
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  const runnerPid = Number(values.get('--runner-pid'));
  const claimId = values.get('--claim-id');
  if (
    !summaryPath ||
    !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    !Number.isSafeInteger(runnerPid) ||
    runnerPid <= 0 ||
    typeof claimId !== 'string' ||
    !/^d07-run-95-pr-\d+-[0-9a-f]{12}-[0-9a-f]{12}$/u.test(claimId)
  ) {
    throw new Error(
      'D07 requires a bounded summary path, exact Candidate/runtime hashes, and active claim identity.',
    );
  }
  return { summaryPath, candidateSha, bundleSha256, runnerPid, claimId };
}

function runtimeCandidateMatches(candidateSha, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === candidateSha &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readG26McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  const runner = { runnerPid: config.runnerPid, claimId: config.claimId };
  if (!isD07RunnerProcessActive(runner)) {
    throw new Error('D07 MCP server requires its live claim-bound Harness runner.');
  }
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }
  const candidateSha = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    candidateSha !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    readG26McpBundleAttestation(PRODUCT_ROOT) !== bundleSha256 ||
    !runtimeCandidateMatches(candidateSha, bundleSha256)
  ) {
    throw new Error('D07 MCP server is not running the attested immutable exact Candidate bundle.');
  }

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TARGET_TOOL);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('D07 only exposes the catalogued anonymous read-only query tool.');
  }

  const storage = new MemoryStorage();
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10_000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), TARGET_TOOL);
  const mcpTool = { ...toMcpTool(tool), annotations: publicReadOnlyToolAnnotations(tool) };
  const server = new Server(
    { name: 'bangumi-d07-ten-year-one-tool', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const gate = createD07QuerySequenceGate();
  let deniedCallCount = 0;
  const callSummaries = [];
  let summary = {
    schemaVersion: 1,
    serverProfile: 'd07-ten-year-one-tool-anonymous-v1',
    serverInstanceId: randomUUID(),
    sourceRevision: candidateSha,
    bundleSha256,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: TARGET_TOOL,
    toolDescriptionSha256: createHash('sha256').update(mcpTool.description, 'utf8').digest('hex'),
    inputSchemaSha256: createHash('sha256')
      .update(canonicalJson(mcpTool.inputSchema), 'utf8')
      .digest('hex'),
    serverToolNames: [TARGET_TOOL],
    serverToolCount: 1,
    expectedArgumentsSha256: createHash('sha256')
      .update(canonicalJson(D07_QUERY_ARGUMENTS_BY_YEAR), 'utf8')
      .digest('hex'),
    expectedCallCount: D07_EXPECTED_YEARS.length,
    allowedCallCount: 0,
    deniedCallCount: 0,
    callSummaries,
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
      credentialsStored: false,
    },
  };
  writeSanitizedSummary(config.summaryPath, summary);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!isD07RunnerProcessActive(runner)) {
      deniedCallCount += 1;
      summary = { ...summary, deniedCallCount, sequence: gate.summary() };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [
          { type: 'text', text: 'Rejected by D07 server: one-shot runner is no longer active.' },
        ],
        isError: true,
      };
    }
    const authorization = gate.authorize(request.params.name, request.params.arguments || {});
    if (!authorization.allowed) {
      deniedCallCount += 1;
      summary = { ...summary, deniedCallCount, sequence: gate.summary() };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [
          { type: 'text', text: `Rejected by D07 one-tool server: ${authorization.code}.` },
        ],
        isError: true,
      };
    }
    if (!runtimeCandidateMatches(candidateSha, bundleSha256) || !isD07RunnerProcessActive(runner)) {
      deniedCallCount += 1;
      summary = { ...summary, deniedCallCount, sequence: gate.summary() };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: 'Rejected by D07 server: Candidate drift.' }],
        isError: true,
      };
    }

    summary = {
      ...summary,
      allowedCallCount: gate.summary().allowedCalls,
      sequence: gate.summary(),
      activeYear: authorization.year,
    };
    writeSanitizedSummary(config.summaryPath, summary);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(
        TARGET_TOOL,
        D07_QUERY_ARGUMENTS_BY_YEAR[authorization.year],
        {
          ...identity,
          requestId: `req_${randomUUID()}`,
          confirmationId: undefined,
        },
      );
      if (
        !runtimeCandidateMatches(candidateSha, bundleSha256) ||
        !isD07RunnerProcessActive(runner)
      ) {
        deniedCallCount += 1;
        summary = { ...summary, deniedCallCount, sequence: gate.summary() };
        writeSanitizedSummary(config.summaryPath, summary);
        return {
          content: [{ type: 'text', text: 'D07 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      callSummaries.push(summarizeD07QueryResult(authorization.year, result));
      summary = {
        ...summary,
        allowedCallCount: gate.summary().allowedCalls,
        deniedCallCount,
        sequence: gate.summary(),
        activeYear: null,
        callSummaries,
      };
      writeSanitizedSummary(config.summaryPath, summary);
      const presentation = presentMcpToolResult(TARGET_TOOL, result);
      return {
        content: [{ type: 'text', text: presentation.text }],
        ...(presentation.structuredContent
          ? { structuredContent: presentation.structuredContent }
          : {}),
      };
    } catch (error) {
      const publicError = toPublicError(error);
      const errorSummary = {
        year: authorization.year,
        state: 'error',
        operation: 'browseSubjects',
        retrievedAt: new Date().toISOString(),
        totalKind: 'unknown',
        coverage: { state: 'unavailable', requested: 1, scanned: 0, matched: 0, returned: 0 },
        itemCount: 0,
        items: [],
        errorCode: publicError.code,
      };
      callSummaries.push(errorSummary);
      summary = {
        ...summary,
        allowedCallCount: gate.summary().allowedCalls,
        deniedCallCount,
        sequence: gate.summary(),
        activeYear: null,
        callSummaries,
      };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: `D07 query failed (${publicError.code}).` }],
        isError: true,
      };
    }
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  process.exitCode = 1;
});
