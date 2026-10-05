export const G15_AGENT_ANSWER_CHECK_METHOD = 'ordered-two-subject-metric-identity-and-caveat-v1';
export const G15_SUBJECT_IDS = Object.freeze([400602, 420628]);
const EXPECTED_SUBJECT_NAMES = new Map([
  [400602, new Set(['葬送的芙莉莲', '葬送のフリーレン'])],
  [420628, new Set(['药屋少女的呢喃', '薬屋のひとりごと'])],
]);
const TOOL_NAME = 'bangumi.get_subject_comparison';
const REQUIRED_METRIC_KEYS = Object.freeze([
  'score',
  'episodesReported',
  'collectionCompletionRate',
]);
const ALLOWED_METRIC_KEYS = new Set([
  'score',
  'episodesReported',
  'totalEpisodesReported',
  'collectionCompletionRate',
]);
const IDENTITY_LINE = /^条目｜(\d+)｜名称[:=：](.+)$/u;
const METRIC_LINE =
  /^指标｜(score|episodesReported|totalEpisodesReported|collectionCompletionRate)｜A=(.+)｜B=(.+)｜B-A=(.+)｜state=(complete|unknown|conflict)$/u;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)/u;
const FORBIDDEN_POSITIVE_CLAIM =
  /(?:整体质量更高|作品质量更高|谁更优秀|更值得看|推荐(?:观看)?|评分上升|热度上升|排名上升|完整比较|完整(?:榜单|名单|统计|演职员表|覆盖|结果|列表)|全量(?:数据|名单|结果|覆盖)|全站(?:完整|数据|列表|覆盖)|(?:覆盖|囊括)全部(?:作品|条目|动画)|所有(?:动画|作品|条目)|全部(?:动画|作品|条目)|没有遗漏|没有共同(?:声优|演员|职员|制作人员)|不存在共同(?:声优|演员|职员|制作人员))/gu;
const CLAIM_NEGATION =
  /(?:不代表|并非|并不是|不能据此|无法据此|不能|无法|不足以|不是|不等于|不说明|未能|不推断)\s*$/u;

