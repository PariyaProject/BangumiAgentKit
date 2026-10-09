const G02_QUERY_ARGUMENTS = {
  media: 'anime',
  from: '2024-01-01',
  to: '2025-01-01',
  concepts: ['异世界'],
  sort: 'heat',
  order: 'desc',
  resultMode: 'top',
  limit: 10,
  explain: 'full',
};

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

function findDiscoveryResult(value) {
  const queue = [{ value, depth: 0 }];
  const visited = new Set();
  let visitedCount = 0;
  while (queue.length > 0 && visitedCount < 1200) {
    const current = queue.shift();
    visitedCount += 1;
    let candidate = current.value;
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        continue;
      }
    }
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      current.depth > 14 ||
      visited.has(candidate)
    ) {
      continue;
    }
    visited.add(candidate);
    if (
      !Array.isArray(candidate) &&
      ['ok', 'partial'].includes(candidate.state) &&
      Array.isArray(candidate.items) &&
      candidate.coverage &&
      typeof candidate.coverage === 'object'
    ) {
      return candidate;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) queue.push({ value: item, depth: current.depth + 1 });
    } else {
      for (const key of [
        'content',
        'text',
        'data',
        'result',
        'output',
        'toolOutput',
        'structuredContent',
      ]) {
        if (key in candidate) queue.push({ value: candidate[key], depth: current.depth + 1 });
      }
    }
  }
  return null;
}

function rowTitle(item) {
  if (typeof item?.nameCn === 'string' && item.nameCn.trim()) return item.nameCn.trim();
  if (typeof item?.name === 'string' && item.name.trim()) return item.name.trim();
  return null;
}

function answerRows(answer) {
  const rows = [];
  const pattern = /^(\d+)\s*[｜|]\s*(.+?)\s*[｜|]\s*(?:当前收藏人数[:：]?\s*)?([\d,]+)\s*$/u;
  for (const line of answer.split(/\r?\n/u)) {
    const match = line.trim().match(pattern);
    if (match) {
      rows.push({
        id: Number(match[1]),
        title: match[2].trim(),
        collectionTotal: Number(match[3].replace(/,/gu, '')),
      });
    }
  }
  return rows;
}

