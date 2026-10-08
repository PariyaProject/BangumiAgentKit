export const D04_DISCOVERY_ANSWER_CHECK_METHOD =
  'bounded-official-anime-exact-tag-rating-and-reported-eps-v1';
export const D04_DISCOVERY_TOOL = 'bangumi.query_subjects';
export const D04_DISCOVERY_ARGUMENTS = Object.freeze({
  media: 'anime',
  tags: ['科幻'],
  ratingCount: { min: 3001 },
  reportedEpisodeCount: { max: 12 },
  resultMode: 'all',
  limit: 100,
  explain: 'full',
});

const ITEM_ROW =
  /^\s*条目[｜|](\d+)[｜|]名称[:=：](.+)[｜|]评分人数[:=：]([\d,]+)[｜|]报告话数[:=：](\d+)\s*$/u;
const NUMBER_TOKEN = /(?<![A-Za-z0-9])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/gu;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)/u;
const COMPLETENESS_TERMS =
  /(?:完整(?:清单|名单|列表|结果|覆盖)|全量(?:清单|结果|覆盖)|所有(?:符合条件的?)?(?:动画|作品|条目|候选)|全部(?:动画|作品|条目|候选)|全库)/giu;
const COMPLETENESS_NEGATION =
  /(?:不构成|不代表|不能(?:据此)?(?:证明|确认|说明)|无法(?:据此)?(?:证明|确认|说明)|不足以(?:证明|确认)|not\s+(?:a\s+)?complete|does\s+not\s+prove)(?:全库|全站|全部|全量)?\s*$/iu;
const ABSENCE_TERMS =
  /(?:(?:没有|不存在|找不到|无)(?:其他|更多|其余|任何)(?:动画|作品|条目|候选)|(?:动画|作品|条目|候选).{0,8}(?:只有|仅有)(?:上述|以上|这些|前述))/gu;
const ABSENCE_NEGATION = /(?:不代表|不说明|不能据此证明|无法据此证明|not\s+evidence\s+of)\s*$/iu;

export function canonicalD04Json(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalD04Json).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalD04Json(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findDiscoveryResult(value, seen = new Set(), depth = 0) {
  if (depth > 10 || value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
  }
  if (
    isObject(value) &&
    Array.isArray(value.items) &&
    isObject(value.coverage) &&
    isObject(value.plan)
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDiscoveryResult(item, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(value)) return null;
  if (value.structuredContent) {
    const found = findDiscoveryResult(value.structuredContent, seen, depth + 1);
    if (found) return found;
  }
  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      if (typeof item?.text !== 'string') continue;
      try {
        const found = findDiscoveryResult(JSON.parse(item.text), seen, depth + 1);
        if (found) return found;
      } catch {
        // Non-JSON text is not result readback.
      }
    }
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'structuredContent' || key === 'content') continue;
    const found = findDiscoveryResult(item, seen, depth + 1);
    if (found) return found;
  }
  return null;
}

function findDiscoveryTextView(value, seen = new Set(), depth = 0) {
  if (depth > 10 || value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
  }
  if (
    isObject(value) &&
    isObject(value.textProjection) &&
    Array.isArray(value.items) &&
    value.textProjection.fullStructuredContentAvailable === true &&
    Number.isSafeInteger(value.textProjection.rowsOmitted)
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDiscoveryTextView(item, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(value)) return null;
  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      if (typeof item?.text !== 'string') continue;
      try {
        const parsed = JSON.parse(item.text);
        if (
          isObject(parsed) &&
          isObject(parsed.textProjection) &&
          Array.isArray(parsed.items) &&
          parsed.textProjection.fullStructuredContentAvailable === true &&
          Number.isSafeInteger(parsed.textProjection.rowsOmitted)
        ) {
          return parsed;
        }
      } catch {
        // Ignore other tool-text forms.
      }
    }
  }
  if (value.structuredContent) {
    const found = findDiscoveryTextView(value.structuredContent, seen, depth + 1);
    if (found) return found;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'structuredContent' || key === 'content') continue;
    const found = findDiscoveryTextView(item, seen, depth + 1);
    if (found) return found;
  }
  return null;
}

