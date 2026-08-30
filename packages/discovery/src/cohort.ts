import {
  assertSafeEvidence,
  createEvidenceRef,
  type CapabilityResult,
  type CapabilityState,
  type EvidenceRef,
  type FieldEvidence,
  type ProviderRequestContext,
  type ProviderSubjectData,
  type SubjectDiscoveryProvider,
} from '@bangumi-agent-kit/provider-core';
import {
  DiscoveryValidationError,
  type DiscoveryCoverage,
  type DiscoveryItem,
  type DiscoveryPlan,
  type DiscoveryQuery,
  type DiscoveryResult,
} from './contracts.js';
import { DiscoveryEngine } from './engine.js';

export const SUBJECT_COHORT_COMPARISON_FORMULA_VERSION = 'subject-cohort-comparison-v1' as const;
export const SUBJECT_COHORT_DEFAULT_MAX_SUBJECTS = 40;
export const SUBJECT_COHORT_MAX_SUBJECTS = 60;
export const SUBJECT_COHORT_MAX_PAGES = 6;
export const SUBJECT_COHORT_MAX_CANDIDATES = 300;
export const SUBJECT_COHORT_MAX_QUERY_HYDRATIONS = 60;
export const SUBJECT_COHORT_DETAIL_CONCURRENCY = 6;
export const SUBJECT_COHORT_MAX_EVIDENCE_REFS = 256;
export const SUBJECT_COHORT_MAX_EVIDENCE_BYTES = 96_000;
export const SUBJECT_COHORT_MAX_WARNINGS = 12;
export const SUBJECT_COHORT_MAX_TEXT_LENGTH = 240;

export const SUBJECT_COHORT_METRICS = ['score', 'heat', 'episodesReported'] as const;
export type SubjectCohortMetricKey = (typeof SUBJECT_COHORT_METRICS)[number];
export type SubjectCohortMetricState =
  | 'complete'
  | 'partial'
  | 'conflict'
  | 'unavailable'
  | 'not_computable'
  | 'not_found'
  | 'upstream_error'
  | 'unsupported'
  | 'stale'
  | 'auth_required'
  | 'permission_denied';

export interface SubjectCohortDefinition {
  label?: string;
  query: DiscoveryQuery;
}

export interface SubjectCohortComparisonOptions {
  maxSubjects?: number;
  now?: () => string;
}

export interface SubjectCohortSubject {
  id: number;
  name: string;
  displayName: string;
  date?: string;
  score?: number;
  collectionTotal?: number;
  episodesReported?: number;
  totalEpisodesReported?: number;
  metricStates: Record<SubjectCohortMetricKey, 'available' | 'missing' | 'conflict'>;
}

export interface SubjectCohortMetricCoverage {
  valid: number;
  missing: number;
  conflicts: number;
  state: SubjectCohortMetricState;
}

export interface SubjectCohortQueryCoverage {
  state: CapabilityState;
  coverage: DiscoveryCoverage;
  plan: DiscoveryPlan;
}

export interface SubjectCohort {
  label: string;
  query: DiscoveryQuery;
  querySummary: string;
  subjects: SubjectCohortSubject[];
  coverage: {
    query: SubjectCohortQueryCoverage;
    detailHydrationsAttempted: number;
    detailHydrationsSucceeded: number;
    detailHydrationsFailed: number;
    metrics: Record<SubjectCohortMetricKey, SubjectCohortMetricCoverage>;
  };
}

export interface SubjectCohortMetric {
  key: SubjectCohortMetricKey;
  label: string;
  sourceField: string;
  averages: Array<number | undefined>;
  partialAverages?: Array<number | undefined>;
  validCounts: number[];
  missingCounts: number[];
  conflictCounts: number[];
  delta?: number;
  state: SubjectCohortMetricState;
}

export interface SubjectCohortSourceSummary {
  class: 'official-v0' | 'derived-s7';
  operations: string[];
  attemptedAt: string;
  retrievedAt?: string;
}

export interface SubjectCohortComparisonWarning {
  code: string;
  state: CapabilityState;
  message: string;
  cohort?: string;
}

export type SubjectCohortComparisonState =
  | 'complete'
  | 'partial'
  | 'conflict'
  | 'unavailable'
  | 'not_computable'
  | 'not_found'
  | 'upstream_error'
  | 'unsupported'
  | 'stale'
  | 'auth_required'
  | 'permission_denied';