export function verifyG15AgentAnswer(answer, toolName, queryArguments, toolOutput) {
  const args = unwrapArguments(queryArguments);
  const queryArgumentsMatch = exactQueryArguments(args);
  const result = findComparisonResult(toolOutput);
  const resultReadbackAvailable = Boolean(result);
  const subjectIdentity = result ? validateSubjectIdentity(result) : emptyIdentityCheck();
  const expectedMetrics = result ? collectExpectedMetrics(result) : [];
  const parsed = parseAnswer(answer);
  const identityMatches = validateIdentityRows(parsed.identityRows, subjectIdentity.expectedById);
  const identityOrderPreserved =
    parsed.identityRows.length === G15_SUBJECT_IDS.length &&
    parsed.identityRows.every((row, index) => row.id === G15_SUBJECT_IDS[index]);
  const expectedMetricByKey = new Map(expectedMetrics.map((metric) => [metric.key, metric]));
  const seenMetricKeys = new Set();
  let metricRowsMatched = 0;
  let duplicateMetricRows = 0;
  let unmatchedMetricRows = 0;
  let mismatchedMetricRows = 0;

  for (const row of parsed.metrics) {
    if (seenMetricKeys.has(row.key)) duplicateMetricRows += 1;
    seenMetricKeys.add(row.key);
    const expected = expectedMetricByKey.get(row.key);
    if (!expected) {
      unmatchedMetricRows += 1;
      continue;
    }
    if (matchesMetric(row, expected)) metricRowsMatched += 1;
    else mismatchedMetricRows += 1;
  }

  const missingMetricRows = expectedMetrics.filter(
    (metric) => !seenMetricKeys.has(metric.key),
  ).length;
  const requiredMetricsPresent = REQUIRED_METRIC_KEYS.every((key) => expectedMetricByKey.has(key));
  const metricStatesPreserved = parsed.metrics.every((row) => {
    const expected = expectedMetricByKey.get(row.key);
    return expected && row.state === expected.state;
  });
  const scopeText = parsed.scopeLines.join('\n');
  const sourceContract = result
    ? validateSourceContract(result)
    : { passed: false, stats: null, formula: null };
  const caveats = validateCaveats(scopeText, result);
  const unsupportedClaims = hasUnqualifiedClaim(answer, FORBIDDEN_POSITIVE_CLAIM);
  const markdownFormattingDetected =
    answerLines(answer).some((line) => MARKDOWN_LINE.test(line)) ||
    answer.includes('**') ||
    answer.includes('`');
  const passed =
    typeof answer === 'string' &&
    answer.trim().length > 0 &&
    toolName === TOOL_NAME &&
    queryArgumentsMatch &&
    resultReadbackAvailable &&
    sourceContract.passed &&
    subjectIdentity.passed &&
    parsed.identityRows.length === 2 &&
    identityOrderPreserved &&
    identityMatches.matched === 2 &&
    identityMatches.unmatched === 0 &&
    parsed.malformedIdentityRows === 0 &&
    parsed.malformedMetricRows === 0 &&
    requiredMetricsPresent &&
    parsed.duplicateIdentityRows === 0 &&
    parsed.unstructuredAnswerLinesCount === 0 &&
    parsed.metrics.length === expectedMetrics.length &&
    metricRowsMatched === expectedMetrics.length &&
    mismatchedMetricRows === 0 &&
    unmatchedMetricRows === 0 &&
    duplicateMetricRows === 0 &&
    missingMetricRows === 0 &&
    metricStatesPreserved &&
    caveats.passed &&
    !unsupportedClaims &&
    !markdownFormattingDetected;

  return {
    method: G15_AGENT_ANSWER_CHECK_METHOD,
    toolNameMatch: toolName === TOOL_NAME,
    queryArgumentsMatch,
    resultReadbackAvailable,
    resultState: result?.state ?? null,
    resultSourceContractPassed: sourceContract.passed,
    requestedSubjectIdsMatch: subjectIdentity.subjectIdsMatch,
    sourceSubjectIdentitiesMatch: subjectIdentity.passed,
    subjectIdentityRowsExpected: subjectIdentity.expected,
    subjectIdentityRowsMatched: identityMatches.matched,
    subjectIdentityRowsUnmatched: identityMatches.unmatched + parsed.malformedIdentityRows,
    identityOrderPreserved,
    malformedMetricRows: parsed.malformedMetricRows,
    duplicateIdentityRows: parsed.duplicateIdentityRows,
    requiredMetricsPresent,
    expectedMetricRows: expectedMetrics.length,
    answerMetricRowsParsed: parsed.metrics.length,
    metricRowsMatched,
    missingMetricRows,
    mismatchedMetricRows,
    unmatchedMetricRows,
    duplicateMetricRows,
    metricStatesPreserved,
    unstructuredAnswerLinesCount: parsed.unstructuredAnswerLinesCount,
    currentOfficialV0DisclosurePresent: caveats.currentOfficialV0DisclosurePresent,
    currentSnapshotDisclosurePresent: caveats.currentSnapshotDisclosurePresent,
    noHistoricalTrendClaimPresent: caveats.noHistoricalTrendClaimPresent,
    deltaDirectionDisclosurePresent: caveats.deltaDirectionDisclosurePresent,
    completionFormulaDisclosurePresent: caveats.completionFormulaDisclosurePresent,
    completionFormulaEvidenceDisclosurePresent: caveats.completionFormulaEvidenceDisclosurePresent,
    notPersonalWatchProgressDisclosurePresent: caveats.notPersonalWatchProgressDisclosurePresent,
    boundedOverlapDisclosurePresent: caveats.boundedOverlapDisclosurePresent,
    omissionNotAbsenceDisclosurePresent: caveats.omissionNotAbsenceDisclosurePresent,
    unsupportedClaimPresent: unsupportedClaims,
    markdownFormattingDetected,
    passed,
  };
}

