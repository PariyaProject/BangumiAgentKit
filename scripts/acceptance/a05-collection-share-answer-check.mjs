import { createHash } from 'node:crypto';
import { COLLECTION_COMPLETION_UNRESOLVED_CAVEAT } from '@bangumi-agent-kit/discovery';

export const A05_ANSWER_CHECK_METHOD = 'a05-collection-share-agent-mcp-v1';
export const A05_TARGET_TOOL = 'bangumi.query_subjects';
export const A05_FORMULA_ID = 'bangumi.subject.completion.v1';
export const A05_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  media: 'anime',
  rating: { min: 8 },
  collectionCompletionRate: { max: 0.4 },
  sort: 'score',
  order: 'desc',
  resultMode: 'top',
  limit: 8,
  explain: 'full',
});
export const A05_EXPECTED_CAVEATS = Object.freeze([
  'This is a sample-verified ratio, not an official formula, episode completion, personal progress, or preference.',
  'The experimental search has estimated totals; this is only the bounded observed sample and does not establish a complete list.',
  'Missing, invalid, conflicting collection buckets and zero denominators remain unresolved or not computable.',
]);

const FORMULA = 'collect / (wish + collect + doing + on_hold + dropped)';
const FORMULA_ID = A05_FORMULA_ID;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isObject(value) &&
    canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
  );
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function coverageStatesAreConsistent(resultState, coverage) {
  if (
    !isObject(coverage) ||
    !['complete', 'partial', 'unknown'].includes(coverage.state) ||
    typeof coverage.upstreamExhausted !== 'boolean'
  ) {
    return false;
  }
  const partialSignal =
    coverage.unresolvedCandidates > 0 ||
    coverage.hydrationsUnresolved > 0 ||
    coverage.hydrationsFailed > 0 ||
    coverage.budgetExceeded === true ||
    coverage.hydrationBudgetExceeded === true ||
    coverage.outputCap !== undefined ||
    coverage.reason === 'output_cap';
  if (partialSignal) return resultState === 'partial' && coverage.state === 'partial';
  if (resultState === 'partial' || coverage.state === 'partial') {
    return resultState === 'partial' && coverage.state === 'partial';
  }
  if (coverage.state === 'complete') {
    return resultState === 'ok' && coverage.upstreamExhausted;
  }
  return coverage.state === 'unknown' && !coverage.upstreamExhausted &&
    ['ok', 'unknown'].includes(resultState);
}

function parseMcpText(toolOutput) {
  if (!Array.isArray(toolOutput?.content)) return null;
  const text = toolOutput.content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
  if (!text) return null;
  try {
    const result = JSON.parse(text);
    return isObject(result) && Array.isArray(result.items) ? { result, text } : null;
  } catch {
    return null;
  }
}

function resultSources(toolOutput) {
  const structured =
    isObject(toolOutput?.structuredContent) && Array.isArray(toolOutput.structuredContent.items)
      ? toolOutput.structuredContent
      : null;
  const textResult = parseMcpText(toolOutput);
  return {
    result: structured ?? textResult?.result ?? null,
    structured,
    textResult,
  };
}

function exactQuery(value) {
  return canonicalJson(value ?? {}) === canonicalJson(A05_EXPECTED_QUERY_ARGUMENTS);
}

function exactCall(toolCalls, queryArguments) {
  return (
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === A05_TARGET_TOOL &&
    toolCalls[0]?.state === 'DONE' &&
    exactQuery(toolCalls[0]?.arguments) &&
    exactQuery(queryArguments)
  );
}

function evidenceSummary(items) {
  let formulaRows = 0;
  let sourceRows = 0;
  for (const item of items) {
    const evidence = isObject(item?.evidence) ? item.evidence : {};
    const derived = Array.isArray(evidence.collectionCompletionRate)
      ? evidence.collectionCompletionRate
      : [];
    const formulaFound = derived.some(
      (reference) => reference?.formula === FORMULA_ID && reference?.fieldPath === 'collectionCompletionRate',
    );
    const sourceFound = derived.some(
      (reference) =>
        reference?.source?.class === 'official_v0' &&
        typeof reference?.fieldPath === 'string' &&
        /\.collection$/u.test(reference.fieldPath),
    );
    if (formulaFound) formulaRows += 1;
    if (sourceFound) sourceRows += 1;
  }
  return { formulaRows, sourceRows };
}

function rowValues(item) {
  if (!isObject(item)) return null;
  const title = [item.displayName, item.nameCn, item.name].find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  if (!title || !finite(item.score) || !finite(item.collectionCompletionRate)) return null;
  return {
    title,
    score: item.score,
    collectionCompletionRate: item.collectionCompletionRate,
  };
}