export interface SubjectCohortComparisonResult {
  state: SubjectCohortComparisonState;
  cohorts: SubjectCohort[];
  metrics: SubjectCohortMetric[];
  formulaVersion: typeof SUBJECT_COHORT_COMPARISON_FORMULA_VERSION;
  coverage: {
    maxSubjectsPerCohort: number;
    totalSubjectsReturned: number;
    cohortsComplete: number;
    cohortsPartial: number;
    detailHydrationsAttempted: number;
    detailHydrationsSucceeded: number;
    detailHydrationsFailed: number;
    truncated: boolean;
    evidence: {
      retained: number;
      omitted: number;
      deduplicated: number;
      omittedByBound: number;
      bytes: number;
      maxRefs: number;
      maxBytes: number;
      truncated: boolean;
    };
    warnings: {
      retained: number;
      omitted: number;
      max: number;
      truncated: boolean;
    };
  };
  source: {
    official: SubjectCohortSourceSummary & { class: 'official-v0' };
    derived: SubjectCohortSourceSummary & { class: 'derived-s7' };
  };
  evidence: EvidenceRef[];
  warnings: SubjectCohortComparisonWarning[];
  limitations: string[];
  retrievedAt?: string;
}

interface HydratedSubject {
  item: DiscoveryItem;
  result: CapabilityResult<ProviderSubjectData>;
}

const METRIC_LABELS: Record<SubjectCohortMetricKey, string> = {
  score: '平均评分',
  heat: '平均热度（收藏总数）',
  episodesReported: '平均报告话数',
};

const METRIC_SOURCE_FIELDS: Record<SubjectCohortMetricKey, string> = {
  score: 'subject.rating.score',
  heat: 'subject.collection.total',
  episodesReported: 'subject.eps',
};

const LIMITATIONS = [
  '每个 cohort 是官方 v0 discovery 在本次硬上限内返回的条目样本；不把实验性搜索或估计总数转换为完整数据库枚举。',
  '热度使用官方 collection 各状态之和（收藏总数）；它不是社区趋势、质量、偏好或推荐分数。',
  '报告话数使用官方 subject.eps；它不等同于已播话数、观看进度、总生命周期或章节源完整性。',
  '均值只对该指标有有效值的返回条目计算；缺失、来源冲突、不可用和未找到不会转换为零。',
  '差值按输入顺序计算为 B − A；部分观察均值会明确标为 partial observation，不生成完整总体差值。',
];

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value as number)));
}

function nowIso(options: SubjectCohortComparisonOptions): string {
  return options.now?.() || new Date().toISOString();
}

function boundedText(value: string, maximum = SUBJECT_COHORT_MAX_TEXT_LENGTH): string {
  const text = Array.from(value);
  return text.length <= maximum ? value : `${text.slice(0, Math.max(0, maximum - 1)).join('')}…`;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function latestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function earliestTimestamp(values: Array<string | undefined>, fallback: string): string {
  return values.filter((value): value is string => Boolean(value)).sort()[0] || fallback;
}

function flattenEvidence(evidence: FieldEvidence | undefined): EvidenceRef[] {
  return Object.values(evidence || {}).flat();
}

function sumCollection(collection: ProviderSubjectData['stats']['collection']): number | undefined {
  const values = [
    collection.wish,
    collection.collect,
    collection.doing,
    collection.onHold,
    collection.dropped,
  ];
  return values.every((value) => Number.isFinite(value))
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finiteScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : undefined;
}

function queryForCohort(query: DiscoveryQuery, maxSubjects: number): DiscoveryQuery {
  const limit = Math.min(maxSubjects, query.limit ?? maxSubjects);
  return {
    ...query,
    resultMode: 'all',
    limit,
    budget: {
      maxPages: SUBJECT_COHORT_MAX_PAGES,
      maxCandidates: SUBJECT_COHORT_MAX_CANDIDATES,
      maxHydrations: SUBJECT_COHORT_MAX_QUERY_HYDRATIONS,
      concurrency: SUBJECT_COHORT_DETAIL_CONCURRENCY,
      maxConceptProbes: 8,
      maxReturnedItems: limit,
    },
  };
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      const value = values[index];
      if (value !== undefined) results[index] = await callback(value);
    }
  });
  await Promise.all(workers);
  return results;
}

