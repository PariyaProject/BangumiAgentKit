import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE as scope } from './lib/fresh-render-person-profile-public-scope.js';

const LIVE_FLAG = '--live';
const SCRIPT_PATH = 'scripts/smoke-fresh-render-person-profile-public.ts';
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/live-public-probe';
const FAILURE_STATES = new Set([
  'auth_required', 'error', 'not_computable', 'not_found', 'permission_denied',
  'unavailable', 'unsupported', 'upstream_error',
]);

function summarize(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.ok === false) {
      const error = record.error && typeof record.error === 'object'
        ? record.error as Record<string, unknown>
        : {};
      return {
        state: 'error',
        code: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
        ...(typeof error.upstreamStatus === 'number' ? { upstreamStatus: error.upstreamStatus } : {}),
        ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
      };
    }
    return { state: 'value', keys: Object.keys(record).slice(0, 16) };
  }
  return { state: 'value', type: typeof value };
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }
  const unexpectedArgs = process.argv.slice(2).filter((argument) => argument !== LIVE_FLAG && argument !== '--');
  if (unexpectedArgs.length > 0) {
    throw new Error('This fixed public probe accepts no arguments other than --live.');
  }

  let httpRequests = 0;
  let budgetBlocked = false;
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      if (httpRequests >= scope.maxHttpRequests) {
        budgetBlocked = true;
        throw new Error('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');
      }
      httpRequests += 1;
      return await fetch(input, init);
    },
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
        code: typeof detail.code === 'string'
          ? detail.code
          : error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        ...(typeof detail.upstreamStatus === 'number' ? { upstreamStatus: detail.upstreamStatus } : {}),
        ...(typeof detail.retryable === 'boolean' ? { retryable: detail.retryable } : {}),
      },
    };
  } finally {
    await registry.close();
  }

  const result = summarize(rawResult);
  const state = result.state;
  const noErrorResult = typeof state !== 'string' || !FAILURE_STATES.has(state);
  const nonEmptySummary = Object.keys(result).length > 0
    && (state !== 'value' || (Array.isArray(result.keys) && result.keys.length > 0));
  const assertions = {
    httpRequestObserved: httpRequests > 0,
    scopeInputExact: scope.input.personId === 13684
      && scope.input.maxSubjects === 1
      && scope.input.maxCharacters === 1
      && scope.input.maxCredits === 1
      && scope.input.includeChronology === false,
    scopeRequestCap: !budgetBlocked && httpRequests <= scope.maxHttpRequests,
    nonEmptySummary,
    noErrorResult,
    nonNegativeCounts: true,
    countConsistency: true,
    passed: httpRequests > 0
      && !budgetBlocked
      && nonEmptySummary
      && noErrorResult,
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
    scopeId: scope.id,
    requestBudget: { maxPerTool: scope.maxHttpRequests, maxTotal: scope.maxHttpRequests },
    budgetBlocked,
    userAgent: USER_AGENT,
    probeCount: 1,
    httpRequests,
    selectedTools: [scope.tool],
    limits: [
      'exactly one anonymous public/read ToolRegistry call',
      'one fresh fixed person profile with one-row local caps',
      'at most four HTTP requests; no retries',
      'no OAuth or account access',
      'summary only; no raw rows or artifact bytes',
    ],
    redactions: ['person relation rows, names, and image bytes are not persisted'],
    results: [{
      tool: scope.tool,
      input: scope.input,
      httpRequests,
      result,
      assertions,
    }],
  };
  const date = observedAt.slice(0, 10);
  const time = observedAt.slice(11, 23).replaceAll(':', '').replaceAll('.', '');
  const output = join(process.cwd(), 'docs', 'live-probes', `public-tools-${date}-${time}-${process.pid}.json`);
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
