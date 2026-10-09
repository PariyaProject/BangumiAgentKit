import { createHash } from 'node:crypto';

export const A01_TARGET_TOOL = 'bangumi.compare_subject_cohorts';
export const A01_MAX_SUBJECTS = 8;
export const A01_EXPECTED_QUERY_BUDGET = Object.freeze({
  maxPages: 6,
  maxCandidates: 300,
  maxHydrations: 60,
  concurrency: 6,
  maxConceptProbes: 8,
  maxReturnedItems: A01_MAX_SUBJECTS,
});
export const A01_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  cohorts: [
    {
      label: '目标作品',
      query: {
        keyword: '少女终末旅行',
        media: 'anime',
        categories: 'tv',
        season: '2017-autumn',
        resultMode: 'all',
        nsfw: 'exclude',
      },
    },
    {
      label: '2017-autumn 动画返回样本',
      query: {
        media: 'anime',
        season: '2017-autumn',
        resultMode: 'all',
        nsfw: 'exclude',
      },
    },
  ],
  maxSubjects: A01_MAX_SUBJECTS,
});

const A01_OFFICIAL_OPERATIONS = new Set([
  'searchSubjects',
  'browseSubjects',
  'getSubjectById',
]);
const A01_EXPECTED_EFFECTIVE_QUERIES = A01_EXPECTED_QUERY_ARGUMENTS.cohorts.map(
  ({ query }) => ({
    ...query,
    limit: A01_MAX_SUBJECTS,
    budget: A01_EXPECTED_QUERY_BUDGET,
  }),
);
const A01_METRIC_STATES = new Set([
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
const A01_METRIC_ROW_STATES = new Set([
  'available',
  'partial',
  'missing',
  'conflict',
  'not_computable',
]);
const A01_TERMINAL_METRIC_STATES = [
  'upstream_error',
  'auth_required',
  'permission_denied',
  'unavailable',
  'unsupported',
  'stale',
];

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fixed(value) {
  return Number.isFinite(value) ? value.toFixed(3) : 'unavailable';
}

function subjectState(subject) {
  const state = subject?.metricStates?.ratingStandardDeviation;
  return typeof state === 'string' ? state : 'missing';
}

function subjectSdToken(subject) {
  const state = subjectState(subject);
  if (!Number.isFinite(subject?.ratingStandardDeviation)) return state.replaceAll('_', '-');
  if (state === 'available') return fixed(subject.ratingStandardDeviation);
  if (state === 'partial') return `partial:${fixed(subject.ratingStandardDeviation)}`;
  return state.replaceAll('_', '-');
}

function subjectCountToken(subject) {
  if (subject?.ratingCountState === 'invalid') return 'invalid';
  return Number.isSafeInteger(subject?.ratingCount) && subject.ratingCount >= 0
    ? String(subject.ratingCount)
    : 'unknown';
}

function cohortAverage(metric, index) {
  if (Number.isFinite(metric?.averages?.[index])) return fixed(metric.averages[index]);
  if (Number.isFinite(metric?.partialAverages?.[index])) {
    return `partial:${fixed(metric.partialAverages[index])}`;
  }
  return 'unavailable';
}

function queryCoverageToken(cohorts, field) {
  return JSON.stringify(
    cohorts.map((cohort) => cohort?.coverage?.query?.coverage?.[field] ?? 'unknown'),
  );
}

export function expectedA01AnswerLines(result) {
  const cohorts = Array.isArray(result?.cohorts) ? result.cohorts : [];
  const metric = Array.isArray(result?.metrics)
    ? result.metrics.find((item) => item?.key === 'ratingStandardDeviation')
    : undefined;
  const rows = cohorts.flatMap((cohort, index) =>
    (Array.isArray(cohort?.subjects) ? cohort.subjects : []).map((subject) => {
      const label = index === 0 ? 'A' : 'B';
      return `${label}｜${subject.id}｜name=${subject.name}｜displayName=${subject.displayName}｜SD=${subjectSdToken(subject)}｜state=${subjectState(subject)}｜ratingCount=${subjectCountToken(subject)}`;
    }),
  );
  const overlap = result?.coverage?.overlap ?? { subjectIds: [], count: 0 };
  const evidence = result?.coverage?.evidence ?? {};
  const source = result?.source?.official ?? {};
  const derivedSource = result?.source?.derived ?? {};
  const warnings = Array.isArray(result?.warnings)
    ? result.warnings.map((warning) => warning?.code).filter((code) => typeof code === 'string')
    : [];
  const queryStates = cohorts.map((cohort) => cohort?.coverage?.query?.state ?? 'unknown');
  const averageLine = [
    '指标：',
    'formula=bangumi.rating.population_sd.v1',
    `formulaVersion=${metric?.formula?.version ?? 'unknown'}`,
    `avgA=${cohortAverage(metric, 0)}`,
    `avgB=${cohortAverage(metric, 1)}`,
    `deltaB-A=${fixed(metric?.delta)}`,
    `valid=${JSON.stringify(metric?.validCounts ?? [])}`,
    `partial=${JSON.stringify(metric?.partialCounts ?? [])}`,
    `missing=${JSON.stringify(metric?.missingCounts ?? [])}`,
    `conflict=${JSON.stringify(metric?.conflictCounts ?? [])}`,
    `notComputable=${JSON.stringify(metric?.notComputableCounts ?? [])}`,
    `metricState=${metric?.state ?? 'unavailable'}`,
  ].join(';');
  const scopeLine = [
    '范围：',
    'A.query=(keyword=少女终末旅行,media=anime,categories=tv,season=2017-autumn,resultMode=all,nsfw=exclude)',
    'B.query=(media=anime,season=2017-autumn,resultMode=all,nsfw=exclude)',
    `maxSubjects=${result?.coverage?.maxSubjectsPerCohort ?? 'unknown'}/cohort`,
    `returned=[${cohorts.map((cohort) => cohort?.subjects?.length ?? 0).join(',')}]`,
    `queryState=${JSON.stringify(queryStates)}`,
    `coverageState=${queryCoverageToken(cohorts, 'state')}`,
    `scanned=${queryCoverageToken(cohorts, 'scanned')}`,
    `matched=${queryCoverageToken(cohorts, 'matched')}`,
    `pagesScanned=${queryCoverageToken(cohorts, 'pagesScanned')}`,
    `upstreamExhausted=${queryCoverageToken(cohorts, 'upstreamExhausted')}`,
    `totalKind=${queryCoverageToken(cohorts, 'totalKind')}`,
    `detailHydrations=${JSON.stringify(cohorts.map((cohort) => [
      cohort?.coverage?.detailHydrationsAttempted ?? 0,
      cohort?.coverage?.detailHydrationsSucceeded ?? 0,
      cohort?.coverage?.detailHydrationsFailed ?? 0,
    ]))}`,
    `resultState=${result?.state ?? 'unknown'}`,
    `truncated=${Boolean(result?.coverage?.truncated)}`,
    `overlapCount=${overlap.count ?? 'unknown'}`,
    `overlapIds=${JSON.stringify(overlap.subjectIds ?? [])}`,
    `source=official-v0`,
    `operations=${JSON.stringify(source.operations ?? [])}`,
    `retrievedAt=${source.retrievedAt ?? 'unknown'}`,
    `derivedOperations=${JSON.stringify(derivedSource.operations ?? [])}`,
    `derivedRetrievedAt=${derivedSource.retrievedAt ?? 'unknown'}`,
    `evidenceRetained=${evidence.retained ?? 'unknown'}`,
    `evidenceOmitted=${evidence.omitted ?? 'unknown'}`,
    `evidenceBytes=${evidence.bytes ?? 'unknown'}`,
    `evidenceMaxRefs=${evidence.maxRefs ?? 'unknown'}`,
    `evidenceMaxBytes=${evidence.maxBytes ?? 'unknown'}`,
    `evidenceTruncated=${Boolean(evidence.truncated)}`,
    `warningCodes=${JSON.stringify(warnings)}`,
    '结果仅描述官方 v0 本次有界返回样本的当前快照；估算总数、未返回或省略的条目不表示不存在或覆盖完整。',
    '没有统计显著性检验，不能据此认定“明显”或因果、质量、极化、推荐关系。',
  ].join(';');
  return {
    rows,
    averageLine,
    scopeTokens: scopeLine.split(';').slice(1),
  };
}

function exactTarget(cohorts) {
  const targetRows = Array.isArray(cohorts?.[0]?.subjects) ? cohorts[0].subjects : [];
  const target = targetRows[0];
  const acceptedTitles = new Set(['少女终末旅行', '少女終末旅行']);
  return (
    targetRows.length === 1 &&
    target?.id === 218707 &&
    (acceptedTitles.has(target?.name) || acceptedTitles.has(target?.displayName))
  );
}

function queryPlanMatches(cohorts) {
  return cohorts?.length === 2 && cohorts.every(
    (cohort, index) =>
      canonicalJson(cohort?.query) === canonicalJson(A01_EXPECTED_EFFECTIVE_QUERIES[index]),
  );
}

function expectedCohortMetricState(cohort, coverage) {
  const queryState = cohort?.coverage?.query?.state;
  const queryCoverageState = cohort?.coverage?.query?.coverage?.state;
  const queryMetricState = queryState === 'ok'
    ? undefined
    : queryState === 'not_found'
      ? 'not_computable'
      : queryState;
  if (queryMetricState !== undefined && queryMetricState !== 'partial') return queryMetricState;
  if (coverage.conflicts > 0) return 'conflict';
  if (
    coverage.valid === 0 &&
    coverage.partial === 0 &&
    coverage.notComputable > 0 &&
    coverage.missing === 0
  ) return 'not_computable';
  if (
    queryMetricState === 'partial' ||
    queryCoverageState !== 'complete' ||
    coverage.partial > 0 ||
    coverage.missing > 0 ||
    coverage.notComputable > 0
  ) return 'partial';
  if (coverage.valid === 0) return 'not_computable';
  return 'complete';
}

function aggregateMetricState(coverages) {
  for (const state of A01_TERMINAL_METRIC_STATES) {
    if (coverages.some((coverage) => coverage.state === state)) return state;
  }
  if (coverages.some((coverage) => coverage.state === 'conflict')) return 'conflict';
  if (coverages.every((coverage) => coverage.state === 'not_computable')) {
    return 'not_computable';
  }
  if (coverages.every((coverage) => coverage.state === 'complete')) return 'complete';
  return 'partial';
}

function metricCoverageMatches(result) {
  const cohorts = result?.cohorts;
  const metric = result?.metrics?.find((item) => item?.key === 'ratingStandardDeviation');
  if (!Array.isArray(cohorts) || cohorts.length !== 2 || !metric) return false;
  const coverageFields = ['valid', 'partial', 'missing', 'conflicts', 'notComputable', 'state'];
  const countFields = [
    ['validCounts', 'valid'],
    ['partialCounts', 'partial'],
    ['missingCounts', 'missing'],
    ['conflictCounts', 'conflicts'],
    ['notComputableCounts', 'notComputable'],
  ];
  const coverages = [];
  for (const cohort of cohorts) {
    const coverage = cohort?.coverage?.metrics?.ratingStandardDeviation;
    const rows = cohort?.subjects;
    if (
      !coverage ||
      !rows ||
      canonicalJson(Object.keys(coverage).sort()) !== canonicalJson([...coverageFields].sort()) ||
      !coverageFields.slice(0, -1).every(
        (field) => Number.isSafeInteger(coverage[field]) && coverage[field] >= 0,
      ) ||
      !A01_METRIC_STATES.has(coverage.state)
    ) return false;
    const rowCounts = Object.fromEntries([...A01_METRIC_ROW_STATES].map((state) => [state, 0]));
    for (const row of rows) {
      const state = subjectState(row);
      if (!A01_METRIC_ROW_STATES.has(state)) return false;
      const deviation = row?.ratingStandardDeviation;
      if (
        (state === 'available' || state === 'partial') &&
        (!Number.isFinite(deviation) || deviation < 0)
      ) return false;
      if (
        (state === 'missing' || state === 'not_computable') &&
        deviation !== undefined &&
        deviation !== null
      ) return false;
      rowCounts[state] += 1;
    }
    if (
      rowCounts.available !== coverage.valid ||
      rowCounts.partial !== coverage.partial ||
      rowCounts.missing !== coverage.missing ||
      rowCounts.conflict !== coverage.conflicts ||
      rowCounts.not_computable !== coverage.notComputable ||
      coverage.state !== expectedCohortMetricState(cohort, coverage)
    ) return false;
    coverages.push(coverage);
  }
  if (
    metric.state !== aggregateMetricState(coverages) ||
    !A01_METRIC_STATES.has(metric.state)
  ) return false;
  for (const [metricField, coverageField] of countFields) {
    const values = metric[metricField];
    if (
      !Array.isArray(values) ||
      values.length !== 2 ||
      values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
      values.some((value, index) => value !== coverages[index]?.[coverageField])
    ) return false;
  }
  const resultCoverage = result?.coverage;
  const queryCoverageStates = cohorts.map(
    (cohort) => cohort?.coverage?.query?.coverage?.state,
  );
  const completeCount = queryCoverageStates.filter((state) => state === 'complete').length;
  const expectedTruncated =
    cohorts.some((cohort) =>
      cohort?.coverage?.query?.coverage?.budgetExceeded ||
      cohort?.coverage?.query?.coverage?.state !== 'complete',
    ) ||
    resultCoverage?.evidence?.truncated === true ||
    resultCoverage?.warnings?.truncated === true;
  if (
    resultCoverage?.cohortsComplete !== completeCount ||
    resultCoverage?.cohortsPartial !== cohorts.length - completeCount ||
    typeof resultCoverage?.truncated !== 'boolean' ||
    resultCoverage.truncated !== expectedTruncated ||
    typeof resultCoverage?.evidence?.truncated !== 'boolean' ||
    typeof resultCoverage?.warnings?.truncated !== 'boolean'
  ) return false;

  if (metric.state === 'complete') {
    return (
      Array.isArray(metric.averages) &&
      metric.averages.length === 2 &&
      metric.averages.every((value) => Number.isFinite(value) && value >= 0) &&
      metric.partialAverages === undefined &&
      Number.isFinite(metric.delta) &&
      Math.abs(metric.delta - (metric.averages[1] - metric.averages[0])) <= 1e-9 &&
      coverages.every((coverage) =>
        coverage.state === 'complete' &&
        coverage.valid > 0 &&
        coverage.partial === 0 &&
        coverage.missing === 0 &&
        coverage.conflicts === 0 &&
        coverage.notComputable === 0,
      )
    );
  }

  return (
    Array.isArray(metric.averages) &&
    metric.averages.length === 2 &&
    metric.averages.every((value) => value === undefined || value === null) &&
    Array.isArray(metric.partialAverages) &&
    metric.partialAverages.length === 2 &&
    metric.partialAverages.every((value, index) => {
      if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
        return false;
      }
      return (coverages[index].valid + coverages[index].partial > 0) === Number.isFinite(value);
    }) &&
    (metric.delta === undefined || metric.delta === null)
  );
}

function officialEvidenceMatches(result) {
  const operations = result?.source?.official?.operations;
  const sources = (Array.isArray(result?.evidence) ? result.evidence : [])
    .map((item) => item?.source)
    .filter((source) => source?.class === 'official_v0');
  if (!Array.isArray(operations) || sources.length === 0 || !sources.every((source) =>
    source.provider === 'bangumi' &&
    source.version === 'v0' &&
    A01_OFFICIAL_OPERATIONS.has(source.operation) &&
    (source.experimental === undefined || typeof source.experimental === 'boolean'),
  )) return false;
  const summaryOperations = new Set(operations);
  const evidenceOperations = new Set(sources.map((source) => source.operation));
  if ([...evidenceOperations].some((operation) => !summaryOperations.has(operation))) return false;
  return result?.coverage?.evidence?.truncated === true ||
    canonicalJson([...summaryOperations].sort()) === canonicalJson([...evidenceOperations].sort());
}

function overlapMatches(result) {
  const firstIds = new Set((result?.cohorts?.[0]?.subjects ?? []).map((item) => item?.id));
  const expected = [...new Set((result?.cohorts?.[1]?.subjects ?? []).map((item) => item?.id))]
    .filter((id) => firstIds.has(id))
    .sort((left, right) => left - right);
  const observed = [...(result?.coverage?.overlap?.subjectIds ?? [])].sort(
    (left, right) => left - right,
  );
  return (
    result?.coverage?.overlap?.count === expected.length &&
    canonicalJson(observed) === canonicalJson(expected)
  );
}

function affirmativeClaim(answer, patterns) {
  const negation = /(?:不能|不可|不表示|不代表|不意味着|不足以|无法|没有|并非|未能|不等于)/u;
  const sentenceEnd = /[。！？!?;\n]/u;
  const sentenceStart = /[。！？!?;\n]/gu;
  for (const pattern of patterns) {
    for (const match of answer.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const boundaryBefore = [...answer.slice(0, start).matchAll(sentenceStart)].at(-1);
      const startOfSentence = boundaryBefore ? boundaryBefore.index + boundaryBefore[0].length : 0;
      const nextBoundary = answer.slice(end).search(sentenceEnd);
      const endOfSentence = nextBoundary < 0 ? answer.length : end + nextBoundary + 1;
      if (/[？?]/u.test(answer.slice(start, endOfSentence))) continue;
      const clausePrefix = answer
        .slice(startOfSentence, start)
        .split(/(?:但|但是|然而|不过|实际上|[，,:；])/u)
        .at(-1) ?? '';
      if (negation.test(clausePrefix.slice(-40))) continue;
      return true;
    }
  }
  return false;
}

function affirmativeSignificanceClaim(answer) {
  return affirmativeClaim(answer, [
    /(?:评分标准差|SD|差值|目标|A组).{0,24}(?:明显|显著).{0,16}(?:高于|偏高|更高|较高|大于|超过)/giu,
    /(?:明显|显著)(?:地)?(?:高于|偏高|更高|较高|大于|超过)/giu,
    /(?:证明|表明|说明).{0,24}(?:统计显著|因果|质量更高|极化|推荐)/giu,
  ]);
}

function affirmativeGlobalCoverageClaim(answer) {
  return affirmativeClaim(answer, [
    /(?:覆盖|囊括|包含|枚举|遍历|穷尽|检索到|扫描了|拿到了).{0,20}(?:全季|全量|全部|所有|完整|全面|整个|全库|全站).{0,20}(?:动画|作品|条目|样本|数据|列表)?/giu,
    /(?:所有|全部|全量|全季|整个季度|整个秋季).{0,16}(?:2017年秋季|2017-autumn|秋季动画|动画|作品|条目|样本|数据库)/giu,
    /(?:2017年秋季|2017-autumn|2017年10月至12月|2017年10到12月).{0,18}(?:所有|全部|全量).{0,18}(?:动画|作品|条目|样本|数据库)/giu,
    /(?:完整|全量|全部).{0,16}(?:覆盖|枚举|抓取|检索|遍历|列表|样本|清单)/giu,
  ]);
}

function affirmativeUnsupportedInterpretation(answer) {
  return affirmativeClaim(answer, [
    /(?:证明|表明|说明|显示|意味着|因此|所以).{0,24}(?:因果|导致|造成|质量更高|质量更好|作品质量|两极化|极化|推荐|值得推荐)/giu,
    /(?:评分标准差|标准差|评分离散|差值).{0,20}(?:证明|表明|说明|意味着|代表).{0,20}(?:因果|质量|两极化|极化|推荐)/giu,
    /(?:标准差|评分差异|评分变化|A组|B组).{0,20}(?:导致|造成|引起|归因于|因为).{0,20}(?:作品|评分|评价|质量|用户|观看|极化)/giu,
    /(?:我|可以|值得|更)?推荐.{0,8}(?:本作|这部作品|该作品|作品|条目|观看|选择)/giu,
    /(?:质量更高|质量更好|更值得看|更值得推荐|推荐观看|建议观看)/giu,
  ]);
}

export function verifyA01AgentAnswer({ answer, queryArguments, toolResult }) {
  const result = toolResult?.structuredContent;
  const cohorts = result?.cohorts;
  const metric = result?.metrics?.find((item) => item?.key === 'ratingStandardDeviation');
  const lines = typeof answer === 'string' ? answer.split(/\r?\n/u).map((line) => line.trim()) : [];
  const expected = expectedA01AnswerLines(result);
  const expectedScopeLine = `范围：${expected.scopeTokens.join(';')}`;
  const outputRowLines = lines.filter((line) => /^(?:A|B)｜/u.test(line));
  const exactRows = expected.rows.length > 0 &&
    canonicalJson(lines.slice(0, expected.rows.length)) === canonicalJson(expected.rows) &&
    canonicalJson(outputRowLines) === canonicalJson(expected.rows);
  const checks = {
    fixedArguments: canonicalJson(queryArguments) === canonicalJson(A01_EXPECTED_QUERY_ARGUMENTS),
    resultStructuredContent: Boolean(result && Array.isArray(result.cohorts) && Array.isArray(result.metrics)),
    targetIdentity: exactTarget(cohorts),
    queryPlan: queryPlanMatches(cohorts),
    sampleBound: result?.coverage?.maxSubjectsPerCohort === A01_MAX_SUBJECTS &&
      cohorts?.length === 2 &&
      cohorts.every(
        (cohort) =>
          Array.isArray(cohort?.subjects) && cohort.subjects.length <= A01_MAX_SUBJECTS,
      ),
    returnedRowCount: result?.coverage?.totalSubjectsReturned ===
      cohorts?.reduce(
        (total, cohort) => total + (Array.isArray(cohort?.subjects) ? cohort.subjects.length : 0),
        0,
      ),
    metricFormula: metric?.formula?.id === 'bangumi.rating.population_sd.v1' &&
      metric?.formula?.version === 1,
    metricCoverage: metricCoverageMatches(result),
    overlap: overlapMatches(result),
    officialProvenance: result?.source?.official?.class === 'official-v0' &&
      Array.isArray(result.source.official.operations) &&
      result.source.official.operations.length > 0 &&
      officialEvidenceMatches(result),
    officialPublicOperations: Array.isArray(result?.source?.official?.operations) &&
      result.source.official.operations.every(
        (operation) => typeof operation === 'string' && A01_OFFICIAL_OPERATIONS.has(operation),
      ),
    answerPresent: typeof answer === 'string' && answer.trim().length > 0,
    exactRows,
    exactMetricLine: lines[expected.rows.length] === expected.averageLine,
    exactScopeLine:
      typeof answer === 'string' &&
      lines.length === expected.rows.length + 2 &&
      lines[expected.rows.length + 1] === expectedScopeLine,
    rejectsUnsupportedSignificance: !affirmativeSignificanceClaim(answer ?? ''),
    rejectsUnsupportedCompleteness: !affirmativeGlobalCoverageClaim(answer ?? ''),
    rejectsUnsupportedInterpretation: !affirmativeUnsupportedInterpretation(answer ?? ''),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    answerSha256: typeof answer === 'string' ? sha256(answer) : null,
    answerUtf8Bytes: typeof answer === 'string' ? Buffer.byteLength(answer, 'utf8') : null,
  };
}
