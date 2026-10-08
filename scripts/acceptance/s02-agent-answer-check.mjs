export const S02_RANKING_ANSWER_CHECK_METHOD = 's02-top-rated-main-voice-answer-v1';

export const S02_EXPECTED_QUERY_ARGUMENTS = {
  personId: 3474,
  rankingMode: 'top_rated_main_voice',
  media: 'all',
};

const TOOL_NAME = 'bangumi.get_person_activity';
const RANKING_SCOPE = 'current_official_person_character_response';
const COVERAGE_FIELDS = [
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectDetailRequests',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'subjectDetailIdsDroppedAtLimit',
  'mainRoleSubjectsSelected',
  'scoreableMainRoleSubjects',
  'zeroRatingScoreSubjects',
  'unknownRoleRows',
  'missingRatingScoreSubjects',
  'missingRatingTotalSubjects',
  'mediaUnknownSubjects',
  'missingSubjectIdRows',
  'mainRoleSubjectsMissingDetail',
  'rowsReturned',
];
const COVERAGE_ANSWER_FIELDS = new Set(COVERAGE_FIELDS);
const CAREER_OR_HISTORY_CLAIMS =
  /(?:完整生涯(?:排名|榜单)?|生涯(?:总|全部|完整)(?:作品|排名)|历来最高分|历史最高分|historical\s+rating|career[- ]wide\s+ranking)/iu;
const MARKDOWN_SYNTAX = /(?:^\s*#{1,6}\s|^\s*[-*+]\s|```|\*\*|`)/mu;

const canonicalJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);