function rowsEqual(left, right) {
  return (
    left.length === right.length &&
    left.every(Boolean) &&
    right.every(Boolean) &&
    left.every(
      (item, index) =>
        item.title === right[index]?.title &&
        item.score === right[index]?.score &&
        item.collectionCompletionRate === right[index]?.collectionCompletionRate,
    )
  );
}

function hasDisclosure(value, patterns) {
  return typeof value === 'string' && patterns.some((pattern) => pattern.test(value));
}

function noUnsupportedCompletenessClaim(value) {
  if (typeof value !== 'string') return false;
  const clauses = value
    .split(/[。！？；;\n]|但|但是|不过|然而|而且|并且|同时|以及|\bbut\b|\bhowever\b|\band\b/iu)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const completeness = /(?:完整(?:列表|清单|名单)?|全站|全库|所有匹配|无遗漏|complete list|entire site|whole database|all matching)/iu;
  const negation = /(?:不代表|不能|无法|并非|未证明|未能证明|不完整|not|cannot|does not|no guarantee)/iu;
  return clauses.every((clause) => {
    const claimIndex = clause.search(completeness);
    if (claimIndex < 0) return true;
    const negationIndex = clause.search(negation);
    return negationIndex >= 0 && negationIndex < claimIndex;
  });
}

function answerShape(answer, result, resultItems) {
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    return { parsed: null, checks: {} };
  }
  const coverage = result.coverage;
  const answerCoverage = parsed?.coverage;
  const answerItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const answerCaveats = Array.isArray(parsed?.caveats) ? parsed.caveats : [];
  const answerUsesExactSanitizedShape =
    hasExactKeys(parsed, ['formula', 'thresholds', 'items', 'coverage', 'caveats']) &&
    hasExactKeys(parsed.thresholds, ['ratingMin', 'collectionCompletionRateMax']) &&
    answerItems.every((item) =>
      hasExactKeys(item, ['title', 'score', 'collectionCompletionRate']),
    ) &&
    hasExactKeys(answerCoverage, [
      'state',
      'scanned',
      'matched',
      'returned',
      'totalKind',
      'unresolvedCandidates',
    ]) &&
    Array.isArray(parsed.caveats) &&
    parsed.caveats.every((caveat) => typeof caveat === 'string');
  const coverageMatches =
    isObject(answerCoverage) &&
    ['state', 'scanned', 'matched', 'returned', 'totalKind', 'unresolvedCandidates'].every(
      (key) => answerCoverage[key] === coverage?.[key],
    );
  const answerRows = Array.isArray(parsed?.items)
    ? parsed.items.map((item) =>
        isObject(item)
          ? {
              title: item.title,
              score: item.score,
              collectionCompletionRate: item.collectionCompletionRate,
            }
          : null,
      )
    : [];
  const rowMatches =
    answerRows.length === resultItems.length &&
    answerRows.every(
      (item, index) =>
        item?.title === resultItems[index]?.title &&
        item?.score === resultItems[index]?.score &&
        item?.collectionCompletionRate === resultItems[index]?.collectionCompletionRate,
    );
  const caveats = answerCaveats.join(' ');
  const checks = {
    answerUsesExactSanitizedShape,
    answerCaveatsMatchApprovedSet:
      canonicalJson(answerCaveats) === canonicalJson(A05_EXPECTED_CAVEATS),
    answerThresholdsMatch:
      canonicalJson(parsed?.thresholds) ===
      canonicalJson({ ratingMin: 8, collectionCompletionRateMax: 0.4 }),
    answerFormulaMatches: parsed?.formula === FORMULA,
    answerRowsMatchResult: rowMatches,
    answerCoverageMatchesResult: coverageMatches,
    answerExplainsSampleFormula: hasDisclosure(caveats, [/sample-verified/iu, /样本验证/u]),
    answerDistinguishesOfficialFormula:
      hasDisclosure(caveats, [/not an official formula/iu, /不是官方公式/u]),
    answerDisclaimsEpisodeAndPersonalProgress:
      /(?:not.{0,40}episode completion|not.{0,40}personal progress|不是章节完成|不是个人进度)/iu.test(
        caveats,
      ),
    answerDisclosesExperimentalEstimatedBounds:
      /(?:experimental.{0,80}estimated|estimated.{0,80}experimental)/iu.test(caveats) ||
      /实验.{0,80}估计|估计.{0,80}实验/u.test(caveats),
    answerDisclosesUnresolvedCoverage:
      /(?:unresolved|not computable|未解析|不可计算)/iu.test(caveats),
    answerDisclosesBoundedSample:
      /(?:bounded observed sample|有界观察样本|有界样本|本次实际观察)/iu.test(caveats),
    answerDisclaimsPreference: /(?:not.*preference|not.*taste|不代表.*偏好|不表示.*偏好)/iu.test(caveats),
    answerAvoidsCompletenessClaim: noUnsupportedCompletenessClaim(caveats),
  };
  return { parsed, checks };
}

