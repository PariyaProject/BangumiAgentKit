import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function filterAllowedTools(tools, targetTool) {
  const matches = tools.filter((tool) =>
    tool?.name === targetTool && tool?.auth === 'none' && tool?.risk === 'read');
  if (matches.length !== 1) {
    throw new Error('The one-tool profile requires exactly one catalogued auth=none, risk=read tool.');
  }
  return matches;
}

export function publicReadOnlyToolAnnotations(tool) {
  if (tool?.auth !== 'none' || tool?.risk !== 'read') {
    throw new Error('Read-only MCP annotations require an anonymous read-only catalog tool.');
  }
  return { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
}

export function authorizeToolCall({ name, args, expectedTool, expectedArguments, completedCalls }) {
  if (name !== expectedTool) return { allowed: false, code: 'TOOL_NOT_ALLOWLISTED' };
  if (completedCalls > 0) return { allowed: false, code: 'CALL_LIMIT_REACHED' };
  if (canonicalJson(args || {}) !== canonicalJson(expectedArguments)) {
    return { allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_FIXED_QUERY' };
  }
  return { allowed: true, code: 'ALLOWLISTED_FIXED_PUBLIC_QUERY' };
}

export function claimSingleToolCall(lockPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, 'wx', 0o600);
    fs.closeSync(descriptor);
    return true;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* Preserve the original failure. */ }
    }
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

function safeSourceOperationSummary(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.sourceOperations)) return [];
  return result.sourceOperations.slice(0, 20).map((item) => ({
    operation: typeof item?.operation === 'string' &&
      /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/[A-Za-z0-9_{}./-]{1,112}$/u.test(item.operation)
      ? item.operation
      : 'unclassified',
    attempted: Number.isInteger(item?.attempted) ? item.attempted : 0,
    succeeded: Number.isInteger(item?.succeeded) ? item.succeeded : 0,
    failed: Number.isInteger(item?.failed) ? item.failed : 0,
  }));
}

function summarizeD04DiscoveryFacts(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.items) ||
      !result.plan || typeof result.plan !== 'object' || !result.coverage ||
      typeof result.coverage !== 'object') return null;
  const plan = result.plan;
  const searchStep = Array.isArray(plan.steps)
    ? plan.steps.find((step) => step?.kind === 'search' && step?.operation === 'searchSubjects')
    : undefined;
  const filter = searchStep?.request?.filter || {};
  const episodeFilter = Array.isArray(plan.postFilters)
    ? plan.postFilters.find((item) => item?.field === 'episodeCount')
    : undefined;
  const rows = result.items;
  const integerCount = (field) => rows.filter((item) => Number.isSafeInteger(item?.[field]) && item[field] >= 0).length;
  const sourceClasses = Array.isArray(result.evidence)
    ? [...new Set(result.evidence.map((item) => item?.source?.class)
      .filter((value) => value === 'official_v0' || value === 'derived'))].sort()
    : [];
  const coverage = result.coverage;
  const counters = {};
  for (const field of [
    'requested', 'scanned', 'matched', 'returned', 'pagesScanned', 'hydrationsAttempted',
    'hydrationsSucceeded', 'hydrationsFailed', 'hydrationsUnresolved',
  ]) {
    counters[field] = Number.isSafeInteger(coverage[field]) && coverage[field] >= 0
      ? coverage[field] : null;
  }
  return {
    resultState: typeof result.state === 'string' ? result.state : null,
    operation: plan.operation === 'searchSubjects' ? 'searchSubjects' : 'other',
    officialV0Plan: plan.source === 'official_v0',
    sourceClasses,
    coverageState: ['complete', 'partial', 'unknown', 'not_applicable'].includes(coverage.state)
      ? coverage.state : 'unknown',
    totalKind: ['exact', 'estimated', 'unknown'].includes(coverage.totalKind)
      ? coverage.totalKind : 'unknown',
    counters,
    queryChecks: {
      animeTypePushedDown: Array.isArray(filter.type) && filter.type.includes(2),
      exactScienceFictionTagPushedDown: Array.isArray(filter.tag) && filter.tag.includes('科幻'),
      strictRatingCountLowerBoundPushedDown:
        Array.isArray(filter.ratingCount) && filter.ratingCount.includes('>=3001'),
      reportedEpisodeMaximumIsTwelve: episodeFilter?.classification === 'POST_FILTER' &&
        episodeFilter?.value?.max === 12,
      episodeCountWasNotSentAsUpstreamFilter:
        !Object.keys(filter).some((key) => /episode|eps/iu.test(key)),
    },
    rowChecks: {
      count: rows.length,
      rowsWithReportedEpisodeCount: integerCount('episodesReported'),
      missingReportedEpisodeCount: rows.filter((item) =>
        !Number.isSafeInteger(item?.episodesReported) || item.episodesReported < 0).length,
      rowsWithinReportedEpisodeMaximum: rows.filter((item) =>
        Number.isSafeInteger(item?.episodesReported) && item.episodesReported >= 0 && item.episodesReported <= 12).length,
      rowsWithRatingCount: integerCount('ratingCount'),
      rowsMeetingRatingCountLowerBound: rows.filter((item) =>
        Number.isSafeInteger(item?.ratingCount) && item.ratingCount >= 3001).length,
      rowsWithAnimeMedia: rows.filter((item) => item?.media === 'anime').length,
      rowsWithExactTag: rows.filter((item) => Array.isArray(item?.tags) && item.tags.includes('科幻')).length,
    },
    experimentalSearchDisclosurePresent: Array.isArray(plan.limitations) &&
      plan.limitations.some((item) => typeof item === 'string' && /experimental/iu.test(item)),
    reportedEpisodeFieldDisclosurePresent: Array.isArray(plan.limitations) &&
      plan.limitations.some((item) => typeof item === 'string' && /subject\.eps/iu.test(item)),
    warningCodes: Array.isArray(result.warnings)
      ? result.warnings.map((item) => item?.code).filter((value) => typeof value === 'string').slice(0, 20)
      : [],
    limitationCount: Array.isArray(result.limitations) ? result.limitations.length : 0,
  };
}

