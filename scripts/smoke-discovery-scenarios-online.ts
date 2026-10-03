import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  DISCOVERY_SCENARIOS,
  summarizeDiscoveryScenarioItems,
  validateDiscoveryScenarioItems,
  type DiscoveryScenarioId,
  type DiscoveryScenarioItem,
} from './discovery-scenario-cases.js';

const LIVE_FLAG = '--live';
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/discovery-scenario-probe';
const FAILED_STATES = new Set([
  'error',
  'unavailable',
  'unsupported',
  'auth_required',
  'permission_denied',
]);
const COVERAGE_FIELDS = [
  'state',
  'requested',
  'scanned',
  'matched',
  'returned',
  'pagesRequested',
  'pagesScanned',
  'upstreamExhausted',
  'budgetExceeded',
  'totalKind',
  'hydrationsAttempted',
  'hydrationsSucceeded',
  'hydrationsFailed',
  'hydrationsUnresolved',
  'hydrationBudgetExceeded',
] as const;

interface DiscoveryResultSummary {
  state: string;
  itemCount: number;
  items: DiscoveryScenarioItem[];
  warningCodes: string[];
  coverage: Record<string, string | number | boolean | null>;
  planSource: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function summarizeCoverage(value: unknown): Record<string, string | number | boolean | null> {
  const coverage = asRecord(value);
  if (!coverage) return {};
  return Object.fromEntries(
    COVERAGE_FIELDS.flatMap((field) => {
      const item = coverage[field];
      return typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean' ||
        item === null
        ? [[field, item]]
        : [];
    }),
  );
}

function summarizeResult(scenario: DiscoveryScenarioId, value: unknown): DiscoveryResultSummary {
  const result = asRecord(value);
  if (!result)
    return {
      state: 'unavailable_shape',
      itemCount: 0,
      items: [],
      warningCodes: [],
      coverage: {},
      planSource: null,
    };
  const items = summarizeDiscoveryScenarioItems(scenario, result.items);
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const warningCodes = warnings
    .flatMap((warning) => {
      const code = asRecord(warning)?.code;
      return typeof code === 'string' ? [code] : [];
    })
    .slice(0, 20);
  return {
    state: typeof result.state === 'string' ? result.state : 'unknown',
    itemCount: items.length,
    items,
    warningCodes,
    coverage: summarizeCoverage(result.coverage),
    planSource: asRecord(result.plan)?.source ?? null,
  };
}

function validateResult(
  scenario: DiscoveryScenarioId,
  result: ReturnType<typeof summarizeResult>,
  httpRequests: number,
) {
  const itemChecks = validateDiscoveryScenarioItems(scenario, result.items);
  const coverage = result.coverage;
  const coverageReported =
    typeof coverage.state === 'string' &&
    typeof coverage.returned === 'number' &&
    typeof coverage.totalKind === 'string';
  const coverageConsistent =
    coverageReported &&
    coverage.returned === result.itemCount &&
    typeof coverage.scanned === 'number' &&
    coverage.scanned >= result.itemCount;
  const stateSuccessful = !FAILED_STATES.has(result.state);
  const checks = {
    httpRequestObserved: httpRequests > 0,
    stateSuccessful,
    officialSource: result.planSource === 'official_v0',
    coverageReported,
    coverageConsistent,
    estimatedSearchTotal: coverage.totalKind === 'estimated',
    ...itemChecks,
  };
  return { ...checks, passed: Object.values(checks).every(Boolean) };
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing public API requests without ${LIVE_FLAG}.`);
  }
  let requestCount = 0;
  const client = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      requestCount += 1;
      return await fetch(input, init);
    },
  });
  const storage = new MemoryStorage();
  const registry = new ToolRegistry(
    createRuntimeDependenciesWithStorage(storage, {
      secretKey: 'discovery-scenario-probe-secret-key-0123456789',
      publicHttpClient: client,
    }),
  );
  const startedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const [index, scenario] of (
      Object.keys(DISCOVERY_SCENARIOS) as DiscoveryScenarioId[]
    ).entries()) {
      const before = requestCount;
      let rawResult: unknown;
      let failureClass: string | undefined;
      try {
        rawResult = await registry.executeTool(
          'bangumi.query_subjects',
          DISCOVERY_SCENARIOS[scenario].query as unknown as Record<string, unknown>,
          {
            principalId: 'discovery-scenario-probe',
            botInstanceId: 'discovery-scenario-probe',
            conversationId: `discovery-scenario-${scenario}`,
          },
        );
      } catch (error) {
        failureClass = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      }
      const httpRequests = requestCount - before;
      const summary = summarizeResult(scenario, rawResult);
      const assertions = validateResult(scenario, summary, httpRequests);
      results.push({
        scenario,
        tool: 'bangumi.query_subjects',
        query: DISCOVERY_SCENARIOS[scenario].query,
        querySha256: createHash('sha256')
          .update(JSON.stringify(DISCOVERY_SCENARIOS[scenario].query))
          .digest('hex'),
        httpRequests,
        ...(failureClass === undefined ? {} : { failureClass }),
        result: summary,
        assertions,
      });
      if (index < Object.keys(DISCOVERY_SCENARIOS).length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  } finally {
    await registry.close();
  }

  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_public_discovery_scenarios_tool_registry',
    observedAt: startedAt,
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    catalogSha256: createHash('sha256')
      .update(await readFile(join(process.cwd(), 'docs', 'tool-catalog.json')))
      .digest('hex'),
    probeScriptSha256: createHash('sha256')
      .update(await readFile(join(process.cwd(), 'scripts', 'smoke-discovery-scenarios-online.ts')))
      .digest('hex'),
    sourceProgram: 'scripts/smoke-discovery-scenarios-online.ts',
    mode: 'read_only_public_api_scenario_smoke',
    userAgent: USER_AGENT,
    httpRequests: requestCount,
    scenarioCount: results.length,
    qqPipelineTested: false,
    timClientTested: false,
    redactions: [
      'tool answer prose and work titles omitted; only public IDs, filter fields, coverage and bounded numeric fields retained',
    ],
    results,
  };
  const timestamp = startedAt
    .slice(0, 19)
    .replaceAll(':', '')
    .replaceAll('-', '')
    .replace('T', '-');
  const output = join(
    process.cwd(),
    'docs',
    'live-probes',
    `discovery-scenarios-${timestamp}-${process.pid}.json`,
  );
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        output,
        sourceRevision: report.sourceRevision,
        scenarios: results.map((item) => ({
          scenario: item.scenario,
          passed: (item.assertions as Record<string, unknown>).passed,
          httpRequests: item.httpRequests,
          itemCount: (item.result as Record<string, unknown>).itemCount,
          coverage: (item.result as Record<string, unknown>).coverage,
        })),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(
    results.every((item) => (item.assertions as Record<string, unknown>).passed === true) ? 0 : 1,
  );
}

main().catch(() => {
  process.stderr.write(
    'Public discovery scenario probe failed before a verified report was written.\n',
  );
  process.exit(1);
});
