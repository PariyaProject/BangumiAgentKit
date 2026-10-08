export const D05_ANSWER_CHECK_METHOD = 'd05-current-season-multitag-heat-v1';
export const D05_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  media: 'anime',
  season: 'current',
  tags: ['校园', '恋爱'],
  sort: 'heat',
  order: 'desc',
  resultMode: 'top',
  limit: 8,
  explain: 'compact',
});

const TARGET_TOOL = 'bangumi.query_subjects';
const EXPECTED_TAGS = ['校园', '恋爱'];
const ANSWER_KEYS = ['season', 'dateRange', 'tags', 'heatMeaning', 'items', 'coverage', 'caveat'];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseToolText(toolOutput) {
  if (!Array.isArray(toolOutput?.content)) return null;
  const text = toolOutput.content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return isObject(value) && Array.isArray(value.items) ? { value, text } : null;
  } catch {
    return null;
  }
}

function sourceResult(toolOutput) {
  const structured =
    isObject(toolOutput?.structuredContent) && Array.isArray(toolOutput.structuredContent.items)
      ? toolOutput.structuredContent
      : isObject(toolOutput) && Array.isArray(toolOutput.items)
        ? toolOutput
        : null;
  const parsedText = parseToolText(toolOutput);
  return {
    result: structured ?? parsedText?.value ?? null,
    structuredAvailable: structured !== null,
    textResult: parsedText?.value ?? null,
    text: parsedText?.text ?? null,
  };
}

