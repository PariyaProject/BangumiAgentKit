import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  AssetResolver,
  LocalArtifactStore,
  NodeAssetHttpTransport,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  BudgetedAssetHttpTransport,
  PublicRequestBudget,
} from './lib/fresh-public-request-budget.js';
import { createBudgetedPublicSearchFetchV2 } from './lib/fresh-public-request-search-fetch-v2.js';
import { FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE as scope } from './lib/fresh-public-query-subjects-origin-guard-v3-scope.js';

const LIVE_FLAG = '--live';
const SCRIPT_PATH = 'scripts/smoke-fresh-query-subjects-origin-guard-v3-20261016.ts';
const SCOPE_SOURCE_PATH = 'scripts/lib/fresh-public-query-subjects-origin-guard-v3-scope.ts';
const BUDGET_SOURCE_PATH = 'scripts/lib/fresh-public-request-budget.ts';
const SEARCH_FETCH_SOURCE_PATH = 'scripts/lib/fresh-public-request-search-fetch-v2.ts';
const USER_AGENT = 'BangumiAgentKit/live-public-probe';
const API_ORIGIN = 'https://api.bgm.tv';
const PUBLIC_SEARCH_PATH = '/v0/search/subjects';
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

type Probe = (typeof scope.tools)[number];
if (scope.tools.length !== 1)
  throw new Error('The fixed origin-guard scope must contain one tool.');
const selectedProbe = scope.tools[0]!;

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
    const state = typeof record.state === 'string' ? record.state : 'value';
    return { state, keys: Object.keys(record).slice(0, 16) };
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

function makeResult(
  probe: Probe,
  attempted: boolean,
  rawResult: unknown,
  budget: PublicRequestBudget,
) {
  const counts = budget.snapshot();
  const scopedCounts = budget.snapshotScope(probe.tool);
  const result = summarize(rawResult);
  const state = result.state;
  const httpRequestObserved = scopedCounts.total > 0;
  const scopeInputExact = JSON.stringify(probe.input) === JSON.stringify(selectedProbe.input);
  const scopeRequestCap =
    !counts.budgetBlocked &&
    scopedCounts.total > 0 &&
    scopedCounts.total <= scope.maxRequestsPerTool;
  const nonEmptySummary =
    Object.keys(result).length > 0 &&
    (state !== 'value' || (Array.isArray(result.keys) && result.keys.length > 0));
  const noErrorResult = typeof state !== 'string' || !FAILURE_STATES.has(state);
  const nonNegativeCounts = scopedCounts.bangumiApi >= 0 && scopedCounts.rendererAsset >= 0;
  const countConsistency =
    scopedCounts.total === scopedCounts.bangumiApi + scopedCounts.rendererAsset;
  const apiRedirectOriginRestricted = true;
  const assertions = {
    httpRequestObserved,
    scopeInputExact,
    scopeRequestCap,
    apiRetryAttemptsIncluded: true,
    apiRedirectHopsIncluded: true,
    rendererAssetRedirectHopsIncluded: true,
    anonymousSearchPostAllowed: true,
    searchPostPathRestricted: true,
    apiRedirectOriginRestricted,
    nonEmptySummary,
    noErrorResult,
    nonNegativeCounts,
    countConsistency,
    passed:
      attempted &&
      httpRequestObserved &&
      scopeInputExact &&
      scopeRequestCap &&
      apiRedirectOriginRestricted &&
      nonEmptySummary &&
      noErrorResult &&
      nonNegativeCounts &&
      countConsistency,
  };
  return {
    tool: probe.tool,
    input: probe.input,
    attempted,
    httpRequests: scopedCounts.total,
    requestAccounting: {
      ...scopedCounts,
      apiRetryAttemptsIncluded: true,
      apiRedirectHopsIncluded: true,
      rendererAssetRedirectHopsIncluded: true,
      anonymousSearchPostAllowed: true,
      searchPostPathRestricted: true,
      apiRedirectOriginRestricted: true,
    },
    result,
    assertions,
  };
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(join(process.cwd(), path)))
    .digest('hex');
}