export function summarizeSubjectStatsFacts(result) {
  if (!result || typeof result !== 'object' || !result.rating || !result.collection) return null;
  const histogram = result.raw?.ratingHistogram;
  const scores = Array.from({ length: 10 }, (_, index) => index + 1);
  const binsValid = Boolean(histogram) && scores.every((score) =>
    Number.isInteger(histogram[String(score)]) && histogram[String(score)] >= 0);
  const histogramPopulation = binsValid
    ? scores.reduce((total, score) => total + histogram[String(score)], 0)
    : null;
  const scoreBandCount = binsValid ? histogram['8'] + histogram['9'] : null;
  const scoreBandPercentage = binsValid && histogramPopulation > 0
    ? (scoreBandCount / histogramPopulation) * 100
    : null;
  const share = result.rating.scoreBand8To9Share || {};
  const completionFormula = result.collection.formulas?.completion || {};
  const shareFormula = share.formula || {};
  return {
    subjectId: Number.isInteger(result.subjectId) ? result.subjectId : null,
    state: typeof result.state === 'string' ? result.state : null,
    rating: {
      state: typeof result.rating.state === 'string' ? result.rating.state : null,
      population: Number.isFinite(result.rating.population) ? result.rating.population : null,
      mean: Number.isFinite(result.rating.mean) ? result.rating.mean : null,
      standardDeviation: Number.isFinite(result.rating.standardDeviation)
        ? result.rating.standardDeviation : null,
      scoreBand8To9Share: {
        state: typeof share.state === 'string' ? share.state : null,
        count: Number.isInteger(share.count) ? share.count : null,
        population: Number.isInteger(share.population) ? share.population : null,
        percentage: Number.isFinite(share.percentage) ? share.percentage : null,
        formulaId: typeof shareFormula.id === 'string' ? shareFormula.id : null,
        formulaVersion: Number.isInteger(shareFormula.version) ? shareFormula.version : null,
        evidenceStatus: typeof shareFormula.evidenceStatus === 'string'
          ? shareFormula.evidenceStatus : null,
      },
      histogram: {
        allTenBinsValid: binsValid,
        population: histogramPopulation,
        scoreBand8To9CountFromBins: scoreBandCount,
        scoreBand8To9PercentageFromBins: scoreBandPercentage,
      },
      distribution: Array.isArray(result.rating.distribution)
        ? result.rating.distribution.map((item) => ({
            score: Number.isInteger(item?.score) ? item.score : null,
            count: Number.isInteger(item?.count) ? item.count : null,
            percentage: Number.isFinite(item?.percentage) ? item.percentage : null,
          }))
        : [],
    },
    collection: {
      state: typeof result.collection.state === 'string' ? result.collection.state : null,
      total: Number.isInteger(result.collection.total) ? result.collection.total : null,
      completionState: typeof result.collection.completionState === 'string'
        ? result.collection.completionState : null,
      completionRate: Number.isFinite(result.collection.completionRate)
        ? result.collection.completionRate : null,
      completionFormulaId: typeof completionFormula.id === 'string' ? completionFormula.id : null,
      completionFormulaVersion: Number.isInteger(completionFormula.version)
        ? completionFormula.version : null,
      completionEvidenceStatus: typeof completionFormula.evidenceStatus === 'string'
        ? completionFormula.evidenceStatus : null,
      distribution: Array.isArray(result.collection.distribution)
        ? result.collection.distribution.map((item) => ({
            status: ['wish', 'doing', 'collect', 'on_hold', 'dropped'].includes(item?.status)
              ? item.status : null,
            count: Number.isInteger(item?.count) ? item.count : null,
            percentage: Number.isFinite(item?.percentage) ? item.percentage : null,
          }))
        : [],
    },
    coverage: result.coverage && typeof result.coverage === 'object' ? {
      sourceRequestsAttempted: Number.isInteger(result.coverage.sourceRequestsAttempted)
        ? result.coverage.sourceRequestsAttempted : null,
      sourceRequestsSucceeded: Number.isInteger(result.coverage.sourceRequestsSucceeded)
        ? result.coverage.sourceRequestsSucceeded : null,
      ratingBucketsExpected: Number.isInteger(result.coverage.ratingBucketsExpected)
        ? result.coverage.ratingBucketsExpected : null,
      ratingBucketsObserved: Number.isInteger(result.coverage.ratingBucketsObserved)
        ? result.coverage.ratingBucketsObserved : null,
      collectionBucketsExpected: Number.isInteger(result.coverage.collectionBucketsExpected)
        ? result.coverage.collectionBucketsExpected : null,
      collectionBucketsObserved: Number.isInteger(result.coverage.collectionBucketsObserved)
        ? result.coverage.collectionBucketsObserved : null,
    } : null,
    officialSourceClass: result.source?.official?.class === 'official-v0'
      ? 'official-v0' : null,
    evidenceSources: Array.isArray(result.evidence)
      ? [...new Set(result.evidence.map((item) => item?.source)
        .filter((source) => source === 'official-v0' || source === 'derived-s7'))].sort()
      : [],
    warningCodes: Array.isArray(result.warnings)
      ? result.warnings.map((item) => item?.code).filter((code) => typeof code === 'string').slice(0, 20)
      : [],
    limitationCount: Array.isArray(result.limitations) ? result.limitations.length : 0,
  };
}