function findDiscoveryTextResult(value) {
  if (!isObject(value) || !Array.isArray(value.content)) return null;
  for (const item of value.content) {
    if (typeof item?.text !== 'string') continue;
    try {
      const result = findDiscoveryResult(JSON.parse(item.text));
      if (result) return result;
    } catch {
      // Non-JSON text is not a structured discovery readback.
    }
  }
  return null;
}

function unwrapArguments(value) {
  if (!isObject(value)) return value;
  if (isObject(value.arguments)) return value.arguments;
  if (isObject(value.args)) return value.args;
  return value;
}

function planFilters(plan, property) {
  return Array.isArray(plan?.[property]) ? plan[property] : [];
}

function rangeFilter(filters, field) {
  return filters.find((filter) => filter?.field === field && isObject(filter.value))?.value;
}

function requestFilter(result) {
  const step = Array.isArray(result.plan?.steps)
    ? result.plan.steps.find(
        (item) => item?.kind === 'search' && item?.operation === 'searchSubjects',
      )
    : undefined;
  return step?.request?.filter && isObject(step.request.filter) ? step.request.filter : {};
}

function rowsFromAnswer(answer) {
  if (typeof answer !== 'string') return [];
  return answer.split(/\r?\n/u).flatMap((line) => {
    const match = ITEM_ROW.exec(line);
    if (!match) return [];
    return [
      {
        id: Number(match[1]),
        name: match[2].trim(),
        ratingCount: Number(match[3].replaceAll(',', '')),
        reportedEpisodeCount: Number(match[4]),
      },
    ];
  });
}

function visibleNameMatchesStructuredSource(visibleName, sourceNames) {
  if (sourceNames.includes(visibleName)) return true;
  const visibleCharacters = Array.from(visibleName);
  if (visibleCharacters.length < 2 || visibleCharacters.at(-1) !== '…') return false;
  const prefix = visibleCharacters.slice(0, -1);
  return sourceNames.some((sourceName) => {
    const sourceCharacters = Array.from(sourceName);
    return (
      sourceCharacters.length > prefix.length &&
      prefix.every((character, index) => character === sourceCharacters[index])
    );
  });
}

function precedingClauseIsNegated(text, index, pattern) {
  const prefix = text.slice(0, index);
  const boundaries = [...prefix.matchAll(/[。！？；;，,\n]|但是|然而|不过|但|however|but/giu)];
  const last = boundaries.at(-1);
  const clause = prefix.slice(last ? last.index + last[0].length : 0).trim();
  return pattern.test(clause);
}

function hasUnnegated(pattern, negation, text) {
  if (typeof text !== 'string') return false;
  for (const match of text.matchAll(pattern)) {
    if (!precedingClauseIsNegated(text, match.index ?? 0, negation)) return true;
  }
  return false;
}

function checkItemRows(result, answerRows, visibleItems) {
  const sourceRows = Array.isArray(result.items) ? result.items : [];
  const rowsById = new Map(
    sourceRows.flatMap((item) =>
      Number.isSafeInteger(item?.id) && item.id > 0 ? [[item.id, item]] : [],
    ),
  );
  const visibleIds = (Array.isArray(visibleItems) ? visibleItems : []).map((item) => item?.id);
  const visibleRowsById = new Map(
    (Array.isArray(visibleItems) ? visibleItems : []).flatMap((item) =>
      Number.isSafeInteger(item?.id) && item.id > 0 ? [[item.id, item]] : [],
    ),
  );
  let matched = 0;
  let mismatched = 0;
  let unmatched = 0;
  let duplicate = 0;
  const seen = new Set();
  for (const row of answerRows) {
    if (seen.has(row.id)) duplicate += 1;
    seen.add(row.id);
    const expected = rowsById.get(row.id);
    if (!expected) {
      unmatched += 1;
      continue;
    }
    const displayed = visibleRowsById.get(row.id) || expected;
    const names = [displayed.name, displayed.nameCn, displayed.displayName].filter(
      (value) => typeof value === 'string',
    );
    const structuredNames = [expected.name, expected.nameCn, expected.displayName].filter(
      (value) => typeof value === 'string',
    );
    const projectedNamesMatchSource =
      names.length > 0 &&
      names.every((name) => visibleNameMatchesStructuredSource(name, structuredNames));
    if (
      !names.includes(row.name) ||
      !projectedNamesMatchSource ||
      displayed.ratingCount !== expected.ratingCount ||
      displayed.reportedEpisodeCount !== expected.reportedEpisodeCount ||
      row.ratingCount !== displayed.ratingCount ||
      row.reportedEpisodeCount !== displayed.reportedEpisodeCount
    ) {
      mismatched += 1;
      continue;
    }
    matched += 1;
  }
  const missing = visibleIds.filter((id) => Number.isSafeInteger(id) && !seen.has(id)).length;
  const orderPreserved =
    answerRows.length === visibleIds.length &&
    visibleIds.every((id, index) => answerRows[index]?.id === id);
  return {
    matched,
    mismatched,
    unmatched,
    duplicate,
    missing,
    orderPreserved,
    sourceRowCount: sourceRows.length,
    visibleRowCount: visibleIds.length,
    answerRowCount: answerRows.length,
  };
}