async function hydrate(
  provider: SubjectDiscoveryProvider,
  items: DiscoveryItem[],
  context: ProviderRequestContext,
): Promise<HydratedSubject[]> {
  return mapConcurrent(items, SUBJECT_COHORT_DETAIL_CONCURRENCY, async (item) => {
    try {
      return { item, result: await provider.getSubject(item.id, context) };
    } catch {
      return {
        item,
        result: {
          state: 'upstream_error',
          error: { code: 'upstream_error', retryable: false },
          warnings: [
            {
              code: 'UPSTREAM_ERROR',
              message: 'Subject detail hydration failed before a provider result was returned.',
            },
          ],
        },
      } satisfies HydratedSubject;
    }
  });
}

function querySummary(label: string, query: DiscoveryQuery): string {
  const facets: string[] = [label];
  if (query.media)
    facets.push(`媒介=${Array.isArray(query.media) ? query.media.join('/') : query.media}`);
  if (query.categories) {
    facets.push(
      `分类=${Array.isArray(query.categories) ? query.categories.join('/') : query.categories}`,
    );
  }
  if (query.season) facets.push(`季度=${query.season}`);
  else if (query.year !== undefined && query.month !== undefined) {
    facets.push(`日期=${query.year}-${String(query.month).padStart(2, '0')}`);
  } else if (query.year !== undefined) facets.push(`年份=${query.year}`);
  if (query.from || query.to) facets.push(`范围=${query.from || '?'}..${query.to || '?'}`);
  if (query.metaTags?.length) facets.push(`元标签=${query.metaTags.join('/')}`);
  if (query.tags?.length) facets.push(`标签=${query.tags.join('/')}`);
  if (query.sort) facets.push(`排序=${query.sort}/${query.order || 'desc'}`);
  return facets.join(' · ');
}

function itemValue(
  item: DiscoveryItem,
  hydrated: CapabilityResult<ProviderSubjectData>,
  key: SubjectCohortMetricKey,
): { value?: number; conflict: boolean } {
  const detail = hydrated.state === 'ok' ? hydrated.data : undefined;
  if (key === 'episodesReported') {
    return { value: finiteNonNegative(detail?.eps), conflict: false };
  }

  const discovered =
    key === 'score' ? finiteScore(item.score) : finiteNonNegative(item.collectionTotal);
  const detailed =
    key === 'score'
      ? finiteScore(detail?.stats.score)
      : detail?.stats.collection
        ? sumCollection(detail.stats.collection)
        : undefined;
  if (discovered !== undefined && detailed !== undefined && discovered !== detailed) {
    return { conflict: true };
  }
  return { value: detailed ?? discovered, conflict: false };
}

function buildSubjectRow(
  item: DiscoveryItem,
  hydrated: CapabilityResult<ProviderSubjectData>,
): {
  subject: SubjectCohortSubject;
  conflicts: SubjectCohortMetricKey[];
} {
  const values = SUBJECT_COHORT_METRICS.map((key) => itemValue(item, hydrated, key));
  const [score, heat, episodesReported] = values;
  const detail = hydrated.state === 'ok' ? hydrated.data : undefined;
  const totalEpisodesReported = finiteNonNegative(detail?.totalEpisodes);
  const subject: SubjectCohortSubject = {
    id: item.id,
    name: boundedText(item.name, 180),
    displayName: boundedText(item.displayName, 180),
    ...(item.date ? { date: item.date } : {}),
    ...(score?.value === undefined ? {} : { score: score.value }),
    ...(heat?.value === undefined ? {} : { collectionTotal: heat.value }),
    ...(episodesReported?.value === undefined ? {} : { episodesReported: episodesReported.value }),
    ...(totalEpisodesReported === undefined ? {} : { totalEpisodesReported }),
    metricStates: {
      score: score?.conflict ? 'conflict' : score?.value === undefined ? 'missing' : 'available',
      heat: heat?.conflict ? 'conflict' : heat?.value === undefined ? 'missing' : 'available',
      episodesReported: episodesReported?.conflict
        ? 'conflict'
        : episodesReported?.value === undefined
          ? 'missing'
          : 'available',
    },
  };
  return {
    subject,
    conflicts: SUBJECT_COHORT_METRICS.filter(
      (key) => values.find((candidate, index) => SUBJECT_COHORT_METRICS[index] === key)?.conflict,
    ),
  };
}