const SUBJECT_STATS_COLLECTION_STATUSES = ['wish', 'doing', 'collect', 'on_hold', 'dropped'];
const UNSUPPORTED_STATS_CLAIM_TERMS = [
  '质量', '口碑', '推荐', '因果', '趋势', '两极化', '两极分化', '双峰', '多峰',
  'bimodal', 'multimodal', '争议', '热度', '优质',
];
const CLAIM_NEGATION_PREFIX = /(?:不能|无法|不可)(?:据此|因此|由此|从而)?$/u;
const CLAIM_NEGATION_PREDICATE = /(?:判断|推断|确认|证明|说明|得出|判定)[^。！？；;，,、]{0,10}$/u;
const CLAIM_NEGATION_PATTERNS = [
  /不代表[^。！？；;，,、]*$/u,
  /(?:并非|不是|不应|不支持)(?:为|是|被|视为)?$/u,
  /(?:没有|无)(?:证据|依据|根据)(?:支持|表明|证明)?$/u,
  /未(?:经|被|能|有)?(?:验证|支持|证实|证明|确认)?$/u,
  /\b(?:not|no|cannot|can't|unable\s+to)\b(?:\s+(?:possibly|necessarily|establish(?:ed)?|show(?:n)?|support(?:ed)?|prove(?:n)?|confirm(?:ed)?|indicate(?:d)?|demonstrate(?:d)?|a|an|the|that|it|to|be|evidence|of|any|claim(?:s)?)){0,6}\s*$/iu,
];
const COLLECTION_STATUS_LABELS = {
  wish: ['愿望', '想看', 'wish'],
  doing: ['在看', '在做', 'doing'],
  collect: ['看过', '已看', 'collect'],
  on_hold: ['搁置', '暂停', 'on_hold'],
  dropped: ['抛弃', '弃看', '弃坑', 'dropped'],
};

function addRoundedPercent(out, value) {
  if (!Number.isFinite(value)) return;
  out.add(Math.round(value * 10) / 10);
  out.add(Math.round(value));
}

function hasExpectedPercentMention(text, value) {
  if (typeof text !== 'string' || !Number.isFinite(value)) return false;
  const expected = [value, Math.round(value * 10) / 10, Math.round(value)];
  const tokens = text.match(/\d+(?:\.\d+)?\s*[％%]/gu) || [];
  return tokens.some((token) => {
    const mentioned = Number(token.replace(/[％%\s]/gu, ''));
    return expected.some((candidate) => Math.abs(mentioned - candidate) < 0.011);
  });
}

function collectStatsAnswerNumbers(value, exact, roundedMetrics, percentages, key = '') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    exact.add(value);
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes('percentage')) {
      addRoundedPercent(percentages, value);
      percentages.add(value);
    } else if (normalizedKey.includes('completionrate') && value >= 0 && value <= 1) {
      percentages.add(value * 100);
      addRoundedPercent(percentages, value * 100);
      roundedMetrics.add(Math.round(value * 10) / 10);
    } else if (normalizedKey.includes('mean') || normalizedKey.includes('standarddeviation')) {
      roundedMetrics.add(Math.round(value * 10) / 10);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStatsAnswerNumbers(item, exact, roundedMetrics, percentages, key);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      collectStatsAnswerNumbers(child, exact, roundedMetrics, percentages, childKey);
    }
  }
}

