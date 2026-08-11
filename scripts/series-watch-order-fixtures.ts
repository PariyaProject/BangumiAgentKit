import { SeriesService, type SeriesWatchOrderResult } from '../packages/bangumi-core/src/index.js';
import { HttpClient } from '../packages/bangumi-transport/src/index.js';

export const SERIES_FIXTURE_VARIANTS = ['complete', 'partial', 'not-computable'] as const;
export type SeriesFixtureVariant = (typeof SERIES_FIXTURE_VARIANTS)[number];

type RawSubjectType = 1 | 2 | 3 | 4 | 6;
type FixtureOperation = 'getSubjectById' | 'getRelatedSubjectsBySubjectId';
type FixtureStatus = 'succeeded' | 'failed';

interface RawSubject {
  id: number;
  type: RawSubjectType;
  name: string;
  name_cn: string;
  date?: string;
}

interface RawRelation extends RawSubject {
  relation: string;
}

export interface SeriesWatchOrderFixtureRequest {
  operation: FixtureOperation;
  subjectId: number;
  status: FixtureStatus;
  rowCount?: number;
}

type FixtureEvidenceSource = SeriesWatchOrderResult['evidence']['sources'][number];
type FixtureEdgeSpec = Pick<
  SeriesWatchOrderResult['edges'][number],
  'fromId' | 'toId' | 'depth' | 'relation' | 'relationKind' | 'pathIds' | 'pathKinds' | 'direct'
>;

interface FixtureOptions {
  depth: number;
  maxNodes: number;
  media: 'anime' | 'all';
}

type ExpectedFixtureSource = FixtureEvidenceSource;

interface FixtureExpectation {
  state: SeriesWatchOrderResult['state'];
  requests: readonly SeriesWatchOrderFixtureRequest[];
  sources: readonly ExpectedFixtureSource[];
  edges: readonly FixtureEdgeSpec[];
  observedIds: readonly number[];
  selectedIds: readonly number[];
  excludedCount: number;
  excludedByReason: ReadonlyArray<{
    reason: string;
    count: number;
  }>;
  relationRowsObserved: number;
  edgeEvidenceReturned: number;
  animeNodesObserved: number;
  animeNodesSelected: number;
  nonAnimeRowsObserved: number;
  nonAnimeRowsReturned: number;
  detailsAttempted: number;
  detailsFetched: number;
  detailsFailed: number;
  relationFailures: number;
  truncationReasons: readonly string[];
}

interface FixtureScenario {
  variant: SeriesFixtureVariant;
  subjectId: number;
  options: FixtureOptions;
  subjects: ReadonlyMap<number, RawSubject>;
  relations: ReadonlyMap<number, readonly RawRelation[]>;
  failedDetails: ReadonlySet<number>;
  failedRelations: ReadonlySet<number>;
  expected: FixtureExpectation;
}

export interface SeriesWatchOrderFixtureRun {
  variant: SeriesFixtureVariant;
  options: FixtureOptions;
  result: SeriesWatchOrderResult;
  requests: SeriesWatchOrderFixtureRequest[];
  expected: FixtureExpectation;
}

function subject(id: number, type: RawSubjectType, nameCn: string, date?: string): RawSubject {
  return {
    id,
    type,
    name: `Fixture Original Title ${id}`,
    name_cn: nameCn,
    ...(date ? { date } : {}),
  };
}

function relation(
  id: number,
  type: RawSubjectType,
  relationLabel: string,
  nameCn: string,
): RawRelation {
  return {
    ...subject(id, type, nameCn),
    relation: relationLabel,
  };
}

function detailSource(
  subjectId: number,
  status: FixtureStatus,
  depth?: number,
): ExpectedFixtureSource {
  return {
    operation: 'getSubjectById',
    path: `/v0/subjects/${subjectId}`,
    status,
    subjectId,
    ...(depth === undefined ? {} : { depth }),
  };
}

