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
import {
  D04_DISCOVERY_ARGUMENTS,
  D04_DISCOVERY_TOOL,
} from '../../scripts/acceptance/d04-discovery-answer-check.mjs';
import { computeMcpBundleSha256, gitRepositoryText } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function writeSanitizedSummary(summaryPath, summary, serverInstanceId) {
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error(
      'D04 summary output must stay inside the operating-system temporary directory.',
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
  const encodedArguments = values.get('--arguments-json');
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  if (
    values.get('--tool') !== D04_DISCOVERY_TOOL ||
    !encodedArguments ||
    !summaryPath ||
    !candidateSha ||
    !bundleSha256
  ) {
    throw new Error(
      'D04 accepts only its fixed anonymous query and exact-Candidate summary inputs.',
    );
  }
  if (
    !/^[0-9a-f]{40}$/u.test(candidateSha) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256) ||
    canonicalJson(JSON.parse(encodedArguments)) !== canonicalJson(D04_DISCOVERY_ARGUMENTS)
  ) {
    throw new Error('D04 fixed query or exact runtime hashes do not match.');
  }
  return { summaryPath, candidateSha, bundleSha256 };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === sourceRevision &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

function summarizeD04DiscoveryFacts(result) {
  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.items) ||
    !result.plan ||
    typeof result.plan !== 'object' ||
    !result.coverage ||
    typeof result.coverage !== 'object'
  )
    return null;
  const searchStep = Array.isArray(result.plan.steps)
    ? result.plan.steps.find(
        (step) => step?.kind === 'search' && step?.operation === 'searchSubjects',
      )
    : undefined;
  const filter = searchStep?.request?.filter || {};
  const episodeFilter = Array.isArray(result.plan.postFilters)
    ? result.plan.postFilters.find((item) => item?.field === 'reportedEpisodeCount')
    : undefined;
  const coverage = result.coverage;
  const counters = {};
  for (const field of [
    'requested',
    'scanned',
    'matched',
    'returned',
    'pagesRequested',
    'pagesScanned',
    'hydrationsAttempted',
    'hydrationsSucceeded',
    'hydrationsFailed',
    'hydrationsUnresolved',
    'outputCap',
  ]) {
    counters[field] =
      Number.isSafeInteger(coverage[field]) && coverage[field] >= 0 ? coverage[field] : null;
  }
  const validRows = result.items.filter(
    (item) =>
      item?.media === 'anime' &&
      Array.isArray(item.tags) &&
      item.tags.includes('科幻') &&
      Number.isSafeInteger(item.ratingCount) &&
      item.ratingCount >= 3001 &&
      Number.isSafeInteger(item.reportedEpisodeCount) &&
      item.reportedEpisodeCount >= 0 &&
      item.reportedEpisodeCount <= 12,
  ).length;
  return {
    resultState: typeof result.state === 'string' ? result.state : 'unknown',
    operation: result.plan.operation === 'searchSubjects' ? 'searchSubjects' : 'other',
    officialV0Plan: result.plan.source === 'official_v0',
    totalKind: ['exact', 'estimated', 'unknown'].includes(coverage.totalKind)
      ? coverage.totalKind
      : 'unknown',
    coverageState: ['complete', 'partial', 'unknown', 'not_applicable'].includes(coverage.state)
      ? coverage.state
      : 'unknown',
    counters,
    flags: {
      upstreamExhausted: coverage.upstreamExhausted === true,
      budgetExceeded: coverage.budgetExceeded === true,
      hydrationBudgetExceeded: coverage.hydrationBudgetExceeded === true,
    },
    queryChecks: {
      animeTypePushedDown:
        Array.isArray(filter.type) && filter.type.length === 1 && filter.type[0] === 2,
      exactScienceFictionTagPushedDown:
        Array.isArray(filter.tag) && filter.tag.length === 1 && filter.tag[0] === '科幻',
      strictRatingCountLowerBoundPushedDown:
        Array.isArray(filter.ratingCount) && filter.ratingCount.includes('>=3001'),
      reportedEpisodeMaximumIsLocal:
        episodeFilter?.classification === 'POST_FILTER' && episodeFilter?.value?.max === 12,
      reportedEpisodeWasNotSentUpstream: !Object.keys(filter).some((key) =>
        /episode|eps/iu.test(key),
      ),
    },
    rows: {
      observed: result.items.length,
      valid: validRows,
      withReportedEpisodeEvidence: result.items.filter(
        (item) =>
          Array.isArray(item?.evidence?.reportedEpisodeCount) &&
          item.evidence.reportedEpisodeCount.length > 0,
      ).length,
    },
    experimentalDisclosure:
      Array.isArray(result.plan.limitations) &&
      result.plan.limitations.some(
        (item) => typeof item === 'string' && /experimental/iu.test(item),
      ),
    reportedEpsDisclosure:
      Array.isArray(result.plan.limitations) &&
      result.plan.limitations.some(
        (item) => typeof item === 'string' && /subject\.eps/iu.test(item),
      ),
    warningCodes: Array.isArray(result.warnings)
      ? [
          ...new Set(
            result.warnings.map((item) => item?.code).filter((value) => typeof value === 'string'),
          ),
        ].slice(0, 20)
      : [],
  };
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  const serverInstanceId = randomUUID();
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key))
      delete process.env[key];
  }
  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === D04_DISCOVERY_TOOL);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('D04 only exposes its catalogued auth=none, risk=read tool.');
  }
  const sourceRevision = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    sourceRevision !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    !runtimeCandidateMatches(sourceRevision, bundleSha256)
  ) {
    throw new Error('D04 MCP server is not running the immutable exact Candidate bundle.');
  }
  const storage = new MemoryStorage();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10_000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), D04_DISCOVERY_TOOL);
  const mcpTool = { ...toMcpTool(tool), annotations: publicReadOnlyToolAnnotations(tool) };
  const descriptionSha256 = createHash('sha256').update(mcpTool.description, 'utf8').digest('hex');
  const inputSchemaSha256 = createHash('sha256')
    .update(canonicalJson(mcpTool.inputSchema), 'utf8')
    .digest('hex');
  const expectedArgumentsSha256 = createHash('sha256')
    .update(canonicalJson(D04_DISCOVERY_ARGUMENTS), 'utf8')
    .digest('hex');
  const server = new Server(
    { name: 'bangumi-d04-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  let allowedCalls = 0;
  let deniedCalls = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision,
    bundleSha256,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: D04_DISCOVERY_TOOL,
    toolDescriptionSha256: descriptionSha256,
    inputSchemaSha256,
    serverToolNames: [D04_DISCOVERY_TOOL],
    serverToolCount: 1,
    expectedArgumentsSha256,
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
      expectedTool: D04_DISCOVERY_TOOL,
      expectedArguments: D04_DISCOVERY_ARGUMENTS,
      completedCalls: allowedCalls,
    });
    if (
      !authorization.allowed ||
      !claimSingleToolCall(`${path.resolve(config.summaryPath)}.call-claimed`) ||
      !runtimeCandidateMatches(sourceRevision, bundleSha256)
    ) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [
          { type: 'text', text: `Rejected by D04 one-tool server: ${authorization.code}.` },
        ],
        isError: true,
      };
    }
    allowedCalls += 1;
    summary = { ...summary, allowedCallCount: allowedCalls, argumentMatch: true };
    writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(D04_DISCOVERY_TOOL, D04_DISCOVERY_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
        summary = { ...summary, serverResultStatus: 'ERROR', errorCode: 'CANDIDATE_DRIFT' };
        writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
        return {
          content: [{ type: 'text', text: 'D04 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        result: {
          ...summarizeToolResult(D04_DISCOVERY_TOOL, result),
          d04DiscoveryChecks: summarizeD04DiscoveryFacts(result),
        },
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      const presentation = presentMcpToolResult(D04_DISCOVERY_TOOL, result);
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      /* best effort */
    }
    try {
      await registry.close();
    } catch {
      /* best effort */
    }
    try {
      await storage.close();
    } catch {
      /* best effort */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('D04 one-tool MCP server could not start.\n');
    process.exitCode = 1;
  });
}