function hasOnlySupportedNumbers(answer, supportedFacts) {
  if (typeof answer !== 'string') return false;
  const exact = new Set([218707, ...Array.from({ length: 10 }, (_, index) => index + 1)]);
  const roundedMetrics = new Set();
  const percentages = new Set();
  collectStatsAnswerNumbers(supportedFacts, exact, roundedMetrics, percentages);
  const tokens = answer.match(/(?<![A-Za-z])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*[％%]?/gu) || [];
  return tokens.every((token) => {
    const isPercent = /[％%]\s*$/u.test(token);
    const value = Number(token.replace(/[,%％\s]/gu, ''));
    if (!Number.isFinite(value)) return false;
    const candidates = isPercent ? percentages : new Set([...exact, ...roundedMetrics]);
    return [...candidates].some((candidate) => Math.abs(value - candidate) < 0.011);
  });
}

function hasUnsupportedPositiveStatsClaim(answer) {
  if (typeof answer !== 'string') return false;
  const normalizedAnswer = answer.toLowerCase();
  for (const term of UNSUPPORTED_STATS_CLAIM_TERMS) {
    let start = 0;
    while (true) {
      const index = normalizedAnswer.indexOf(term, start);
      if (index < 0) break;
      const prefix = normalizedAnswer.slice(0, index);
      const delimiters = [...prefix.matchAll(/[。！？；;，,]|但是|然而|不过|可是|并且|而且|同时|另外|但|\b(?:but|however|yet)\b/giu)];
      const lastDelimiter = delimiters.at(-1);
      const precedingText = prefix.slice(lastDelimiter ? lastDelimiter.index + lastDelimiter[0].length : 0);
      if (!isStatsClaimNegated(precedingText)) return true;
      start = index + term.length;
    }
  }
  return false;
}