function relationSource(
  subjectId: number,
  depth: number,
  status: FixtureStatus,
): ExpectedFixtureSource {
  return {
    operation: 'getRelatedSubjectsBySubjectId',
    path: `/v0/subjects/${subjectId}/subjects`,
    status,
    subjectId,
    depth,
  };
}

function detailRequest(subjectId: number, status: FixtureStatus): SeriesWatchOrderFixtureRequest {
  return { operation: 'getSubjectById', subjectId, status };
}

function relationRequest(
  subjectId: number,
  status: FixtureStatus,
  rowCount: number,
): SeriesWatchOrderFixtureRequest {
  return {
    operation: 'getRelatedSubjectsBySubjectId',
    subjectId,
    status,
    rowCount,
  };
}

function edgeSpec(
  fromId: number,
  toId: number,
  depth: number,
  relation: string,
  relationKind: FixtureEdgeSpec['relationKind'],
  pathIds: number[],
  pathKinds: FixtureEdgeSpec['pathKinds'],
  direct: boolean,
): FixtureEdgeSpec {
  return { fromId, toId, depth, relation, relationKind, pathIds, pathKinds, direct };
}

function toMap<T extends { id: number }>(items: readonly T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item] as const));
}

function completeScenario(): FixtureScenario {
  const subjects = toMap([
    subject(100, 2, '超长中文起点条目與日本語タイトル', '2020-01-01'),
    subject(101, 2, '前传条目：長い日本語タイトル與中文说明', '2019-01-01'),
    subject(102, 2, '续集条目：缺失封面与長文本'),
    subject(103, 2, '未映射关系条目', '2021-01-01'),
    subject(201, 1, '原作书籍'),
    subject(202, 3, '原声音乐'),
  ]);
  const relations = new Map<number, readonly RawRelation[]>([
    [
      100,
      [
        relation(101, 2, '前传', '前传条目：長い日本語タイトル與中文说明'),
        relation(102, 2, '续集', '续集条目：缺失封面与長文本'),
        relation(103, 2, '相关作品', '未映射关系条目'),
        relation(201, 1, '原作', '原作书籍'),
        relation(202, 3, '音乐', '原声音乐'),
      ],
    ],
    [101, []],
    [102, []],
  ]);
  const sources = [
    detailSource(100, 'succeeded'),
    relationSource(100, 0, 'succeeded'),
    relationSource(101, 1, 'succeeded'),
    relationSource(102, 1, 'succeeded'),
    detailSource(101, 'succeeded', 0),
    detailSource(102, 'succeeded', 0),
  ] as const;

  return {
    variant: 'complete',
    subjectId: 100,
    options: { depth: 1, maxNodes: 8, media: 'all' },
    subjects,
    relations,
    failedDetails: new Set(),
    failedRelations: new Set(),
    expected: {
      state: 'complete',
      requests: [
        detailRequest(100, 'succeeded'),
        relationRequest(100, 'succeeded', 5),
        relationRequest(101, 'succeeded', 0),
        relationRequest(102, 'succeeded', 0),
        detailRequest(101, 'succeeded'),
        detailRequest(102, 'succeeded'),
      ],
      sources,
      edges: [
        edgeSpec(100, 101, 0, '前传', 'prequel', [100, 101], ['prequel'], true),
        edgeSpec(100, 102, 0, '续集', 'sequel', [100, 102], ['sequel'], true),
        edgeSpec(100, 103, 0, '相关作品', 'unknown', [100, 103], ['unknown'], true),
        edgeSpec(100, 201, 0, '原作', 'source', [100, 201], ['source'], true),
        edgeSpec(100, 202, 0, '音乐', 'music', [100, 202], ['music'], true),
      ],
      observedIds: [101, 102, 103, 201, 202],
      selectedIds: [101, 102],
      excludedCount: 3,
      excludedByReason: [
        { reason: 'relation_not_watch_step', count: 1 },
        { reason: 'media_type_not_anime', count: 2 },
      ],
      relationRowsObserved: 5,
      edgeEvidenceReturned: 5,
      animeNodesObserved: 3,
      animeNodesSelected: 2,
      nonAnimeRowsObserved: 2,
      nonAnimeRowsReturned: 2,
      detailsAttempted: 2,
      detailsFetched: 2,
      detailsFailed: 0,
      relationFailures: 0,
      truncationReasons: [],
    },
  };
}

