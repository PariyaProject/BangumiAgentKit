import type {
  SeriesRelationKind,
  SeriesWatchOrderExclusionReason,
  SeriesWatchOrderNode,
  SeriesWatchOrderPath,
  SeriesWatchOrderResult,
} from '../packages/bangumi-core/src/index.js';

export const SERIES_FIXTURE_VARIANTS = ['complete', 'partial', 'not-computable'] as const;
export type SeriesFixtureVariant = (typeof SERIES_FIXTURE_VARIANTS)[number];

const RETRIEVED_AT = '2026-08-12T00:00:00.000Z';

function node(
  id: number,
  type: SeriesWatchOrderNode['type'],
  name: string,
  nameCn: string,
  date?: string,
): SeriesWatchOrderNode {
  return {
    id,
    type,
    name,
    nameCn,
    ...(date ? { date } : {}),
    relationLabels: [],
    relationKinds: [],
    relationPaths: [],
  };
}

function path(
  fromId: number,
  toId: number,
  relation: string,
  relationKind: SeriesRelationKind,
  depth: number,
  pathIds: number[],
  pathKinds: SeriesRelationKind[],
): SeriesWatchOrderPath {
  return {
    fromId,
    toId,
    depth,
    relation,
    relationKind,
    pathIds,
    pathKinds,
    direct: depth === 0,
  };
}

function related(
  subject: SeriesWatchOrderNode,
  relationPath: SeriesWatchOrderPath,
  depth: number,
  includedInWatchOrder: boolean,
  exclusionReason?: SeriesWatchOrderExclusionReason,
) {
  return {
    ...subject,
    relationLabels: [relationPath.relation],
    relationKinds: [relationPath.relationKind],
    relationPaths: [relationPath],
    depth,
    includedInWatchOrder,
    ...(exclusionReason ? { exclusionReason } : {}),
  };
}

function sample(
  subject: SeriesWatchOrderNode,
  relationPath: SeriesWatchOrderPath,
  reason: SeriesWatchOrderExclusionReason,
) {
  return {
    ...related(subject, relationPath, relationPath.depth, false, reason),
    reason,
  };
}

function source(
  operation: 'getSubjectById' | 'getRelatedSubjectsBySubjectId',
  subjectId: number,
  status: 'succeeded' | 'failed',
  depth?: number,
) {
  return {
    operation,
    path:
      operation === 'getSubjectById'
        ? `/v0/subjects/${subjectId}`
        : `/v0/subjects/${subjectId}/subjects`,
    status,
    subjectId,
    ...(depth === undefined ? {} : { depth }),
  };
}