function dateRangeForSeason(season) {
  const match = /^(\d{4})-(winter|spring|summer|autumn)$/u.exec(season ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const seasonName = match[2];
  const startMonth = { winter: 1, spring: 4, summer: 7, autumn: 10 }[seasonName];
  const endMonth = { winter: 4, spring: 7, summer: 10, autumn: 1 }[seasonName];
  const endYear = seasonName === 'autumn' ? year + 1 : year;
  return {
    from: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    to: `${endYear}-${String(endMonth).padStart(2, '0')}-01`,
  };
}

function integer(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeSourceItem(item) {
  if (!isObject(item) || !Number.isInteger(item.id) || item.id <= 0) return null;
  const title = [item.displayName, item.nameCn, item.name].find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  if (!title) return null;
  return {
    id: item.id,
    title,
    collectionTotal: integer(item.collectionTotal) ? item.collectionTotal : null,
    media: typeof item.media === 'string' ? item.media : null,
  };
}

function exactObjectKeys(value, keys) {
  return (
    isObject(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
  );
}

function findTextDisclosure(value, patterns) {
  return typeof value === 'string' && patterns.some((pattern) => pattern.test(value));
}

function hasUnsupportedCompletenessClaim(caveat) {
  if (typeof caveat !== 'string') return true;
  const clauses = caveat
    .split(/[。！？；;，,\n]|但|但是|不过|然而|而且|并且|同时|以及|\bbut\b|\bhowever\b|\band\b/iu)
    .map((item) => item.trim())
    .filter(Boolean);
  return clauses.some((clause) => {
    const scopedCompleteness =
      /(?:本季|本季度|当前季(?:度)?|这季|全站|全库|(?:整个|全部)\s*Bangumi|current season|this season|whole site|entire site|entire database|all matching|every matching)/iu;
    const completeness =
      /(?:全部|所有|完整(?:列表|目录|列出|覆盖)?|无遗漏|全量|exhaustive|complete(?: list| coverage)?|all matching|every matching)/iu;
    if (!scopedCompleteness.test(clause) || !completeness.test(clause)) return false;

    const negation =
      /(?:不代表|不能|无法|并非|不是|不等于|未证明|未能证明|不完整|未完整|not|cannot|does not|doesn't|no guarantee)/iu;
    const negationIndex = clause.search(negation);
    const completenessIndex = clause.search(completeness);
    return negationIndex < 0 || negationIndex > completenessIndex;
  });
}

function extractReturnedItems(result, textResult, structuredAvailable) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const normalized = items.map(normalizeSourceItem);
  const valid = normalized.filter(Boolean);
  const ids = valid.map((item) => item.id);
  const duplicates = ids.length - new Set(ids).size;
  const textProjection = isObject(textResult?.textProjection) ? textResult.textProjection : null;
  const textReadbackComplete = Boolean(
    textResult &&
    Array.isArray(textResult.items) &&
    (textProjection === null ||
      (textProjection.rowsOmitted === 0 &&
        textProjection.displayNamesClipped === 0 &&
        textProjection.rowsIncluded === textResult.items.length)),
  );
  const readbackComplete = structuredAvailable || textReadbackComplete;
  return {
    items: valid,
    rawCount: items.length,
    invalidCount: items.length - valid.length,
    duplicates,
    readbackComplete,
    textProjection,
  };
}

function answerItemsMatch(answerItems, sourceItems) {
  if (!Array.isArray(answerItems) || answerItems.length !== sourceItems.length) return false;
  return answerItems.every((item, index) => {
    const source = sourceItems[index];
    return (
      exactObjectKeys(item, ['id', 'title', 'collectionTotal']) &&
      item.id === source.id &&
      item.title === source.title &&
      item.collectionTotal === source.collectionTotal
    );
  });
}

function verifyAnswerShape(answer, result, sourceItems) {
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    return { parsed: null, valid: false, countersMatch: false, caveatChecks: {} };
  }
  const range = dateRangeForSeason(result?.plan?.season);
  const coverage = result?.coverage;
  const expectedCoverage = {
    state: coverage?.state,
    scanned: coverage?.scanned,
    matched: coverage?.matched,
    returned: coverage?.returned,
    totalKind: coverage?.totalKind,
  };
  const countersMatch =
    exactObjectKeys(parsed?.coverage, Object.keys(expectedCoverage)) &&
    canonicalJson(parsed.coverage) === canonicalJson(expectedCoverage);
  const rangeMatches =
    range !== null &&
    exactObjectKeys(parsed?.dateRange, ['from', 'to']) &&
    parsed.dateRange.from === range.from &&
    parsed.dateRange.to === range.to;
  const caveat = parsed?.caveat;
  const caveatChecks = {
    experimentalSearchDisclosure: findTextDisclosure(caveat, [/实验(?:性)?/u, /experimental/iu]),
    estimatedTotalDisclosure: findTextDisclosure(caveat, [
      /总数.{0,8}估算/u,
      /估算.{0,8}总数/u,
      /estimated total/iu,
    ]),
    boundedCoverageDisclosure: findTextDisclosure(caveat, [
      /本次.{0,8}(?:观察|返回|检索|结果)/u,
      /有界/u,
      /bounded/iu,
    ]),
    nonCompletenessDisclosure: findTextDisclosure(caveat, [
      /不代表.{0,8}(?:完整|全站|全库|本季|本季度|当前季度)/u,
      /不能.{0,8}(?:完整|全站|全库)/u,
      /(?:本季|本季度|当前季度).{0,8}(?:不完整|未能证明|未证明)/u,
      /not.{0,12}(?:complete|exhaustive)/iu,
      /no guarantee of completeness/iu,
    ]),
    noUnsupportedCompletenessClaim: !hasUnsupportedCompletenessClaim(caveat),
  };
  const valid =
    exactObjectKeys(parsed, ANSWER_KEYS) &&
    parsed.season === result?.plan?.season &&
    rangeMatches &&
    canonicalJson(parsed.tags) === canonicalJson(EXPECTED_TAGS) &&
    parsed.heatMeaning === '当前收藏人数降序；不是讨论趋势或历史热度' &&
    answerItemsMatch(parsed.items, sourceItems) &&
    countersMatch &&
    Object.values(caveatChecks).every(Boolean);
  return { parsed, valid, countersMatch, rangeMatches, caveatChecks };
}

export function verifyD05CurrentSeasonAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const exactArguments =
    canonicalJson(queryArguments ?? {}) === canonicalJson(D05_EXPECTED_QUERY_ARGUMENTS);
  const exactToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === TARGET_TOOL &&
    toolCalls[0]?.state === 'DONE' &&
    canonicalJson(toolCalls[0]?.arguments ?? {}) === canonicalJson(D05_EXPECTED_QUERY_ARGUMENTS);
  const { result, structuredAvailable, textResult } = sourceResult(toolOutput);
  const resultReadbackAvailable = result !== null;
  const returned = extractReturnedItems(result, textResult, structuredAvailable);
  const plan = result?.plan;
  const request = Array.isArray(plan?.steps)
    ? plan.steps.find((step) => step?.kind === 'search')?.request
    : undefined;
  const filter = isObject(request?.filter)
    ? request.filter
    : isObject(plan?.filter)
      ? plan.filter
      : undefined;
  const expectedRange = dateRangeForSeason(plan?.season);
  const requestFilterMatches = Boolean(
    expectedRange &&
    (request?.sort ?? plan?.sort) === 'heat' &&
    Array.isArray(filter?.type) &&
    canonicalJson(filter.type) === canonicalJson([2]) &&
    Array.isArray(filter?.tag) &&
    canonicalJson(filter.tag) === canonicalJson(EXPECTED_TAGS) &&
    Array.isArray(filter?.airDate) &&
    canonicalJson(filter.airDate) ===
      canonicalJson([`>=${expectedRange.from}`, `<${expectedRange.to}`]),
  );
  const coverage = result?.coverage;
  const coverageConsistent = Boolean(
    coverage &&
    ['complete', 'partial', 'unknown', 'not_applicable'].includes(coverage.state) &&
    coverage.totalKind === 'estimated' &&
    integer(coverage.scanned) &&
    integer(coverage.matched) &&
    integer(coverage.returned) &&
    coverage.scanned >= coverage.matched &&
    coverage.matched >= coverage.returned &&
    coverage.returned === returned.rawCount &&
    coverage.returned <= D05_EXPECTED_QUERY_ARGUMENTS.limit,
  );
  const warningCodes = Array.isArray(result?.warnings)
    ? [
        ...new Set(
          result.warnings.map((item) => item?.code).filter((code) => typeof code === 'string'),
        ),
      ]
    : [];
  const experimentalSourceWarningPresent = warningCodes.includes('EXPERIMENTAL_SOURCE');
  const planContractMatches = Boolean(
    plan?.source === 'official_v0' &&
    plan?.operation === 'searchSubjects' &&
    typeof plan?.season === 'string' &&
    expectedRange &&
    plan?.sort === 'heat' &&
    plan?.order === 'desc' &&
    plan?.totalKind === 'estimated' &&
    ((Array.isArray(plan?.limitations) &&
      plan.limitations.some(
        (item) => typeof item === 'string' && /heat means upstream 收藏人数/u.test(item),
      )) ||
      plan?.heatMeaning === '当前收藏人数；不是讨论趋势或历史热度'),
  );
  const textBudgetVerified =
    Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600;
  const answerCheck = verifyAnswerShape(answer, result, returned.items);
  const rowsMatchMedia = returned.items.every((item) => item.media === 'anime');
  const answerChecks = {
    queryArgumentsMatch: exactArguments,
    exactSingleToolCall: exactToolCall,
    resultReadbackAvailable,
    rowsReadbackComplete: returned.readbackComplete,
    sourceRowsValid: returned.invalidCount === 0,
    sourceRowsUnique: returned.duplicates === 0,
    sourceRowsNonEmpty: returned.items.length > 0,
    rowsMatchAnimeMedia: rowsMatchMedia,
    requestFilterMatches,
    planContractMatches,
    coverageConsistent,
    experimentalSourceWarningPresent,
    textBudgetVerified,
    answerShapeAndRowsMatch: answerCheck.valid,
    answerCoverageCountersMatch: answerCheck.countersMatch,
    answerRangeMatchesResolvedSeason: answerCheck.rangeMatches,
    ...answerCheck.caveatChecks,
  };
  const passed =
    typeof answer === 'string' &&
    answer.trim().length > 0 &&
    Object.values(answerChecks).every(Boolean);
  const resultCounters = {
    state: typeof result?.state === 'string' ? result.state : 'unavailable',
    season: typeof plan?.season === 'string' ? plan.season : null,
    totalKind: typeof coverage?.totalKind === 'string' ? coverage.totalKind : 'unknown',
    scanned: integer(coverage?.scanned) ? coverage.scanned : null,
    matched: integer(coverage?.matched) ? coverage.matched : null,
    returned: integer(coverage?.returned) ? coverage.returned : null,
    sourceRowsValid: returned.items.length,
    sourceRowsInvalid: returned.invalidCount,
    sourceRowsDuplicate: returned.duplicates,
    textRowsOmitted: integer(returned.textProjection?.rowsOmitted)
      ? returned.textProjection.rowsOmitted
      : 0,
    displayNamesClipped: integer(returned.textProjection?.displayNamesClipped)
      ? returned.textProjection.displayNamesClipped
      : 0,
    textUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    answerRows: Array.isArray(answerCheck.parsed?.items) ? answerCheck.parsed.items.length : 0,
  };
  return {
    method: D05_ANSWER_CHECK_METHOD,
    passed,
    answerChecks,
    resultCounters,
    warningCodes,
    privacy: {
      rawAnswerPersisted: false,
      rawToolResultPersisted: false,
      credentialsPersisted: false,
      oauthAttempted: false,
      accountDataRead: false,
      communityRead: false,
      writesAttempted: false,
      qqTested: false,
      timTested: false,
    },
  };
}
