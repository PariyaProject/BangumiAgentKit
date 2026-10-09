import { isDeepStrictEqual } from 'node:util';

export const A01_AGGREGATE_TARGET_TOOL = 'bangumi.aggregate_subject_cohort';
export const A01_AGGREGATE_ARGUMENT_PROFILE = 'a01-aggregate-2012-anime-sample-v1';
export const A01_AGGREGATE_EXPECTED_ARGUMENTS = Object.freeze({
  cohort: Object.freeze({
    query: Object.freeze({
      media: 'anime',
      year: 2012,
      resultMode: 'all',
    }),
  }),
  maxSubjects: 1,
});

const METRICS = [
  ['score', '平均评分'],
  ['heat', '平均热度'],
  ['episodesReported', '平均报告话数'],
  ['ratingStandardDeviation', '平均评分总体标准差'],
];
const METRIC_STATES = new Set([
  'complete',
  'partial',
  'conflict',
  'unavailable',
  'not_computable',
  'not_found',
  'upstream_error',
  'unsupported',
  'stale',
  'auth_required',
  'permission_denied',
]);
const RESULT_STATES = new Set([
  'complete',
  'partial',
  'conflict',
  'unavailable',
  'not_computable',
  'not_found',
  'upstream_error',
  'unsupported',
  'stale',
  'auth_required',
  'permission_denied',
]);
const QUERY_STATES = new Set([
  'ok',
  'partial',
  'stale',
  'conflict',
  'auth_required',
  'permission_denied',
  'unavailable',
  'not_computable',
  'unsupported',
  'not_found',
  'upstream_error',
]);
const COVERAGE_STATES = new Set(['complete', 'partial', 'unknown', 'not_applicable']);
const SUBJECT_METRIC_STATES = new Set([
  'available',
  'partial',
  'missing',
  'conflict',
  'not_computable',
]);
const METRIC_VALUE_FIELDS = {
  score: 'score',
  heat: 'collectionTotal',
  episodesReported: 'episodesReported',
  ratingStandardDeviation: 'ratingStandardDeviation',
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedCounter(value, maximum = 1) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function metricValue(metric) {
  const average = metric.averages?.[0];
  if (typeof average === 'number' && Number.isFinite(average)) {
    return average;
  }
  const partial = metric.partialAverages?.[0];
  return typeof partial === 'number' && Number.isFinite(partial) ? partial : null;
}

function summarizeMetric(metric, expectedKey) {
  if (
    !isRecord(metric) ||
    metric.key !== expectedKey ||
    !METRIC_STATES.has(metric.state) ||
    !Array.isArray(metric.averages) ||
    metric.averages.length !== 1 ||
    !Array.isArray(metric.validCounts) ||
    !Array.isArray(metric.partialCounts) ||
    !Array.isArray(metric.missingCounts) ||
    !Array.isArray(metric.conflictCounts) ||
    !Array.isArray(metric.notComputableCounts) ||
    [
      metric.validCounts,
      metric.partialCounts,
      metric.missingCounts,
      metric.conflictCounts,
      metric.notComputableCounts,
    ].some((counts) => counts.length !== 1 || !boundedCounter(counts[0]))
  ) {
    return null;
  }
  if (
    metric.averages[0] !== undefined &&
    metric.averages[0] !== null &&
    (typeof metric.averages[0] !== 'number' || !Number.isFinite(metric.averages[0]))
  ) {
    return null;
  }
  if (
    metric.partialAverages !== undefined &&
    (!Array.isArray(metric.partialAverages) ||
      metric.partialAverages.length !== 1 ||
      (metric.partialAverages[0] !== null &&
        metric.partialAverages[0] !== undefined &&
        (typeof metric.partialAverages[0] !== 'number' ||
          !Number.isFinite(metric.partialAverages[0]))))
  ) {
    return null;
  }
  return {
    key: expectedKey,
    state: metric.state,
    value: metricValue(metric),
    valid: metric.validCounts[0],
    partial: metric.partialCounts[0],
    missing: metric.missingCounts[0],
    conflicts: metric.conflictCounts[0],
    notComputable: metric.notComputableCounts[0],
  };
}

function expectedMetricCoverageState(key, queryState, queryCoverageState, counts) {
  const queryMetricState =
    queryState === 'ok' ? null : queryState === 'not_found' ? 'not_computable' : queryState;
  if (queryMetricState !== null && queryMetricState !== 'partial') return queryMetricState;
  if (counts.conflicts > 0) return 'conflict';
  if (key !== 'ratingStandardDeviation' && counts.valid === 0) return 'not_computable';
  if (counts.valid + counts.partial === 0 && counts.notComputable > 0 && counts.missing === 0) {
    return 'not_computable';
  }
  if (
    queryMetricState === 'partial' ||
    queryCoverageState !== 'complete' ||
    counts.partial > 0 ||
    counts.missing > 0 ||
    counts.notComputable > 0
  ) {
    return 'partial';
  }
  return counts.valid === 0 ? 'not_computable' : 'complete';
}

function expectedOverallState(queryState, metricStates, coverageTruncated = false) {
  const terminalQueryStates = [
    'upstream_error',
    'auth_required',
    'permission_denied',
    'unavailable',
    'unsupported',
    'stale',
  ];
  if (terminalQueryStates.includes(queryState)) return queryState;
  if (queryState === 'not_found') return 'not_found';
  if (metricStates.some((state) => state === 'conflict')) return 'conflict';
  if (metricStates.every((state) => state === 'not_computable')) return 'not_computable';
  if (
    queryState !== 'ok' ||
    metricStates.some((state) => state !== 'complete') ||
    coverageTruncated
  )
    return 'partial';
  return 'complete';
}

function expectedMetricAverage(subjects, key) {
  const field = METRIC_VALUE_FIELDS[key];
  const values = [];
  for (const subject of subjects) {
    const state = subject.metricStates[key];
    if (state !== 'available' && state !== 'partial') continue;
    const value = subject[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      values.push(value);
    } else if (state === 'available') {
      return undefined;
    }
  }
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeA01AggregateResult(result) {
  if (
    !isRecord(result) ||
    !RESULT_STATES.has(result.state) ||
    !Array.isArray(result.cohorts) ||
    result.cohorts.length !== 1 ||
    !Array.isArray(result.metrics) ||
    result.metrics.length !== METRICS.length ||
    !isRecord(result.coverage) ||
    !isRecord(result.source) ||
    !isRecord(result.source.official) ||
    result.source.official.class !== 'official-v0'
  ) {
    return null;
  }
  const cohort = result.cohorts[0];
  const queryCoverage = cohort?.coverage?.query?.coverage;
  if (
    !isRecord(cohort) ||
    !isRecord(cohort.query) ||
    !isDeepStrictEqual(cohort.query, A01_AGGREGATE_EXPECTED_ARGUMENTS.cohort.query) ||
    !Array.isArray(cohort.subjects) ||
    cohort.subjects.length > 1 ||
    !isRecord(queryCoverage) ||
    !COVERAGE_STATES.has(queryCoverage.state) ||
    !boundedCounter(queryCoverage.scanned, 500) ||
    !boundedCounter(queryCoverage.matched, 500) ||
    !boundedCounter(queryCoverage.returned, 500) ||
    queryCoverage.matched > queryCoverage.scanned ||
    queryCoverage.returned > queryCoverage.matched ||
    !['estimated', 'exact', 'unknown'].includes(queryCoverage.totalKind) ||
    !isRecord(cohort.coverage) ||
    !isRecord(cohort.coverage.query) ||
    !QUERY_STATES.has(cohort.coverage.query.state) ||
    !isRecord(cohort.coverage.metrics) ||
    !Number.isSafeInteger(cohort.coverage.detailHydrationsAttempted) ||
    cohort.coverage.detailHydrationsAttempted < 0 ||
    cohort.coverage.detailHydrationsAttempted > 1 ||
    !Number.isSafeInteger(cohort.coverage.detailHydrationsSucceeded) ||
    cohort.coverage.detailHydrationsSucceeded < 0 ||
    cohort.coverage.detailHydrationsSucceeded > cohort.coverage.detailHydrationsAttempted ||
    !Number.isSafeInteger(cohort.coverage.detailHydrationsFailed) ||
    cohort.coverage.detailHydrationsFailed < 0 ||
    cohort.coverage.detailHydrationsFailed > cohort.coverage.detailHydrationsAttempted ||
    !Number.isSafeInteger(result.coverage.maxSubjectsPerCohort) ||
    result.coverage.maxSubjectsPerCohort !== 1 ||
    !Number.isSafeInteger(result.coverage.totalSubjectsReturned) ||
    result.coverage.totalSubjectsReturned < 0 ||
    result.coverage.totalSubjectsReturned > 1 ||
    !Number.isSafeInteger(result.coverage.cohortsComplete) ||
    !Number.isSafeInteger(result.coverage.cohortsPartial) ||
    result.coverage.cohortsComplete < 0 ||
    result.coverage.cohortsPartial < 0 ||
    result.coverage.cohortsComplete + result.coverage.cohortsPartial !== 1 ||
    !Number.isSafeInteger(result.coverage.detailHydrationsAttempted) ||
    !Number.isSafeInteger(result.coverage.detailHydrationsSucceeded) ||
    !Number.isSafeInteger(result.coverage.detailHydrationsFailed) ||
    result.coverage.detailHydrationsAttempted !== cohort.coverage.detailHydrationsAttempted ||
    result.coverage.detailHydrationsSucceeded !== cohort.coverage.detailHydrationsSucceeded ||
    result.coverage.detailHydrationsFailed !== cohort.coverage.detailHydrationsFailed ||
    typeof queryCoverage.budgetExceeded !== 'boolean' ||
    typeof queryCoverage.upstreamExhausted !== 'boolean' ||
    typeof result.coverage.truncated !== 'boolean' ||
    !Array.isArray(result.source.official.operations) ||
    result.source.official.operations.length < 1 ||
    result.source.official.operations.length > 2 ||
    result.source.official.operations.some(
      (operation) => !['searchSubjects', 'getSubjectById'].includes(operation),
    )
  ) {
    return null;
  }
  const totalReturned = result.coverage.totalSubjectsReturned;
  const queryResultState = cohort.coverage.query.state;
  const queryLimited =
    queryCoverage.budgetExceeded ||
    !queryCoverage.upstreamExhausted ||
    queryCoverage.matched > queryCoverage.returned;
  if (
    cohort.subjects.length !== totalReturned ||
    queryCoverage.returned !== totalReturned ||
    cohort.coverage.detailHydrationsAttempted !== totalReturned ||
    cohort.coverage.detailHydrationsSucceeded + cohort.coverage.detailHydrationsFailed !==
      cohort.coverage.detailHydrationsAttempted ||
    result.coverage.cohortsComplete !== (queryCoverage.state === 'complete' ? 1 : 0) ||
    result.coverage.cohortsPartial !== (queryCoverage.state === 'complete' ? 0 : 1) ||
    ((queryCoverage.state !== 'complete' || queryCoverage.budgetExceeded) &&
      !result.coverage.truncated) ||
    (queryCoverage.state === 'complete' &&
      (queryCoverage.budgetExceeded ||
        !queryCoverage.upstreamExhausted ||
        queryCoverage.matched !== queryCoverage.returned)) ||
    (queryLimited &&
      ['ok', 'partial', 'not_found'].includes(queryResultState) &&
      (queryCoverage.state !== 'partial' ||
        queryResultState !== 'partial' ||
        result.coverage.cohortsComplete !== 0 ||
        result.coverage.cohortsPartial !== 1 ||
        !result.coverage.truncated ||
        result.state === 'complete')) ||
    (totalReturned === 0 && cohort.coverage.query.state === 'ok') ||
    (totalReturned > 0 && cohort.coverage.query.state === 'not_found')
  ) {
    return null;
  }
  const metricKeys = METRICS.map(([key]) => key);
  if (
    Object.keys(cohort.coverage.metrics).sort().join('\0') !== [...metricKeys].sort().join('\0')
  ) {
    return null;
  }
  const rowCounts = Object.fromEntries(
    metricKeys.map((key) => [
      key,
      { valid: 0, partial: 0, missing: 0, conflicts: 0, notComputable: 0 },
    ]),
  );
  for (const subject of cohort.subjects) {
    if (
      !isRecord(subject) ||
      !isRecord(subject.metricStates) ||
      Object.keys(subject.metricStates).sort().join('\0') !== [...metricKeys].sort().join('\0')
    ) {
      return null;
    }
    for (const key of metricKeys) {
      const state = subject.metricStates[key];
      if (!SUBJECT_METRIC_STATES.has(state)) return null;
      if (state === 'available') rowCounts[key].valid += 1;
      else if (state === 'partial') rowCounts[key].partial += 1;
      else if (state === 'missing') rowCounts[key].missing += 1;
      else if (state === 'conflict') rowCounts[key].conflicts += 1;
      else rowCounts[key].notComputable += 1;
    }
  }
  const metrics = METRICS.map(([key]) =>
    summarizeMetric(
      result.metrics.find((metric) => metric?.key === key),
      key,
    ),
  );
  if (metrics.some((metric) => metric === null)) return null;
  for (let index = 0; index < metricKeys.length; index += 1) {
    const key = metricKeys[index];
    const metric = metrics[index];
    const rawMetric = result.metrics.find((item) => item?.key === key);
    const coverageMetric = cohort.coverage.metrics[key];
    const counts = rowCounts[key];
    const countFields = ['valid', 'partial', 'missing', 'conflicts', 'notComputable'];
    if (
      !isRecord(coverageMetric) ||
      !METRIC_STATES.has(coverageMetric.state) ||
      countFields.some(
        (field) =>
          !boundedCounter(coverageMetric[field]) ||
          coverageMetric[field] !== counts[field] ||
          coverageMetric[field] !== metric[field],
      ) ||
      coverageMetric.state !==
        expectedMetricCoverageState(
          key,
          cohort.coverage.query.state,
          queryCoverage.state,
          counts,
        ) ||
      metric.state !== coverageMetric.state
    ) {
      return null;
    }
    const expectedAverage = expectedMetricAverage(cohort.subjects, key);
    if (expectedAverage === undefined || metric.value !== expectedAverage) return null;
    if (rawMetric.state === 'complete') {
      if (rawMetric.averages[0] !== expectedAverage || rawMetric.partialAverages !== undefined) {
        return null;
      }
    } else if (
      (rawMetric.averages[0] !== null && rawMetric.averages[0] !== undefined) ||
      (rawMetric.partialAverages?.[0] ?? null) !== expectedAverage
    ) {
      return null;
    }
  }
  if (
    result.state !==
    expectedOverallState(
      cohort.coverage.query.state,
      metrics.map((metric) => metric.state),
      result.coverage.truncated,
    )
  ) {
    return null;
  }
  return {
    state: result.state,
    formulaVersion: result.formulaVersion,
    query: {
      state: cohort.coverage.query.state,
      scanned: queryCoverage.scanned,
      matched: queryCoverage.matched,
      returned: queryCoverage.returned,
      totalKind: queryCoverage.totalKind,
      budgetExceeded: queryCoverage.budgetExceeded,
      upstreamExhausted: queryCoverage.upstreamExhausted,
    },
    coverage: {
      maxSubjectsPerCohort: result.coverage.maxSubjectsPerCohort,
      totalSubjectsReturned: result.coverage.totalSubjectsReturned,
      cohortsComplete: result.coverage.cohortsComplete,
      cohortsPartial: result.coverage.cohortsPartial,
      detailHydrationsAttempted: result.coverage.detailHydrationsAttempted,
      detailHydrationsSucceeded: result.coverage.detailHydrationsSucceeded,
      detailHydrationsFailed: result.coverage.detailHydrationsFailed,
      truncated: result.coverage.truncated,
    },
    metrics,
    officialOperations: [...result.source.official.operations],
  };
}

function metricText(metric, label) {
  const value = metric.value === null ? '不可用' : metric.value.toFixed(2);
  return (
    label +
    '=' +
    value +
    '（' +
    metric.state +
    '；有效' +
    metric.valid +
    '、部分' +
    metric.partial +
    '、缺失' +
    metric.missing +
    '、冲突' +
    metric.conflicts +
    '、不可计算' +
    metric.notComputable +
    '）'
  );
}

export function expectedA01AggregateAnswer(summary) {
  const metrics = METRICS.map(([, label], index) => metricText(summary.metrics[index], label)).join(
    '；',
  );
  const query = summary.query;
  const coverage = summary.coverage;
  return (
    '指标：' +
    metrics +
    '。范围：2012 年 anime；本次最多返回 ' +
    coverage.maxSubjectsPerCohort +
    ' 条，实际返回 ' +
    coverage.totalSubjectsReturned +
    ' 条；查询状态 ' +
    query.state +
    '（scanned=' +
    query.scanned +
    '，matched=' +
    query.matched +
    '，returned=' +
    query.returned +
    '，total=' +
    query.totalKind +
    '，预算超限=' +
    (query.budgetExceeded ? '是' : '否') +
    '，上游耗尽=' +
    (query.upstreamExhausted ? '是' : '否') +
    '），详情请求 ' +
    coverage.detailHydrationsAttempted +
    ' 次、成功 ' +
    coverage.detailHydrationsSucceeded +
    ' 次、失败 ' +
    coverage.detailHydrationsFailed +
    ' 次；整体状态 ' +
    summary.state +
    '，截断=' +
    (coverage.truncated ? '是' : '否') +
    '。限制：这只是官方 v0 当前有界返回样本，不代表 Bangumi 全库或完整 cohort；不据此推断统计显著性、作品质量、因果关系或历史趋势。'
  );
}

export function verifyA01AggregateAnswer({ answer, queryArguments, toolResult }) {
  const summary = summarizeA01AggregateResult(toolResult?.structuredContent);
  const checks = {
    fixedArguments: isDeepStrictEqual(queryArguments, A01_AGGREGATE_EXPECTED_ARGUMENTS),
    structuredResultReadback: summary !== null,
    exactAggregateAnswer:
      summary !== null &&
      typeof answer === 'string' &&
      answer.trim() === expectedA01AggregateAnswer(summary),
    boundedSampleDisclosure:
      typeof answer === 'string' &&
      answer.includes('最多返回 1 条') &&
      answer.includes('不代表 Bangumi 全库或完整 cohort'),
    nonCausalLimitations:
      typeof answer === 'string' &&
      answer.includes('不据此推断统计显著性、作品质量、因果关系或历史趋势'),
    plainTextNoMarkdown:
      typeof answer === 'string' && answer.trim() === answer && !/[\r\n#*_\x60]/u.test(answer),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    summary,
  };
}