function isStatsClaimNegated(precedingText) {
  const normalized = precedingText.trim();
  const predicate = normalized.match(CLAIM_NEGATION_PREDICATE);
  if (predicate) {
    const negationPrefix = normalized.slice(0, predicate.index).trim();
    if (CLAIM_NEGATION_PREFIX.test(negationPrefix)) return true;
  }
  return CLAIM_NEGATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasOnePlainParagraph(answer) {
  return typeof answer === 'string' && answer.trim().length > 0 && !/[\r\n`*#]/u.test(answer) &&
    !/^\s*(?:[-*>]|\d+[.)])\s/u.test(answer.trim());
}

function commonStatsAnswerChecks(answer) {
  return {
    subjectIdMentioned: typeof answer === 'string' && answer.includes('218707'),
    currentSnapshotMentioned: typeof answer === 'string' && ['当前', '现时快照', '当前快照'].some((text) => answer.includes(text)),
    ratingAndBandMentioned: typeof answer === 'string' && answer.includes('评分') && /8\s*[–—-]\s*9|8\s*(?:至|到)\s*9/u.test(answer),
    collectionMentioned: typeof answer === 'string' && answer.includes('收藏') && /分布|完成|状态/u.test(answer),
    officialV0Mentioned: typeof answer === 'string' && /官方\s*v0|official\s*v0/iu.test(answer),
    coverageStateMentioned: typeof answer === 'string' && /覆盖|coverage/iu.test(answer) && /状态|部分|完整|未提供|不完整|不可计算|partial|unavailable/iu.test(answer),
    singleParagraphNoMarkdown: hasOnePlainParagraph(answer),
    noUnsupportedPositiveClaim: typeof answer === 'string' && !hasUnsupportedPositiveStatsClaim(answer),
  };
}

function metricStateIsMentioned(answer, state) {
  const statePattern = {
    complete: /完整|齐全|complete/iu,
    partial: /部分|不完整|partial/iu,
    unavailable: /未提供|不可用|unavailable/iu,
    not_computable: /不可计算|无法计算|not[_ -]?computable/iu,
    conflict: /冲突|conflict/iu,
  }[state];
  return Boolean(statePattern && statePattern.test(answer));
}

function statsMetricStatesMentioned(answer, facts) {
  return typeof answer === 'string' &&
    metricStateIsMentioned(answer, facts?.rating?.state) &&
    metricStateIsMentioned(answer, facts?.collection?.state);
}

function statsLimitationsMentioned(answer) {
  return typeof answer === 'string' && /不代表|不能据此|不可据此|无法据此|不能判断|无法判断|不能推断|无法推断|只是当前快照|仅为当前快照|单次快照|不是.{0,6}趋势|不等于.{0,8}(?:趋势|质量|口碑)|不包含历史|未覆盖历史|限制|局限/iu.test(answer);
}

function statsClaimPercentagesMatch(answer, facts) {
  if (typeof answer !== 'string') return false;
  const share = facts?.rating?.scoreBand8To9Share;
  if (Number.isFinite(share?.percentage)) {
    const bandShareClaim = answer.match(/8\s*[–—-]\s*9|8\s*(?:至|到)\s*9/iu);
    if (!bandShareClaim) return false;
    const nearbyClaim = answer.slice(bandShareClaim.index, bandShareClaim.index + 72);
    if (!/(?:占比|比例|占|share)/iu.test(nearbyClaim) ||
        !hasExpectedPercentMention(nearbyClaim, share.percentage)) return false;
  }

  const completionRate = facts?.collection?.completionRate;
  if (Number.isFinite(completionRate) && /完成率/iu.test(answer)) {
    const rate = answer.match(/完成率[^。；;]{0,48}/iu)?.[0] || '';
    if (!hasExpectedPercentMention(rate, completionRate * 100)) return false;
  }
  return true;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function collectionStatusCountClaims(answer, status) {
  const aliases = COLLECTION_STATUS_LABELS[status] || [status];
  const numeric = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
  const separator = '[^\\d。！？；;,，、\\n]{0,8}?';
  const claims = [];
  for (const alias of aliases) {
    const label = /^[a-z_]+$/iu.test(alias)
      ? `\\b${escapeRegExp(alias)}\\b`
      : escapeRegExp(alias);
    const afterLabel = new RegExp(`${label}${separator}(${numeric})\\s*(人|条|个|件|users?|items?)?`, 'giu');
    const beforeLabel = new RegExp(`(${numeric})\\s*(人|条|个|件|users?|items?)?${separator}${label}`, 'giu');
    for (const match of answer.matchAll(afterLabel)) {
      const token = match[1];
      const tokenEnd = match.index + match[0].lastIndexOf(token) + token.length;
      if (!/[％%]/u.test(answer.slice(tokenEnd, tokenEnd + 2))) claims.push(Number(token.replaceAll(',', '')));
    }
    for (const match of answer.matchAll(beforeLabel)) {
      const token = match[1];
      const tokenEnd = match.index + match[0].indexOf(token) + token.length;
      if (!/[％%]/u.test(answer.slice(tokenEnd, tokenEnd + 2))) claims.push(Number(token.replaceAll(',', '')));
    }
  }
  return claims;
}

function statsCollectionStatusCountsMatch(answer, facts) {
  if (typeof answer !== 'string') return false;
  const distribution = facts?.collection?.distribution;
  if (!Array.isArray(distribution)) return false;
  for (const row of distribution) {
    if (!Number.isInteger(row?.count) || typeof row?.status !== 'string') continue;
    const claims = collectionStatusCountClaims(answer, row.status);
    if (claims.some((count) => count !== row.count)) return false;
  }
  return true;
}

function statsRatingHistogramSequenceMatches(answer, facts) {
  if (typeof answer !== 'string') return false;
  const distribution = facts?.rating?.distribution;
  if (!Array.isArray(distribution) || distribution.length !== 10) return false;
  const expected = distribution.map((row, index) => {
    if (row?.score !== index + 1 || !Number.isInteger(row.count)) return null;
    return row.count;
  });
  if (expected.some((count) => count === null)) return false;
  const marker = /1\s*(?:至|到|[-–—])\s*10\s*分[^。！？；;\n]{0,24}?(?:人数|分布)?[^。！？；;\n]{0,12}?(?:依次|分别)\s*(?:为|是)\s*/giu;
  const integer = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)';
  for (const match of answer.matchAll(marker)) {
    const tail = answer.slice(match.index + match[0].length);
    const sequence = tail.match(new RegExp(`^[\\s:：]*${integer}(?:\\s*[、，,]\\s*${integer}){9}`, 'u'));
    const observed = sequence?.[0].match(new RegExp(integer, 'gu'))
      ?.map((token) => Number(token.replaceAll(',', '')));
    if (observed?.length !== 10 || observed.some((count, index) => count !== expected[index])) return false;
  }
  return true;
}

export function statsFactsAreConsistent(facts) {
  if (!facts || typeof facts !== 'object' || facts.subjectId !== 218707 ||
      facts.officialSourceClass !== 'official-v0' || !facts.evidenceSources?.includes('official-v0')) return false;
  const rating = facts.rating || {};
  const collection = facts.collection || {};
  const coverage = facts.coverage || {};
  const ratingDistribution = rating.distribution || [];
  const collectionDistribution = collection.distribution || [];
  if (ratingDistribution.length !== 10 || ratingDistribution.some((row, index) => row.score !== index + 1)) return false;
  if (collectionDistribution.length !== 5 ||
      SUBJECT_STATS_COLLECTION_STATUSES.some((status) => !collectionDistribution.some((row) => row.status === status))) return false;
  if (coverage.ratingBucketsExpected !== 10 || coverage.collectionBucketsExpected !== 5) return false;
  const histogram = rating.histogram || {};
  const share = rating.scoreBand8To9Share || {};
  if (share.formulaId !== 'bangumi.rating.score_band_8_9_share.v1' || share.formulaVersion !== 1) return false;
  if (histogram.allTenBinsValid) {
    if (ratingDistribution.some((row) => !Number.isInteger(row.count) || row.count < 0)) return false;
    const populationFromBins = ratingDistribution.reduce((total, row) => total + row.count, 0);
    const bandCountFromBins = ratingDistribution
      .filter((row) => row.score === 8 || row.score === 9)
      .reduce((total, row) => total + row.count, 0);
    if (populationFromBins !== histogram.population || bandCountFromBins !== histogram.scoreBand8To9CountFromBins) return false;
    if (share.count !== histogram.scoreBand8To9CountFromBins || share.population !== histogram.population) return false;
    const expectedBandShare = histogram.population > 0 ? (bandCountFromBins / histogram.population) * 100 : null;
    if (!Number.isFinite(share.percentage) || !Number.isFinite(expectedBandShare) ||
        Math.abs(share.percentage - expectedBandShare) > 0.011 ||
        Math.abs(share.percentage - histogram.scoreBand8To9PercentageFromBins) > 0.011) return false;
  } else if (!['partial', 'unavailable', 'not_computable', 'conflict'].includes(share.state)) {
    return false;
  }
  if (collection.completionState === 'empirically_verified' &&
      (collection.completionFormulaId !== 'subject-stats-collection-completion-v1' ||
       collection.completionFormulaVersion !== 1 || collection.completionEvidenceStatus !== 'empirically_verified')) return false;
  return true;
}

function sameExactNumber(value, expected) {
  if (expected === null) return value === null;
  return Number.isFinite(value) && Number.isFinite(expected) && Math.abs(value - expected) < 1e-9;
}

function sameRoundedNumber(value, expected, scale = 10) {
  if (expected === null) return value === null;
  if (!Number.isFinite(value) || !Number.isFinite(expected)) return false;
  const rounded = Math.round(expected * scale) / scale;
  return Math.abs(value - expected) < 1e-9 || Math.abs(value - rounded) < 0.011;
}

function samePercent(value, expected) {
  if (expected === null) return value === null;
  if (!Number.isFinite(value) || !Number.isFinite(expected)) return false;
  return [expected, Math.round(expected * 10) / 10, Math.round(expected)]
    .some((candidate) => Math.abs(value - candidate) < 0.011);
}

function objectHasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function statsTypedAnswerMismatches(typedAnswer, facts) {
  const fields = [
    'subjectId', 'resultState', 'ratingState', 'ratingPopulation', 'ratingMean',
    'ratingStandardDeviation', 'scoreBand8To9Share', 'ratingDistribution',
    'collectionState', 'collectionTotal', 'completionState', 'completionRatePercentage',
    'collectionDistribution', 'coverage', 'officialSourceClass', 'evidenceSources', 'answer',
  ];
  if (!objectHasExactKeys(typedAnswer, fields)) return ['shape'];
  const rating = facts?.rating || {};
  const collection = facts?.collection || {};
  const share = rating.scoreBand8To9Share || {};
  const typedShare = typedAnswer.scoreBand8To9Share;
  const shareFields = ['state', 'count', 'population', 'percentage', 'formulaId', 'formulaVersion', 'evidenceStatus'];
  const coverageFields = [
    'sourceRequestsAttempted', 'sourceRequestsSucceeded', 'ratingBucketsExpected',
    'ratingBucketsObserved', 'collectionBucketsExpected', 'collectionBucketsObserved',
  ];
  const typedCoverage = typedAnswer.coverage;
  const mismatches = [];
  if (typedAnswer.subjectId !== facts.subjectId) mismatches.push('subjectId');
  if (typedAnswer.resultState !== facts.state) mismatches.push('resultState');
  if (typedAnswer.ratingState !== rating.state) mismatches.push('ratingState');
  if (!sameExactNumber(typedAnswer.ratingPopulation, rating.population)) mismatches.push('ratingPopulation');
  if (!sameRoundedNumber(typedAnswer.ratingMean, rating.mean)) mismatches.push('ratingMean');
  if (!sameRoundedNumber(typedAnswer.ratingStandardDeviation, rating.standardDeviation)) {
    mismatches.push('ratingStandardDeviation');
  }
  if (!objectHasExactKeys(typedShare, shareFields)) {
    mismatches.push('scoreBand8To9Share.shape');
  } else {
    if (typedShare.state !== share.state) mismatches.push('scoreBand8To9Share.state');
    if (typedShare.count !== share.count) mismatches.push('scoreBand8To9Share.count');
    if (typedShare.population !== share.population) mismatches.push('scoreBand8To9Share.population');
    if (!samePercent(typedShare.percentage, share.percentage)) mismatches.push('scoreBand8To9Share.percentage');
    if (typedShare.formulaId !== share.formulaId) mismatches.push('scoreBand8To9Share.formulaId');
    if (typedShare.formulaVersion !== share.formulaVersion) mismatches.push('scoreBand8To9Share.formulaVersion');
    if (typedShare.evidenceStatus !== share.evidenceStatus) mismatches.push('scoreBand8To9Share.evidenceStatus');
  }
  if (typedAnswer.collectionState !== collection.state) mismatches.push('collectionState');
  if (typedAnswer.collectionTotal !== collection.total) mismatches.push('collectionTotal');
  if (typedAnswer.completionState !== collection.completionState) mismatches.push('completionState');
  if (!samePercent(typedAnswer.completionRatePercentage,
    Number.isFinite(collection.completionRate) ? collection.completionRate * 100 : null)) {
    mismatches.push('completionRatePercentage');
  }
  if (typedAnswer.officialSourceClass !== facts.officialSourceClass) mismatches.push('officialSourceClass');
  if (!Array.isArray(typedAnswer.evidenceSources) ||
      JSON.stringify([...typedAnswer.evidenceSources].sort()) !== JSON.stringify([...facts.evidenceSources].sort())) {
    mismatches.push('evidenceSources');
  }
  if (!objectHasExactKeys(typedCoverage, coverageFields)) {
    mismatches.push('coverage.shape');
  } else {
    for (const field of coverageFields) {
      if (typedCoverage[field] !== facts.coverage?.[field]) mismatches.push(`coverage.${field}`);
    }
  }

  const ratingDistribution = rating.distribution || [];
  const typedRatingDistribution = typedAnswer.ratingDistribution;
  if (!Array.isArray(typedRatingDistribution)) {
    mismatches.push('ratingDistribution.shape');
  } else {
    if (typedRatingDistribution.length !== ratingDistribution.length) mismatches.push('ratingDistribution.length');
    for (let index = 0; index < Math.min(typedRatingDistribution.length, ratingDistribution.length); index += 1) {
      const row = typedRatingDistribution[index];
      const expected = ratingDistribution[index];
      const prefix = `ratingDistribution[${expected.score}]`;
      if (!objectHasExactKeys(row, ['score', 'count', 'percentage'])) {
        mismatches.push(`${prefix}.shape`);
        continue;
      }
      if (row.score !== expected.score) mismatches.push(`${prefix}.score`);
      if (row.count !== expected.count) mismatches.push(`${prefix}.count`);
      if (!samePercent(row.percentage, expected.percentage)) mismatches.push(`${prefix}.percentage`);
    }
  }

  const collectionDistribution = collection.distribution || [];
  const typedCollectionDistribution = typedAnswer.collectionDistribution;
  if (!Array.isArray(typedCollectionDistribution)) {
    mismatches.push('collectionDistribution.shape');
  } else {
    if (typedCollectionDistribution.length !== collectionDistribution.length) {
      mismatches.push('collectionDistribution.length');
    }
    for (let index = 0; index < Math.min(typedCollectionDistribution.length, collectionDistribution.length); index += 1) {
      const row = typedCollectionDistribution[index];
      const expected = collectionDistribution[index];
      const prefix = `collectionDistribution[${expected.status}]`;
      if (!objectHasExactKeys(row, ['status', 'count', 'percentage'])) {
        mismatches.push(`${prefix}.shape`);
        continue;
      }
      if (row.status !== expected.status) mismatches.push(`${prefix}.status`);
      if (row.count !== expected.count) mismatches.push(`${prefix}.count`);
      if (!samePercent(row.percentage, expected.percentage)) mismatches.push(`${prefix}.percentage`);
    }
  }
  return mismatches;
}

export function statsTypedAnswerMatches(typedAnswer, facts) {
  return statsTypedAnswerMismatches(typedAnswer, facts).length === 0;
}

export function checkStatsAnswer(answer, facts, typedAnswer) {
  const ratingDistributionClaimsMatch = statsRatingHistogramSequenceMatches(answer, facts);
  const collectionDistributionClaimsMatch = statsCollectionStatusCountsMatch(answer, facts);
  const answerChecks = {
    ...commonStatsAnswerChecks(answer),
    metricStatesMentioned: statsMetricStatesMentioned(answer, facts),
    limitationsMentioned: statsLimitationsMentioned(answer),
    ratingDistributionClaimsMatch,
    collectionDistributionClaimsMatch,
    typedFieldsMatch: statsFactsAreConsistent(facts) && hasOnlySupportedNumbers(answer, facts) &&
      ratingDistributionClaimsMatch && collectionDistributionClaimsMatch &&
      (typedAnswer === undefined ||
        typedAnswer.answer === answer && statsTypedAnswerMatches(typedAnswer, facts)) &&
      statsClaimPercentagesMatch(answer, facts),
  };
  return { passed: Object.values(answerChecks).every(Boolean), answerChecks };
}

export function checkRendererAnswer(answer, result) {
  const artifact = result?.artifact;
  const artifactValid = result?.resultState === 'artifact_returned' && artifact?.returned === true && artifact?.persisted === false &&
    artifact?.mimeType === 'image/png' && Number.isInteger(artifact?.width) && artifact.width > 0 &&
    Number.isInteger(artifact?.height) && artifact.height > 0 && Number.isInteger(artifact?.byteLength) &&
    artifact.byteLength > 0 && /^[0-9a-f]{64}$/u.test(artifact?.sha256 || '') && artifact.pngSignatureValid === true;
  const artifactNumbers = { subjectId: 218707, width: artifact?.width, height: artifact?.height };
  const answerChecks = {
    ...commonStatsAnswerChecks(answer),
    typedFieldsMatch: artifactValid && hasOnlySupportedNumbers(answer, artifactNumbers),
    artifactMentioned: typeof answer === 'string' && /图卡|图片卡|artifact|png/iu.test(answer),
  };
  return { passed: Object.values(answerChecks).every(Boolean), answerChecks };
}

export function summarizeToolResult(toolName, result, artifactSummary = { returned: false, persisted: false }) {
  const serialized = JSON.stringify(result);
  const hasArtifact = Boolean(result && typeof result === 'object' &&
    result.artifact && typeof result.artifact.id === 'string');
  return {
    toolName,
    resultType: result === null ? 'null' : Array.isArray(result) ? 'array' : typeof result,
    resultState: result && typeof result === 'object' && typeof result.state === 'string'
      ? result.state
      : hasArtifact ? 'artifact_returned' : 'no_state_field',
    resultByteLength: Buffer.byteLength(serialized ?? 'null', 'utf8'),
    resultSha256: createHash('sha256').update(serialized ?? 'null').digest('hex'),
    sourceOperations: safeSourceOperationSummary(result),
    artifact: hasArtifact ? artifactSummary : { returned: false, persisted: false },
    ...(toolName === 'bangumi.get_subject_stats_intelligence'
      ? { subjectStatsFacts: summarizeSubjectStatsFacts(result) } : {}),
    ...(toolName === 'bangumi.query_subjects'
      ? { d04DiscoveryChecks: summarizeD04DiscoveryFacts(result) } : {}),
  };
}
