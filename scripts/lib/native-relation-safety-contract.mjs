import { isDeepStrictEqual } from 'node:util';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const RELATION_SAFETY_IDS = freeze({
  root: 9632001,
  prequel: 9632002,
  conflict: 9632003,
  book: 9632004,
  unknown: 9632005,
});
const { root, prequel, conflict, book, unknown } = RELATION_SAFETY_IDS;
export const RELATION_SAFETY_CALLS = freeze([
  {
    toolName: 'bangumi.get_subject_relations',
    arguments: { subjectId: root, includeEvidence: true },
  },
  {
    toolName: 'bangumi.get_series_watch_order',
    arguments: { subjectId: root, depth: 1, maxNodes: 8, media: 'all' },
  },
]);
const relation = (id, label, type = 2) => ({
  id,
  type,
  name: `合成作品 ${id}`,
  name_cn: `合成作品 ${id}`,
  relation: label,
});
const rows = [
  relation(prequel, '前传'),
  relation(conflict, '前传'),
  relation(conflict, '续集'),
  relation(book, '原作', 1),
  relation(unknown, '相关作品'),
];
const detail = (id, date) => ({
  id,
  type: 2,
  name: `合成作品 ${id}`,
  name_cn: `合成作品 ${id}`,
  date,
});
// Five local responses, including two separate observations of the root array.
// There is no fallback to fetch or user-supplied fixture/endpoint.
export const RELATION_SAFETY_RESPONSES = freeze([
  { path: `/v0/subjects/${root}/subjects`, body: rows },
  { path: `/v0/subjects/${root}`, body: detail(root, '2024-01-01') },
  { path: `/v0/subjects/${root}/subjects`, body: rows },
  { path: `/v0/subjects/${prequel}/subjects`, body: [relation(root, '续集')] },
  { path: `/v0/subjects/${prequel}`, body: detail(prequel, '2020-01-01') },
]);
const select = (value, keys) => Object.fromEntries(keys.map((key) => [key, value?.[key]]));
const requireFact = (condition) => {
  if (!condition) throw new Error('NATIVE_RELATION_RESULT_INVALID');
};
const equal = (actual, expected) => requireFact(isDeepStrictEqual(actual, expected));

/** Checks native output, never an Agent answer, signed report or invocation permit. */
export function verifyRelationSafetyResult(index, result) {
  requireFact(index === 0 || index === 1);
  requireFact(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 65536);
  requireFact(result.subjectId === root);
  if (index === 0) {
    requireFact(result.state === 'observed');
    equal(
      result.items.map((row) => [row.id, row.type, row.relation]),
      [
        [prequel, 'anime', '前传'],
        [conflict, 'anime', '前传'],
        [conflict, 'anime', '续集'],
        [book, 'book', '原作'],
        [unknown, 'anime', '相关作品'],
      ],
    );
    equal(result.coverage, {
      responseRowsObserved: 5,
      rowsReturned: 5,
      schemaDriftRows: 0,
      truncated: false,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    });
    requireFact(result.source.operation === 'GET /v0/subjects/{subject_id}/subjects');
    requireFact(result.source.direction === 'source_subject_to_returned_target');
    requireFact(result.source.scope === 'visible_direct_rows_returned_for_source_subject');
    return {
      rowsObserved: 5,
      rowsReturned: 5,
      conflictingLabelsRetained: true,
      sourceCompletenessUnknown: true,
    };
  }
  requireFact(result.state === 'partial');
  requireFact(result.capabilityStates.watchOrder === 'bounded_recommendation');
  equal(
    result.watchOrder.map((row) => [row.id, row.placement]),
    [
      [prequel, 'before_root'],
      [root, 'root'],
    ],
  );
  equal(
    result.watchOrder.map((row) => row.type),
    ['anime', 'anime'],
  );
  equal(result.excluded.byReason, [
    { reason: 'conflicting_direct_relations', count: 1 },
    { reason: 'relation_not_watch_step', count: 1 },
    { reason: 'media_type_not_anime', count: 1 },
  ]);
  requireFact(result.excluded.count === 3);
  const expected = [
    [conflict, 'conflicting_direct_relations', ['前传', '续集']],
    [unknown, 'relation_not_watch_step', ['相关作品']],
    [book, 'media_type_not_anime', ['原作']],
  ];
  equal(
    result.excluded.samples.map((row) => [row.id, row.reason, row.relationLabels]),
    expected,
  );
  for (const [id, reason, labels] of expected) {
    const row = result.related.find((item) => item.id === id);
    requireFact(row?.includedInWatchOrder === false && row.exclusionReason === reason);
    equal(row.relationLabels, labels);
    equal(
      row.relationPaths.map((path) => [path.fromId, path.toId, path.relation, path.direct]),
      labels.map((label) => [root, id, label, true]),
    );
  }
  const coverage = {
    depth: 1,
    maxNodes: 8,
    media: 'all',
    relationRequests: 2,
    relationRowsObserved: 6,
    uniqueRelatedObserved: 4,
    uniqueRelatedReturned: 4,
    animeNodesSelected: 1,
    nonAnimeRowsReturned: 1,
    detailsAttempted: 1,
    detailsFetched: 1,
    detailsFailed: 0,
    relationFailures: 0,
    edgeEvidenceReturned: 6,
    edgeEvidenceTruncated: false,
    relatedEvidenceTruncated: false,
    truncated: true,
    truncationReasons: ['semantic-conflict'],
  };
  equal(select(result.coverage, Object.keys(coverage)), coverage);
  // The return edge is visible evidence, not permission to traverse the root again.
  equal(
    result.edges.map((edge) => [edge.fromId, edge.toId, edge.relation]).sort(),
    [...rows.map((row) => [root, row.id, row.relation]), [prequel, root, '续集']].sort(),
  );
  requireFact(
    result.limitations.includes(
      '日期、关系标签和源覆盖可能不完整；本结果不等同于唯一正确或官方 canonical 顺序。',
    ),
  );
  return {
    stepIds: [prequel, root],
    exclusions: expected.map(([id, reason]) => ({ id, reason })),
    semanticConflict: true,
    canonicalOrder: false,
  };
}