function partialScenario(): FixtureScenario {
  const subjects = toMap([
    subject(300, 2, '部分覆盖起点', '2020-01-01'),
    subject(301, 2, '前传：長い日本語タイトル', '2018-01-01'),
    subject(302, 2, '续集：CJK 详情', '2021-01-01'),
    subject(303, 2, '详情暂不可用续集'),
    subject(304, 2, '更深前传：深层证据', '2017-01-01'),
    subject(306, 2, '深度边界前传', '2016-01-01'),
    subject(401, 1, '原作书籍'),
  ]);
  const relations = new Map<number, readonly RawRelation[]>([
    [
      300,
      [
        relation(301, 2, '前传', '前传：長い日本語タイトル'),
        relation(302, 2, '续集', '续集：CJK 详情'),
        relation(303, 2, '续集', '详情暂不可用续集'),
        relation(401, 1, '原作', '原作书籍'),
      ],
    ],
    [301, [relation(304, 2, '前传', '更深前传：深层证据')]],
    [303, []],
    [304, [relation(306, 2, '前传', '深度边界前传')]],
  ]);
  const sources = [
    detailSource(300, 'succeeded'),
    relationSource(300, 0, 'succeeded'),
    relationSource(301, 1, 'succeeded'),
    relationSource(302, 1, 'failed'),
    relationSource(303, 1, 'succeeded'),
    relationSource(304, 2, 'succeeded'),
    detailSource(301, 'succeeded', 0),
    detailSource(302, 'succeeded', 0),
    detailSource(303, 'failed', 0),
    detailSource(304, 'succeeded', 1),
    detailSource(306, 'succeeded', 2),
  ] as const;

  return {
    variant: 'partial',
    subjectId: 300,
    options: { depth: 2, maxNodes: 8, media: 'all' },
    subjects,
    relations,
    failedDetails: new Set([303]),
    failedRelations: new Set([302]),
    expected: {
      state: 'partial',
      requests: [
        detailRequest(300, 'succeeded'),
        relationRequest(300, 'succeeded', 4),
        relationRequest(301, 'succeeded', 1),
        relationRequest(302, 'failed', 0),
        relationRequest(303, 'succeeded', 0),
        relationRequest(304, 'succeeded', 1),
        detailRequest(301, 'succeeded'),
        detailRequest(302, 'succeeded'),
        detailRequest(303, 'failed'),
        detailRequest(304, 'succeeded'),
        detailRequest(306, 'succeeded'),
      ],
      sources,
      edges: [
        edgeSpec(300, 301, 0, '前传', 'prequel', [300, 301], ['prequel'], true),
        edgeSpec(300, 302, 0, '续集', 'sequel', [300, 302], ['sequel'], true),
        edgeSpec(300, 303, 0, '续集', 'sequel', [300, 303], ['sequel'], true),
        edgeSpec(300, 401, 0, '原作', 'source', [300, 401], ['source'], true),
        edgeSpec(301, 304, 1, '前传', 'prequel', [300, 301, 304], ['prequel', 'prequel'], false),
        edgeSpec(
          304,
          306,
          2,
          '前传',
          'prequel',
          [300, 301, 304, 306],
          ['prequel', 'prequel', 'prequel'],
          false,
        ),
      ],
      observedIds: [301, 302, 303, 304, 306, 401],
      selectedIds: [301, 302, 303, 304, 306],
      excludedCount: 1,
      excludedByReason: [{ reason: 'media_type_not_anime', count: 1 }],
      relationRowsObserved: 6,
      edgeEvidenceReturned: 6,
      animeNodesObserved: 5,
      animeNodesSelected: 5,
      nonAnimeRowsObserved: 1,
      nonAnimeRowsReturned: 1,
      detailsAttempted: 5,
      detailsFetched: 4,
      detailsFailed: 1,
      relationFailures: 1,
      truncationReasons: ['depth=2', 'subject-detail-failure', 'relation-read-failure'],
    },
  };
}