export function createSanitizedG15CanaryReport(input) {
  const check = input.answerCheck;
  const passed =
    input.probeProcessExitCode === 0 &&
    input.resultStatus === 'SUCCESS' &&
    input.completedBangumiToolCalls === 1 &&
    input.otherCompletedToolEvents === 0 &&
    input.textReadbackAvailable === true &&
    input.textProjectionBytes <= 3600 &&
    check?.passed === true;
  return {
    schemaVersion: 1,
    evidenceKind: 'g15_current_candidate_subject_comparison_agent_canary',
    createdOn: input.createdOn,
    candidate: {
      sha: input.candidate.sha,
      baseSha: input.candidate.baseSha,
      catalogSha256: input.candidate.catalogSha256,
      agentImageRevision: input.candidate.agentImageRevision,
      cliVersion: input.candidate.cliVersion,
    },
    call: {
      tool: TOOL_NAME,
      completedBangumiToolCalls: input.completedBangumiToolCalls,
      onlyAllowedToolCompleted: input.otherCompletedToolEvents === 0,
      argumentsMatchExpectedScope: check?.queryArgumentsMatch === true,
      subjectIds: [...G15_SUBJECT_IDS],
    },
    textProjection: {
      readBackInAgentEventStream: input.textReadbackAvailable === true,
      utf8Bytes: input.textProjectionBytes,
      maxUtf8Bytes: 3600,
      sizeWithinBound: input.textProjectionBytes <= 3600,
    },
    answerCheckMethod: check?.method ?? G15_AGENT_ANSWER_CHECK_METHOD,
    answerCheck: selectSanitizedCheck(check),
    structuredContentEvidence: {
      separateFieldExposedInAgentEventStream: input.separateStructuredContentExposed === true,
      preservationRegressionPassed: input.preservationRegressionPassed === true,
      liveFullObjectReadback: input.separateStructuredContentExposed
        ? 'EXPOSED_IN_AGENT_EVENT_STREAM'
        : 'NOT_EXPOSED_BY_ANTIGRAVITY_EVENT_STREAM',
    },
    probe: {
      cliProcessExitCode: input.probeProcessExitCode,
      resultStatus: input.resultStatus,
      isolatedProbePassed: passed,
      rawPromptAnswerAndMcpResultPersisted: false,
    },
    frontierStatus: 'PARTIAL',
    passed,
    passBasis:
      'One bounded current-source Agent/MCP observation; no completeness or client acceptance claim.',
  };
}

function selectSanitizedCheck(check) {
  const keys = [
    'toolNameMatch',
    'queryArgumentsMatch',
    'resultReadbackAvailable',
    'resultSourceContractPassed',
    'requestedSubjectIdsMatch',
    'sourceSubjectIdentitiesMatch',
    'subjectIdentityRowsExpected',
    'subjectIdentityRowsMatched',
    'subjectIdentityRowsUnmatched',
    'identityOrderPreserved',
    'malformedMetricRows',
    'duplicateIdentityRows',
    'requiredMetricsPresent',
    'expectedMetricRows',
    'answerMetricRowsParsed',
    'metricRowsMatched',
    'missingMetricRows',
    'mismatchedMetricRows',
    'unmatchedMetricRows',
    'duplicateMetricRows',
    'metricStatesPreserved',
    'unstructuredAnswerLinesCount',
    'currentOfficialV0DisclosurePresent',
    'currentSnapshotDisclosurePresent',
    'noHistoricalTrendClaimPresent',
    'deltaDirectionDisclosurePresent',
    'completionFormulaDisclosurePresent',
    'completionFormulaEvidenceDisclosurePresent',
    'notPersonalWatchProgressDisclosurePresent',
    'boundedOverlapDisclosurePresent',
    'omissionNotAbsenceDisclosurePresent',
    'unsupportedClaimPresent',
    'markdownFormattingDetected',
    'passed',
  ];
  return Object.fromEntries(keys.map((key) => [key, check?.[key] ?? null]));
}