function findRankingResult(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try {
      return findRankingResult(JSON.parse(value), seen, depth + 1);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  if (
    !Array.isArray(value) &&
    value.ranking?.mode === 'top_rated_main_voice' &&
    value.ranking?.scope === RANKING_SCOPE
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findRankingResult(child, seen, depth + 1);
      if (found) return found;
    }
  } else {
    for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
      if (!(key in value)) continue;
      const found = findRankingResult(value[key], seen, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function exactArguments(value) {
  return canonicalJson(value) === canonicalJson(S02_EXPECTED_QUERY_ARGUMENTS);
}

function validRankedItem(item) {
  return (
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    Number.isInteger(item.subjectId) &&
    item.subjectId > 0 &&
    typeof item.ratingScore === 'number' &&
    Number.isFinite(item.ratingScore) &&
    typeof item.subjectName === 'string' &&
    typeof item.subjectNameCn === 'string' &&
    (item.ratingTotal === undefined ||
      (typeof item.ratingTotal === 'number' && Number.isFinite(item.ratingTotal))) &&
    Array.isArray(item.rawRoles) &&
    item.rawRoles.length > 0 &&
    item.rawRoles.every((role) => typeof role === 'string' && role.trim().length > 0)
  );
}

function rankIsDeterministic(items) {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    if (
      previous.ratingScore < current.ratingScore ||
      (previous.ratingScore === current.ratingScore &&
        (previous.ratingTotal ?? -1) < (current.ratingTotal ?? -1)) ||
      (previous.ratingScore === current.ratingScore &&
        (previous.ratingTotal ?? -1) === (current.ratingTotal ?? -1) &&
        previous.subjectId > current.subjectId)
    ) {
      return false;
    }
  }
  return true;
}

function projectCoverage(coverage) {
  if (!coverage || typeof coverage !== 'object') return null;
  const output = {};
  for (const key of COVERAGE_FIELDS) {
    if (!Number.isInteger(coverage[key]) || coverage[key] < 0) return null;
    output[key] = coverage[key];
  }
  return output;
}

function answerItemMatches(answerItem, sourceItem) {
  const expectedKeys = new Set(['subjectId', 'title', 'ratingScore', 'ratingTotal', 'rawRoles']);
  if (!answerItem || typeof answerItem !== 'object' || Array.isArray(answerItem)) return false;
  if (Object.keys(answerItem).some((key) => !expectedKeys.has(key))) return false;
  return (
    answerItem.subjectId === sourceItem.subjectId &&
    answerItem.title === (sourceItem.subjectNameCn || sourceItem.subjectName) &&
    answerItem.ratingScore === sourceItem.ratingScore &&
    answerItem.ratingTotal === sourceItem.ratingTotal &&
    canonicalJson(answerItem.rawRoles) === canonicalJson(sourceItem.rawRoles)
  );
}

export function verifyS02RankingAnswer(answer, queryArguments, toolOutput, toolCalls) {
  const text = typeof answer === 'string' ? answer.trim() : '';
  let parsedAnswer = null;
  try {
    parsedAnswer = JSON.parse(text);
  } catch {
    parsedAnswer = null;
  }

  const result = findRankingResult(toolOutput);
  const ranking = result?.ranking;
  const resultItems = Array.isArray(ranking?.items) ? ranking.items : [];
  const validItems =
    resultItems.length > 0 && resultItems.length <= 5 && resultItems.every(validRankedItem);
  const distinctSubjects =
    validItems && new Set(resultItems.map((item) => item.subjectId)).size === resultItems.length;
  const deterministicRanking = validItems && rankIsDeterministic(resultItems);
  const coverage = projectCoverage(ranking?.coverage);
  const queryArgumentsMatch = exactArguments(queryArguments);
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === TOOL_NAME &&
    toolCalls[0]?.state === 'DONE' &&
    exactArguments(toolCalls[0]?.arguments);
  const resultReadbackAvailable = Boolean(
    result &&
    ranking?.mode === 'top_rated_main_voice' &&
    ranking.scope === RANKING_SCOPE &&
    ranking.media === 'all' &&
    ['complete', 'partial', 'unavailable', 'not_computable'].includes(ranking.state) &&
    coverage &&
    typeof ranking.coverage.truncated === 'boolean' &&
    coverage.relationRowsSelected <= coverage.relationRowsObserved &&
    coverage.relationRowsDroppedAtLimit ===
      coverage.relationRowsObserved - coverage.relationRowsSelected &&
    ranking.coverage.rowsReturned === resultItems.length,
  );
  const completeStateCoverageConsistent =
    ranking?.state !== 'complete' ||
    Boolean(
      coverage &&
      coverage.relationRowsDroppedAtLimit === 0 &&
      coverage.subjectDetailsFailed === 0 &&
      coverage.subjectDetailIdsDroppedAtLimit === 0 &&
      coverage.unknownRoleRows === 0 &&
      coverage.missingRatingScoreSubjects === 0 &&
      coverage.missingRatingTotalSubjects === 0 &&
      coverage.mediaUnknownSubjects === 0 &&
      coverage.missingSubjectIdRows === 0 &&
      coverage.mainRoleSubjectsMissingDetail === 0 &&
      ranking.coverage.truncated === false,
    );

  const answerKeys = new Set([
    'personId',
    'rankingMode',
    'scope',
    'state',
    'items',
    'coverage',
    'caveat',
  ]);
  const shapeValid = Boolean(
    parsedAnswer &&
    typeof parsedAnswer === 'object' &&
    !Array.isArray(parsedAnswer) &&
    Object.keys(parsedAnswer).length === answerKeys.size &&
    Object.keys(parsedAnswer).every((key) => answerKeys.has(key)),
  );
  const rows = shapeValid && Array.isArray(parsedAnswer.items) ? parsedAnswer.items : [];
  const rowComparisons =
    shapeValid && validItems
      ? resultItems.map((item, index) => answerItemMatches(rows[index], item))
      : [];
  const rowsMatched = rowComparisons.filter(Boolean).length;
  const missingRowsCount = Math.max(0, resultItems.length - rows.length);
  const extraRowsCount = Math.max(0, rows.length - resultItems.length);
  const coverageMatches = Boolean(
    shapeValid &&
    parsedAnswer.coverage &&
    typeof parsedAnswer.coverage === 'object' &&
    Object.keys(parsedAnswer.coverage).length === COVERAGE_ANSWER_FIELDS.size &&
    Object.keys(parsedAnswer.coverage).every((key) => COVERAGE_ANSWER_FIELDS.has(key)) &&
    canonicalJson(parsedAnswer.coverage) === canonicalJson(coverage),
  );
  const stateMatches = Boolean(shapeValid && parsedAnswer.state === ranking?.state);
  const caveat = shapeValid && typeof parsedAnswer.caveat === 'string' ? parsedAnswer.caveat : '';
  const boundedScopeDisclosurePresent = Boolean(
    ranking?.state === 'partial'
      ? caveat.includes('本次观察样本')
      : ranking?.state === 'complete'
        ? caveat.includes('当前官方响应')
        : caveat.includes('当前官方人物角色关系'),
  );
  const careerHistoryLimitDisclosurePresent =
    caveat.includes('不代表完整生涯') && caveat.includes('不是历史评分快照');
  const unsupportedCareerOrHistoryClaim = CAREER_OR_HISTORY_CLAIMS.test(
    caveat
      .replace(/不代表(?:本次观察样本中的)?完整生涯(?:排名|榜单)?/gu, '')
      .replace(/不是历史评分快照/gu, ''),
  );
  const noMarkdownFormatting = text.length > 0 && !MARKDOWN_SYNTAX.test(text);
  const answerRowsMatch = Boolean(
    shapeValid &&
    Array.isArray(parsedAnswer.items) &&
    rows.length === resultItems.length &&
    rowComparisons.length === resultItems.length &&
    rowComparisons.every(Boolean),
  );
  const passed = Boolean(
    queryArgumentsMatch &&
    exactSingleToolCall &&
    resultReadbackAvailable &&
    validItems &&
    distinctSubjects &&
    deterministicRanking &&
    completeStateCoverageConsistent &&
    stateMatches &&
    coverageMatches &&
    answerRowsMatch &&
    boundedScopeDisclosurePresent &&
    careerHistoryLimitDisclosurePresent &&
    !unsupportedCareerOrHistoryClaim &&
    noMarkdownFormatting,
  );

  const answerChecks = {
    queryArgumentsMatch,
    exactSingleToolCall,
    resultReadbackAvailable,
    resultRowsValid: validItems,
    distinctSubjects,
    deterministicScoreOrder: deterministicRanking,
    completeStateCoverageConsistent,
    answerRowsMatch,
    rankingStateMatches: stateMatches,
    coverageMatches,
    boundedScopeDisclosurePresent,
    careerHistoryLimitDisclosurePresent,
    noUnsupportedCareerOrHistoryClaim: !unsupportedCareerOrHistoryClaim,
    noMarkdownFormatting,
  };
  const answerCounters = {
    sourceRows: resultItems.length,
    answerRows: rows.length,
    rowsMatched,
    missingRowsCount,
    extraRowsCount,
    duplicateAnswerRowsCount:
      shapeValid && Array.isArray(parsedAnswer.items)
        ? rows.length - new Set(rows.map((item) => item?.subjectId).filter(Number.isInteger)).size
        : 0,
    coverageFieldsMatched: coverageMatches ? COVERAGE_FIELDS.length : 0,
  };

  return {
    method: S02_RANKING_ANSWER_CHECK_METHOD,
    passed,
    answerChecks,
    answerCounters,
    resultSummary: resultReadbackAvailable
      ? {
          state: ranking.state,
          scope: ranking.scope,
          media: ranking.media,
          truncated: ranking.coverage.truncated,
          rows: resultItems.map((item) => ({
            subjectId: item.subjectId,
            ratingScore: item.ratingScore,
            ratingTotal: item.ratingTotal ?? null,
          })),
          coverage,
        }
      : null,
  };
}