function baseCoverage(overrides: Partial<SeriesWatchOrderResult['coverage']> = {}) {
  return {
    depth: 1,
    maxNodes: 8,
    media: 'all' as const,
    animeNodeLimit: 8,
    nonAnimeEvidenceLimit: 8,
    relatedLimit: 16,
    relationRequests: 1,
    relationRowsObserved: 0,
    uniqueRelatedObserved: 0,
    uniqueRelatedReturned: 0,
    animeNodesObserved: 0,
    animeNodesSelected: 0,
    nonAnimeRowsObserved: 0,
    nonAnimeRowsReturned: 0,
    detailsAttempted: 0,
    detailsFetched: 0,
    detailsFailed: 0,
    relationFailures: 0,
    edgeEvidenceLimit: 64,
    edgeEvidenceReturned: 0,
    edgeEvidenceTruncated: false,
    relatedEvidenceTruncated: false,
    truncated: false,
    truncationReasons: [],
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function result(
  state: SeriesWatchOrderResult['state'],
  root: SeriesWatchOrderNode,
  watchOrder: SeriesWatchOrderResult['watchOrder'],
  relatedItems: SeriesWatchOrderResult['related'],
  edges: SeriesWatchOrderResult['edges'],
  excluded: SeriesWatchOrderResult['excluded'],
  coverage: SeriesWatchOrderResult['coverage'],
  sources: SeriesWatchOrderResult['evidence']['sources'],
  warnings: string[] = [],
): SeriesWatchOrderResult {
  return {
    state,
    subjectId: root.id,
    root,
    watchOrder,
    related: relatedItems,
    edges,
    excluded,
    coverage,
    capabilityStates: {
      watchOrder: root.type === 'anime' ? 'bounded_recommendation' : 'not_computable',
    },
    evidence: {
      sources,
      derivation: 'series-watch-order-v2',
      retrievedAt: RETRIEVED_AT,
    },
    warnings,
    limitations: [
      'Bangumi 的关系接口没有发布统一的官方观看顺序；本结果是有限深度、有限节点的确定性推荐。',
      '日期、关系标签和源覆盖可能不完整；本结果不等同于唯一正确或官方 canonical 顺序。',
    ],
  };
}

function completeFixture(): SeriesWatchOrderResult {
  const root = node(
    100,
    'anime',
    'Long Original Title',
    '超长中文起点条目與日本語タイトル',
    '2020-01-01',
  );
  const prequel = node(
    101,
    'anime',
    'Prequel Original Title',
    '前传条目：長い日本語タイトル與中文说明',
    '2019-01-01',
  );
  const sequel = node(102, 'anime', 'Sequel Original Title', '续集条目：缺失封面与長文本');
  const unknown = node(103, 'anime', 'Unknown Relation', '未映射关系条目', '2021-01-01');
  const sourceBook = node(201, 'book', 'Original Book', '原作书籍');
  const soundtrack = node(202, 'music', 'Original Soundtrack', '原声音乐');
  const prequelPath = path(100, 101, '前传', 'prequel', 0, [100, 101], ['prequel']);
  const sequelPath = path(100, 102, '续集', 'sequel', 0, [100, 102], ['sequel']);
  const unknownPath = path(100, 103, '相关作品', 'unknown', 0, [100, 103], ['unknown']);
  const sourcePath = path(100, 201, '原作', 'source', 0, [100, 201], ['source']);
  const musicPath = path(100, 202, '音乐', 'music', 0, [100, 202], ['music']);
  const edges = [prequelPath, sequelPath, unknownPath, sourcePath, musicPath];

  return result(
    'complete',
    root,
    [
      {
        ...related(prequel, prequelPath, 0, true),
        position: 1,
        isRoot: false,
        placement: 'before_root',
        placementReason: '起点直接关系标记为前传，置于起点前',
      },
      {
        ...root,
        position: 2,
        isRoot: true,
        placement: 'root',
        placementReason: '请求的起始条目',
      },
      {
        ...related(sequel, sequelPath, 0, true),
        position: 3,
        isRoot: false,
        placement: 'after_root',
        placementReason: '起点直接关系标记为续集，置于起点后',
      },
    ],
    [
      related(prequel, prequelPath, 0, true),
      related(sequel, sequelPath, 0, true),
      related(unknown, unknownPath, 0, false, 'relation_not_watch_step'),
      related(sourceBook, sourcePath, 0, false, 'media_type_not_anime'),
      related(soundtrack, musicPath, 0, false, 'media_type_not_anime'),
    ],
    edges,
    {
      count: 3,
      byReason: [
        { reason: 'relation_not_watch_step', count: 1 },
        { reason: 'media_type_not_anime', count: 2 },
      ],
      samples: [
        sample(unknown, unknownPath, 'relation_not_watch_step'),
        sample(sourceBook, sourcePath, 'media_type_not_anime'),
        sample(soundtrack, musicPath, 'media_type_not_anime'),
      ],
    },
    baseCoverage({
      relationRowsObserved: 5,
      uniqueRelatedObserved: 5,
      uniqueRelatedReturned: 5,
      animeNodesObserved: 3,
      animeNodesSelected: 2,
      nonAnimeRowsObserved: 2,
      nonAnimeRowsReturned: 2,
      detailsAttempted: 2,
      detailsFetched: 2,
      edgeEvidenceReturned: 5,
    }),
    [
      source('getSubjectById', 100, 'succeeded'),
      source('getRelatedSubjectsBySubjectId', 100, 'succeeded', 0),
      source('getSubjectById', 101, 'succeeded', 0),
      source('getSubjectById', 102, 'succeeded', 0),
    ],
  );
}

function partialFixture(): SeriesWatchOrderResult {
  const root = node(300, 'anime', 'Partial Root', '部分覆盖起点', '2020-01-01');
  const deepPrequel = node(304, 'anime', 'Deep Prequel', '更深前传', '2017-01-01');
  const prequel = node(301, 'anime', 'Prequel', '前传', '2018-01-01');
  const sequel = node(302, 'anime', 'Sequel', '续集', '2021-01-01');
  const sequelWithoutDetail = node(303, 'anime', 'Sequel Without Detail', '详情暂不可用续集');
  const sourceBook = node(401, 'book', 'Source Book', '原作书籍');
  const paths = [
    path(300, 304, '前传', 'prequel', 1, [300, 301, 304], ['prequel', 'prequel']),
    path(300, 301, '前传', 'prequel', 0, [300, 301], ['prequel']),
    path(300, 302, '续集', 'sequel', 0, [300, 302], ['sequel']),
    path(300, 303, '续集', 'sequel', 0, [300, 303], ['sequel']),
    path(300, 401, '原作', 'source', 0, [300, 401], ['source']),
  ];

  return result(
    'partial',
    root,
    [
      {
        ...related(deepPrequel, paths[0]!, 1, true),
        position: 1,
        isRoot: false,
        placement: 'before_root',
        placementReason: '沿连续前传路径推导（距起点 2 条关系）',
        derivedDepth: 2,
      },
      {
        ...related(prequel, paths[1]!, 0, true),
        position: 2,
        isRoot: false,
        placement: 'before_root',
        placementReason: '起点直接关系标记为前传，置于起点前',
        derivedDepth: 1,
      },
      {
        ...root,
        position: 3,
        isRoot: true,
        placement: 'root',
        placementReason: '请求的起始条目',
      },
      {
        ...related(sequel, paths[2]!, 0, true),
        position: 4,
        isRoot: false,
        placement: 'after_root',
        placementReason: '起点直接关系标记为续集，置于起点后',
        derivedDepth: 1,
      },
      {
        ...related(sequelWithoutDetail, paths[3]!, 0, true),
        position: 5,
        isRoot: false,
        placement: 'after_root',
        placementReason: '起点直接关系标记为续集，置于起点后',
        derivedDepth: 1,
      },
    ],
    [
      related(deepPrequel, paths[0]!, 1, true),
      related(prequel, paths[1]!, 0, true),
      related(sequel, paths[2]!, 0, true),
      related(sequelWithoutDetail, paths[3]!, 0, true),
      related(sourceBook, paths[4]!, 0, false, 'media_type_not_anime'),
    ],
    paths,
    {
      count: 1,
      byReason: [{ reason: 'media_type_not_anime', count: 1 }],
      samples: [sample(sourceBook, paths[4]!, 'media_type_not_anime')],
    },
    baseCoverage({
      depth: 2,
      relationRequests: 3,
      relationRowsObserved: 5,
      uniqueRelatedObserved: 5,
      uniqueRelatedReturned: 5,
      animeNodesObserved: 4,
      animeNodesSelected: 4,
      nonAnimeRowsObserved: 1,
      nonAnimeRowsReturned: 1,
      detailsAttempted: 4,
      detailsFetched: 3,
      detailsFailed: 1,
      relationFailures: 1,
      edgeEvidenceReturned: 5,
      truncated: true,
      truncationReasons: ['subject-detail-failure', 'relation-read-failure'],
    }),
    [
      source('getSubjectById', 300, 'succeeded'),
      source('getRelatedSubjectsBySubjectId', 300, 'succeeded', 0),
      source('getRelatedSubjectsBySubjectId', 301, 'succeeded', 1),
      source('getRelatedSubjectsBySubjectId', 302, 'failed', 1),
      source('getSubjectById', 301, 'succeeded', 0),
      source('getSubjectById', 302, 'succeeded', 0),
      source('getSubjectById', 303, 'failed', 0),
      source('getSubjectById', 304, 'succeeded', 1),
    ],
    [
      '共有 1 个可选关系读取失败；未读取的分支不会被假设为完整。',
      '共有 1 个条目的详情不可用；名称和关系仍来自关系接口。',
    ],
  );
}

function notComputableFixture(): SeriesWatchOrderResult {
  const root = node(500, 'book', 'Source Novel', '非动画起点：原作小说');
  const animeRelation = node(501, 'anime', 'Adaptation', '动画改编');
  const musicRelation = node(502, 'music', 'Soundtrack', '音乐证据');
  const bookRelation = node(503, 'book', 'Companion Book', '关联书籍');
  const paths = [
    path(500, 501, '改编', 'adaptation', 0, [500, 501], ['adaptation']),
    path(500, 502, '音乐', 'music', 0, [500, 502], ['music']),
    path(500, 503, '相关作品', 'unknown', 0, [500, 503], ['unknown']),
  ];

  return result(
    'not_computable',
    root,
    [],
    [
      related(animeRelation, paths[0]!, 0, false, 'root_not_anime'),
      related(musicRelation, paths[1]!, 0, false, 'root_not_anime'),
      related(bookRelation, paths[2]!, 0, false, 'root_not_anime'),
    ],
    paths,
    {
      count: 3,
      byReason: [{ reason: 'root_not_anime', count: 3 }],
      samples: [
        sample(animeRelation, paths[0]!, 'root_not_anime'),
        sample(musicRelation, paths[1]!, 'root_not_anime'),
        sample(bookRelation, paths[2]!, 'root_not_anime'),
      ],
    },
    baseCoverage({
      relationRowsObserved: 3,
      uniqueRelatedObserved: 3,
      uniqueRelatedReturned: 3,
      animeNodesObserved: 1,
      animeNodesSelected: 0,
      nonAnimeRowsObserved: 2,
      nonAnimeRowsReturned: 2,
      detailsAttempted: 0,
      detailsFetched: 0,
      edgeEvidenceReturned: 3,
    }),
    [
      source('getSubjectById', 500, 'succeeded'),
      source('getRelatedSubjectsBySubjectId', 500, 'succeeded', 0),
    ],
    ['起始条目不是动画；本次结果只能展示关系证据，不能计算动画观看步骤。'],
  );
}

export function buildSeriesWatchOrderFixtureResults(): Record<
  SeriesFixtureVariant,
  SeriesWatchOrderResult
> {
  return {
    complete: completeFixture(),
    partial: partialFixture(),
    'not-computable': notComputableFixture(),
  };
}

export function assertSeriesWatchOrderFixture(result: SeriesWatchOrderResult): void {
  const relationSources = result.evidence.sources.filter(
    (source) => source.operation === 'getRelatedSubjectsBySubjectId',
  );
  const detailSources = result.evidence.sources.filter(
    (source) => source.operation === 'getSubjectById',
  );
  const edgeTargetIds = new Set(result.edges.map((edge) => edge.toId));
  const relatedIds = new Set(result.related.map((item) => item.id));
  const selectedIds = new Set(
    result.watchOrder.filter((item) => !item.isRoot).map((item) => item.id),
  );
  const animeRelated = result.related.filter((item) => item.type === 'anime');
  const nonAnimeRelated = result.related.filter((item) => item.type !== 'anime');
  const failedRelations = relationSources.filter((source) => source.status === 'failed').length;
  const childDetailSources = detailSources.filter((source) => source.subjectId !== result.root.id);
  const failedDetails = childDetailSources.filter((source) => source.status === 'failed').length;

  const checks: Array<[string, boolean]> = [
    [
      'every edge target is represented by related evidence',
      [...edgeTargetIds].every((id) => relatedIds.has(id)),
    ],
    [
      'uniqueRelatedObserved matches edge targets',
      result.coverage.uniqueRelatedObserved === edgeTargetIds.size,
    ],
    [
      'uniqueRelatedReturned matches related evidence',
      result.coverage.uniqueRelatedReturned === result.related.length,
    ],
    [
      'anime observed/selected counts match fixture rows',
      result.coverage.animeNodesObserved === animeRelated.length &&
        result.coverage.animeNodesSelected === selectedIds.size,
    ],
    [
      'non-anime observed/returned counts match fixture rows',
      result.coverage.nonAnimeRowsObserved === nonAnimeRelated.length &&
        result.coverage.nonAnimeRowsReturned === nonAnimeRelated.length,
    ],
    [
      'relation request evidence matches coverage',
      result.coverage.relationRequests === relationSources.length,
    ],
    [
      'detail attempt evidence matches coverage',
      result.coverage.detailsAttempted === childDetailSources.length,
    ],
    ['detail failure evidence matches coverage', result.coverage.detailsFailed === failedDetails],
    [
      'relation failure evidence matches coverage',
      result.coverage.relationFailures === failedRelations,
    ],
    [
      'excluded count matches observed candidates outside selected steps',
      result.excluded.count === edgeTargetIds.size - selectedIds.size,
    ],
    [
      'watch-order selected rows match coverage',
      result.coverage.animeNodesSelected === selectedIds.size,
    ],
  ];

  if (result.state === 'not_computable') {
    checks.push(
      ['not-computable root is non-anime', result.root.type !== 'anime'],
      ['not-computable has no watch-order steps', result.watchOrder.length === 0],
      ['not-computable performs no child detail reads', result.coverage.detailsAttempted === 0],
      [
        'not-computable performs only the root relation read',
        result.coverage.relationRequests === 1,
      ],
    );
  } else {
    checks.push(
      [
        'anime result contains the root step',
        result.watchOrder.some((item) => item.isRoot && item.id === result.root.id),
      ],
      [
        'partial state has an explicit truncation reason',
        result.state === 'complete' || result.coverage.truncationReasons.length > 0,
      ],
    );
  }

  const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
  if (failed.length > 0) {
    throw new Error(`Invalid SeriesWatchOrder fixture: ${failed.join('; ')}`);
  }
}