function coverageSummaryMatches(line, coverage) {
  const match =
    /^范围[｜|]state=([a-z_]+)[｜|]scanned=(\d+)[｜|]matched=(\d+)[｜|]returned=(\d+)[｜|]totalKind=([a-z_]+)$/u.exec(
      line,
    );
  return Boolean(
    match &&
    typeof coverage?.state === 'string' &&
    Number.isSafeInteger(coverage.scanned) &&
    Number.isSafeInteger(coverage.matched) &&
    Number.isSafeInteger(coverage.returned) &&
    typeof coverage.totalKind === 'string' &&
    match[1] === coverage.state &&
    Number(match[2]) === coverage.scanned &&
    Number(match[3]) === coverage.matched &&
    Number(match[4]) === coverage.returned &&
    match[5] === coverage.totalKind,
  );
}

function discoveryTextReadbackMatches(result, textResult, textView) {
  if (!result || !textResult || !Array.isArray(result.items) || !Array.isArray(textResult.items))
    return false;
  const sourceCoverage = result.coverage;
  const visibleCoverage = textResult.coverage;
  if (
    !isObject(sourceCoverage) ||
    !isObject(visibleCoverage) ||
    result.state !== textResult.state ||
    sourceCoverage.state !== visibleCoverage.state ||
    sourceCoverage.scanned !== visibleCoverage.scanned ||
    sourceCoverage.matched !== visibleCoverage.matched ||
    sourceCoverage.returned !== visibleCoverage.returned ||
    sourceCoverage.totalKind !== visibleCoverage.totalKind ||
    sourceCoverage.returned !== result.items.length
  ) {
    return false;
  }
  if (textView) {
    const projection = textView.textProjection;
    if (
      projection.fullStructuredContentAvailable !== true ||
      projection.rowsIncluded !== textResult.items.length ||
      projection.rowsOmitted !== result.items.length - textResult.items.length
    ) {
      return false;
    }
  } else if (textResult.items.length !== result.items.length) {
    return false;
  }
  const expectedVisible = result.items.slice(0, textResult.items.length);
  return textResult.items.every((item, index) => {
    const expected = expectedVisible[index];
    return (
      expected &&
      item?.id === expected.id &&
      item?.media === expected.media &&
      item?.ratingCount === expected.ratingCount &&
      item?.reportedEpisodeCount === expected.reportedEpisodeCount &&
      Array.isArray(item?.tags) &&
      item.tags.includes('科幻')
    );
  });
}

function supportedAnswerNumbers(answer, result, rows) {
  if (typeof answer !== 'string' || !isObject(result?.coverage)) return false;
  const lines = answer
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const conditions = lines.filter((line) => line.startsWith('条件｜') || line.startsWith('条件|'));
  const coverageLines = lines.filter(
    (line) => line.startsWith('范围｜') || line.startsWith('范围|'),
  );
  if (
    conditions.length !== 1 ||
    coverageLines.length !== 1 ||
    !coverageSummaryMatches(coverageLines[0], result.coverage)
  ) {
    return false;
  }
  const conditionNumbers = conditions[0].match(NUMBER_TOKEN) ?? [];
  if (
    canonicalD04Json(conditionNumbers.map((token) => Number(token.replaceAll(',', '')))) !==
    canonicalD04Json([2, 3001, 12])
  ) {
    return false;
  }
  const rowLines = lines.filter((line) => ITEM_ROW.test(line));
  if (rowLines.length !== rows.length) return false;
  return lines.every((line) => {
    if (ITEM_ROW.test(line) || line === conditions[0] || line === coverageLines[0]) return true;
    return (line.match(NUMBER_TOKEN) ?? []).length === 0;
  });
}

