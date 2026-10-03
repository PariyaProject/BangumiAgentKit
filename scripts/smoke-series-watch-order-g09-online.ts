import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { SeriesService, SubjectService } from '@bangumi-agent-kit/bangumi-core';

const G09_QUERY = '少女終末旅行';
const EXPECTED_ROOT_ID = 218707;
const EXPECTED_DERIVATIVE_ID = 227245;
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/live-public-probe';

async function main(): Promise<void> {
  let httpRequests = 0;
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      httpRequests += 1;
      return await fetch(input, init);
    },
  });
  const startedAt = new Date().toISOString();
  const subjectService = new SubjectService(publicHttpClient);
  const search = await subjectService.searchSubjects(G09_QUERY, { type: 2, limit: 50, offset: 0 });
  const exactMatches = search.items.filter(
    (item) => item.nameCn === '少女终末旅行' || item.name === G09_QUERY,
  );
  if (exactMatches.length !== 1 || exactMatches[0]?.type !== 'anime') {
    throw new Error(`Expected one exact G09 anime match; observed ${exactMatches.length}.`);
  }
  const root = exactMatches[0];
  if (root.id !== EXPECTED_ROOT_ID) {
    throw new Error(`G09 public search resolved to an unexpected root ID (${root.id}).`);
  }

  const result = await new SeriesService(publicHttpClient).getSeriesWatchOrder(root.id, {
    depth: 2,
    maxNodes: 8,
    media: 'anime',
  });
  const exactDerivative = result.related.find((item) => item.id === EXPECTED_DERIVATIVE_ID);
  const assertions = {
    exactScenarioRootResolved: root.id === EXPECTED_ROOT_ID,
    animeRootObserved: result.root.id === EXPECTED_ROOT_ID && result.root.type === 'anime',
    rootIsFirstStep:
      result.watchOrder[0]?.id === EXPECTED_ROOT_ID && result.watchOrder[0]?.placement === 'root',
    directDerivativeIncluded:
      exactDerivative?.includedInWatchOrder === true &&
      exactDerivative.relationLabels.includes('衍生'),
    nonAnimeRelationsExplicitlyExcluded: result.excluded.byReason.some(
      (item) => item.reason === 'media_type_not_anime' && item.count === 8,
    ),
    boundedCoverageRecorded:
      result.coverage.depth === 2 &&
      result.coverage.maxNodes === 8 &&
      result.coverage.relationRequests === 2 &&
      result.coverage.relationRowsObserved === 10,
    noncanonicalOrderLimitationPresent: result.limitations.some(
      (limitation) => limitation.includes('没有发布统一的官方观看顺序'),
    ),
  };
  const passed = Object.values(assertions).every(Boolean);
  if (!passed) throw new Error(`G09 public probe assertion failed: ${JSON.stringify(assertions)}`);

  const catalogBytes = await readFile(join(process.cwd(), 'docs', 'tool-catalog.json'));
  const scriptBytes = await readFile(
    join(process.cwd(), 'scripts', 'smoke-series-watch-order-g09-online.ts'),
  );
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_public_series_watch_order_scenario_smoke',
    observedAt: startedAt,
    retrievedAt: result.evidence.retrievedAt,
    mode: 'read_only_public_api_smoke',
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    probeScriptSha256: createHash('sha256').update(scriptBytes).digest('hex'),
    sourceProgram: 'scripts/smoke-series-watch-order-g09-online.ts',
    scenarioId: 'G09',
    httpRequests,
    selectedTool: 'bangumi.get_series_watch_order',
    input: { subjectId: root.id, depth: 2, maxNodes: 8, media: 'anime' },
    result: {
      state: result.state,
      root: { id: result.root.id, type: result.root.type },
      watchOrder: result.watchOrder.map((item) => ({
        id: item.id,
        type: item.type,
        position: item.position,
        placement: item.placement,
        relationLabels: item.relationLabels,
        relationKinds: item.relationKinds,
      })),
      related: result.related.map((item) => ({
        id: item.id,
        type: item.type,
        depth: item.depth,
        includedInWatchOrder: item.includedInWatchOrder,
        exclusionReason: item.exclusionReason,
        relationLabels: item.relationLabels,
        relationKinds: item.relationKinds,
      })),
      coverage: {
        depth: result.coverage.depth,
        maxNodes: result.coverage.maxNodes,
        relationRequests: result.coverage.relationRequests,
        relationRowsObserved: result.coverage.relationRowsObserved,
        uniqueRelatedObserved: result.coverage.uniqueRelatedObserved,
        uniqueRelatedReturned: result.coverage.uniqueRelatedReturned,
        animeNodesObserved: result.coverage.animeNodesObserved,
        animeNodesSelected: result.coverage.animeNodesSelected,
        nonAnimeRowsObserved: result.coverage.nonAnimeRowsObserved,
        nonAnimeRowsReturned: result.coverage.nonAnimeRowsReturned,
        detailsAttempted: result.coverage.detailsAttempted,
        detailsFetched: result.coverage.detailsFetched,
        detailsFailed: result.coverage.detailsFailed,
        relationFailures: result.coverage.relationFailures,
        truncated: result.coverage.truncated,
        truncationReasons: result.coverage.truncationReasons,
      },
      excludedByReason: result.excluded.byReason,
      sourceOperations: result.evidence.sources.map((source) => ({
        operation: source.operation,
        status: source.status,
        subjectId: source.subjectId,
        depth: source.depth,
      })),
      limitations: result.limitations,
      warningCount: result.warnings.length,
    },
    assertions: { ...assertions, passed },
    limits: [
      'one exact public-v0 search plus bounded relation/detail reads',
      'depth 2 and maxNodes 8',
      'no OAuth, account access, or writes',
      'subject names and raw response bodies are omitted from the report',
    ],
  };
  const time = startedAt.slice(11, 23).replaceAll(':', '').replaceAll('.', '');
  const reportName = `g09-series-watch-order-${startedAt.slice(0, 10)}-${time}-${process.pid}.json`;
  const output = join(process.cwd(), 'docs', 'live-probes', reportName);
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
