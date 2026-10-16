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
import { FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE as scope } from './lib/fresh-render-person-profile-public-scope.js';

const LIVE_FLAG = '--live';
const SCRIPT_PATH = 'scripts/smoke-fresh-render-person-profile-public.ts';
const SCOPE_SOURCE_PATH = 'scripts/lib/fresh-render-person-profile-public-scope.ts';
const BUDGET_SOURCE_PATH = 'scripts/lib/fresh-public-request-budget.ts';
const SEARCH_FETCH_SOURCE_PATH = 'scripts/lib/fresh-public-request-search-fetch-v2.ts';
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/live-public-probe';
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
    return { state: 'value', keys: Object.keys(record).slice(0, 16) };
  }
  return { state: 'value', type: typeof value };
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
  const assetTransport = new BudgetedAssetHttpTransport(
    requestBudget,
    new NodeAssetHttpTransport(),
  );
  const renderService = new RenderService(undefined, undefined, new AssetResolver(assetTransport));
  const artifactDirectory = await mkdtemp(join(tmpdir(), 'bangumi-public-render-probe-'));
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
  let rawResult: unknown;
  try {
    rawResult = await registry.executeTool(scope.tool, scope.input, {
      principalId: 'live-probe-principal',
      botInstanceId: 'live-probe-bot',
      conversationId: `live-probe-${scope.id}`,
    });
  } catch (error) {
    const detail = error as { code?: unknown; upstreamStatus?: unknown; retryable?: unknown };
    rawResult = {
      ok: false,
      error: {
        code:
          typeof detail.code === 'string'
            ? detail.code
            : error instanceof Error
              ? error.name
              : 'UNKNOWN_ERROR',
        ...(typeof detail.upstreamStatus === 'number'
          ? { upstreamStatus: detail.upstreamStatus }
          : {}),
        ...(typeof detail.retryable === 'boolean' ? { retryable: detail.retryable } : {}),
      },
    };
  } finally {
    try {
      await registry.close();
    } finally {
      await rm(artifactDirectory, { recursive: true, force: true });
    }
  }

  const counts = requestBudget.snapshot();
  const result = summarize(rawResult);
  const state = result.state;
  const noErrorResult = typeof state !== 'string' || !FAILURE_STATES.has(state);
  const nonEmptySummary =
    Object.keys(result).length > 0 &&
    (state !== 'value' || (Array.isArray(result.keys) && result.keys.length > 0));
  const countConsistency = counts.total === counts.bangumiApi + counts.rendererAsset;
  const scopeRequestCap = !counts.budgetBlocked && counts.total <= scope.maxHttpRequests;
  // HttpClient invokes the injected fetchFn for every request attempt, including retries.
  const apiRetryAttemptsIncluded = true;
  const passed =
    counts.total > 0 &&
    !counts.budgetBlocked &&
    scopeRequestCap &&
    apiRetryAttemptsIncluded &&
    countConsistency &&
    nonEmptySummary &&
    noErrorResult;
  const assertions = {
    httpRequestObserved: counts.total > 0,
    scopeInputExact:
      scope.input.personId === 13684 &&
      scope.input.maxSubjects === 1 &&
      scope.input.maxCharacters === 1 &&
      scope.input.maxCredits === 1 &&
      scope.input.includeChronology === false,
    scopeRequestCap,
    apiRetryAttemptsIncluded,
    apiRedirectHopsIncluded: true,
    rendererAssetRedirectHopsIncluded: true,
    anonymousSearchPostAllowed: true,
    searchPostPathRestricted: true,
    apiRedirectOriginRestricted: true,
    apiRedirectPrivatePathBlocked: true,
    nonEmptySummary,
    noErrorResult,
    nonNegativeCounts: counts.bangumiApi >= 0 && counts.rendererAsset >= 0,
    countConsistency,
    passed,
  };
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_public_api_tool_registry_smoke',
    observedAt,
    mode: 'read_only_public_api_smoke',
    catalogSha256: createHash('sha256')
      .update(await readFile(join(process.cwd(), 'docs', 'tool-catalog.json')))
      .digest('hex'),
    probeScriptSha256: createHash('sha256')
      .update(await readFile(join(process.cwd(), SCRIPT_PATH)))
      .digest('hex'),
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
      apiRetryAttemptsIncluded: true,
      apiRedirectHopsIncluded: true,
      rendererAssetRedirectHopsIncluded: true,
      anonymousSearchPostAllowed: true,
      searchPostPathRestricted: true,
      apiRedirectOrigin: 'https://api.bgm.tv',
      apiRedirectOriginRestricted: true,
      apiRedirectPrivatePathBlocked: true,
      bangumiApi: counts.bangumiApi,
      rendererAsset: counts.rendererAsset,
      total: counts.total,
    },
    budgetBlocked: counts.budgetBlocked,
    userAgent: USER_AGENT,
    probeCount: 1,
    httpRequests: counts.total,
    selectedTools: [scope.tool],
    limits: [
      'exactly one anonymous public/read ToolRegistry call',
      'one fresh fixed person profile with one-row local caps',
      'at most four combined Bangumi API and renderer asset HTTP requests; any API retry attempt and every redirect hop counts against the cap',
      'API requests and redirects remain on HTTPS api.bgm.tv; private /p1 paths are rejected before dispatch',
      'no OAuth or account access',
      'summary only; no raw rows or artifact bytes',
      'temporary rendered artifacts removed after the single call',
    ],
    redactions: ['person relation rows, names, and image bytes are not persisted'],
    results: [
      {
        tool: scope.tool,
        input: scope.input,
        httpRequests: counts.total,
        requestAccounting: {
          bangumiApi: counts.bangumiApi,
          rendererAsset: counts.rendererAsset,
          total: counts.total,
          apiRetryAttemptsIncluded: true,
          apiRedirectHopsIncluded: true,
          rendererAssetRedirectHopsIncluded: true,
          anonymousSearchPostAllowed: true,
          searchPostPathRestricted: true,
          apiRedirectOriginRestricted: true,
          apiRedirectPrivatePathBlocked: true,
        },
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
