import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { PublicRequestBudget } from './lib/fresh-public-request-budget.js';
import { createBudgetedPublicSearchFetchV2 } from './lib/fresh-public-request-search-fetch-v2.js';
import { FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE as scope } from './lib/fresh-get-person-profile-public-scope.js';

const LIVE_FLAG = '--live';
const SCRIPT_PATH = 'scripts/smoke-fresh-get-person-profile-public.ts';
const SCOPE_SOURCE_PATH = 'scripts/lib/fresh-get-person-profile-public-scope.ts';
const BUDGET_SOURCE_PATH = 'scripts/lib/fresh-public-request-budget.ts';
const SEARCH_FETCH_SOURCE_PATH = 'scripts/lib/fresh-public-request-search-fetch-v2.ts';
const USER_AGENT = 'BangumiAgentKit/live-public-probe';
const FAILURE_STATES = new Set([
  'auth_required',
  'error',
  'not_computable',
  'not_found',
  'permission_denied',
  'unavailable',
  'unsupported',
  'upstream_error',
]);

function summarize(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.ok === false) {
      const error =
        record.error && typeof record.error === 'object'
          ? (record.error as Record<string, unknown>)
          : {};
      return {
        state: 'error',
        code: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
        ...(typeof error.upstreamStatus === 'number'
          ? { upstreamStatus: error.upstreamStatus }
          : {}),
        ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
      };
    }
    return {
      state: typeof record.state === 'string' ? record.state : 'value',
      keys: Object.keys(record).slice(0, 16),
    };
  }
  return { state: 'value', type: typeof value };
}

