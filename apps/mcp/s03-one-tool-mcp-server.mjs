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
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { S03_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/s03-agent-answer-check.mjs';
import {
  computeMcpBundleSha256,
  readS03McpBundleAttestation,
} from '../../scripts/lib/s03-mcp-bundle.mjs';
import {
  captureS03ServerResult,
  claimS03ServerCall,
  verifyS03ServerAuthorization,
} from '../../scripts/lib/s03-one-shot-authorization.mjs';
import { gitRepositoryText } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_series_watch_order';

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (
      ![
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
        '--base-sha',
        '--reviewer-id',
        '--claim-path',
        '--authorization-token',
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
  const baseSha = values.get('--base-sha');
  const reviewerId = values.get('--reviewer-id');
  const claimPath = values.get('--claim-path');
  const authorizationToken = values.get('--authorization-token');
  if (
    !summaryPath ||
    !candidateSha ||
    !bundleSha256 ||
    !baseSha ||
    !reviewerId ||
    !claimPath ||
    !authorizationToken
  ) {
    throw new Error(
      '--summary-file, --candidate-sha, --bundle-sha256, --base-sha, --reviewer-id, --claim-path, and --authorization-token are required.',
    );
  }
  if (
    !/^[0-9a-f]{40}$/u.test(candidateSha) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256) ||
    !/^[0-9a-f]{40}$/u.test(baseSha) ||
    !/^gpt-6-luna-max-run95-s03-pr\d+-round[1-6]$/u.test(reviewerId) ||
    !/^[0-9a-f]{64}$/u.test(authorizationToken)
  ) {
    throw new Error('Exact Candidate, MCP bundle, and one-shot authorization tokens are required.');
  }
  const absoluteSummaryPath = path.resolve(summaryPath);
  if (!absoluteSummaryPath.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) {
    throw new Error(
      'S03 summary output must stay inside the operating-system temporary directory.',
    );
  }
  return {
    summaryPath: absoluteSummaryPath,
    candidateSha,
    bundleSha256,
    baseSha,
    reviewerId,
    claimPath: path.resolve(claimPath),
    authorizationToken,
  };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    return (
      gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) === sourceRevision &&
      gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256 &&
      readS03McpBundleAttestation(PRODUCT_ROOT) === bundleSha256
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

function summarizeVoiceActorPresence(result) {
  const presence = result?.voiceActorPresence;
  if (!presence) return null;
  return {
    personId: presence.personId,
    state: presence.state,
    matchStatus: presence.matchStatus,
    distinctWorks: presence.distinctWorks,
    subjectIds: Array.isArray(presence.works)
      ? presence.works.map((work) => work.subjectId).filter(Number.isInteger)
      : [],
    characterIds: Array.isArray(presence.works)
      ? presence.works.flatMap((work) =>
          (Array.isArray(work.credits) ? work.credits : [])
            .map((credit) => credit?.characterId)
            .filter(Number.isInteger),
        )
      : [],
    coverage: presence.coverage
      ? {
          relationRowsObserved: presence.coverage.relationRowsObserved,
          eligibleDirectAnimeWorksObserved: presence.coverage.eligibleDirectAnimeWorksObserved,
          eligibleDirectAnimeWorksSelected: presence.coverage.eligibleDirectAnimeWorksSelected,
          eligibleDirectAnimeWorksOmitted: presence.coverage.eligibleDirectAnimeWorksOmitted,
          personRowsObserved: presence.coverage.personRowsObserved,
          personRowsReturned: presence.coverage.personRowsReturned,
          personRowsOmitted: presence.coverage.personRowsOmitted,
          matchedCreditRows: presence.coverage.matchedCreditRows,
          duplicateRows: presence.coverage.duplicateRows,
          schemaDriftRows: presence.coverage.schemaDriftRows,
          maxRelatedAnimeWorks: presence.coverage.maxRelatedAnimeWorks,
          maxVoiceCredits: presence.coverage.maxVoiceCredits,
          maxResponseBytes: presence.coverage.maxResponseBytes,
          truncated: presence.coverage.truncated,
        }
      : null,
    sourceOperationStatus: presence.sourceOperation?.status ?? 'unavailable',
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
    throw new Error('S03 MCP server is not running the immutable exact Candidate bundle.');
  }
  const expectedArgumentsSha256 = createHash('sha256')
    .update(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS), 'utf8')
    .digest('hex');
  const claim = verifyS03ServerAuthorization(config.claimPath, config.authorizationToken, {
    sourceRevision: config.candidateSha,
    bundleSha256: config.bundleSha256,
    expectedArgumentsSha256,
    baseSha: config.baseSha,
    reviewerId: config.reviewerId,
  });

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('S03 permits only the catalogued anonymous read-only series tool.');
  }
  const storage = new MemoryStorage();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), TOOL_NAME);
  const mcpTool = {
    ...toMcpTool(tool),
    annotations: publicReadOnlyToolAnnotations(tool),
  };
  const toolDescriptionSha256 = createHash('sha256')
    .update(mcpTool.description, 'utf8')
    .digest('hex');
  const inputSchemaSha256 = createHash('sha256')
    .update(canonicalJson(mcpTool.inputSchema), 'utf8')
    .digest('hex');
  const catalogSha256 = createHash('sha256').update(catalogBytes).digest('hex');
  const server = new Server(
    { name: 'bangumi-codex-s03-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  let allowedCallCount = 0;
  let deniedCallCount = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 's03-one-tool-anonymous-public-v1',
    sourceRevision: config.candidateSha,
    bundleSha256: config.bundleSha256,
    claimAuthorizationStatus: 'valid',
    serverCallClaimStatus: 'not_claimed',
    claimSourceRevision: claim.sourceRevision,
    claimBundleSha256: claim.bundleSha256,
    claimBaseSha: claim.baseSha,
    claimReviewerId: claim.reviewerId,
    catalogSha256,
    toolName: TOOL_NAME,
    toolDescriptionSha256,
    inputSchemaSha256,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    expectedArgumentsSha256,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount,
    deniedCallCount,
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
      expectedArguments: S03_EXPECTED_QUERY_ARGUMENTS,
      completedCalls: allowedCallCount,
    });
    let oneShotClaimed = false;
    try {
      oneShotClaimed =
        call.allowed &&
        runtimeCandidateMatches(config.candidateSha, config.bundleSha256) &&
        claimS03ServerCall(config.claimPath, config.authorizationToken, {
          sourceRevision: config.candidateSha,
          bundleSha256: config.bundleSha256,
          expectedArgumentsSha256,
          baseSha: config.baseSha,
          reviewerId: config.reviewerId,
        });
    } catch {
      oneShotClaimed = false;
    }
    if (!oneShotClaimed) {
      deniedCallCount += 1;
      summary = { ...summary, deniedCallCount };
      writeSanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: 'Rejected by the fixed S03 one-tool query server.' }],
        isError: true,
      };
    }

    allowedCallCount += 1;
    summary = {
      ...summary,
      allowedCallCount,
      argumentMatch: true,
      serverCallClaimStatus: 'claimed',
    };
    writeSanitizedSummary(config.summaryPath, summary);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(TOOL_NAME, S03_EXPECTED_QUERY_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(config.candidateSha, config.bundleSha256)) {
        summary = { ...summary, serverResultStatus: 'ERROR', errorCode: 'CANDIDATE_DRIFT' };
        writeSanitizedSummary(config.summaryPath, summary);
        captureS03ServerResult(config.claimPath, config.authorizationToken, summary);
        return {
          content: [{ type: 'text', text: 'S03 result rejected because the Candidate changed.' }],
          isError: true,
        };
      }
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        result: {
          subjectId: result?.subjectId ?? null,
          state: result?.state ?? 'unavailable',
          voiceActorPresence: summarizeVoiceActorPresence(result),
        },
      };
      writeSanitizedSummary(config.summaryPath, summary);
      captureS03ServerResult(config.claimPath, config.authorizationToken, summary);
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
      try {
        captureS03ServerResult(config.claimPath, config.authorizationToken, summary);
      } catch {
        /* The consumed global call lock still prevents any retry. */
      }
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

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `[codex-one-tool-mcp] ${error instanceof Error ? error.message : 'startup error'}`,
    );
    process.exitCode = 1;
  });
}
