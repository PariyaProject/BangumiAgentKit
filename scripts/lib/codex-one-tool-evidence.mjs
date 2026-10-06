import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

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

export function authorizeToolCall({ name, args, expectedTool, expectedArguments, completedCalls }) {
  if (name !== expectedTool) return { allowed: false, code: 'TOOL_NOT_ALLOWLISTED' };
  if (completedCalls > 0) return { allowed: false, code: 'CALL_LIMIT_REACHED' };
  if (canonicalJson(args || {}) !== canonicalJson(expectedArguments)) {
    return { allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_FIXED_QUERY' };
  }
  return { allowed: true, code: 'ALLOWLISTED_FIXED_PUBLIC_QUERY' };
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
    ? scoreBandCount / histogramPopulation
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
  };
}