function notComputableScenario(): FixtureScenario {
  const subjects = toMap([
    subject(500, 1, '非动画起点：原作小说'),
    subject(501, 2, '动画改编'),
    subject(502, 3, '音乐证据'),
    subject(503, 1, '关联书籍'),
  ]);
  const relations = new Map<number, readonly RawRelation[]>([
    [
      500,
      [
        relation(501, 2, '改编', '动画改编'),
        relation(502, 3, '音乐', '音乐证据'),
        relation(503, 1, '相关作品', '关联书籍'),
      ],
    ],
  ]);
  const sources = [detailSource(500, 'succeeded'), relationSource(500, 0, 'succeeded')] as const;

  return {
    variant: 'not-computable',
    subjectId: 500,
    options: { depth: 1, maxNodes: 8, media: 'all' },
    subjects,
    relations,
    failedDetails: new Set(),
    failedRelations: new Set(),
    expected: {
      state: 'not_computable',
      requests: [detailRequest(500, 'succeeded'), relationRequest(500, 'succeeded', 3)],
      sources,
      edges: [
        edgeSpec(500, 501, 0, '改编', 'adaptation', [500, 501], ['adaptation'], true),
        edgeSpec(500, 502, 0, '音乐', 'music', [500, 502], ['music'], true),
        edgeSpec(500, 503, 0, '相关作品', 'unknown', [500, 503], ['unknown'], true),
      ],
      observedIds: [501, 502, 503],
      selectedIds: [],
      excludedCount: 3,
      excludedByReason: [{ reason: 'root_not_anime', count: 3 }],
      relationRowsObserved: 3,
      edgeEvidenceReturned: 3,
      animeNodesObserved: 1,
      animeNodesSelected: 0,
      nonAnimeRowsObserved: 2,
      nonAnimeRowsReturned: 2,
      detailsAttempted: 0,
      detailsFetched: 0,
      detailsFailed: 0,
      relationFailures: 0,
      truncationReasons: [],
    },
  };
}

function scenarios(): readonly FixtureScenario[] {
  return [completeScenario(), partialScenario(), notComputableScenario()];
}

function response(body: unknown, status = 200): Response {
  return new Response(status === 200 ? JSON.stringify(body) : 'fixture failure', {
    status,
    headers: status === 200 ? { 'content-type': 'application/json' } : undefined,
  });
}

async function runScenario(scenario: FixtureScenario): Promise<SeriesWatchOrderFixtureRun> {
  const requests: SeriesWatchOrderFixtureRequest[] = [];
  const fetchFn = async (input: string | URL): Promise<Response> => {
    const url = String(input);
    const relationMatch = url.match(/\/v0\/subjects\/(\d+)\/subjects$/u);
    if (relationMatch) {
      const subjectId = Number(relationMatch[1]);
      const failed = scenario.failedRelations.has(subjectId);
      const rows = scenario.relations.get(subjectId) || [];
      requests.push({
        operation: 'getRelatedSubjectsBySubjectId',
        subjectId,
        status: failed ? 'failed' : 'succeeded',
        rowCount: failed ? 0 : rows.length,
      });
      return failed ? response(undefined, 404) : response(rows);
    }

    const detailMatch = url.match(/\/v0\/subjects\/(\d+)$/u);
    if (detailMatch) {
      const subjectId = Number(detailMatch[1]);
      const failed = scenario.failedDetails.has(subjectId) || !scenario.subjects.has(subjectId);
      requests.push({
        operation: 'getSubjectById',
        subjectId,
        status: failed ? 'failed' : 'succeeded',
      });
      return failed ? response(undefined, 404) : response(scenario.subjects.get(subjectId));
    }

    throw new Error(`Unexpected fixture request: ${url}`);
  };

  const result = await new SeriesService(
    new HttpClient({ fetchFn: fetchFn as typeof fetch }),
  ).getSeriesWatchOrder(scenario.subjectId, scenario.options);

  return {
    variant: scenario.variant,
    options: scenario.options,
    result,
    requests,
    expected: scenario.expected,
  };
}