export function verifyA05CollectionShareAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const { result, structured, textResult } = resultSources(toolOutput);
  const items = Array.isArray(result?.items) ? result.items : [];
  const sourceRows = items.map(rowValues);
  const validRows = sourceRows.filter(Boolean);
  const evidence = evidenceSummary(items);
  const request = Array.isArray(result?.plan?.steps)
    ? result.plan.steps.find((step) => step?.kind === 'search')?.request
    : undefined;
  const requestFilter = isObject(request?.filter) ? request.filter : {};
  const derived = Array.isArray(result?.plan?.derivedFilters) ? result.plan.derivedFilters : [];
  const completionFilter = derived.find((filter) => filter?.field === 'collectionCompletionRate');
  const coverage = result?.coverage;
  const budget = result?.plan?.budget;
  const textItems = Array.isArray(textResult?.result?.items)
    ? textResult.result.items.map(rowValues)
    : [];
  const textProjection = isObject(textResult?.result?.textProjection)
    ? textResult.result.textProjection
    : {};
  const planLimitations = Array.isArray(result?.plan?.limitations)
    ? result.plan.limitations.join(' ')
    : '';
  const formulaText = typeof textResult?.text === 'string' ? textResult.text : '';
  const formulaPosition = formulaText.indexOf('collectionCompletionRate = collect');
  const rowsPosition = formulaText.indexOf('"items"');
  const hasTextProjection = isObject(textResult?.result?.textProjection);
  const textRowsComplete = hasTextProjection
    ? textProjection.rowsOmitted === 0 &&
      textProjection.rowsIncluded === items.length &&
      textProjection.displayNamesClipped === 0
    : textItems.length === items.length;
  const answerResult = answerShape(answer, result, validRows);

  const checks = {
    exactQueryArguments: exactQuery(queryArguments),
    exactlyOneTargetToolCall: exactCall(toolCalls, queryArguments),
    resultReadbackAvailable: result !== null,
    structuredOrCompleteTextResultAvailable:
      structured !== null || (textResult !== null && textRowsComplete),
    resultUsesOfficialSubjectSearch:
      result?.plan?.source === 'official_v0' && result?.plan?.operation === 'searchSubjects',
    ratingFilterIsSearchPushdown:
      Array.isArray(requestFilter.rating) && requestFilter.rating.includes('>=8'),
    animeMediaIsSearchPushdown:
      Array.isArray(requestFilter.type) && requestFilter.type.length === 1 && requestFilter.type[0] === 2,
    collectionShareIsLocalDerivedFilter:
      completionFilter?.classification === 'DERIVED_FILTER' &&
      completionFilter?.value?.max === 0.4,
    allReturnedRowsAreAnime: items.length > 0 && items.every((item) => item?.media === 'anime'),
    allReturnedRowsAreValid: validRows.length === items.length && items.length > 0,
    allReturnedScoresMeetThreshold: validRows.every((item) => item.score >= 8),
    allReturnedSharesMeetThreshold: validRows.every(
      (item) => item.collectionCompletionRate >= 0 && item.collectionCompletionRate <= 0.4,
    ),
    returnedRowsAreScoreDescending: validRows
      .slice(1)
      .every((item, index) => validRows[index]?.score >= item.score),
    everyRowHasFormulaEvidence: evidence.formulaRows === items.length && items.length > 0,
    everyRowHasOfficialCollectionEvidence: evidence.sourceRows === items.length && items.length > 0,
    coverageIsBoundedAndConsistent:
      isObject(coverage) &&
      ['ok', 'partial', 'unknown'].includes(result?.state) &&
      coverageStatesAreConsistent(result?.state, coverage) &&
      coverage.totalKind === 'estimated' &&
      typeof coverage.budgetExceeded === 'boolean' &&
      typeof coverage.hydrationBudgetExceeded === 'boolean' &&
      nonNegativeInteger(coverage.scanned) &&
      nonNegativeInteger(coverage.matched) &&
      coverage.matched <= coverage.scanned &&
      nonNegativeInteger(coverage.returned) &&
      coverage.returned === items.length &&
      coverage.returned <= A05_EXPECTED_QUERY_ARGUMENTS.limit &&
      coverage.matched >= coverage.returned &&
      coverage.scanned >= coverage.returned &&
      coverage.scanned <= DEFAULT_MAX_CANDIDATES &&
      nonNegativeInteger(coverage.unresolvedCandidates) &&
      coverage.unresolvedCandidates <= coverage.scanned &&
      nonNegativeInteger(coverage.pagesScanned) &&
      coverage.pagesScanned <= DEFAULT_MAX_PAGES &&
      nonNegativeInteger(coverage.hydrationsAttempted) &&
      coverage.hydrationsAttempted <= DEFAULT_MAX_HYDRATIONS &&
      nonNegativeInteger(coverage.hydrationsSucceeded) &&
      nonNegativeInteger(coverage.hydrationsFailed) &&
      nonNegativeInteger(coverage.hydrationsUnresolved) &&
      coverage.hydrationsUnresolved === coverage.unresolvedCandidates &&
      coverage.hydrationsSucceeded + coverage.hydrationsFailed <= coverage.hydrationsAttempted &&
      coverage.hydrationsUnresolved <= coverage.scanned &&
      (coverage.outputCap === undefined ||
        (Number.isSafeInteger(coverage.outputCap) &&
          coverage.outputCap >= 1 &&
          coverage.outputCap <= DEFAULT_MAX_RETURNED_ITEMS)) &&
      (coverage.reason === undefined || typeof coverage.reason === 'string'),
    effectiveBudgetIsServerBounded:
      budget?.maxPages === DEFAULT_MAX_PAGES &&
      budget?.maxCandidates === DEFAULT_MAX_CANDIDATES &&
      budget?.maxHydrations === DEFAULT_MAX_HYDRATIONS &&
      budget?.concurrency === DEFAULT_CONCURRENCY &&
      budget?.maxReturnedItems === DEFAULT_MAX_RETURNED_ITEMS,
    formulaCaveatIsPrioritized:
      formulaPosition >= 0 && (!hasTextProjection || rowsPosition > formulaPosition),
    formulaAndSampleLimitationsPresent:
      /not an official API formula/u.test(planLimitations) &&
      /experimental/u.test(planLimitations) &&
      /estimated/u.test(planLimitations) &&
      /bounded observed sample/u.test(planLimitations),
    planDisclosesUnresolvedCoverage:
      planLimitations.includes(COLLECTION_COMPLETION_UNRESOLVED_CAVEAT),
    textReadbackHasAllUnclippedRows:
      textResult !== null && textRowsComplete && rowsEqual(validRows, textItems),
    toolTextWithinLimit:
      Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600,
    ...answerResult.checks,
  };
  const counters = {
    state: typeof result?.state === 'string' ? result.state : 'unavailable',
    totalKind: typeof coverage?.totalKind === 'string' ? coverage.totalKind : 'unknown',
    scanned: nonNegativeInteger(coverage?.scanned) ? coverage.scanned : null,
    pagesScanned: nonNegativeInteger(coverage?.pagesScanned) ? coverage.pagesScanned : null,
    matched: nonNegativeInteger(coverage?.matched) ? coverage.matched : null,
    returned: nonNegativeInteger(coverage?.returned) ? coverage.returned : null,
    unresolvedCandidates: nonNegativeInteger(coverage?.unresolvedCandidates)
      ? coverage.unresolvedCandidates
      : null,
    hydrationsAttempted: nonNegativeInteger(coverage?.hydrationsAttempted)
      ? coverage.hydrationsAttempted
      : null,
    formulaEvidenceRows: evidence.formulaRows,
    sourceEvidenceRows: evidence.sourceRows,
    textRowsIncluded: nonNegativeInteger(textProjection.rowsIncluded)
      ? textProjection.rowsIncluded
      : null,
    textRowsOmitted: nonNegativeInteger(textProjection.rowsOmitted)
      ? textProjection.rowsOmitted
      : null,
    effectiveBudget: {
      maxPages: budget?.maxPages ?? null,
      maxCandidates: budget?.maxCandidates ?? null,
      maxHydrations: budget?.maxHydrations ?? null,
      concurrency: budget?.concurrency ?? null,
      maxReturnedItems: budget?.maxReturnedItems ?? null,
    },
    answerItemCount: Array.isArray(answerResult.parsed?.items) ? answerResult.parsed.items.length : null,
    warningCount: Array.isArray(result?.warnings) ? result.warnings.length : null,
    experimentalSourceWarningPresent:
      Array.isArray(result?.warnings) && result.warnings.some((warning) => warning?.code === 'EXPERIMENTAL_SOURCE'),
  };
  return {
    passed:
      typeof answer === 'string' &&
      answer.trim().length > 0 &&
      Object.values(checks).every(Boolean),
    checks,
    counters,
    answerCheckMethod: A05_ANSWER_CHECK_METHOD,
  };
}

export function querySha256(value = A05_EXPECTED_QUERY_ARGUMENTS) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_CANDIDATES = 500;
const DEFAULT_MAX_HYDRATIONS = 120;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_RETURNED_ITEMS = 100;