function validateSubjectIdentity(result) {
  const subjectIdsMatch =
    Array.isArray(result.subjectIds) &&
    result.subjectIds.length === 2 &&
    result.subjectIds[0] === G15_SUBJECT_IDS[0] &&
    result.subjectIds[1] === G15_SUBJECT_IDS[1];
  const expected = Array.isArray(result.subjects) ? result.subjects : [];
  const expectedById = new Map(
    expected.map((subject) => {
      const identity = subject?.subject;
      const name = [identity?.nameCn, identity?.name].find(
        (item) => typeof item === 'string' && item.trim(),
      );
      return [
        subject?.subjectId,
        {
          id: subject?.subjectId,
          name: typeof name === 'string' ? name.trim() : null,
          expectedName:
            typeof name === 'string' &&
            (EXPECTED_SUBJECT_NAMES.get(subject?.subjectId)?.has(name.trim()) ?? false),
          valid:
            subject?.subject?.nameCnTextTruncated !== true &&
            subject?.subject?.nameTextTruncated !== true,
        },
      ];
    }),
  );
  const expectedPairsMatch = G15_SUBJECT_IDS.every((id) => {
    const row = expectedById.get(id);
    return row && row.valid && row.name && row.expectedName;
  });
  return {
    subjectIdsMatch,
    expected: G15_SUBJECT_IDS.length,
    matched: expectedPairsMatch ? G15_SUBJECT_IDS.length : 0,
    passed: subjectIdsMatch && expected.length === 2 && expectedPairsMatch,
    expectedById,
  };
}

function emptyIdentityCheck() {
  return {
    subjectIdsMatch: false,
    expected: 2,
    matched: 0,
    passed: false,
    expectedById: new Map(),
  };
}

function collectExpectedMetrics(result) {
  if (!Array.isArray(result.metrics)) return [];
  return result.metrics
    .filter((metric) => ALLOWED_METRIC_KEYS.has(metric?.key))
    .map((metric) => ({
      key: metric.key,
      state: metric.state,
      values: Array.isArray(metric.values) ? metric.values : [],
      delta: metric.delta,
      deltaPrecision: Number.isInteger(metric.deltaPrecision) ? metric.deltaPrecision : 0,
    }));
}

function matchesMetric(answer, expected) {
  if (
    answer.state !== expected.state ||
    !['complete', 'unknown', 'conflict'].includes(expected.state)
  ) {
    return false;
  }
  if (expected.state === 'conflict') {
    return answer.left === '冲突' && answer.right === '冲突' && answer.delta === '不可计算';
  }
  const [left, right] = expected.values;
  const expectedLeft = parseExpectedValue(left);
  const expectedRight = parseExpectedValue(right);
  if (!matchesMetricValue(answer.left, expectedLeft, expected.key)) return false;
  if (!matchesMetricValue(answer.right, expectedRight, expected.key)) return false;
  if (expected.state === 'unknown' || expected.delta === null || expected.delta === undefined) {
    return answer.delta === '不可计算';
  }
  const expectedDelta = parseExpectedValue(expected.delta);
  return matchesMetricValue(answer.delta, expectedDelta, expected.key, true);
}

function parseExpectedValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function matchesMetricValue(actualText, expected, key, isDelta = false) {
  if (expected === null) return actualText === '未知' || actualText === '不可计算';
  if (actualText === '未知' || actualText === '冲突' || actualText === '不可计算') return false;
  const parsed = parseAnswerNumber(actualText, key, isDelta);
  if (parsed === null) return false;
  const precision = key === 'collectionCompletionRate' ? 3 : key === 'score' ? 1 : 0;
  const tolerance =
    key === 'collectionCompletionRate' ? 0.00051 : 0.5 * 10 ** -precision + Number.EPSILON;
  return Math.abs(parsed - expected) <= tolerance;
}

function parseAnswerNumber(value, key, isDelta) {
  const normalized = value.trim().replaceAll(',', '');
  const pointSuffix = /(?:个百分点|percentage\s*points?|pp)$/iu.test(normalized);
  const percentSuffix = /%$/u.test(normalized);
  const numeric = Number(
    normalized.replace(/(?:个百分点|percentage\s*points?|pp|%)$/iu, '').trim(),
  );
  if (!Number.isFinite(numeric)) return null;
  if (key === 'collectionCompletionRate' && (percentSuffix || pointSuffix)) return numeric / 100;
  if (key !== 'collectionCompletionRate' && (percentSuffix || pointSuffix)) return null;
  if (isDelta && key === 'collectionCompletionRate' && pointSuffix) return numeric / 100;
  return numeric;
}