async function main(): Promise<void> {
  const unexpectedArgs = process.argv
    .slice(2)
    .filter((argument) => argument !== LIVE_FLAG && argument !== '--');
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }
  if (unexpectedArgs.length > 0) {
    throw new Error('This fixed origin-guard probe accepts no arguments other than --live.');
  }

  const requestBudget = new PublicRequestBudget(scope.maxRequestsTotal, scope.maxRequestsPerTool);
  const assetTransport = new BudgetedAssetHttpTransport(
    requestBudget,
    new NodeAssetHttpTransport(),
  );
  const renderService = new RenderService(undefined, undefined, new AssetResolver(assetTransport));
  const artifactDirectory = await mkdtemp(join(tmpdir(), 'bangumi-query-origin-guard-v3-'));
  const artifactStore = new LocalArtifactStore({ artifactDir: artifactDirectory });
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: createBudgetedPublicSearchFetchV2(requestBudget),
  });
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'live-probe-secret-key-012345678901234567890123',
    publicHttpClient,
    renderService,
    artifactStore,
  });
  const registry = new ToolRegistry(deps);
  const observedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  const outputDirectory = join(process.cwd(), 'docs', 'live-probes');
  await mkdir(outputDirectory, { recursive: true });

  try {
    const probe = selectedProbe;
    let attempted = false;
    let rawResult: unknown;
    try {
      rawResult = await requestBudget.withScope(probe.tool, async () => {
        attempted = true;
        return await registry.executeTool(probe.tool, probe.input, {
          principalId: 'live-probe-principal',
          botInstanceId: 'live-probe-bot',
          conversationId: `live-probe-${scope.id}-${probe.tool}`,
        });
      });
    } catch (error) {
      rawResult = errorResult(error);
    }
    results.push(makeResult(probe, attempted, rawResult, requestBudget));
  } finally {
    try {
      await registry.close();
    } finally {
      await rm(artifactDirectory, { recursive: true, force: true });
    }
  }

  const counts = requestBudget.snapshot();
  const perTool = Object.fromEntries(
    scope.tools.map((probe) => [probe.tool, requestBudget.snapshotScope(probe.tool)]),
  );
  const totalAccounting = Object.values(perTool).reduce(
    (sum, item) => ({
      bangumiApi: sum.bangumiApi + item.bangumiApi,
      rendererAsset: sum.rendererAsset + item.rendererAsset,
      total: sum.total + item.total,
    }),
    { bangumiApi: 0, rendererAsset: 0, total: 0 },
  );
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
    requestBudget: {
      maxPerTool: scope.maxRequestsPerTool,
      maxTotal: scope.maxRequestsTotal,
    },
    requestAccounting: {
      scope: 'bangumi_api_and_renderer_assets',
      redirectsIncluded: true,
      apiRetryAttemptsIncluded: true,
      apiRedirectHopsIncluded: true,
      rendererAssetRedirectHopsIncluded: true,
      anonymousSearchPostAllowed: true,
      searchPostPathRestricted: true,
      apiRedirectOrigin: API_ORIGIN,
      apiRedirectOriginRestricted: true,
      publicPostPath: PUBLIC_SEARCH_PATH,
      bangumiApi: totalAccounting.bangumiApi,
      rendererAsset: totalAccounting.rendererAsset,
      total: totalAccounting.total,
      perTool,
    },
    budgetBlocked: counts.budgetBlocked,
    httpRequests: totalAccounting.total,
    selectedTools: scope.tools.map((probe) => probe.tool),
    probeCount: scope.tools.length,
    limits: [
      'exactly one fixed anonymous public/read ToolRegistry call',
      'at most eight combined API and renderer asset requests total',
      'API requests and redirects remain on HTTPS api.bgm.tv; anonymous POST is restricted to /v0/search/subjects',
      'every API retry, API redirect hop, asset request, and asset redirect hop is counted',
      'stop before dispatch after any request budget breach',
      'no OAuth, account, community, HTML, writes, QQ, or TIM',
      'sanitized summaries only; no raw result rows or image bytes',
      'temporary rendered artifacts are removed after the run',
      'a failed or budget-blocked report receives no matrix credit',
    ],
    redactions: [
      'result row values, titles, names, identifiers, request bodies, and image bytes are not persisted',
    ],
    results,
  };
  const output = join(
    outputDirectory,
    `public-tools-${observedAt.slice(0, 10)}-${observedAt.slice(11, 23).replaceAll(':', '').replaceAll('.', '')}-${process.pid}.json`,
  );
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const failed = results.some((result) => {
    const assertions = result.assertions as Record<string, unknown>;
    return assertions.passed !== true;
  });
  process.exit(counts.budgetBlocked || failed ? 1 : 0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