function metricNumber(
  subject: SubjectCohortSubject,
  key: SubjectCohortMetricKey,
): number | undefined {
  if (key === 'score') return subject.score;
  if (key === 'heat') return subject.collectionTotal;
  return subject.episodesReported;
}

function metricCoverage(
  subjects: SubjectCohortSubject[],
  query: SubjectCohortQueryCoverage,
  key: SubjectCohortMetricKey,
): SubjectCohortMetricCoverage {
  const valid = subjects.filter((subject) => subject.metricStates[key] === 'available').length;
  const conflicts = subjects.filter((subject) => subject.metricStates[key] === 'conflict').length;
  const missing = subjects.length - valid - conflicts;
  const queryState: SubjectCohortMetricState | undefined =
    query.state === 'ok' ? undefined : query.state === 'not_found' ? 'not_computable' : query.state;
  let state: SubjectCohortMetricState;
  if (queryState !== undefined && queryState !== 'partial') state = queryState;
  else if (conflicts > 0) state = 'conflict';
  else if (valid === 0) state = 'not_computable';
  else if (queryState === 'partial' || query.coverage.state !== 'complete' || missing > 0)
    state = 'partial';
  else state = 'complete';
  return { valid, missing, conflicts, state };
}

function groupState(result: DiscoveryResult): CapabilityState {
  if (result.state !== 'ok') return result.state;
  if (result.items.length === 0) return 'not_found';
  return result.state;
}

function buildGroup(
  definition: SubjectCohortDefinition,
  result: DiscoveryResult,
  hydrated: HydratedSubject[],
): { cohort: SubjectCohort; conflicts: SubjectCohortMetricKey[] } {
  const label = definition.label?.trim() || '未命名组';
  const rows = hydrated.map(({ item, result: detail }) => buildSubjectRow(item, detail));
  const subjects = rows.map((row) => row.subject);
  const query: SubjectCohortQueryCoverage = {
    state: groupState(result),
    coverage: result.coverage,
    plan: result.plan,
  };
  const metrics = Object.fromEntries(
    SUBJECT_COHORT_METRICS.map((key) => [key, metricCoverage(subjects, query, key)]),
  ) as Record<SubjectCohortMetricKey, SubjectCohortMetricCoverage>;
  return {
    cohort: {
      label: boundedText(label, 80),
      query: definition.query,
      querySummary: boundedText(querySummary(boundedText(label, 80), definition.query)),
      subjects,
      coverage: {
        query,
        detailHydrationsAttempted: hydrated.length,
        detailHydrationsSucceeded: hydrated.filter(
          (item) => item.result.state === 'ok' && item.result.data,
        ).length,
        detailHydrationsFailed: hydrated.filter(
          (item) => item.result.state !== 'ok' || !item.result.data,
        ).length,
        metrics,
      },
    },
    conflicts: rows.flatMap((row) => row.conflicts),
  };
}