function parseAnswer(answer) {
  const identityRows = [];
  const metrics = [];
  const scopeLines = [];
  let duplicateIdentityRows = 0;
  let malformedIdentityRows = 0;
  let malformedMetricRows = 0;
  let unstructuredAnswerLinesCount = 0;
  const seenIdentityIds = new Set();
  if (typeof answer !== 'string') {
    return {
      identityRows,
      metrics,
      scopeLines,
      duplicateIdentityRows,
      malformedIdentityRows: 2,
      malformedMetricRows: 0,
      unstructuredAnswerLinesCount: 1,
    };
  }
  for (const rawLine of answerLines(answer)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('说明｜')) {
      scopeLines.push(line.slice('说明｜'.length).trim());
      continue;
    }
    const identity = IDENTITY_LINE.exec(line);
    if (identity) {
      const id = Number(identity[1]);
      if (seenIdentityIds.has(id)) duplicateIdentityRows += 1;
      seenIdentityIds.add(id);
      identityRows.push({ id, name: identity[2].trim() });
      continue;
    }
    const metric = METRIC_LINE.exec(line);
    if (metric) {
      metrics.push({
        key: metric[1],
        left: metric[2].trim(),
        right: metric[3].trim(),
        delta: metric[4].trim(),
        state: metric[5],
      });
      continue;
    }
    if (line.startsWith('条目｜')) malformedIdentityRows += 1;
    else if (line.startsWith('指标｜')) malformedMetricRows += 1;
    else unstructuredAnswerLinesCount += 1;
  }
  return {
    identityRows,
    metrics,
    scopeLines,
    duplicateIdentityRows,
    malformedIdentityRows,
    malformedMetricRows,
    unstructuredAnswerLinesCount,
  };
}

function validateSourceContract(result) {
  const official = result.source?.official;
  const subjects = Array.isArray(result.subjects) ? result.subjects : [];
  const formula =
    result.collectionCompletionFormula ??
    subjects.find((subject) => subject.subjectId === G15_SUBJECT_IDS[0])?.statistics?.collection
      ?.formulas?.completion;
  const stats = subjects.find((subject) => subject.subjectId === G15_SUBJECT_IDS[0])?.statistics;
  const state = result.state;
  const coverage = result.coverage;
  const passed =
    (state === 'complete' || state === 'partial') &&
    official?.class === 'official-v0' &&
    Array.isArray(official.operations) &&
    official.operations.length > 0 &&
    typeof official.attemptedAt === 'string' &&
    Number.isInteger(coverage?.requestedSubjects) &&
    coverage.requestedSubjects === 2 &&
    Number.isInteger(coverage?.returnedSubjects) &&
    coverage.returnedSubjects === 2 &&
    typeof formula?.description === 'string' &&
    formula.description.includes('collect') &&
    formula.description.includes('wish') &&
    formula.description.includes('doing') &&
    formula.description.includes('on_hold') &&
    formula.description.includes('dropped') &&
    typeof stats?.collection?.completionState === 'string';
  return { passed, stats, formula };
}