export function verifyD04DiscoveryAnswer(answer, toolCalls, queryArguments, toolOutput) {
  const parsedArguments = unwrapArguments(queryArguments);
  const queryArgumentsMatch =
    canonicalD04Json(parsedArguments) === canonicalD04Json(D04_DISCOVERY_ARGUMENTS);
  const result = findDiscoveryResult(toolOutput);
  const textView = findDiscoveryTextView(toolOutput);
  const textResult = findDiscoveryTextResult(toolOutput);
  const visibleItems = textResult?.items ?? [];
  const textReadbackMatches = discoveryTextReadbackMatches(result, textResult, textView);
  const rows = rowsFromAnswer(answer);
  const rowChecks = result
    ? checkItemRows(result, rows, visibleItems)
    : {
        matched: 0,
        mismatched: 0,
        unmatched: 0,
        duplicate: 0,
        missing: 0,
        orderPreserved: false,
        sourceRowCount: 0,
        visibleRowCount: 0,
        answerRowCount: rows.length,
      };
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const singleTargetCall =
    calls.length === 1 &&
    calls[0]?.name === D04_DISCOVERY_TOOL &&
    ['DONE', 'SUCCESS'].includes(String(calls[0]?.state).toUpperCase());
  const inputFilter = result ? requestFilter(result) : {};
  const postFilters = result ? planFilters(result.plan, 'postFilters') : [];
  const tagFilter = Array.isArray(inputFilter.tag) && inputFilter.tag.includes('科幻');
  const ratingFilter =
    Array.isArray(inputFilter.ratingCount) && inputFilter.ratingCount.includes('>=3001');
  const mediaFilter = Array.isArray(inputFilter.type) && inputFilter.type.includes(2);
  const episodeRange = rangeFilter(postFilters, 'reportedEpisodeCount');
  const episodeFilterIsLocal =
    postFilters.some(
      (item) => item?.field === 'reportedEpisodeCount' && item?.classification === 'POST_FILTER',
    ) &&
    episodeRange?.max === 12 &&
    !Object.keys(inputFilter).some((key) => /episode|eps/iu.test(key));
  const sourceContract = Boolean(
    result &&
    result.plan.source === 'official_v0' &&
    result.plan.operation === 'searchSubjects' &&
    result.coverage.totalKind === 'estimated',
  );
  const coverage = result?.coverage ?? {};
  const coverageStateConsistent = Boolean(
    result &&
    ((result.state === 'ok' && coverage.state === 'complete') ||
      (result.state === 'partial' && coverage.state === 'partial')),
  );
  const budget = result?.plan?.budget ?? {};
  const unresolvedOrTruncated =
    coverage.budgetExceeded === true ||
    coverage.hydrationBudgetExceeded === true ||
    (Number.isSafeInteger(coverage.hydrationsUnresolved) && coverage.hydrationsUnresolved > 0) ||
    (Number.isSafeInteger(coverage.outputCap) && coverage.matched > coverage.returned);
  const boundedResources =
    Number.isSafeInteger(coverage.pagesRequested) &&
    coverage.pagesRequested <= 10 &&
    Number.isSafeInteger(coverage.pagesScanned) &&
    coverage.pagesScanned <= 10 &&
    Number.isSafeInteger(coverage.scanned) &&
    coverage.scanned <= 500 &&
    Number.isSafeInteger(coverage.hydrationsAttempted) &&
    coverage.hydrationsAttempted <= 120 &&
    Number.isSafeInteger(coverage.returned) &&
    coverage.returned <= 100 &&
    budget.maxPages === 10 &&
    budget.maxCandidates === 500 &&
    budget.maxHydrations === 120 &&
    budget.maxReturnedItems === 100 &&
    (!unresolvedOrTruncated || (result?.state === 'partial' && coverage.state === 'partial'));
  const sourceRows = Array.isArray(result?.items) ? result.items : [];
  const sourceRowsValid = sourceRows.every(
    (item) =>
      item.media === 'anime' &&
      Array.isArray(item.tags) &&
      item.tags.includes('科幻') &&
      Number.isSafeInteger(item.ratingCount) &&
      item.ratingCount >= 3001 &&
      Number.isSafeInteger(item.reportedEpisodeCount) &&
      item.reportedEpisodeCount >= 0 &&
      item.reportedEpisodeCount <= 12,
  );
  const reportedEpisodeEvidenceVisible = sourceRows.every(
    (item) =>
      Array.isArray(item?.evidence?.reportedEpisodeCount) &&
      item.evidence.reportedEpisodeCount.some(
        (ref) =>
          ref?.source?.class === 'official_v0' &&
          ['eps', `items[${item.id}].eps`].includes(ref?.fieldPath),
      ),
  );
  const answerText = typeof answer === 'string' ? answer : '';
  const lines = answerText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const scopeText = lines
    .filter((line) => /^(?:条件|筛选|范围|口径|说明)[｜|:：]/u.test(line))
    .join('\n');
  const queryScopeDisclosure =
    /动画/u.test(scopeText) &&
    /科幻/u.test(scopeText) &&
    /(?:评分人数|ratingCount).{0,24}(?:3000|3,000|3001|3,001)/u.test(scopeText) &&
    /(?:subject\.eps|报告话数).{0,24}(?:12|十三|13)/u.test(scopeText);
  const boundedDisclosure =
    /(?:本次|有限|有界|bounded)/iu.test(scopeText) &&
    /(?:实验性|experimental)/iu.test(scopeText) &&
    /(?:估算|估计|estimated)/iu.test(scopeText);
  const partialCoverageDisclosure =
    result?.state !== 'partial' || /(?:部分|不完整|未完成|partial)/iu.test(scopeText);
  const reportedEpsDisclosure =
    /subject\.eps/iu.test(scopeText) &&
    /(?:不是|不等于|而非|not)/iu.test(scopeText) &&
    /(?:total_episodes|章节数|已播|观看进度|watched)/iu.test(scopeText);
  const nonExhaustiveDisclosure =
    /(?:不构成|不代表|不能据此|无法据此|not\s+(?:a\s+)?complete)/iu.test(scopeText) &&
    /(?:完整清单|全库|完整结果|complete\s+(?:list|inventory))/iu.test(scopeText);
  const omissionDisclosure = Boolean(
    textReadbackMatches &&
    (!textView ||
      textView.textProjection.rowsOmitted === 0 ||
      /(?:仅显示|文本视图|省略|未展示|omitted)/iu.test(scopeText)),
  );
  const emptyResultDisclosure =
    rowChecks.sourceRowCount > 0 ||
    (/(?:本次|当前).{0,12}(?:未观察到|没有观察到|未发现|没有找到)/u.test(answerText) &&
      /(?:不代表|不能据此|不足以证明).{0,12}(?:不存在|没有)/u.test(answerText));
  const markdownFormattingDetected =
    lines.some((line) => MARKDOWN_LINE.test(line)) ||
    answerText.includes('**') ||
    answerText.includes('`');
  const unsupportedCompletenessClaim =
    hasUnnegated(COMPLETENESS_TERMS, COMPLETENESS_NEGATION, answerText) ||
    hasUnnegated(ABSENCE_TERMS, ABSENCE_NEGATION, answerText);
  const numericClaimsMatch = supportedAnswerNumbers(answerText, result, rows);
  const visibleRowsMatch =
    rowChecks.answerRowCount === rowChecks.visibleRowCount &&
    rowChecks.matched === rowChecks.answerRowCount &&
    rowChecks.mismatched === 0 &&
    rowChecks.unmatched === 0 &&
    rowChecks.duplicate === 0 &&
    rowChecks.missing === 0 &&
    rowChecks.orderPreserved;
  const checks = {
    exactTargetToolCalledOnce: singleTargetCall,
    exactQueryArguments: queryArgumentsMatch,
    resultReadbackAvailable: Boolean(result && textResult && textReadbackMatches),
    mcpTextProjectionPreservesFullStructuredResult: textReadbackMatches,
    officialExperimentalSourceAndEstimatedCoverage: sourceContract,
    coverageStateConsistent,
    exactAnimeTagAndRatingFilters: mediaFilter && tagFilter && ratingFilter,
    reportedEpisodeCountIsLocalPostFilter: episodeFilterIsLocal,
    reportedEpisodeEvidenceVisible,
    withinResourceCeilings: boundedResources,
    allObservedRowsMatchRequestedFilters: sourceRowsValid,
    answerRowsMatchVisibleSourceRows: visibleRowsMatch,
    queryConditionsDisclosed: queryScopeDisclosure,
    boundedExperimentalEstimatedScopeDisclosed: boundedDisclosure,
    partialCoverageDisclosure,
    reportedEpsMeaningDisclosed: reportedEpsDisclosure,
    nonExhaustiveBoundaryDisclosed: nonExhaustiveDisclosure,
    textProjectionOmissionDisclosed: omissionDisclosure,
    emptyResultNotOverclaimed: emptyResultDisclosure,
    unsupportedCompletenessOrAbsenceClaim: unsupportedCompletenessClaim,
    numericClaimsMatchObservedSource: numericClaimsMatch,
    markdownFormattingDetected,
  };
  const passed =
    typeof answer === 'string' &&
    answer.trim().length > 0 &&
    Object.entries(checks).every(([key, value]) =>
      key === 'markdownFormattingDetected'
        ? value === false
        : key === 'unsupportedCompletenessOrAbsenceClaim'
          ? value === false
          : Boolean(value),
    );
  return {
    method: D04_DISCOVERY_ANSWER_CHECK_METHOD,
    passed,
    checks,
    counts: {
      sourceRows: rowChecks.sourceRowCount,
      visibleRows: rowChecks.visibleRowCount,
      answerRows: rowChecks.answerRowCount,
      matchedRows: rowChecks.matched,
      mismatchedRows: rowChecks.mismatched,
      unmatchedRows: rowChecks.unmatched,
      duplicateRows: rowChecks.duplicate,
      missingVisibleRows: rowChecks.missing,
      scanCount: Number.isSafeInteger(coverage.scanned) ? coverage.scanned : 0,
      pageCount: Number.isSafeInteger(coverage.pagesScanned) ? coverage.pagesScanned : 0,
      hydrationCount: Number.isSafeInteger(coverage.hydrationsAttempted)
        ? coverage.hydrationsAttempted
        : 0,
    },
  };
}