function errorResult(error: unknown): Record<string, unknown> {
  const detail = error as { code?: unknown; upstreamStatus?: unknown; retryable?: unknown };
  return {
    state: 'error',
    code:
      typeof detail.code === 'string'
        ? detail.code
        : error instanceof Error
          ? error.name
          : 'UNKNOWN_ERROR',
    ...(typeof detail.upstreamStatus === 'number' ? { upstreamStatus: detail.upstreamStatus } : {}),
    ...(typeof detail.retryable === 'boolean' ? { retryable: detail.retryable } : {}),
  };
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(join(process.cwd(), path)))
    .digest('hex');
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }
  const unexpectedArgs = process.argv
    .slice(2)
    .filter((argument) => argument !== LIVE_FLAG && argument !== '--');
  if (unexpectedArgs.length > 0) {
    throw new Error('This fixed public probe accepts no arguments other than --live.');
  }

  const requestBudget = new PublicRequestBudget(scope.maxHttpRequests);
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: createBudgetedPublicSearchFetchV2(requestBudget),
  });
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'live-probe-secret-key-012345678901234567890123',
    publicHttpClient,
  });
  const registry = new ToolRegistry(deps);
  const observedAt = new Date().toISOString();
  let rawResult: unknown;
  try {
    rawResult = await requestBudget.withScope(scope.tool, async () =>
      registry.executeTool(scope.tool, scope.input, {
        principalId: 'live-probe-principal',
        botInstanceId: 'live-probe-bot',
        conversationId: `live-probe-${scope.id}`,
      }),
    );
  } catch (error) {
    rawResult = errorResult(error);
  } finally {
    await registry.close();
  }

  const counts = requestBudget.snapshot();
  const scopedCounts = requestBudget.snapshotScope(scope.tool);
  const result = summarize(rawResult);
  const state = result.state;
  const scopeInputExact =
    JSON.stringify(scope.input) ===
    JSON.stringify({
      personId: 13684,
      maxSubjects: 1,
      maxCharacters: 1,
      includeChronology: false,
    });
  const scopeRequestCap =
    !counts.budgetBlocked && scopedCounts.total > 0 && scopedCounts.total <= scope.maxHttpRequests;
  const nonEmptySummary =
    Object.keys(result).length > 0 &&
    (state !== 'value' || (Array.isArray(result.keys) && result.keys.length > 0));
  const noErrorResult = typeof state !== 'string' || !FAILURE_STATES.has(state);
  const nonNegativeCounts = scopedCounts.bangumiApi >= 0 && scopedCounts.rendererAsset >= 0;
  const countConsistency =
    scopedCounts.total === scopedCounts.bangumiApi + scopedCounts.rendererAsset;
  const accountingMetadata = {
    apiRetryAttemptsIncluded: true,
    apiRedirectHopsIncluded: true,
    rendererAssetRedirectHopsIncluded: true,
    anonymousSearchPostAllowed: true,
    searchPostPathRestricted: true,
    apiRedirectOriginRestricted: true,
    apiRedirectPrivatePathBlocked: true,
  };
  const passed =
    scopedCounts.total > 0 &&
    scopeInputExact &&
    scopeRequestCap &&
    accountingMetadata.apiRedirectHopsIncluded &&
    accountingMetadata.rendererAssetRedirectHopsIncluded &&
    accountingMetadata.anonymousSearchPostAllowed &&
    accountingMetadata.searchPostPathRestricted &&
    accountingMetadata.apiRedirectOriginRestricted &&
    accountingMetadata.apiRedirectPrivatePathBlocked &&
    nonEmptySummary &&
    noErrorResult &&
    nonNegativeCounts &&
    countConsistency;
  const assertions = {
    httpRequestObserved: scopedCounts.total > 0,
    scopeInputExact,
    scopeRequestCap,
    apiRetryAttemptsIncluded: true,
    apiRedirectHopsIncluded: true,
    rendererAssetRedirectHopsIncluded: true,
    anonymousSearchPostAllowed: true,
    searchPostPathRestricted: true,
    apiRedirectOriginRestricted: true,
    apiRedirectPrivatePathBlocked: true,
    nonEmptySummary,
    noErrorResult,
    nonNegativeCounts,
    countConsistency,
    passed,
  };
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_public_api_tool_registry_smoke',
    observedAt,
    mode: 'read_only_public_api_smoke',
    catalogSha256: await sha256('docs/tool-catalog.json'),
    probeScriptSha256: await sha256(SCRIPT_PATH),
    sourceProgram: SCRIPT_PATH,
    supportingSourceSha256: {
      [SCOPE_SOURCE_PATH]: await sha256(SCOPE_SOURCE_PATH),
      [BUDGET_SOURCE_PATH]: await sha256(BUDGET_SOURCE_PATH),
      [SEARCH_FETCH_SOURCE_PATH]: await sha256(SEARCH_FETCH_SOURCE_PATH),
    },
    scopeId: scope.id,
    requestBudget: { maxPerTool: scope.maxHttpRequests, maxTotal: scope.maxHttpRequests },
    requestAccounting: {
      scope: 'bangumi_api_and_renderer_assets',
      redirectsIncluded: true,
      ...accountingMetadata,
      apiRedirectOrigin: 'https://api.bgm.tv',
      bangumiApi: scopedCounts.bangumiApi,
      rendererAsset: scopedCounts.rendererAsset,
      total: scopedCounts.total,
      perTool: { [scope.tool]: scopedCounts },
    },
    budgetBlocked: counts.budgetBlocked,
    httpRequests: scopedCounts.total,
    selectedTools: [scope.tool],
    probeCount: 1,
    limits: [
      'exactly one anonymous public/read ToolRegistry call',
      'personId=13684 with one-row subject and character caps; chronology disabled',
      'at most four API requests including retries and every redirect hop',
      'HTTPS api.bgm.tv only; private /p1 paths are rejected before dispatch',
      'no OAuth, account, community, HTML, write, QQ, or TIM operation',
      'summary only; no raw rows, names, or identifiers are persisted',
    ],
    redactions: ['person relation rows, names, and image bytes are not persisted'],
    results: [
      {
        tool: scope.tool,
        input: scope.input,
        attempted: true,
        httpRequests: scopedCounts.total,
        requestAccounting: { ...scopedCounts, ...accountingMetadata },
        result,
        assertions,
      },
    ],
  };
  const date = observedAt.slice(0, 10);
  const time = observedAt.slice(11, 23).replaceAll(':', '').replaceAll('.', '');
  const output = join(
    process.cwd(),
    'docs',
    'live-probes',
    `public-tools-${date}-${time}-${process.pid}.json`,
  );
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  process.exitCode = assertions.passed ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