function validateCaveats(scopeText, result) {
  const currentOfficialV0DisclosurePresent = /官方\s*v0/iu.test(scopeText);
  const currentSnapshotDisclosurePresent = /当前.{0,12}(?:快照|观察|查询|读取)/u.test(scopeText);
  const noHistoricalTrendClaimPresent =
    /(?:不代表|不能据此|不足以|无法据此|不能说明).{0,12}历史趋势/u.test(scopeText);
  const deltaDirectionDisclosurePresent =
    /B\s*[-−]\s*A/u.test(scopeText) && /第二个条目减第一个条目/u.test(scopeText);
  const completionFormulaDisclosurePresent =
    /collect\s*\/\s*\(?\s*wish\s*\+\s*collect\s*\+\s*doing\s*\+\s*on_hold\s*\+\s*dropped\s*\)?/iu.test(
      scopeText,
    ) ||
    ['collect', 'wish', 'doing', 'on_hold', 'dropped'].every((part) => scopeText.includes(part));
  const completionFormulaEvidenceDisclosurePresent =
    /(?:样本|经验).{0,8}验证/u.test(scopeText) &&
    /(?:非官方|不是官方|并非官方).{0,12}(?:API|接口).{0,8}(?:契约|约定)/iu.test(scopeText);
  const notPersonalWatchProgressDisclosurePresent =
    /(?:不代表|不等于|不能说明|并非|不是).{0,12}(?:用户|个人).{0,8}(?:观看进度|追番进度)/u.test(
      scopeText,
    ) || /(?:不代表|不等于|不能说明|并非|不是).{0,12}(?:观看进度|追番进度)/u.test(scopeText);
  const overlapWasOmitted =
    Number(result?.mcpTextProjection?.overlapItemsOmittedFromText ?? 0) > 0 ||
    Number(result?.overlaps?.cast?.itemsOmittedFromText ?? 0) > 0 ||
    Number(result?.overlaps?.staff?.itemsOmittedFromText ?? 0) > 0;
  const boundedOverlapDisclosurePresent = /(?:有界|部分覆盖)/u.test(scopeText);
  const omissionNotAbsenceDisclosurePresent =
    !overlapWasOmitted ||
    /(?:未显示|未列出|省略).{0,12}(?:不代表|不能说明|并不意味着).{0,12}(?:不存在|没有)/u.test(
      scopeText,
    );
  return {
    currentOfficialV0DisclosurePresent,
    currentSnapshotDisclosurePresent,
    noHistoricalTrendClaimPresent,
    deltaDirectionDisclosurePresent,
    completionFormulaDisclosurePresent,
    completionFormulaEvidenceDisclosurePresent,
    notPersonalWatchProgressDisclosurePresent,
    boundedOverlapDisclosurePresent,
    omissionNotAbsenceDisclosurePresent,
    passed:
      currentOfficialV0DisclosurePresent &&
      currentSnapshotDisclosurePresent &&
      noHistoricalTrendClaimPresent &&
      deltaDirectionDisclosurePresent &&
      completionFormulaDisclosurePresent &&
      completionFormulaEvidenceDisclosurePresent &&
      notPersonalWatchProgressDisclosurePresent &&
      boundedOverlapDisclosurePresent &&
      omissionNotAbsenceDisclosurePresent,
  };
}

function hasUnqualifiedClaim(answer, pattern) {
  for (const sentence of answer.split(/(?<=[。！？\n])/u)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 24), match.index).trimEnd();
      if (!CLAIM_NEGATION.test(prefix)) return true;
    }
  }
  return false;
}

function validateIdentityRows(parsedRows, expectedById) {
  let matched = 0;
  let unmatched = 0;
  for (const row of parsedRows) {
    const expected = expectedById.get(row.id);
    if (!expected || expected.name !== row.name) unmatched += 1;
    else matched += 1;
  }
  return { matched, unmatched };
}

function exactQueryArguments(args) {
  return (
    args &&
    typeof args === 'object' &&
    !Array.isArray(args) &&
    Object.keys(args).length === 1 &&
    Array.isArray(args.subjectIds) &&
    args.subjectIds.length === 2 &&
    args.subjectIds[0] === G15_SUBJECT_IDS[0] &&
    args.subjectIds[1] === G15_SUBJECT_IDS[1]
  );
}

function unwrapArguments(value) {
  let parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if ('Arguments' in parsed) parsed = parseJson(parsed.Arguments);
    else if ('arguments' in parsed) parsed = parseJson(parsed.arguments);
  }
  return parsed;
}

function findComparisonResult(value) {
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length > 0 && visited < 3000) {
    const current = pending.pop();
    visited += 1;
    const candidate = parseJson(current.value);
    if (current.depth > 12 || !candidate || typeof candidate !== 'object') continue;
    if (
      Array.isArray(candidate.subjectIds) &&
      Array.isArray(candidate.subjects) &&
      Array.isArray(candidate.metrics) &&
      candidate.overlaps &&
      candidate.source
    )
      return candidate;
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 100))
        pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    for (const key of [
      'structuredContent',
      'data',
      'result',
      'content',
      'text',
      'output',
      'tool_info',
    ]) {
      if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
    }
  }
  return null;
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function answerLines(answer) {
  return typeof answer === 'string' ? answer.split(/\r?\n/u) : [];
}
