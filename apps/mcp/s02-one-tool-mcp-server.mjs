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
  readS02McpBundleAttestation,
} from '../../scripts/lib/s02-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_person_activity';
const EXPECTED_ARGUMENTS = {
  personId: 3474,
  rankingMode: 'top_rated_main_voice',
  media: 'all',
};

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--summary-file', '--candidate-sha', '--bundle-sha256'].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (values.has(key) || index + 1 >= argv.length) throw new Error(`Invalid ${key} argument.`);
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  if (!summaryPath || !candidateSha || !bundleSha256) {
    throw new Error('--summary-file, --candidate-sha, and --bundle-sha256 are required.');
  }
  if (!/^[0-9a-f]{40}$/u.test(candidateSha) || !/^[0-9a-f]{64}$/u.test(bundleSha256)) {
    throw new Error('Exact Candidate and built MCP bundle hashes are required.');
  }
  const absoluteSummaryPath = path.resolve(summaryPath);
  if (!absoluteSummaryPath.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) {
    throw new Error(
      'S02 summary output must stay inside the operating-system temporary directory.',
    );
  }
  return { summaryPath: absoluteSummaryPath, candidateSha, bundleSha256 };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === sourceRevision &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readS02McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

function writeSanitizedSummary(summaryPath, summary) {
  const temporary = `${summaryPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, summaryPath);
}

function summarizeRanking(result) {
  const ranking = result?.ranking;
  if (!ranking || ranking.mode !== 'top_rated_main_voice') return null;
  const coverageKeys = [
    'relationRowsObserved',
    'relationRowsSelected',
    'relationRowsDroppedAtLimit',
    'subjectDetailRequests',
    'subjectDetailsSucceeded',
    'subjectDetailsFailed',
    'subjectDetailIdsDroppedAtLimit',
    'unknownRoleRows',
    'missingRatingScoreSubjects',
    'rowsReturned',
    'truncated',
  ];
  const coverage = Object.fromEntries(
    coverageKeys.map((key) => [key, ranking.coverage?.[key] ?? null]),
  );
  const items = Array.isArray(ranking.items)
    ? ranking.items.slice(0, 5).map((item) => ({
        subjectId: Number.isInteger(item?.subjectId) ? item.subjectId : null,
        subjectName: typeof item?.subjectName === 'string' ? item.subjectName.slice(0, 160) : '',
        subjectNameCn:
          typeof item?.subjectNameCn === 'string' ? item.subjectNameCn.slice(0, 160) : '',
        ratingScore: Number.isFinite(item?.ratingScore) ? item.ratingScore : null,
        ratingTotal: Number.isFinite(item?.ratingTotal) ? item.ratingTotal : null,
        rawRoles: Array.isArray(item?.rawRoles)
          ? item.rawRoles
              .filter((role) => typeof role === 'string')
              .slice(0, 3)
              .map((role) => role.slice(0, 64))
          : [],
      }))
    : [];
  return {
    mode: ranking.mode,
    scope: ranking.scope,
    media: ranking.media,
    state: ranking.state,
    limit: ranking.limit,
    items,
    coverage,
  };
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }
  if (!runtimeCandidateMatches(config.candidateSha, config.bundleSha256)) {
    throw new Error('S02 MCP server is not running the immutable exact Candidate bundle.');
  }

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('S02 permits only the catalogued anonymous read-only activity tool.');
  }
  const storage = new MemoryStorage();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), TOOL_NAME);
  const mcpTool = {
    ...toMcpTool(tool),
    annotations: publicReadOnlyToolAnnotations(tool),
  };
  const descriptionSha256 = createHash('sha256').update(mcpTool.description, 'utf8').digest('hex');
  const inputSchemaSha256 = createHash('sha256')
    .update(canonicalJson(mcpTool.inputSchema), 'utf8')
    .digest('hex');
  const catalogSha256 = createHash('sha256').update(catalogBytes).digest('hex');
  const expectedArgumentsSha256 = createHash('sha256')
    .update(canonicalJson(EXPECTED_ARGUMENTS), 'utf8')
    .digest('hex');
  const server = new Server(
    { name: 'bangumi-codex-s02-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  let allowedCallCount = 0;
  let deniedCallCount = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 's02-one-tool-anonymous-public-v1',
    sourceRevision: config.candidateSha,
    bundleSha256: config.bundleSha256,
    catalogSha256,
    toolName: TOOL_NAME,
    toolDescriptionSha256: descriptionSha256,
    inputSchemaSha256,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    expectedArgumentsSha256,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount,
    deniedCallCount,
    argumentMatch: false,
    ranking: null,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      communityRead: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      credentialsStored: false,
    },
  };
  writeSanitizedSummary(config.summaryPath, summary);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const call = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: TOOL_NAME,
      expectedArguments: EXPECTED_ARGUMENTS,
      completedCalls: allowedCallCount,
    });
    if (
      !call.allowed ||
      !claimSingleToolCall(`${config.summaryPath}.call-claimed`) ||
      !runtimeCandidateMatches(config.candidateSha, config.bundleSha256)
    ) {
      deniedCallCount += 1;
      summary = { ...summary, deniedCallCount };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: 'Rejected by the fixed S02 one-tool query server.' }],
        isError: true,
      };
    }

    allowedCallCount += 1;
    summary = { ...summary, allowedCallCount, argumentMatch: true };
    writeSanitizedSummary(config.summaryPath, summary);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(TOOL_NAME, EXPECTED_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(config.candidateSha, config.bundleSha256)) {
        summary = { ...summary, serverResultStatus: 'ERROR', errorCode: 'CANDIDATE_DRIFT' };
        writeSanitizedSummary(config.summaryPath, summary);
        return {
          content: [{ type: 'text', text: 'S02 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        ranking: summarizeRanking(result),
      };
      writeSanitizedSummary(config.summaryPath, summary);
      const presentation = presentMcpToolResult(TOOL_NAME, result);
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
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: 'S02 public query failed.' }],
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
      /* Continue best-effort cleanup. */
    }
    try {
      await registry.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
    try {
      await storage.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('[s02-one-tool-mcp] startup or execution failed.\n');
    process.exitCode = 1;
  });
}
