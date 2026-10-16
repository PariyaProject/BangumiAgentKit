import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const C02_PROFILE_ID = 'c02-cardcaptor-tv-movie-v1';
export const C02_DELTA_RULE = 'second_minus_first';
export const C02_OFFICIAL_V0_OPERATIONS = Object.freeze([
  'GET /v0/subjects/{subject_id}',
  'GET /v0/subjects/{subject_id} (rating/collection fields)',
  'GET /v0/subjects/{subject_id}/characters',
  'GET /v0/subjects/{subject_id}/persons',
  'GET /v0/subjects/{subject_id}/subjects',
]);
export const C02_LIMITATIONS = Object.freeze([
  'episodesReported 是 Bangumi 报告话数，不是已播或已看话数。',
  '评分和收藏总数仅为当前公开快照。',
  '本次只比较固定条目 1940 与 1941，不代表全体改编作品。',
  '不据此推断作品质量、偏好、因果、趋势或统计显著性。',
]);

const PROFILE = getAgentMcpProfileById(C02_PROFILE_ID);
const SUBJECT_IDS = [1940, 1941];
const METRIC_KEYS = ['episodesReported', 'score', 'collectionTotal'];
const COMPARISON_METRIC_KEYS = [
  'episodesReported',
  'totalEpisodesReported',
  'score',
  'rank',
  'ratingTotal',
  'collectionTotal',
  'ratingPopulation',
  'ratingMean',
  'ratingStandardDeviation',
  'collectionPopulation',
  'collectionCompletionRate',
];
const METRIC_STATES = ['complete', 'unknown', 'conflict'];
const OVERLAP_STATES = ['complete', 'partial', 'unavailable', 'not_computable'];
const DELTA_PRECISION = { episodesReported: 0, score: 1, collectionTotal: 0 };

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumberOrNull = (value) =>
  value === null || (typeof value === 'number' && Number.isFinite(value));
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value, keys) =>
  isRecord(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

function roundedDelta(values, precision) {
  const factor = 10 ** precision;
  return Math.round((values[1] - values[0]) * factor + Number.EPSILON) / factor;
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function projectMetric(metric, key) {
  if (
    !isRecord(metric) ||
    metric.key !== key ||
    !Array.isArray(metric.values) ||
    metric.values.length !== 2 ||
    metric.values.some((value) => !isFiniteNumberOrNull(value)) ||
    !isFiniteNumberOrNull(metric.delta) ||
    metric.deltaPrecision !== DELTA_PRECISION[key] ||
    !['complete', 'unknown', 'conflict'].includes(metric.state)
  )
    return null;

  if (metric.state === 'complete') {
    if (
      metric.values.some((value) => typeof value !== 'number') ||
      typeof metric.delta !== 'number'
    ) {
      return null;
    }
    if (metric.delta !== roundedDelta(metric.values, metric.deltaPrecision)) return null;
  }
  if (metric.state !== 'complete' && metric.delta !== null) return null;

  return {
    key,
    values: [...metric.values],
    delta: metric.delta,
    deltaPrecision: metric.deltaPrecision,
    state: metric.state,
    conflictCount: Array.isArray(metric.conflicts) ? metric.conflicts.length : 0,
  };
}

export function projectC02ComparisonResult(result) {
  if (!PROFILE || !isRecord(result)) return null;
  const expectedArguments = PROFILE.calls[0]?.arguments;
  if (
    canonicalAgentMcpProfileJson(result.subjectIds) !==
      canonicalAgentMcpProfileJson(expectedArguments?.subjectIds) ||
    result.formulaVersion !== 'subject-comparison-v2' ||
    !['complete', 'partial'].includes(result.state) ||
    !Array.isArray(result.subjects) ||
    result.subjects.length !== 2 ||
    !Array.isArray(result.metrics) ||
    !isRecord(result.coverage) ||
    !isRecord(result.overlaps) ||
    !isRecord(result.overlaps.cast) ||
    !OVERLAP_STATES.includes(result.overlaps.cast.state) ||
    !isRecord(result.overlaps.staff) ||
    !OVERLAP_STATES.includes(result.overlaps.staff.state) ||
    !isRecord(result.source) ||
    !isRecord(result.source.official) ||
    result.source.official.class !== 'official-v0' ||
    !Array.isArray(result.source.official.operations) ||
    result.source.official.operations.length === 0 ||
    !result.source.official.operations.every((item) => typeof item === 'string' && item.trim()) ||
    !result.source.official.operations.every((item) => C02_OFFICIAL_V0_OPERATIONS.includes(item)) ||
    !isIsoTimestamp(result.source.official.attemptedAt) ||
    (result.source.official.retrievedAt !== undefined &&
      !isIsoTimestamp(result.source.official.retrievedAt))
  )
    return null;

  const subjects = result.subjects.map((row, index) => {
    if (
      !isRecord(row) ||
      row.subjectId !== SUBJECT_IDS[index] ||
      !isRecord(row.subject) ||
      row.subject.id !== SUBJECT_IDS[index] ||
      typeof row.subject.name !== 'string' ||
      !row.subject.name.trim() ||
      Buffer.byteLength(row.subject.name, 'utf8') > 256 ||
      !['complete', 'partial'].includes(row.state) ||
      (row.subject.nameCn !== undefined &&
        (typeof row.subject.nameCn !== 'string' ||
          Buffer.byteLength(row.subject.nameCn, 'utf8') > 256))
    )
      return null;
    return {
      subjectId: row.subjectId,
      name: row.subject.name,
      ...(typeof row.subject.nameCn === 'string' && row.subject.nameCn.trim()
        ? { nameCn: row.subject.nameCn }
        : {}),
    };
  });
  if (subjects.some((subject) => subject === null)) return null;

  const metricKeys = result.metrics.map((metric) => metric?.key);
  if (
    result.metrics.length !== COMPARISON_METRIC_KEYS.length ||
    metricKeys.some((key) => !COMPARISON_METRIC_KEYS.includes(key)) ||
    new Set(metricKeys).size !== COMPARISON_METRIC_KEYS.length ||
    result.metrics.some((metric) => !isRecord(metric) || !METRIC_STATES.includes(metric.state))
  )
    return null;

  const metricStateCounts = {
    complete: result.metrics.filter((metric) => metric.state === 'complete').length,
    unknown: result.metrics.filter((metric) => metric.state === 'unknown').length,
    conflict: result.metrics.filter((metric) => metric.state === 'conflict').length,
  };
  const subjectStateCounts = {
    complete: result.subjects.filter((row) => row.state === 'complete').length,
    partial: result.subjects.filter((row) => row.state === 'partial').length,
    unavailable: result.subjects.filter((row) => row.state === 'unavailable').length,
    notFound: result.subjects.filter((row) => row.state === 'not_found').length,
  };

  const metrics = METRIC_KEYS.map((key) => {
    const matches = result.metrics.filter((metric) => metric?.key === key);
    return matches.length === 1 ? projectMetric(matches[0], key) : null;
  });
  if (metrics.some((metric) => metric === null)) return null;

  const coverage = result.coverage;
  const requiredCoverage = [
    'requestedSubjects',
    'returnedSubjects',
    'subjectsComplete',
    'subjectsPartial',
    'subjectsUnavailable',
    'subjectsNotFound',
    'metricsComplete',
    'metricsUnknown',
    'metricsConflict',
  ];
  if (requiredCoverage.some((key) => !isNonNegativeInteger(coverage[key]))) return null;
  if (
    coverage.requestedSubjects !== 2 ||
    coverage.returnedSubjects !== 2 ||
    coverage.subjectsComplete !== subjectStateCounts.complete ||
    coverage.subjectsPartial !== subjectStateCounts.partial ||
    coverage.subjectsUnavailable !== subjectStateCounts.unavailable ||
    coverage.subjectsNotFound !== subjectStateCounts.notFound ||
    coverage.metricsComplete !== metricStateCounts.complete ||
    coverage.metricsUnknown !== metricStateCounts.unknown ||
    coverage.metricsConflict !== metricStateCounts.conflict ||
    !isRecord(coverage.limits) ||
    coverage.limits.maxSubjects !== 2 ||
    coverage.limits.maxCast !== expectedArguments.maxCast ||
    coverage.limits.maxStaff !== expectedArguments.maxStaff ||
    coverage.limits.maxRelations !== expectedArguments.maxRelations ||
    !isNonNegativeInteger(coverage.limits.maxOverlapItems)
  )
    return null;

  const completeStateIsConsistent =
    subjectStateCounts.complete === 2 &&
    metricStateCounts.unknown === 0 &&
    metricStateCounts.conflict === 0 &&
    result.overlaps.cast.state === 'complete' &&
    result.overlaps.staff.state === 'complete';
  if ((result.state === 'complete') !== completeStateIsConsistent) return null;

  return {
    state: result.state,
    formulaVersion: result.formulaVersion,
    deltaRule: C02_DELTA_RULE,
    subjectIds: [...SUBJECT_IDS],
    subjects,
    metrics,
    coverage: {
      requestedSubjects: coverage.requestedSubjects,
      returnedSubjects: coverage.returnedSubjects,
      subjectsComplete: coverage.subjectsComplete,
      subjectsPartial: coverage.subjectsPartial,
      subjectsUnavailable: coverage.subjectsUnavailable,
      subjectsNotFound: coverage.subjectsNotFound,
      metricsComplete: coverage.metricsComplete,
      metricsUnknown: coverage.metricsUnknown,
      metricsConflict: coverage.metricsConflict,
      limits: {
        maxSubjects: coverage.limits.maxSubjects,
        maxCast: coverage.limits.maxCast,
        maxStaff: coverage.limits.maxStaff,
        maxRelations: coverage.limits.maxRelations,
        maxOverlapItems: coverage.limits.maxOverlapItems,
      },
    },
    officialSource: {
      operations: [...new Set(result.source.official.operations)].sort(),
      attemptedAt: result.source.official.attemptedAt,
      ...(result.source.official.retrievedAt
        ? { retrievedAt: result.source.official.retrievedAt }
        : {}),
    },
    warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
  };
}

function parseAnswer(answer) {
  if (typeof answer !== 'string' || Buffer.byteLength(answer, 'utf8') > PROFILE.maxAnswerBytes)
    return null;
  try {
    return JSON.parse(answer);
  } catch {
    return null;
  }
}

export function verifyC02Answer(answer, source) {
  const parsed = parseAnswer(answer);
  const checks = {
    exactSchema: exactKeys(parsed, [
      'schemaVersion',
      'subjectIds',
      'subjects',
      'metrics',
      'deltaRule',
      'limitations',
    ]),
    exactSubjectIds:
      canonicalAgentMcpProfileJson(parsed?.subjectIds) ===
      canonicalAgentMcpProfileJson(SUBJECT_IDS),
    exactSubjectNames: false,
    exactMetricsAndStates: false,
    exactDeltas: false,
    explicitSecondMinusFirstRule: parsed?.deltaRule === C02_DELTA_RULE,
    exactLimitations:
      canonicalAgentMcpProfileJson(parsed?.limitations) ===
      canonicalAgentMcpProfileJson(C02_LIMITATIONS),
  };
  if (
    parsed?.schemaVersion === 1 &&
    Array.isArray(parsed.subjects) &&
    parsed.subjects.length === 2
  ) {
    checks.exactSubjectNames = parsed.subjects.every(
      (item, index) =>
        exactKeys(item, ['subjectId', 'name']) &&
        item.subjectId === source?.subjects?.[index]?.subjectId &&
        item.name === source?.subjects?.[index]?.name,
    );
  }
  if (parsed?.schemaVersion === 1 && Array.isArray(parsed.metrics) && parsed.metrics.length === 3) {
    checks.exactMetricsAndStates = parsed.metrics.every((item, index) => {
      const expected = source?.metrics?.[index];
      return (
        exactKeys(item, ['key', 'values', 'delta', 'state']) &&
        item.key === expected?.key &&
        canonicalAgentMcpProfileJson(item.values) ===
          canonicalAgentMcpProfileJson(expected?.values) &&
        item.state === expected?.state
      );
    });
    checks.exactDeltas = parsed.metrics.every(
      (item, index) => item?.delta === source?.metrics?.[index]?.delta,
    );
  }
  return {
    accepted: Object.values(checks).every(Boolean),
    checks,
  };
}