function plainTextAnswer(answer) {
  if (typeof answer !== 'string' || answer.trim().length === 0) return false;
  return !answer
    .split(/\r?\n/u)
    .some((line) => /^\s*(?:#{1,6}\s|[-*+]\s|```|>\s|\d+\.\s|\[[^\]]+\]\()/u.test(line));
}

function hasUnsupportedTrendClaim(answer) {
  if (typeof answer !== 'string') return true;
  for (const clause of answer.split(/[。！？；;\n]/u)) {
    for (const match of clause.matchAll(/讨论热度|历史趋势|讨论增长/gu)) {
      const prefix = clause.slice(0, match.index);
      if (!/(?:不代表|不是|并非|非|不等于)(?:讨论热度)?(?:或|和|及|、)?\s*$/u.test(prefix)) {
        return true;
      }
    }
  }
  return false;
}

function hasUnsupportedGlobalTopTenClaim(answer) {
  if (typeof answer !== 'string') return true;
  for (const clause of answer.split(/[。！？；;\n]/u)) {
    for (const match of clause.matchAll(
      /(?:全站|全部作品|所有作品).{0,12}(?:最热门|前十|top\s*10)/giu,
    )) {
      const prefix = clause.slice(0, match.index);
      if (!/(?:不代表|不是|并非|非|不等于|不能认定|不构成)\s*$/u.test(prefix)) return true;
    }
  }
  return false;
}

function finalScopeLine(answer) {
  if (typeof answer !== 'string') return null;
  const lines = answer
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const scopeLines = lines.filter((line) => line.startsWith('范围：'));
  if (scopeLines.length !== 1 || lines.at(-1) !== scopeLines[0]) return null;
  return scopeLines[0];
}

function scopeDisclosure(answer, coverage) {
  const scopeLine = finalScopeLine(answer);
  if (!scopeLine) return false;
  const text = scopeLine.toLowerCase();
  const dateScope = text.includes('2024-01-01') && text.includes('2025-01-01');
  const exactConcept = text.includes('异世界');
  const currentHeatMeaning =
    text.includes('收藏人数') && (text.includes('当前') || text.includes('collection'));
  const experimental = text.includes('实验') || text.includes('experimental');
  const estimatedUnknown =
    text.includes('估算') && (text.includes('未知') || text.includes('unknown'));
  const nonExhaustive = /(?:不代表全站|非全站|未穷尽|不构成全站|不能认定全站)/u.test(scopeLine);
  const notTrend = scopeLine.includes('不代表讨论热度') && scopeLine.includes('历史趋势');
  const reportedCounts =
    coverage &&
    Number.isInteger(coverage.scanned) &&
    Number.isInteger(coverage.matched) &&
    Number.isInteger(coverage.returned) &&
    new RegExp(`扫描(?:到|了)?\\s*${coverage.scanned}\\s*(?:个候选|个条目|项)?`, 'u').test(
      scopeLine,
    ) &&
    new RegExp(`符合条件\\s*${coverage.matched}\\s*(?:个|条|项)?`, 'u').test(scopeLine) &&
    new RegExp(`(?:展示|返回)\\s*${coverage.returned}\\s*(?:条|个|项)`, 'u').test(scopeLine);
  const unsupportedPositive = hasUnsupportedGlobalTopTenClaim(scopeLine);
  return (
    dateScope &&
    exactConcept &&
    currentHeatMeaning &&
    experimental &&
    estimatedUnknown &&
    nonExhaustive &&
    notTrend &&
    reportedCounts &&
    !unsupportedPositive
  );
}

function rendererScopeDisclosure(answer) {
  const scopeLine = finalScopeLine(answer);
  if (!scopeLine) return false;
  const text = scopeLine.toLowerCase();
  return (
    text.includes('2024-01-01') &&
    text.includes('2025-01-01') &&
    text.includes('异世界') &&
    text.includes('收藏人数') &&
    text.includes('当前') &&
    (text.includes('实验') || text.includes('experimental')) &&
    text.includes('估算') &&
    /未知|不完整|未穷尽/u.test(scopeLine) &&
    /(?:不代表全站|非全站|未穷尽|不构成全站|不能认定全站)/u.test(scopeLine) &&
    scopeLine.includes('不代表讨论热度') &&
    scopeLine.includes('历史趋势')
  );
}

function resultCoverageIsSafe(result) {
  const coverage = result?.coverage;
  const warningCodes = Array.isArray(result?.warningCodes)
    ? result.warningCodes
    : Array.isArray(result?.warnings)
      ? result.warnings.map((warning) => warning?.code).filter((code) => typeof code === 'string')
      : [];
  return Boolean(
    ['unknown', 'partial'].includes(coverage?.state) &&
    coverage?.requested === G02_QUERY_ARGUMENTS.limit &&
    coverage?.totalKind === 'estimated' &&
    Number.isInteger(coverage?.scanned) &&
    coverage.scanned >= 1 &&
    Number.isInteger(coverage?.matched) &&
    coverage.matched >= 1 &&
    Number.isInteger(coverage?.returned) &&
    coverage.returned >= 1 &&
    coverage.returned <= G02_QUERY_ARGUMENTS.limit &&
    coverage.returned === result.items.length &&
    coverage.matched >= coverage.returned &&
    warningCodes.includes('EXPERIMENTAL_SOURCE'),
  );
}

export function verifyG02QueryAnswer({ answer, queryArguments, toolOutput }) {
  const result = findDiscoveryResult(toolOutput);
  const items = result?.items ?? [];
  const normalizedItems = items.map((item) => ({
    id: Number.isSafeInteger(item?.id) ? item.id : null,
    title: rowTitle(item),
    date: typeof item?.date === 'string' ? item.date : null,
    media: item?.media,
    collectionTotal: Number.isFinite(item?.collectionTotal) ? item.collectionTotal : null,
    conceptMatched:
      item?.conceptMatched === true || (Array.isArray(item?.tags) && item.tags.includes('异世界')),
  }));
  const rows = answerRows(typeof answer === 'string' ? answer : '');
  const uniqueIds =
    normalizedItems.length > 0 &&
    new Set(normalizedItems.map((item) => item.id)).size === normalizedItems.length;
  const sourceRowsValid =
    normalizedItems.length > 0 &&
    normalizedItems.every(
      (item) =>
        item.id !== null &&
        item.title !== null &&
        item.media === 'anime' &&
        typeof item.date === 'string' &&
        item.date >= '2024-01-01' &&
        item.date < '2025-01-01' &&
        item.conceptMatched &&
        item.collectionTotal !== null &&
        item.collectionTotal >= 0,
    );
  const heatOrder = normalizedItems
    .slice(1)
    .every((item, index) => normalizedItems[index].collectionTotal >= item.collectionTotal);
  const answerLines =
    typeof answer === 'string'
      ? answer
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
  const bodyLines = finalScopeLine(answer) ? answerLines.slice(0, -1) : [];
  const sourceAnswerMatch =
    bodyLines.length === normalizedItems.length &&
    rows.length === normalizedItems.length &&
    rows.length === bodyLines.length &&
    rows.every(
      (row, index) =>
        row.id === normalizedItems[index].id &&
        row.title === normalizedItems[index].title &&
        row.collectionTotal === normalizedItems[index].collectionTotal,
    );
  const answerChecks = {
    queryArgumentsMatch: canonicalJson(queryArguments) === canonicalJson(G02_QUERY_ARGUMENTS),
    exactSingleToolCall: true,
    resultReadbackAvailable: Boolean(result),
    exact2024DateWindow: sourceRowsValid,
    exactAnimeAndConcept: sourceRowsValid,
    uniqueSourceRows: uniqueIds,
    currentCollectionHeatOrder: heatOrder,
    sourceRowsMatchAnswer: sourceAnswerMatch,
    returnedRowsWithinLimit: normalizedItems.length <= G02_QUERY_ARGUMENTS.limit,
    coverageIsUnknownOrPartial: resultCoverageIsSafe(result),
    experimentalSourceDisclosed: scopeDisclosure(answer, result?.coverage),
    estimatedTotalNotPresentedAsComplete: scopeDisclosure(answer, result?.coverage),
    noUnsupportedGlobalTopTenClaim: !hasUnsupportedGlobalTopTenClaim(answer),
    noUnsupportedTrendClaim: !hasUnsupportedTrendClaim(answer),
    plainTextNoMarkdown: plainTextAnswer(answer) && finalScopeLine(answer) !== null,
  };
  return {
    passed: Object.values(answerChecks).every(Boolean),
    answerChecks,
    resultCounters: result
      ? {
          resultState: result.state,
          coverageState: result.coverage.state,
          totalKind: result.coverage.totalKind,
          scanned: result.coverage.scanned,
          matched: result.coverage.matched,
          returned: result.coverage.returned,
          warningCodes: Array.isArray(result.warningCodes)
            ? result.warningCodes.filter((code) => typeof code === 'string')
            : [],
          sourceRowsValidated: normalizedItems.length,
          answerRowsMatched: rows.length,
        }
      : null,
  };
}

export function verifyG02RendererAnswer({ answer, queryArguments, toolResultSummary }) {
  const artifact = toolResultSummary?.artifact;
  const artifactValid =
    toolResultSummary?.resultState === 'artifact_returned' &&
    artifact?.returned === true &&
    artifact?.persisted === false &&
    artifact?.mimeType === 'image/png' &&
    Number.isInteger(artifact?.width) &&
    artifact.width > 0 &&
    Number.isInteger(artifact?.height) &&
    artifact.height > 0 &&
    Number.isInteger(artifact?.byteLength) &&
    artifact.byteLength > 0 &&
    /^[0-9a-f]{64}$/u.test(artifact?.sha256 ?? '') &&
    artifact?.pngSignatureValid === true;
  const answerChecks = {
    queryArgumentsMatch: canonicalJson(queryArguments) === canonicalJson(G02_QUERY_ARGUMENTS),
    artifactReturnedInMemory: artifactValid,
    artifactMentioned: typeof answer === 'string' && /图卡|图片卡|图片|png|artifact/iu.test(answer),
    exactDateAndConceptScopeDisclosed: rendererScopeDisclosure(answer),
    currentCollectionHeatMeaningDisclosed:
      typeof answer === 'string' &&
      /heat.{0,10}(?:当前)?收藏人数|收藏人数.{0,10}heat/iu.test(answer),
    experimentalSourceAndEstimatedCoverageDisclosed:
      typeof answer === 'string' &&
      /实验|experimental/iu.test(answer) &&
      /估算/u.test(answer) &&
      /未知|不完整|未穷尽/u.test(answer),
    nonExhaustiveScopeDisclosed:
      typeof answer === 'string' &&
      /(?:不代表全站|非全站|未穷尽|不构成全站|不能认定全站)/u.test(answer),
    notClaimedAsGlobalTopTen: !hasUnsupportedGlobalTopTenClaim(answer),
    noTrendClaim: !hasUnsupportedTrendClaim(answer),
    plainTextNoMarkdown: plainTextAnswer(answer) && finalScopeLine(answer) !== null,
  };
  return {
    passed: Object.values(answerChecks).every(Boolean),
    answerChecks,
    artifactSummary: artifactValid
      ? {
          mimeType: artifact.mimeType,
          width: artifact.width,
          height: artifact.height,
          byteLength: artifact.byteLength,
          sha256: artifact.sha256,
          pngSignatureValid: artifact.pngSignatureValid,
        }
      : null,
  };
}

export { G02_QUERY_ARGUMENTS, findDiscoveryResult };