export async function buildSeriesWatchOrderFixtureRuns(): Promise<
  Record<SeriesFixtureVariant, SeriesWatchOrderFixtureRun>
> {
  const runs = await Promise.all(scenarios().map((scenario) => runScenario(scenario)));
  return Object.fromEntries(runs.map((run) => [run.variant, run])) as Record<
    SeriesFixtureVariant,
    SeriesWatchOrderFixtureRun
  >;
}

export async function buildSeriesWatchOrderFixtureResults(): Promise<
  Record<SeriesFixtureVariant, SeriesWatchOrderResult>
> {
  const runs = await buildSeriesWatchOrderFixtureRuns();
  return Object.fromEntries(
    SERIES_FIXTURE_VARIANTS.map((variant) => [variant, runs[variant].result]),
  ) as Record<SeriesFixtureVariant, SeriesWatchOrderResult>;
}

function comparableSource(source: FixtureEvidenceSource) {
  return {
    operation: source.operation,
    path: source.path,
    status: source.status,
    subjectId: source.subjectId,
    depth: source.depth ?? null,
  };
}

function comparableRequest(request: SeriesWatchOrderFixtureRequest) {
  return {
    operation: request.operation,
    subjectId: request.subjectId,
    status: request.status,
    rowCount: request.rowCount ?? null,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireInvariant(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Invalid SeriesWatchOrder fixture: ${label}`);
}

function sortedUnique(ids: Iterable<number>): number[] {
  return [...new Set(ids)].sort((left, right) => left - right);
}

function pathKey(path: SeriesWatchOrderResult['edges'][number]): string {
  return [
    path.fromId,
    path.toId,
    path.depth,
    path.relation,
    path.relationKind,
    path.pathIds.join(','),
    path.pathKinds.join(','),
    path.direct,
  ].join('|');
}

export function assertSeriesWatchOrderFixture(run: SeriesWatchOrderFixtureRun): void {
  const { result, expected } = run;
  const relationSources = result.evidence.sources.filter(
    (source) => source.operation === 'getRelatedSubjectsBySubjectId',
  );
  const detailSources = result.evidence.sources.filter(
    (source) => source.operation === 'getSubjectById',
  );
  const expectedRelationSources = expected.sources.filter(
    (source) => source.operation === 'getRelatedSubjectsBySubjectId',
  );
  const expectedDetailSources = expected.sources.filter(
    (source) => source.operation === 'getSubjectById',
  );
  const childDetailSources = detailSources.filter((source) => source.subjectId !== result.root.id);
  const selectedIds = sortedUnique(
    result.watchOrder.filter((item) => !item.isRoot).map((item) => item.id),
  );
  const relatedIds = sortedUnique(result.related.map((item) => item.id));
  const edgeTargetIds = sortedUnique(result.edges.map((edge) => edge.toId));
  const relatedPathKeys = new Set(result.edges.map(pathKey));
  const actualRelationRequests = run.requests.filter(
    (request) => request.operation === 'getRelatedSubjectsBySubjectId',
  );
  const actualDetailRequests = run.requests.filter(
    (request) => request.operation === 'getSubjectById',
  );
  const actualChildDetailRequests = actualDetailRequests.filter(
    (request) => request.subjectId !== result.root.id,
  );

  requireInvariant(result.subjectId === result.root.id, 'root id matches requested subject id');
  requireInvariant(
    result.coverage.depth === run.options.depth &&
      result.coverage.maxNodes === run.options.maxNodes &&
      result.coverage.media === run.options.media,
    'coverage preserves the configured traversal options',
  );
  requireInvariant(result.state === expected.state, 'state matches deterministic scenario');
  requireInvariant(
    sameJson(run.requests.map(comparableRequest), expected.requests.map(comparableRequest)),
    'mocked API requests match the configured traversal scenario',
  );
  requireInvariant(
    sameJson(result.evidence.sources.map(comparableSource), expected.sources.map(comparableSource)),
    'evidence sources exactly match the actual mocked API attempts',
  );
  requireInvariant(
    sameJson(relationSources.map(comparableSource), expectedRelationSources.map(comparableSource)),
    'relation attempt subjects, depths, statuses, and order are truthful',
  );
  requireInvariant(
    sameJson(detailSources.map(comparableSource), expectedDetailSources.map(comparableSource)),
    'detail attempt subjects, depths, statuses, and order are truthful',
  );
  requireInvariant(
    sameJson(result.edges.map(pathKey).sort(), expected.edges.map(pathKey).sort()),
    'every returned edge has the expected truthful topology and relation evidence',
  );
  requireInvariant(
    sameJson(edgeTargetIds, sortedUnique(expected.observedIds)),
    'edge targets match every observed relation candidate',
  );
  requireInvariant(
    sameJson(relatedIds, sortedUnique(expected.observedIds)),
    'related evidence retains every observed candidate for this uncapped fixture',
  );
  requireInvariant(
    edgeTargetIds.every((id) => relatedIds.includes(id)),
    'every edge target is represented by related evidence',
  );

  for (const edge of result.edges) {
    requireInvariant(
      edge.pathIds[0] === result.subjectId,
      `edge ${pathKey(edge)} is root-relative`,
    );
    requireInvariant(
      edge.pathIds[edge.pathIds.length - 1] === edge.toId,
      `edge ${pathKey(edge)} ends at toId`,
    );
    requireInvariant(
      edge.pathIds[edge.pathIds.length - 2] === edge.fromId,
      `edge ${pathKey(edge)} has truthful immediate fromId`,
    );
    requireInvariant(
      edge.pathIds.length === edge.depth + 2,
      `edge ${pathKey(edge)} depth matches path length`,
    );
    requireInvariant(
      edge.pathKinds.length === edge.pathIds.length - 1,
      `edge ${pathKey(edge)} path kinds match path ids`,
    );
    requireInvariant(
      edge.pathKinds[edge.pathKinds.length - 1] === edge.relationKind,
      `edge ${pathKey(edge)} terminal kind matches relation kind`,
    );
    requireInvariant(
      edge.direct === (edge.depth === 0),
      `edge ${pathKey(edge)} direct flag is truthful`,
    );
    requireInvariant(
      relationSources.some(
        (source) =>
          source.subjectId === edge.fromId &&
          source.depth === edge.depth &&
          source.status === 'succeeded',
      ),
      `edge ${pathKey(edge)} originates at a successful relation attempt at its depth`,
    );
    if (edge.depth > 0) {
      requireInvariant(
        result.edges.some(
          (candidate) =>
            sameJson(candidate.pathIds, edge.pathIds.slice(0, -1)) &&
            sameJson(candidate.pathKinds, edge.pathKinds.slice(0, -1)),
        ),
        `edge ${pathKey(edge)} has a returned parent traversal path`,
      );
    }
  }

  for (const item of [...result.related, ...result.watchOrder.filter((entry) => !entry.isRoot)]) {
    for (const path of item.relationPaths) {
      requireInvariant(path.toId === item.id, `item ${item.id} path target is truthful`);
      requireInvariant(
        relatedPathKeys.has(pathKey(path)),
        `item ${item.id} path is retained in returned edge evidence`,
      );
    }
  }

  requireInvariant(
    result.coverage.relationRequests === relationSources.length,
    'relation request count',
  );
  requireInvariant(
    result.coverage.relationRowsObserved === expected.relationRowsObserved,
    'relationRowsObserved matches successful mocked response rows',
  );
  requireInvariant(
    result.coverage.relationRowsObserved ===
      actualRelationRequests
        .filter((request) => request.status === 'succeeded')
        .reduce((total, request) => total + (request.rowCount ?? 0), 0),
    'relationRowsObserved matches the actual successful request row counts',
  );
  requireInvariant(
    result.coverage.uniqueRelatedObserved === expected.observedIds.length,
    'uniqueRelatedObserved matches observed candidates',
  );
  requireInvariant(
    result.coverage.uniqueRelatedReturned === result.related.length,
    'uniqueRelatedReturned matches related evidence',
  );
  requireInvariant(
    result.coverage.edgeEvidenceReturned === result.edges.length &&
      result.edges.length === expected.edgeEvidenceReturned,
    'edgeEvidenceReturned matches returned edge evidence',
  );
  requireInvariant(
    result.coverage.animeNodesObserved === expected.animeNodesObserved,
    'animeNodesObserved matches classified anime candidates',
  );
  requireInvariant(
    result.coverage.animeNodesSelected === expected.animeNodesSelected &&
      sameJson(selectedIds, sortedUnique(expected.selectedIds)),
    'anime selection matches the service-emitted watch order',
  );
  requireInvariant(
    result.coverage.nonAnimeRowsObserved === expected.nonAnimeRowsObserved &&
      result.coverage.nonAnimeRowsReturned === expected.nonAnimeRowsReturned &&
      result.coverage.nonAnimeRowsReturned ===
        result.related.filter((item) => item.type !== 'anime').length,
    'non-anime observed/returned counts match related evidence',
  );
  requireInvariant(
    result.coverage.detailsAttempted === expected.detailsAttempted &&
      childDetailSources.length === expected.detailsAttempted &&
      actualChildDetailRequests.length === expected.detailsAttempted,
    'detailsAttempted matches actual detail requests',
  );
  requireInvariant(
    result.coverage.detailsFetched === expected.detailsFetched &&
      result.coverage.detailsFailed === expected.detailsFailed &&
      result.coverage.detailsFetched ===
        actualChildDetailRequests.filter((request) => request.status === 'succeeded').length &&
      result.coverage.detailsFailed ===
        actualChildDetailRequests.filter((request) => request.status === 'failed').length,
    'detail fetched/failed counts match actual statuses',
  );
  requireInvariant(
    result.coverage.relationFailures === expected.relationFailures &&
      result.coverage.relationFailures ===
        actualRelationRequests.filter((request) => request.status === 'failed').length,
    'relation failure count matches actual statuses',
  );
  requireInvariant(
    result.excluded.count === expected.excludedCount &&
      result.excluded.count === result.related.length - selectedIds.length,
    'excluded count matches unselected observed candidates',
  );
  requireInvariant(
    sameJson(result.excluded.byReason, expected.excludedByReason),
    'excluded reason totals match the service-emitted result',
  );
  requireInvariant(
    result.excluded.byReason.reduce((total, item) => total + item.count, 0) ===
      result.excluded.count,
    'excluded reason totals sum to excluded count',
  );
  requireInvariant(
    sameJson(result.coverage.truncationReasons, expected.truncationReasons),
    'truncation reasons match the deterministic failure/depth scenario',
  );
  requireInvariant(
    result.coverage.truncated === (expected.state === 'partial'),
    'coverage truncated state is truthful',
  );
  requireInvariant(
    result.coverage.edgeEvidenceTruncated === false &&
      result.coverage.relatedEvidenceTruncated === false,
    'these representative fixtures do not claim unexercised output caps',
  );

  if (expected.state === 'not_computable') {
    requireInvariant(result.root.type !== 'anime', 'not-computable root is non-anime');
    requireInvariant(result.watchOrder.length === 0, 'not-computable has no watch-order steps');
    requireInvariant(
      result.coverage.relationRequests === 1,
      'not-computable reads only root relations',
    );
    requireInvariant(
      result.coverage.detailsAttempted === 0,
      'not-computable reads no child details',
    );
  } else {
    requireInvariant(
      result.watchOrder.some((item) => item.isRoot && item.id === result.root.id),
      'anime result contains the root step',
    );
    requireInvariant(
      result.capabilityStates.watchOrder === 'bounded_recommendation',
      'anime result exposes bounded recommendation capability',
    );
  }
}