function average(
  subjects: SubjectCohortSubject[],
  key: SubjectCohortMetricKey,
): number | undefined {
  const values = subjects
    .map((subject) => metricNumber(subject, key))
    .filter((value): value is number => value !== undefined);
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricState(coverages: SubjectCohortMetricCoverage[]): SubjectCohortMetricState {
  if (coverages.some((coverage) => coverage.state === 'upstream_error')) return 'upstream_error';
  if (coverages.some((coverage) => coverage.state === 'auth_required')) return 'auth_required';
  if (coverages.some((coverage) => coverage.state === 'permission_denied')) {
    return 'permission_denied';
  }
  if (coverages.some((coverage) => coverage.state === 'unavailable')) return 'unavailable';
  if (coverages.some((coverage) => coverage.state === 'unsupported')) return 'unsupported';
  if (coverages.some((coverage) => coverage.state === 'stale')) return 'stale';
  if (coverages.some((coverage) => coverage.state === 'conflict')) return 'conflict';
  if (coverages.every((coverage) => coverage.state === 'not_computable')) return 'not_computable';
  if (coverages.every((coverage) => coverage.state === 'complete')) return 'complete';
  return 'partial';
}

function comparisonState(
  cohorts: SubjectCohort[],
  metrics: SubjectCohortMetric[],
): SubjectCohortComparisonState {
  const queryStates = cohorts.map((cohort) => cohort.coverage.query.state);
  if (queryStates.some((state) => state === 'upstream_error')) return 'upstream_error';
  if (queryStates.some((state) => state === 'auth_required')) return 'auth_required';
  if (queryStates.some((state) => state === 'permission_denied')) return 'permission_denied';
  if (queryStates.some((state) => state === 'unavailable')) return 'unavailable';
  if (queryStates.some((state) => state === 'unsupported')) return 'unsupported';
  if (queryStates.some((state) => state === 'stale')) return 'stale';
  if (queryStates.every((state) => state === 'not_found')) return 'not_found';
  if (metrics.some((metric) => metric.state === 'conflict')) return 'conflict';
  if (metrics.every((metric) => metric.state === 'not_computable')) {
    return 'not_computable';
  }
  if (
    queryStates.some((state) => state !== 'ok') ||
    metrics.some((metric) => metric.state !== 'complete')
  ) {
    return 'partial';
  }
  return 'complete';
}

function warningFromDiscovery(
  label: string,
  result: DiscoveryResult,
): SubjectCohortComparisonWarning[] {
  return result.warnings.map((warning) => ({
    code: boundedText(warning.code, 80),
    state: result.state,
    message: boundedText(warning.message),
    cohort: boundedText(label, 80),
  }));
}

function evidenceBytes(value: EvidenceRef): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function capEvidence(raw: EvidenceRef[]): {
  evidence: EvidenceRef[];
  coverage: SubjectCohortComparisonResult['coverage']['evidence'];
} {
  const unique: EvidenceRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const required = unique.filter((item) => item.source.class === 'derived');
  const optional = unique.filter((item) => item.source.class !== 'derived');
  const requiredBytes = required.reduce((sum, item) => sum + evidenceBytes(item), 0);
  const evidence: EvidenceRef[] = [];
  let bytes = 0;
  for (const item of optional) {
    const itemBytes = evidenceBytes(item);
    if (
      evidence.length + required.length >= SUBJECT_COHORT_MAX_EVIDENCE_REFS ||
      bytes + itemBytes + requiredBytes > SUBJECT_COHORT_MAX_EVIDENCE_BYTES
    ) {
      continue;
    }
    evidence.push(item);
    bytes += itemBytes;
  }
  for (const item of required) {
    if (
      evidence.length >= SUBJECT_COHORT_MAX_EVIDENCE_REFS ||
      bytes + evidenceBytes(item) > SUBJECT_COHORT_MAX_EVIDENCE_BYTES
    ) {
      continue;
    }
    evidence.push(item);
    bytes += evidenceBytes(item);
  }
  return {
    evidence,
    coverage: {
      retained: evidence.length,
      omitted: raw.length - evidence.length,
      deduplicated: raw.length - unique.length,
      omittedByBound: Math.max(0, unique.length - evidence.length),
      bytes,
      maxRefs: SUBJECT_COHORT_MAX_EVIDENCE_REFS,
      maxBytes: SUBJECT_COHORT_MAX_EVIDENCE_BYTES,
      truncated: evidence.length < unique.length,
    },
  };
}

function capWarnings(warnings: SubjectCohortComparisonWarning[]): {
  warnings: SubjectCohortComparisonWarning[];
  coverage: SubjectCohortComparisonResult['coverage']['warnings'];
} {
  const bounded = warnings.slice(0, SUBJECT_COHORT_MAX_WARNINGS).map((warning) => ({
    ...warning,
    message: boundedText(warning.message),
  }));
  return {
    warnings: bounded,
    coverage: {
      retained: bounded.length,
      omitted: Math.max(0, warnings.length - bounded.length),
      max: SUBJECT_COHORT_MAX_WARNINGS,
      truncated: bounded.length < warnings.length,
    },
  };
}

function metricAverageState(
  state: SubjectCohortMetricState,
  averages: Array<number | undefined>,
): Pick<SubjectCohortMetric, 'averages' | 'partialAverages'> {
  return state === 'complete'
    ? { averages }
    : { averages: averages.map(() => undefined), partialAverages: averages };
}

export async function compareSubjectCohorts(
  definitions: readonly SubjectCohortDefinition[],
  options: SubjectCohortComparisonOptions = {},
  provider: SubjectDiscoveryProvider,
  context: ProviderRequestContext = { authScope: 'public' },
): Promise<SubjectCohortComparisonResult> {
  const issues: string[] = [];
  if (definitions.length < 1 || definitions.length > 2) {
    issues.push('cohorts must contain one or two cohort definitions');
  }
  definitions.forEach((definition, index) => {
    if (!definition || typeof definition !== 'object') issues.push(`cohorts[${index}] is required`);
    if (!definition?.query || typeof definition.query !== 'object') {
      issues.push(`cohorts[${index}].query is required`);
    } else if (definition.query.resultMode === 'top') {
      issues.push(`cohorts[${index}].query.resultMode must be all for cohort aggregation`);
    }
  });
  if (issues.length > 0) throw new DiscoveryValidationError(issues);

  const maxSubjects = boundedInteger(
    options.maxSubjects,
    SUBJECT_COHORT_DEFAULT_MAX_SUBJECTS,
    SUBJECT_COHORT_MAX_SUBJECTS,
  );
  const attemptedAt = nowIso(options);
  const engine = new DiscoveryEngine(provider);
  const groups: Array<{
    definition: SubjectCohortDefinition;
    result: DiscoveryResult;
    hydrated: HydratedSubject[];
  }> = [];

  for (const definition of definitions) {
    const query = queryForCohort(definition.query, maxSubjects);
    const result = await engine.query(query, context);
    const hydrated = await hydrate(provider, result.items, context);
    groups.push({ definition: { ...definition, query }, result, hydrated });
  }

  const built = groups.map(({ definition, result, hydrated }) =>
    buildGroup(definition, result, hydrated),
  );
  const cohorts = built.map(({ cohort }) => cohort);
  const metrics = SUBJECT_COHORT_METRICS.map((key): SubjectCohortMetric => {
    const coverages = cohorts.map((cohort) => cohort.coverage.metrics[key]);
    const averages = cohorts.map((cohort) => average(cohort.subjects, key));
    const state = metricState(coverages);
    return {
      key,
      label: METRIC_LABELS[key],
      sourceField: METRIC_SOURCE_FIELDS[key],
      ...metricAverageState(state, averages),
      validCounts: coverages.map((coverage) => coverage.valid),
      missingCounts: coverages.map((coverage) => coverage.missing),
      conflictCounts: coverages.map((coverage) => coverage.conflicts),
      ...(cohorts.length === 2 &&
      state === 'complete' &&
      averages[0] !== undefined &&
      averages[1] !== undefined
        ? { delta: averages[1] - averages[0] }
        : {}),
      state,
    };
  });

  const discoveryEvidence = groups.flatMap(({ result }) => result.evidence);
  const detailEvidence = groups.flatMap(({ hydrated }) =>
    hydrated.flatMap(({ result }) => flattenEvidence(result.evidence)),
  );
  const derivedRetrievedAt =
    latestTimestamp([
      ...discoveryEvidence.map((item) => item.retrievedAt),
      ...detailEvidence.map((item) => item.retrievedAt),
    ]) || attemptedAt;
  const derivedEvidence = createEvidenceRef({
    source: {
      class: 'derived',
      provider: 'bangumi-agent-kit',
      operation: 'subject-cohort-comparison',
      version: SUBJECT_COHORT_COMPARISON_FORMULA_VERSION,
    },
    retrievedAt: derivedRetrievedAt,
    fieldPath: 'metrics',
    freshness: { state: 'unknown' },
    authScope: 'public',
    confidence: 'high',
    formula: SUBJECT_COHORT_COMPARISON_FORMULA_VERSION,
  });
  const rawEvidence = [...discoveryEvidence, ...detailEvidence, derivedEvidence];
  rawEvidence.forEach((item) => assertSafeEvidence(item));
  const boundedEvidence = capEvidence(rawEvidence);

  const warnings: SubjectCohortComparisonWarning[] = groups.flatMap(({ definition, result }) =>
    warningFromDiscovery(definition.label?.trim() || '未命名组', result),
  );
  const conflicts = uniqueStrings(
    built.flatMap(({ conflicts }) => conflicts.map((key) => `conflict:${key}`)),
  );
  if (conflicts.length > 0) {
    warnings.push({
      code: 'COHORT_METRIC_CONFLICT',
      state: 'conflict',
      message: `官方 discovery 与详情对 ${conflicts.map((item) => item.slice('conflict:'.length)).join('、')} 给出了不一致值；冲突值未用于均值。`,
    });
  }
  if (cohorts.some((cohort) => cohort.coverage.query.coverage.state !== 'complete')) {
    warnings.push({
      code: 'COHORT_COVERAGE_DEGRADED',
      state: 'partial',
      message: '至少一个 cohort 的 discovery 覆盖是 partial/unknown；均值仅代表本次已返回样本。',
    });
  }
  if (cohorts.some((cohort) => cohort.coverage.detailHydrationsFailed > 0)) {
    warnings.push({
      code: 'COHORT_DETAIL_COVERAGE_DEGRADED',
      state: 'partial',
      message: '部分条目详情读取失败或未找到；报告话数及冲突检查保留为未知，不填充猜测值。',
    });
  }
  if (boundedEvidence.coverage.truncated) {
    warnings.push({
      code: 'COHORT_EVIDENCE_TRUNCATED',
      state: 'partial',
      message: `检索证据已按 ${SUBJECT_COHORT_MAX_EVIDENCE_REFS} 条/${SUBJECT_COHORT_MAX_EVIDENCE_BYTES} 字节硬上限保留；省略项不会用于额外推断。`,
    });
  }

  const officialEvidence = rawEvidence.filter((item) => item.source.class === 'official_v0');
  const retrievedAt = latestTimestamp(rawEvidence.map((item) => item.retrievedAt));
  const boundedWarnings = capWarnings(warnings);
  const result: SubjectCohortComparisonResult = {
    state: comparisonState(cohorts, metrics),
    cohorts,
    metrics,
    formulaVersion: SUBJECT_COHORT_COMPARISON_FORMULA_VERSION,
    coverage: {
      maxSubjectsPerCohort: maxSubjects,
      totalSubjectsReturned: cohorts.reduce((sum, cohort) => sum + cohort.subjects.length, 0),
      cohortsComplete: cohorts.filter(
        (cohort) => cohort.coverage.query.coverage.state === 'complete',
      ).length,
      cohortsPartial: cohorts.filter(
        (cohort) => cohort.coverage.query.coverage.state !== 'complete',
      ).length,
      detailHydrationsAttempted: cohorts.reduce(
        (sum, cohort) => sum + cohort.coverage.detailHydrationsAttempted,
        0,
      ),
      detailHydrationsSucceeded: cohorts.reduce(
        (sum, cohort) => sum + cohort.coverage.detailHydrationsSucceeded,
        0,
      ),
      detailHydrationsFailed: cohorts.reduce(
        (sum, cohort) => sum + cohort.coverage.detailHydrationsFailed,
        0,
      ),
      truncated:
        cohorts.some(
          (cohort) =>
            cohort.coverage.query.coverage.budgetExceeded ||
            cohort.coverage.query.coverage.state !== 'complete',
        ) ||
        boundedEvidence.coverage.truncated ||
        boundedWarnings.coverage.truncated,
      evidence: boundedEvidence.coverage,
      warnings: boundedWarnings.coverage,
    },
    source: {
      official: {
        class: 'official-v0',
        operations: uniqueStrings(officialEvidence.map((item) => item.source.operation)),
        attemptedAt: earliestTimestamp(
          officialEvidence.map((item) => item.retrievedAt),
          attemptedAt,
        ),
        ...(latestTimestamp(officialEvidence.map((item) => item.retrievedAt))
          ? { retrievedAt: latestTimestamp(officialEvidence.map((item) => item.retrievedAt)) }
          : {}),
      },
      derived: {
        class: 'derived-s7',
        operations: ['subject-cohort-comparison'],
        attemptedAt,
        retrievedAt: derivedRetrievedAt,
      },
    },
    evidence: boundedEvidence.evidence,
    warnings: boundedWarnings.warnings,
    limitations: [...LIMITATIONS],
    ...(retrievedAt ? { retrievedAt } : {}),
  };
  return result;
}