export function createSanitizedD04CanaryReport(input) {
  const server = input?.serverSummary;
  const answerCheck = input?.answerCheck;
  const queryArgumentsMatch =
    canonicalD04Json(input?.queryArguments) === canonicalD04Json(D04_DISCOVERY_ARGUMENTS);
  const serverContract = Boolean(
    server &&
    server.serverProfile === 'one-tool-anonymous-public-v1' &&
    server.toolName === D04_DISCOVERY_TOOL &&
    server.serverToolCount === 1 &&
    Array.isArray(server.serverToolNames) &&
    server.serverToolNames.length === 1 &&
    server.serverToolNames[0] === D04_DISCOVERY_TOOL &&
    server.serverResultStatus === 'SUCCESS' &&
    server.allowedCallCount === 1 &&
    server.deniedCallCount === 0 &&
    server.argumentMatch === true &&
    server.result?.d04DiscoveryChecks &&
    server.result.d04DiscoveryChecks.operation === 'searchSubjects',
  );
  const privacy = server?.privacy ?? {};
  const privacyChecks = {
    anonymous: privacy.authProfile === 'anonymous',
    oauthNotAttempted: privacy.oauthAttempted === false,
    accountDataNotRead: privacy.accountDataRead === false,
    writesNotAttempted: privacy.writesAttempted === false,
    qqNotTested: privacy.qqPipelineTested === false,
    timNotTested: privacy.timClientTested === false,
    promptNotStored: privacy.promptStored === false,
    answerNotStored: privacy.answerStored === false,
    rawResultNotStored: privacy.rawResultStored === false,
    artifactImageBytesNotStored: privacy.artifactImageBytesStored === false,
    credentialsNotStored: privacy.credentialsStored === false,
  };
  const checkKeys =
    answerCheck?.checks && typeof answerCheck.checks === 'object' ? answerCheck.checks : {};
  const passed = Boolean(
    queryArgumentsMatch &&
    serverContract &&
    answerCheck?.passed === true &&
    Object.values(privacyChecks).every(Boolean),
  );
  return {
    schemaVersion: 1,
    acceptanceKind: 'sanitized_anonymous_d04_agent_mcp',
    sourceRevision:
      typeof server?.sourceRevision === 'string' && /^[0-9a-f]{40}$/u.test(server.sourceRevision)
        ? server.sourceRevision
        : null,
    catalogSha256:
      typeof server?.catalogSha256 === 'string' && /^[0-9a-f]{64}$/u.test(server.catalogSha256)
        ? server.catalogSha256
        : null,
    toolName: D04_DISCOVERY_TOOL,
    toolDescriptionSha256:
      typeof server?.toolDescriptionSha256 === 'string' ? server.toolDescriptionSha256 : null,
    inputSchemaSha256:
      typeof server?.inputSchemaSha256 === 'string' ? server.inputSchemaSha256 : null,
    expectedArgumentsSha256:
      typeof server?.expectedArgumentsSha256 === 'string' ? server.expectedArgumentsSha256 : null,
    queryArgumentsMatch,
    serverContract,
    serverResultStatus: server?.serverResultStatus === 'SUCCESS' ? 'SUCCESS' : 'NOT_ACCEPTED',
    allowedCallCount: Number.isSafeInteger(server?.allowedCallCount) ? server.allowedCallCount : 0,
    deniedCallCount: Number.isSafeInteger(server?.deniedCallCount) ? server.deniedCallCount : 0,
    discoveryChecks: server?.result?.d04DiscoveryChecks ?? null,
    answerCheck: {
      passed: answerCheck?.passed === true,
      checks: checkKeys,
      counts: answerCheck?.counts ?? null,
    },
    privacy: privacyChecks,
    rawPromptStored: false,
    rawAnswerStored: false,
    rawResultStored: false,
    subjectFactsStored: false,
    passed,
  };
}

export function createD04CodexAcceptanceReport(input) {
  const sanitized = createSanitizedD04CanaryReport(input);
  const server = input?.serverSummary;
  const codex = input?.codexSummary;
  const answerCheck = input?.answerCheck;
  const checks =
    answerCheck?.checks && typeof answerCheck.checks === 'object' ? answerCheck.checks : {};
  const answerChecks = {
    exactTargetToolCalledOnce: checks.exactTargetToolCalledOnce === true,
    exactQueryArguments: checks.exactQueryArguments === true,
    mcpTextProjectionPreservesFullStructuredResult:
      checks.mcpTextProjectionPreservesFullStructuredResult === true,
    officialExperimentalSourceAndEstimatedCoverage:
      checks.officialExperimentalSourceAndEstimatedCoverage === true,
    exactAnimeTagAndRatingFilters: checks.exactAnimeTagAndRatingFilters === true,
    reportedEpisodeCountIsLocalPostFilter: checks.reportedEpisodeCountIsLocalPostFilter === true,
    reportedEpisodeEvidenceVisible: checks.reportedEpisodeEvidenceVisible === true,
    withinResourceCeilings: checks.withinResourceCeilings === true,
    allObservedRowsMatchRequestedFilters: checks.allObservedRowsMatchRequestedFilters === true,
    answerRowsMatchVisibleSourceRows: checks.answerRowsMatchVisibleSourceRows === true,
    queryConditionsDisclosed: checks.queryConditionsDisclosed === true,
    boundedExperimentalEstimatedScopeDisclosed:
      checks.boundedExperimentalEstimatedScopeDisclosed === true,
    partialCoverageDisclosure: checks.partialCoverageDisclosure === true,
    reportedEpsMeaningDisclosed: checks.reportedEpsMeaningDisclosed === true,
    nonExhaustiveBoundaryDisclosed: checks.nonExhaustiveBoundaryDisclosed === true,
    textProjectionOmissionDisclosed: checks.textProjectionOmissionDisclosed === true,
    emptyResultNotOverclaimed: checks.emptyResultNotOverclaimed === true,
    noUnsupportedCompletenessOrAbsenceClaim: checks.unsupportedCompletenessOrAbsenceClaim === false,
    numericClaimsMatchObservedSource: checks.numericClaimsMatchObservedSource === true,
    plainTextWithoutMarkdown: checks.markdownFormattingDetected === false,
  };
  const result = server?.result;
  const facts = result?.d04DiscoveryChecks;
  const resultState =
    facts?.coverageState === 'complete' && facts?.resultState === 'ok'
      ? 'complete'
      : ['ok', 'partial'].includes(facts?.resultState)
        ? 'partial'
        : 'unavailable';
  const eventStreamAccepted =
    codex?.eventStreamParsed === true &&
    codex?.processExitCode === 0 &&
    codex?.codexMcpToolEventCount === 1 &&
    codex?.nonMcpToolEventCount === 0 &&
    codex?.shellToolCallCount === 0;
  const passed =
    sanitized.passed &&
    eventStreamAccepted &&
    Object.values(answerChecks).every(Boolean) &&
    typeof codex?.codexCliVersion === 'string' &&
    /^[0-9]+\.[0-9]+\.[0-9]+$/u.test(codex.codexCliVersion) &&
    codex?.model === 'gpt-6-luna' &&
    codex?.reasoningEffort === 'max' &&
    Number.isSafeInteger(result?.resultByteLength) &&
    result.resultByteLength > 0 &&
    typeof result?.resultSha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(result.resultSha256) &&
    Array.isArray(result?.sourceOperations) &&
    ['complete', 'partial'].includes(resultState);
  return {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_mcp_tool_use',
    sourceRevision: sanitized.sourceRevision,
    codexCliVersion: codex?.codexCliVersion ?? null,
    catalogSha256: sanitized.catalogSha256,
    profile: 'codex-luna-max-one-tool-v1',
    model: codex?.model === 'gpt-6-luna' ? 'gpt-6-luna' : null,
    reasoningEffort: codex?.reasoningEffort === 'max' ? 'max' : null,
    toolName: D04_DISCOVERY_TOOL,
    toolDescriptionSha256: sanitized.toolDescriptionSha256,
    inputSchemaSha256: sanitized.inputSchemaSha256,
    argumentProfile: 'd04-reported-episode-count-discovery-v1',
    expectedArgumentsSha256: sanitized.expectedArgumentsSha256,
    serverToolNames: [D04_DISCOVERY_TOOL],
    serverToolCount: Number.isSafeInteger(server?.serverToolCount) ? server.serverToolCount : 0,
    processExitCode: Number.isInteger(codex?.processExitCode) ? codex.processExitCode : -1,
    resultStatus: server?.serverResultStatus === 'SUCCESS' ? 'SUCCESS' : 'NOT_ACCEPTED',
    resultCount: server?.serverResultStatus === 'SUCCESS' ? 1 : 0,
    eventStreamParsed: codex?.eventStreamParsed === true,
    codexMcpToolEventCount: Number.isSafeInteger(codex?.codexMcpToolEventCount)
      ? codex.codexMcpToolEventCount
      : 0,
    nonMcpToolEventCount: Number.isSafeInteger(codex?.nonMcpToolEventCount)
      ? codex.nonMcpToolEventCount
      : 0,
    shellToolCallCount: Number.isSafeInteger(codex?.shellToolCallCount)
      ? codex.shellToolCallCount
      : 0,
    allowedCallCount: Number.isSafeInteger(server?.allowedCallCount) ? server.allowedCallCount : 0,
    deniedCallCount: Number.isSafeInteger(server?.deniedCallCount) ? server.deniedCallCount : 0,
    qqPipelineTested: false,
    timClientTested: false,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      communityRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
    scenarios: [
      {
        id: D04_DISCOVERY_TOOL,
        passed,
        exactArgumentsMatched: sanitized.queryArgumentsMatch,
        oneToolAllowlistVerified: sanitized.serverContract,
        resultReadbackVerified: checks.resultReadbackAvailable === true,
        answerCheckPassed: answerCheck?.passed === true,
        answerChecks,
        toolCalls: [{ name: D04_DISCOVERY_TOOL, state: 'DONE' }],
        result: {
          toolName: D04_DISCOVERY_TOOL,
          resultState,
          resultByteLength: Number.isSafeInteger(result?.resultByteLength)
            ? result.resultByteLength
            : 0,
          resultSha256:
            typeof result?.resultSha256 === 'string' ? result.resultSha256 : '0'.repeat(64),
          sourceOperations: Array.isArray(result?.sourceOperations) ? result.sourceOperations : [],
          artifact: { returned: false, persisted: false },
        },
      },
    ],
  };
}
