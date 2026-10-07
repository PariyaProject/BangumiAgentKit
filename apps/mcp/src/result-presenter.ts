import type {
  PersonActivityResult,
  PersonActivityWindowSummary,
  SubjectCastItem,
  SubjectCastResult,
  SubjectComparisonResult,
  SubjectOverviewResult,
  SubjectStatsIntelligenceResult,
  SeriesWatchOrderResult,
  SubjectStaffGroup,
  SubjectStaffMember,
} from '@bangumi-agent-kit/bangumi-core';

export const MCP_TOOL_TEXT_MAX_UTF8_BYTES = 3600;

export interface McpToolResultPresentation {
  text: string;
  structuredContent?: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;
type SubjectStaffToolResult = JsonObject & {
  state: string;
  subjectId: number;
  productionStaff: SubjectStaffMember[];
  cast: SubjectCastItem[];
  groups: SubjectStaffGroup[];
  coverage: {
    state: string;
    retrievedAt: string;
    productionStaff: { observed: number; returned: number; truncated: boolean };
    cast: { observed: number; returned: number; truncated: boolean };
    limit: number;
  };
  evidence: unknown[];
  warnings: Array<{ code: string; state: string; message: string }>;
  capabilityStates: Record<string, string>;
};

type SubjectRelationsEvidenceResult = JsonObject & {
  state: 'observed' | 'partial';
  subjectId: number;
  source: JsonObject & {
    api: string;
    operation: string;
    direction: string;
    scope: string;
    retrievedAt: string;
  };
  coverage: JsonObject & {
    responseRowsObserved: number;
    rowsReturned: number;
    schemaDriftRows: number;
    truncated: boolean;
    paginationAvailable: boolean;
    totalCountAvailable: boolean;
    completeness: string;
  };
  items: Array<
    JsonObject & {
      id: number;
      type: string;
      name: string;
      nameCn?: string;
      relation: string;
    }
  >;
  limitations: string[];
};

const PERSON_ACTIVITY_TOOL = 'bangumi.get_person_activity';
const SUBJECT_STAFF_TOOL = 'bangumi.get_subject_staff';
const SUBJECT_CAST_TOOL = 'bangumi.get_subject_cast';
const SUBJECT_OVERVIEW_TOOL = 'bangumi.get_subject_overview';
const SUBJECT_COMPARISON_TOOL = 'bangumi.get_subject_comparison';
const SERIES_WATCH_ORDER_TOOL = 'bangumi.get_series_watch_order';
const QUERY_SUBJECTS_TOOL = 'bangumi.query_subjects';
const SUBJECT_RELATIONS_TOOL = 'bangumi.get_subject_relations';
const MAX_PERSON_ROWS = 6;
const MAX_MONTH_BUCKETS = 6;
const MAX_SECTION_ITEMS = 4;
const MAX_STAFF_GROUPS = 6;
const MAX_ACTORS_PER_CHARACTER = 2;
const MAX_WARNINGS = 2;
const MAX_LIMITATIONS = 2;
const MAX_COMPARISON_DETAILS = 4;
const MESSAGE_TEXT_LIMIT = 80;
const DISPLAY_TEXT_LIMIT = 120;
const TEXT_VIEW_SCOPE_NOTE =
  'Only included rows are shown; partial or truncated coverage is not a complete source list, and omission is not evidence of absence.';

export function presentMcpToolResult(toolName: string, result: unknown): McpToolResultPresentation {
  const fullText = serializeFullResult(result);
  if (
    toolName === SUBJECT_RELATIONS_TOOL &&
    isJsonObject(result) &&
    isSubjectRelationsEvidenceResult(result)
  ) {
    return {
      text: compactSubjectRelations(result),
      structuredContent: result,
    };
  }

  if (utf8Bytes(fullText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) {
    return { text: fullText };
  }

  if (!isJsonObject(result)) {
    return { text: fullText };
  }

  if (toolName === QUERY_SUBJECTS_TOOL && isDiscoveryResult(result)) {
    return {
      text: compactDiscoveryResult(result),
      structuredContent: result,
    };
  }

  if (toolName === PERSON_ACTIVITY_TOOL && isPersonActivityResult(result)) {
    const text = compactPersonActivity(result);
    return {
      text,
      structuredContent: result,
    };
  }

  if (toolName === SUBJECT_STAFF_TOOL && isSubjectStaffResult(result)) {
    return {
      text: compactSubjectStaff(result),
      structuredContent: result,
    };
  }

  if (toolName === SUBJECT_CAST_TOOL && isSubjectCastResult(result)) {
    return {
      text: compactSubjectCast(result),
      structuredContent: result,
    };
  }

  if (toolName === SUBJECT_OVERVIEW_TOOL && isSubjectOverviewResult(result)) {
    const text = compactSubjectOverview(result);
    return {
      text,
      structuredContent: result,
    };
  }

  if (toolName === SUBJECT_COMPARISON_TOOL && isSubjectComparisonResult(result)) {
    return {
      text: compactSubjectComparison(result),
      structuredContent: result,
    };
  }

  if (toolName === SERIES_WATCH_ORDER_TOOL && isSeriesWatchOrderResult(result)) {
    return {
      text: compactSeriesWatchOrder(result),
      structuredContent: result,
    };
  }

  return { text: fullText };
}

function serializeFullResult(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2) ?? 'null';
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

type DiscoveryToolResult = JsonObject & {
  state: string;
  items: JsonObject[];
  plan: JsonObject;
  coverage: JsonObject;
};

function isDiscoveryResult(value: JsonObject): value is DiscoveryToolResult {
  return (
    ['ok', 'partial'].includes(String(value.state)) &&
    Array.isArray(value.items) &&
    value.items.every(isJsonObject) &&
    isJsonObject(value.plan) &&
    isJsonObject(value.coverage)
  );
}

function compactDiscoveryResult(result: DiscoveryToolResult): string {
  const fullJsonBytes = utf8Bytes(JSON.stringify(result, null, 2));
  const explanation = isJsonObject(result.explanation) ? result.explanation : {};
  const plan = result.plan;
  const request = firstDiscoveryRequest(plan);
  const filter = isJsonObject(request?.filter) ? request.filter : {};
  const requiredTags = stringValues(filter.tag);
  const requiredMetaTags = stringValues(filter.metaTags);
  const sourceNote =
    plan.operation === 'searchSubjects'
      ? 'Official Bangumi subject search is experimental; totals are estimated and do not establish complete database coverage.'
      : undefined;
  const rawWarnings = Array.isArray(result.warnings)
    ? result.warnings.filter(isJsonObject).flatMap((item) =>
        typeof item.code === 'string'
          ? [
              {
                code: item.code,
                ...(typeof item.state === 'string' ? { state: item.state } : {}),
                ...(typeof item.message === 'string' ? { message: item.message } : {}),
              },
            ]
          : [],
      )
    : [];
  const orderedWarnings = [
    ...rawWarnings.filter((item) => item.code === 'EXPERIMENTAL_SOURCE'),
    ...rawWarnings.filter((item) => item.code !== 'EXPERIMENTAL_SOURCE'),
  ];
  const rawLimitations = [
    ...(sourceNote ? [sourceNote] : []),
    ...(typeof explanation.coverageScope === 'string' ? [explanation.coverageScope] : []),
    ...(Array.isArray(explanation.limitations)
      ? explanation.limitations.filter((item): item is string => typeof item === 'string')
      : []),
    ...(Array.isArray(plan.limitations)
      ? plan.limitations.filter((item): item is string => typeof item === 'string')
      : []),
  ];
  const limitations = [...new Set(rawLimitations)];
  const coverage = projectDiscoveryCoverage(result.coverage);
  const planSummary = projectDiscoveryPlan(plan, filter);
  const filterValuesOmitted = planSummary.filterValuesOmitted + planSummary.postFiltersOmitted;
  const filterTextNote =
    filterValuesOmitted > 0
      ? ` ${filterValuesOmitted} query filter value(s) are omitted from this text view.`
      : '';
  const baseTextViewScope =
    'Only included rows are shown in this text view; omitted rows are not evidence of absence. Source coverage can still be partial.' +
    filterTextNote;
  let rowLimit = result.items.length;
  let displayCharacters = 120;
  let messageCharacters = 220;
  let facetLimit = 6;
  let warningLimit = Math.min(4, orderedWarnings.length);
  let limitationLimit = Math.min(5, limitations.length);

  while (true) {
    let displayNamesClipped = 0;
    let tagsOmitted = 0;
    let metaTagsOmitted = 0;
    const items = result.items.slice(0, rowLimit).map((item) => {
      const projection = projectDiscoveryItem(
        item,
        requiredTags,
        requiredMetaTags,
        displayCharacters,
        facetLimit,
      );
      displayNamesClipped += projection.displayNamesClipped;
      tagsOmitted += projection.tagsOmitted;
      metaTagsOmitted += projection.metaTagsOmitted;
      return projection.item;
    });
    const warnings = orderedWarnings.slice(0, warningLimit).map((item) => ({
      ...item,
      ...(typeof item.message === 'string'
        ? { message: clippedDisplayText(item.message, messageCharacters).text }
        : {}),
    }));
    const projectedLimitations = limitations
      .slice(0, limitationLimit)
      .map((item) => clippedDisplayText(item, messageCharacters).text);
    const text = JSON.stringify({
      state: result.state,
      plan: planSummary,
      coverage,
      warnings,
      limitations: projectedLimitations,
      items,
      textProjection: {
        rowsIncluded: items.length,
        rowsOmitted: result.items.length - items.length,
        displayNamesClipped,
        tagsOmitted,
        metaTagsOmitted,
        warningsOmitted: orderedWarnings.length - warnings.length,
        limitationsOmitted: limitations.length - projectedLimitations.length,
        fullStructuredContentAvailable: true,
        textViewScope: baseTextViewScope,
        maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
        fullResultUtf8Bytes: fullJsonBytes,
      },
    });
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (rowLimit > 1) rowLimit = Math.floor(rowLimit / 2);
    else if (rowLimit === 1) rowLimit = 0;
    else if (displayCharacters > 24) displayCharacters = Math.floor(displayCharacters / 2);
    else if (messageCharacters > 80) messageCharacters = Math.floor(messageCharacters / 2);
    else if (facetLimit > 0) facetLimit -= 1;
    else if (limitationLimit > 1) limitationLimit -= 1;
    else if (warningLimit > 1) warningLimit -= 1;
    else break;
  }

  const fallback = JSON.stringify({
    state: result.state,
    plan: planSummary,
    coverage,
    warnings: orderedWarnings
      .filter((item) => item.code === 'EXPERIMENTAL_SOURCE')
      .slice(0, 1)
      .map(({ code, state }) => ({ code, ...(state ? { state } : {}) })),
    limitations: sourceNote ? [sourceNote] : [],
    items: [],
    textProjection: {
      rowsIncluded: 0,
      rowsOmitted: result.items.length,
      fullStructuredContentAvailable: true,
      textViewScope:
        'No rows fit this bounded text view; omitted rows are not evidence of absence. Source coverage can still be partial.' +
        filterTextNote,
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      fullResultUtf8Bytes: fullJsonBytes,
    },
  });
  if (utf8Bytes(fallback) > MCP_TOOL_TEXT_MAX_UTF8_BYTES) {
    throw new Error('Unable to produce bounded MCP discovery text');
  }
  return fallback;
}

function firstDiscoveryRequest(plan: JsonObject): JsonObject | undefined {
  if (!Array.isArray(plan.steps)) return undefined;
  const first = plan.steps.find(isJsonObject);
  if (!first || !isJsonObject(first.request)) return undefined;
  return first.request;
}

function projectDiscoveryPlan(
  plan: JsonObject,
  filter: JsonObject,
): JsonObject & { filterValuesOmitted: number; postFiltersOmitted: number } {
  const budget = isJsonObject(plan.budget) ? plan.budget : {};
  const projectedFilter: JsonObject = {};
  let filterValuesOmitted = 0;
  for (const key of [
    'type',
    'tag',
    'metaTags',
    'airDate',
    'rating',
    'ratingCount',
    'rank',
    'nsfw',
  ]) {
    if (filter[key] !== undefined) {
      const projected = projectQueryFilterValue(filter[key]);
      projectedFilter[key] = projected.value;
      filterValuesOmitted += projected.omitted;
    }
  }
  const allPostFilters = Array.isArray(plan.postFilters)
    ? plan.postFilters.filter(isJsonObject)
    : [];
  const postFilters = allPostFilters.slice(0, 8).map((item) => {
    const value = item.value === undefined ? undefined : projectQueryFilterValue(item.value);
    filterValuesOmitted += value?.omitted ?? 0;
    return {
      ...(typeof item.field === 'string' ? { field: item.field } : {}),
      ...(typeof item.classification === 'string' ? { classification: item.classification } : {}),
      ...(value === undefined ? {} : { value: value.value }),
    };
  });
  return {
    ...(typeof plan.source === 'string' ? { source: plan.source } : {}),
    ...(typeof plan.operation === 'string' ? { operation: plan.operation } : {}),
    ...(typeof plan.totalKind === 'string' ? { totalKind: plan.totalKind } : {}),
    ...(typeof plan.quality === 'string' ? { quality: plan.quality } : {}),
    ...(typeof plan.resultMode === 'string' ? { resultMode: plan.resultMode } : {}),
    filter: projectedFilter,
    postFilters,
    filterValuesOmitted,
    postFiltersOmitted: Math.max(0, allPostFilters.length - postFilters.length),
    budget: {
      ...copyIntegerFields(budget, [
        'maxPages',
        'maxCandidates',
        'maxHydrations',
        'maxReturnedItems',
      ]),
    },
  };
}

function projectQueryFilterValue(value: unknown): { value: unknown; omitted: number } {
  if (Array.isArray(value)) {
    const maximum = 4;
    let clippedItems = 0;
    const visible = value.slice(0, maximum).map((item) => {
      if (typeof item !== 'string') return item;
      const clipped = clippedDisplayText(item, 80);
      if (clipped.clipped) clippedItems += 1;
      return clipped.text;
    });
    return {
      value: visible,
      omitted: Math.max(0, value.length - visible.length) + clippedItems,
    };
  }
  if (typeof value === 'string') {
    const clipped = clippedDisplayText(value, 80);
    return { value: clipped.text, omitted: clipped.clipped ? 1 : 0 };
  }
  if (isJsonObject(value)) {
    const entries = Object.entries(value);
    const visible = Object.fromEntries(entries.slice(0, 8));
    return { value: visible, omitted: Math.max(0, entries.length - 8) };
  }
  return { value, omitted: 0 };
}

function projectDiscoveryCoverage(coverage: JsonObject): JsonObject {
  const projected: JsonObject = {};
  for (const key of [
    'state',
    'requested',
    'scanned',
    'matched',
    'returned',
    'pagesRequested',
    'pagesScanned',
    'upstreamExhausted',
    'budgetExceeded',
    'totalKind',
    'hydrationsAttempted',
    'hydrationsSucceeded',
    'hydrationsFailed',
    'hydrationsUnresolved',
    'hydrationBudgetExceeded',
    'outputCap',
    'reason',
  ]) {
    const value = coverage[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      projected[key] = value;
    }
  }
  return projected;
}

function copyIntegerFields(source: JsonObject, fields: readonly string[]): JsonObject {
  return Object.fromEntries(
    fields.flatMap((field) => (Number.isInteger(source[field]) ? [[field, source[field]]] : [])),
  );
}

function projectDiscoveryItem(
  item: JsonObject,
  requiredTags: readonly string[],
  requiredMetaTags: readonly string[],
  displayCharacters: number,
  facetLimit: number,
): {
  item: JsonObject;
  displayNamesClipped: number;
  tagsOmitted: number;
  metaTagsOmitted: number;
} {
  let displayNamesClipped = 0;
  const projected: JsonObject = {};
  if (Number.isSafeInteger(item.id)) projected.id = item.id;
  for (const key of ['name', 'nameCn', 'displayName']) {
    if (typeof item[key] !== 'string') continue;
    const clipped = clippedDisplayText(item[key] as string, displayCharacters);
    projected[key] = clipped.text;
    if (clipped.clipped) displayNamesClipped += 1;
  }
  for (const key of ['media', 'category', 'date']) {
    if (typeof item[key] === 'string') projected[key] = item[key];
  }
  if (Number.isFinite(item.ratingCount)) projected.ratingCount = item.ratingCount;
  const tags = projectDiscoveryFacets(item.tags, requiredTags, facetLimit);
  const metaTags = projectDiscoveryFacets(item.metaTags, requiredMetaTags, facetLimit);
  if (tags.values.length > 0 || Array.isArray(item.tags)) projected.tags = tags.values;
  if (metaTags.values.length > 0 || Array.isArray(item.metaTags))
    projected.metaTags = metaTags.values;
  return {
    item: projected,
    displayNamesClipped,
    tagsOmitted: tags.omitted,
    metaTagsOmitted: metaTags.omitted,
  };
}

function projectDiscoveryFacets(
  value: unknown,
  required: readonly string[],
  maximum: number,
): { values: string[]; omitted: number } {
  const values = stringValues(value);
  const requiredValues = [...new Set(required.filter((item) => values.includes(item)))];
  const remaining = values.filter((item) => !requiredValues.includes(item));
  const visible = [...requiredValues, ...remaining.slice(0, maximum)];
  return { values: visible, omitted: Math.max(0, values.length - visible.length) };
}

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function clipSubjectRelationText(value: string, maximumCharacters: number): string {
  const characters = Array.from(value);
  return characters.length <= maximumCharacters
    ? value
    : `${characters.slice(0, maximumCharacters).join('')}…`;
}

function compactSubjectRelations(result: SubjectRelationsEvidenceResult): string {
  const options = {
    rowLimit: Math.min(24, result.items.length),
    displayCharacters: 72,
    limitationCharacters: 180,
  };

  while (true) {
    let displayNamesClipped = 0;
    let relationLabelsClipped = 0;
    let limitationsClipped = 0;
    const items = result.items.slice(0, options.rowLimit).map((item) => {
      const name = clipSubjectRelationText(item.name, options.displayCharacters);
      const nameCn =
        item.nameCn === undefined
          ? undefined
          : clipSubjectRelationText(item.nameCn, options.displayCharacters);
      const relation = clipSubjectRelationText(item.relation, options.displayCharacters);
      if (name !== item.name || (item.nameCn !== undefined && nameCn !== item.nameCn)) {
        displayNamesClipped += 1;
      }
      if (relation !== item.relation) relationLabelsClipped += 1;
      return {
        id: item.id,
        type: item.type,
        name,
        ...(nameCn === undefined ? {} : { nameCn }),
        relation,
      };
    });
    const limitations = result.limitations.map((limitation) => {
      const projected = clipSubjectRelationText(limitation, options.limitationCharacters);
      if (projected !== limitation) limitationsClipped += 1;
      return projected;
    });
    const text = JSON.stringify({
      state: result.state,
      subjectId: result.subjectId,
      source: result.source,
      coverage: result.coverage,
      limitations,
      items,
      textProjection: {
        rowsIncluded: items.length,
        rowsOmitted: result.items.length - items.length,
        displayNamesClipped,
        relationLabelsClipped,
        limitationsClipped,
        imageFieldsOmitted: result.items.filter((item) => item.images !== undefined).length,
        fullStructuredContentAvailable: true,
      },
    });
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (options.rowLimit > 1) options.rowLimit = Math.floor(options.rowLimit / 2);
    else if (options.rowLimit === 1) options.rowLimit = 0;
    else if (options.displayCharacters > 12) {
      options.displayCharacters = Math.floor(options.displayCharacters / 2);
    } else if (options.limitationCharacters > 48) {
      options.limitationCharacters = Math.floor(options.limitationCharacters / 2);
    } else {
      throw new Error('Unable to produce bounded MCP subject-relations text');
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSubjectRelationsEvidenceResult(
  value: JsonObject,
): value is SubjectRelationsEvidenceResult {
  return (
    ['observed', 'partial'].includes(String(value.state)) &&
    Number.isInteger(value.subjectId) &&
    isJsonObject(value.source) &&
    typeof value.source.api === 'string' &&
    typeof value.source.operation === 'string' &&
    typeof value.source.direction === 'string' &&
    typeof value.source.scope === 'string' &&
    typeof value.source.retrievedAt === 'string' &&
    isJsonObject(value.coverage) &&
    Number.isInteger(value.coverage.responseRowsObserved) &&
    Number.isInteger(value.coverage.rowsReturned) &&
    Number.isInteger(value.coverage.schemaDriftRows) &&
    typeof value.coverage.truncated === 'boolean' &&
    typeof value.coverage.paginationAvailable === 'boolean' &&
    typeof value.coverage.totalCountAvailable === 'boolean' &&
    typeof value.coverage.completeness === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isJsonObject(item) &&
        Number.isInteger(item.id) &&
        typeof item.type === 'string' &&
        typeof item.name === 'string' &&
        (item.nameCn === undefined || typeof item.nameCn === 'string') &&
        typeof item.relation === 'string',
    ) &&
    Array.isArray(value.limitations) &&
    value.limitations.every((limitation) => typeof limitation === 'string')
  );
}

function isPersonActivityResult(value: JsonObject): value is JsonObject & PersonActivityResult {
  return (
    typeof value.personId === 'number' &&
    (value.person === undefined || isJsonObject(value.person)) &&
    isJsonObject(value.window) &&
    isJsonObject(value.summary) &&
    isJsonObject(value.coverage) &&
    Array.isArray(value.rows) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.limitations)
  );
}

function isSubjectOverviewResult(value: JsonObject): value is JsonObject & SubjectOverviewResult {
  return (
    typeof value.subjectId === 'number' &&
    isJsonObject(value.stats) &&
    isJsonObject(value.cast) &&
    isJsonObject(value.staff) &&
    isJsonObject(value.relations) &&
    isJsonObject(value.coverage) &&
    Array.isArray(value.cast.items) &&
    Array.isArray(value.staff.items) &&
    Array.isArray(value.staff.groups) &&
    Array.isArray(value.relations.items) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.limitations)
  );
}

function isSubjectComparisonResult(
  value: JsonObject,
): value is JsonObject & SubjectComparisonResult {
  return (
    Array.isArray(value.subjectIds) &&
    value.subjectIds.length === 2 &&
    value.subjectIds.every((subjectId) => Number.isInteger(subjectId) && Number(subjectId) > 0) &&
    Array.isArray(value.subjects) &&
    value.subjects.length === 2 &&
    value.subjects.every(isSubjectComparisonSubject) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(
      (metric) =>
        isJsonObject(metric) &&
        typeof metric.key === 'string' &&
        typeof metric.label === 'string' &&
        Array.isArray(metric.values) &&
        metric.values.length === 2 &&
        (metric.delta === null || typeof metric.delta === 'number') &&
        Number.isInteger(metric.deltaPrecision) &&
        typeof metric.state === 'string' &&
        (metric.conflicts === undefined ||
          (Array.isArray(metric.conflicts) && metric.conflicts.every(isJsonObject))),
    ) &&
    isJsonObject(value.coverage) &&
    isJsonObject(value.coverage.limits) &&
    isJsonObject(value.source) &&
    isComparisonSourceSummary(value.source.official) &&
    isComparisonSourceSummary(value.source.derived) &&
    isJsonObject(value.overlaps) &&
    isComparisonOverlap(value.overlaps.cast) &&
    isComparisonOverlap(value.overlaps.staff) &&
    Array.isArray(value.evidence) &&
    value.evidence.every(
      (item) =>
        isJsonObject(item) && typeof item.source === 'string' && typeof item.operation === 'string',
    ) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(
      (warning) =>
        isJsonObject(warning) &&
        typeof warning.code === 'string' &&
        typeof warning.state === 'string' &&
        typeof warning.message === 'string',
    ) &&
    Array.isArray(value.limitations) &&
    value.limitations.every((limitation) => typeof limitation === 'string')
  );
}

const SERIES_WATCH_ORDER_COVERAGE_COUNT_FIELDS = [
  'depth',
  'maxNodes',
  'animeNodeLimit',
  'nonAnimeEvidenceLimit',
  'relatedLimit',
  'relationRequests',
  'relationRowsObserved',
  'uniqueRelatedObserved',
  'uniqueRelatedReturned',
  'animeNodesObserved',
  'animeNodesSelected',
  'nonAnimeRowsObserved',
  'nonAnimeRowsReturned',
  'detailsAttempted',
  'detailsFetched',
  'detailsFailed',
  'relationFailures',
  'edgeEvidenceLimit',
  'edgeEvidenceReturned',
];
const SERIES_WATCH_ORDER_COVERAGE_BOOLEAN_FIELDS = [
  'edgeEvidenceTruncated',
  'relatedEvidenceTruncated',
  'truncated',
];

function isSeriesWatchOrderResult(value: JsonObject): value is JsonObject & SeriesWatchOrderResult {
  return (
    ['complete', 'partial', 'not_computable'].includes(String(value.state)) &&
    Number.isInteger(value.subjectId) &&
    isSeriesWatchOrderNode(value.root) &&
    Array.isArray(value.watchOrder) &&
    value.watchOrder.every(
      (item) =>
        isSeriesWatchOrderNode(item) &&
        Number.isInteger(item.position) &&
        ['root', 'before_root', 'after_root'].includes(String(item.placement)) &&
        typeof item.isRoot === 'boolean' &&
        typeof item.placementReason === 'string',
    ) &&
    Array.isArray(value.related) &&
    value.related.every(
      (item) =>
        isSeriesWatchOrderNode(item) &&
        Number.isInteger(item.depth) &&
        typeof item.includedInWatchOrder === 'boolean' &&
        (item.exclusionReason === undefined || typeof item.exclusionReason === 'string'),
    ) &&
    Array.isArray(value.edges) &&
    value.edges.every(isSeriesWatchOrderPath) &&
    isJsonObject(value.excluded) &&
    Number.isInteger(value.excluded.count) &&
    Array.isArray(value.excluded.byReason) &&
    value.excluded.byReason.every(
      (item) =>
        isJsonObject(item) && typeof item.reason === 'string' && Number.isInteger(item.count),
    ) &&
    Array.isArray(value.excluded.samples) &&
    value.excluded.samples.every(
      (item) => isSeriesWatchOrderNode(item) && typeof item.reason === 'string',
    ) &&
    isSeriesWatchOrderCoverage(value.coverage) &&
    isJsonObject(value.capabilityStates) &&
    typeof value.capabilityStates.watchOrder === 'string' &&
    isJsonObject(value.evidence) &&
    Array.isArray(value.evidence.sources) &&
    value.evidence.sources.every(
      (source) =>
        isJsonObject(source) &&
        typeof source.operation === 'string' &&
        typeof source.path === 'string' &&
        ['succeeded', 'failed'].includes(String(source.status)) &&
        Number.isInteger(source.subjectId) &&
        (source.depth === undefined || Number.isInteger(source.depth)),
    ) &&
    typeof value.evidence.derivation === 'string' &&
    typeof value.evidence.retrievedAt === 'string' &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string') &&
    Array.isArray(value.limitations) &&
    value.limitations.every((limitation) => typeof limitation === 'string')
  );
}

function isSeriesWatchOrderNode(value: unknown): value is JsonObject {
  return (
    isJsonObject(value) &&
    Number.isInteger(value.id) &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.nameCn === 'string' &&
    (value.date === undefined || typeof value.date === 'string') &&
    Array.isArray(value.relationLabels) &&
    value.relationLabels.every((label) => typeof label === 'string') &&
    Array.isArray(value.relationKinds) &&
    value.relationKinds.every((kind) => typeof kind === 'string') &&
    Array.isArray(value.relationPaths) &&
    value.relationPaths.every(isSeriesWatchOrderPath)
  );
}

function isSeriesWatchOrderCoverage(value: unknown): value is JsonObject {
  return (
    isJsonObject(value) &&
    ['anime', 'all'].includes(String(value.media)) &&
    SERIES_WATCH_ORDER_COVERAGE_COUNT_FIELDS.every((field) => Number.isInteger(value[field])) &&
    SERIES_WATCH_ORDER_COVERAGE_BOOLEAN_FIELDS.every(
      (field) => typeof value[field] === 'boolean',
    ) &&
    Array.isArray(value.truncationReasons) &&
    value.truncationReasons.every((reason) => typeof reason === 'string') &&
    typeof value.retrievedAt === 'string'
  );
}

function isSeriesWatchOrderPath(value: unknown): value is JsonObject {
  return (
    isJsonObject(value) &&
    Number.isInteger(value.fromId) &&
    Number.isInteger(value.toId) &&
    Number.isInteger(value.depth) &&
    typeof value.relation === 'string' &&
    typeof value.relationKind === 'string' &&
    Array.isArray(value.pathIds) &&
    value.pathIds.every((id) => Number.isInteger(id)) &&
    Array.isArray(value.pathKinds) &&
    value.pathKinds.every((kind) => typeof kind === 'string') &&
    typeof value.direct === 'boolean'
  );
}

function isComparisonSourceSummary(value: unknown): boolean {
  return (
    isJsonObject(value) &&
    typeof value.class === 'string' &&
    Array.isArray(value.operations) &&
    value.operations.every((operation) => typeof operation === 'string') &&
    typeof value.attemptedAt === 'string'
  );
}

function isComparisonOverlap(value: unknown): boolean {
  return (
    isJsonObject(value) &&
    Array.isArray(value.items) &&
    isJsonObject(value.coverage) &&
    isJsonObject(value.coverage.left) &&
    isJsonObject(value.coverage.right) &&
    typeof value.coverage.truncated === 'boolean'
  );
}

function isSubjectComparisonSubject(value: unknown): boolean {
  if (
    !isJsonObject(value) ||
    !Number.isInteger(value.subjectId) ||
    !isJsonObject(value.stats) ||
    !isJsonObject(value.sections) ||
    !isJsonObject(value.coverage) ||
    !isJsonObject(value.coverage.limits) ||
    !Array.isArray(value.coverage.truncatedSections) ||
    !isJsonObject(value.source) ||
    !isComparisonSourceSummary(value.source.official) ||
    !isComparisonSourceSummary(value.source.derived) ||
    !Array.isArray(value.warnings) ||
    !Array.isArray(value.limitations)
  ) {
    return false;
  }
  if (value.subject !== undefined) {
    if (
      !isJsonObject(value.subject) ||
      !Number.isInteger(value.subject.id) ||
      typeof value.subject.name !== 'string' ||
      typeof value.subject.type !== 'string'
    ) {
      return false;
    }
  }
  if (value.statistics !== undefined) {
    const statistics = value.statistics;
    if (
      !isJsonObject(statistics) ||
      !isJsonObject(statistics.rating) ||
      !Array.isArray(statistics.rating.distribution) ||
      !isJsonObject(statistics.collection) ||
      typeof statistics.collection.completionState !== 'string' ||
      !Array.isArray(statistics.collection.distribution) ||
      !isJsonObject(statistics.collection.formulas) ||
      !isJsonObject(statistics.collection.formulas.completion) ||
      typeof statistics.collection.formulas.completion.description !== 'string'
    ) {
      return false;
    }
  }
  return true;
}

function isSubjectStaffResult(value: JsonObject): value is SubjectStaffToolResult {
  return (
    typeof value.subjectId === 'number' &&
    Array.isArray(value.productionStaff) &&
    Array.isArray(value.cast) &&
    Array.isArray(value.groups) &&
    isJsonObject(value.coverage) &&
    isJsonObject(value.coverage.productionStaff) &&
    isJsonObject(value.coverage.cast) &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.warnings) &&
    isJsonObject(value.capabilityStates)
  );
}

function isSubjectCastResult(value: JsonObject): value is JsonObject & SubjectCastResult {
  return (
    value.status === 'ok' &&
    typeof value.subjectId === 'number' &&
    typeof value.observed === 'number' &&
    typeof value.returned === 'number' &&
    typeof value.truncated === 'boolean' &&
    typeof value.schemaDriftRows === 'number' &&
    typeof value.invalidActorIdRows === 'number' &&
    Array.isArray(value.cast) &&
    value.cast.every(
      (item) =>
        isJsonObject(item) &&
        isJsonObject(item.character) &&
        typeof item.character.id === 'number' &&
        typeof item.character.name === 'string' &&
        typeof item.character.type === 'number' &&
        typeof item.relation === 'string' &&
        Array.isArray(item.actors) &&
        item.actors.every(
          (actor) =>
            isJsonObject(actor) && typeof actor.id === 'number' && typeof actor.name === 'string',
        ),
    )
  );
}

function clippedMessage(value: string): { text: string; clipped: boolean } {
  const characters = Array.from(value);
  if (characters.length <= MESSAGE_TEXT_LIMIT) return { text: value, clipped: false };
  return {
    text: characters.slice(0, MESSAGE_TEXT_LIMIT - 1).join('') + '…',
    clipped: true,
  };
}

function clippedDisplayText(
  value: string,
  maxCharacters = DISPLAY_TEXT_LIMIT,
): { text: string; clipped: boolean } {
  const characters = Array.from(value);
  const limit = Math.max(0, maxCharacters);
  if (characters.length <= limit) return { text: value, clipped: false };
  return {
    text: limit === 0 ? '' : characters.slice(0, limit - 1).join('') + '…',
    clipped: true,
  };
}

function projectMessages(
  warnings: Array<{ code: string; state: string; message: string }>,
  limitations: string[],
  warningLimit: number,
  limitationLimit: number,
) {
  const warningRows = warnings.slice(0, warningLimit).map((warning) => {
    const message = clippedMessage(warning.message);
    return {
      code: warning.code,
      state: warning.state,
      message: message.text,
      ...(message.clipped ? { messageTextTruncated: true } : {}),
    };
  });
  const limitationRows = limitations
    .slice(0, limitationLimit)
    .map((limitation) => clippedMessage(limitation));
  return {
    warnings: warningRows,
    limitations: limitationRows.map((item) => item.text),
    warningsOmittedFromText: warnings.length - warningRows.length,
    limitationsOmittedFromText: limitations.length - limitationRows.length,
    messageStringsTruncated:
      warningRows.filter((warning) => warning.messageTextTruncated === true).length +
      limitationRows.filter((item) => item.clipped).length,
  };
}

function projectWindowSummary(summary: PersonActivityWindowSummary, monthLimit: number) {
  return {
    creditRows: summary.creditRows,
    uniqueSubjects: summary.uniqueSubjects,
    uniqueCharacters: summary.uniqueCharacters,
    byRole: summary.byRole.slice(0, 8),
    byMedia: summary.byMedia.slice(0, 8),
    byMonth: summary.byMonth.slice(0, monthLimit),
    origin: { ...summary.origin },
    byRoleOmittedFromText: Math.max(0, summary.byRole.length - 8),
    byMediaOmittedFromText: Math.max(0, summary.byMedia.length - 8),
    byMonthOmittedFromText: Math.max(0, summary.byMonth.length - monthLimit),
  };
}

function projectPersonCoverage(coverage: PersonActivityResult['coverage']) {
  return {
    relationRowsObserved: coverage.relationRowsObserved,
    relationRowsSelected: coverage.relationRowsSelected,
    relationRowsDroppedAtLimit: coverage.relationRowsDroppedAtLimit,
    relationSelectionStrategy: coverage.relationSelectionStrategy,
    sampled: coverage.sampled,
    subjectDetailIdsObserved: coverage.subjectDetailIdsObserved,
    subjectDetailRequests: coverage.subjectDetailRequests,
    subjectDetailsSucceeded: coverage.subjectDetailsSucceeded,
    subjectDetailsFailed: coverage.subjectDetailsFailed,
    subjectDetailIdsDroppedAtLimit: coverage.subjectDetailIdsDroppedAtLimit,
    rowsEligible: coverage.rowsEligible,
    rowsReturned: coverage.rowsReturned,
    outputTruncated: coverage.outputTruncated,
    uniqueSubjects: coverage.uniqueSubjects,
    uniqueCharacters: coverage.uniqueCharacters,
    missingDateRows: coverage.missingDateRows,
    invalidDateRows: coverage.invalidDateRows,
    outsideWindowRows: coverage.outsideWindowRows,
    mediaExcludedRows: coverage.mediaExcludedRows,
    mediaUnknownRows: coverage.mediaUnknownRows,
    staffRoleExcludedRows: coverage.staffRoleExcludedRows,
    staffRoleUnknownRows: coverage.staffRoleUnknownRows,
    maxRelations: coverage.maxRelations,
    maxSubjectDetails: coverage.maxSubjectDetails,
    maxRows: coverage.maxRows,
    truncated: coverage.truncated,
    retrievedAt: coverage.retrievedAt,
    origin: { ...coverage.origin },
  };
}

function projectPersonRow(row: PersonActivityResult['rows'][number]) {
  const subjectName = clippedDisplayText(row.subjectName);
  const subjectNameCn = clippedDisplayText(row.subjectNameCn);
  return {
    subjectId: row.subjectId,
    subjectName: subjectName.text,
    subjectNameCn: subjectNameCn.text,
    ...(subjectName.clipped || subjectNameCn.clipped ? { displayNameTextTruncated: true } : {}),
    subjectType: row.subjectType,
    ...(row.platform ? { platform: row.platform } : {}),
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationKind: row.relationKind,
    ...(row.characterName ? { characterName: row.characterName } : {}),
    ...(row.rawRole ? { rawRole: row.rawRole } : {}),
    roleFamily: row.roleFamily,
    origin: {
      state: row.origin.state,
      ...(row.origin.metaTags ? { metaTags: row.origin.metaTags } : {}),
      ...(row.origin.metaTagsCoverage
        ? { metaTagsCoverage: { ...row.origin.metaTagsCoverage } }
        : {}),
    },
  };
}

function projectPersonIdentity(
  person: NonNullable<PersonActivityResult['person']>,
  maxCharacters = DISPLAY_TEXT_LIMIT,
) {
  const name = clippedDisplayText(person.name, maxCharacters);
  const nameCn = person.nameCn ? clippedDisplayText(person.nameCn, maxCharacters) : undefined;
  return {
    id: person.id,
    name: name.text,
    ...(nameCn ? { nameCn: nameCn.text } : {}),
    ...(name.clipped || nameCn?.clipped ? { displayNameTextTruncated: true } : {}),
  };
}

function projectActivityWindow(
  window: PersonActivityResult['window'],
  maxCharacters = DISPLAY_TEXT_LIMIT,
) {
  const start = clippedDisplayText(window.start, maxCharacters);
  const end = clippedDisplayText(window.end, maxCharacters);
  return {
    months: window.months,
    start: start.text,
    end: end.text,
    asOfSemantics: window.asOfSemantics,
    ...(start.clipped || end.clipped ? { rangeTextTruncated: true } : {}),
  };
}

function canExposeComparisonCounts(
  period: NonNullable<PersonActivityResult['comparison']>['recent'],
): boolean {
  return (
    period.state === 'complete' || (period.state === 'partial' && period.coverage.rowsEligible > 0)
  );
}

function projectComparisonCoverage(coverage: PersonActivityResult['coverage']) {
  const projected = {
    relationRowsObserved: coverage.relationRowsObserved,
    relationRowsSelected: coverage.relationRowsSelected,
    relationRowsDroppedAtLimit: coverage.relationRowsDroppedAtLimit,
    relationSelectionStrategy: coverage.relationSelectionStrategy,
    sampled: coverage.sampled,
    subjectDetailRequests: coverage.subjectDetailRequests,
    subjectDetailsSucceeded: coverage.subjectDetailsSucceeded,
    subjectDetailsFailed: coverage.subjectDetailsFailed,
    rowsEligible: coverage.rowsEligible,
    rowsReturned: coverage.rowsReturned,
    outputTruncated: coverage.outputTruncated,
    uniqueSubjects: coverage.uniqueSubjects,
    uniqueCharacters: coverage.uniqueCharacters,
    maxRelations: coverage.maxRelations,
    maxSubjectDetails: coverage.maxSubjectDetails,
    maxRows: coverage.maxRows,
    truncated: coverage.truncated,
  };
  return {
    ...projected,
    coverageDetailFieldsOmittedFromText:
      Math.max(0, Object.keys(coverage).length - Object.keys(projected).length) +
      Object.keys(coverage.origin).length,
  };
}

function projectComparison(
  result: PersonActivityResult,
  detailLimit: number,
  textLimit = DISPLAY_TEXT_LIMIT,
  includeAnswerSummary = true,
  includeSummaryOrigin = true,
) {
  if (!result.comparison) return undefined;
  const comparison = result.comparison;
  const projectPeriod = (period: typeof comparison.recent) => {
    const countsAvailable = canExposeComparisonCounts(period);
    const byRole = countsAvailable
      ? period.summary.byRole.slice(0, detailLimit).map((item) => {
          const key = clippedDisplayText(item.key);
          const label = clippedDisplayText(item.label);
          return {
            key: key.text,
            label: label.text,
            creditRows: item.creditRows,
            uniqueSubjects: item.uniqueSubjects,
            uniqueCharacters: item.uniqueCharacters,
            ...(key.clipped || label.clipped ? { labelTextTruncated: true } : {}),
          };
        })
      : [];
    const byMedia = countsAvailable
      ? period.summary.byMedia.slice(0, detailLimit).map((item) => {
          const key = clippedDisplayText(item.key);
          const label = clippedDisplayText(item.label);
          return {
            key: key.text,
            label: label.text,
            creditRows: item.creditRows,
            uniqueSubjects: item.uniqueSubjects,
            uniqueCharacters: item.uniqueCharacters,
            ...(key.clipped || label.clipped ? { labelTextTruncated: true } : {}),
          };
        })
      : [];
    const exclusions = period.exclusions.slice(0, detailLimit).map(({ reason, count }) => ({
      reason,
      count,
    }));
    return {
      state: period.state,
      window: projectActivityWindow(period.window, textLimit),
      summary: {
        ...(countsAvailable
          ? {
              creditRows: period.summary.creditRows,
              uniqueSubjects: period.summary.uniqueSubjects,
              uniqueCharacters: period.summary.uniqueCharacters,
              ...(includeSummaryOrigin
                ? { origin: { ...period.summary.origin } }
                : { originOmittedFromText: true }),
            }
          : { countsOmittedDueToCoverage: true }),
        byRole,
        byRoleOmittedFromText: period.summary.byRole.length - byRole.length,
        byMedia,
        byMediaOmittedFromText: period.summary.byMedia.length - byMedia.length,
        byMonthBucketsOmittedFromText: period.summary.byMonth.length,
      },
      coverage: projectComparisonCoverage(period.coverage),
      exclusions,
      exclusionsOmittedFromText: period.exclusions.length - exclusions.length,
      exclusionSampleIdsOmittedFromText: period.exclusions.reduce(
        (total, exclusion) => total + exclusion.sampleSubjectIds.length,
        0,
      ),
    };
  };
  const peakCountsAvailable =
    comparison.peak.state === 'complete' || comparison.peak.state === 'partial';
  const peakMonthLimit = Math.max(1, detailLimit);
  const peakMonths = peakCountsAvailable
    ? comparison.peak.months.slice(0, peakMonthLimit).map((month) => {
        const label = clippedDisplayText(month.month, textLimit);
        return {
          period: month.period,
          month: label.text,
          creditRows: month.creditRows,
          uniqueSubjects: month.uniqueSubjects,
          uniqueCharacters: month.uniqueCharacters,
          ...(label.clipped ? { monthTextTruncated: true } : {}),
        };
      })
    : [];
  const deltaCountsAvailable =
    comparison.delta.state === 'complete' || comparison.delta.state === 'partial';
  const deltaValues = {
    ...(comparison.delta.creditRows !== undefined
      ? { creditRows: comparison.delta.creditRows }
      : {}),
    ...(comparison.delta.uniqueSubjects !== undefined
      ? { uniqueSubjects: comparison.delta.uniqueSubjects }
      : {}),
    ...(comparison.delta.uniqueCharacters !== undefined
      ? { uniqueCharacters: comparison.delta.uniqueCharacters }
      : {}),
  };
  const deltaValuesOmittedDueToCoverage =
    comparison.delta.state === 'partial' && Object.keys(deltaValues).length === 0;
  const formatPeriodSummary = (label: string, period: typeof comparison.recent): string => {
    const window = `${period.window.start}至${period.window.end}`;
    const count = canExposeComparisonCounts(period)
      ? `本次观察${period.summary.uniqueSubjects}部`
      : `作品数未提供（rowsEligible=${period.coverage.rowsEligible}，不等于零）`;
    return `${label}窗口${window}（${period.state}）：${count}`;
  };
  const deltaUniqueSubjectsAvailable =
    (comparison.delta.state === 'complete' || comparison.delta.state === 'partial') &&
    comparison.delta.uniqueSubjects !== undefined;
  const deltaSummary = deltaUniqueSubjectsAvailable
    ? `差值（${comparison.delta.state}）${comparison.delta.uniqueSubjects}部，部分值仅代表本次观察`
    : comparison.delta.state === 'partial'
      ? '差值（partial）覆盖不足，未提供数值（不等于零）'
      : `差值（${comparison.delta.state}）未提供数值（不等于零）`;
  const answerPeakMonths = comparison.peak.months
    .slice(0, 3)
    .map(
      (month) =>
        `${month.month}（${month.period === 'recent' ? '最近窗口' : '前一窗口'}，观察${month.uniqueSubjects}部）`,
    );
  const omittedPeakMonths = Math.max(0, comparison.peak.months.length - answerPeakMonths.length);
  const peakSummary = answerPeakMonths.length
    ? `观察峰值（${comparison.peak.state}）${answerPeakMonths.join('、')}${omittedPeakMonths ? `等${omittedPeakMonths}个月` : ''}`
    : `峰值（${comparison.peak.state}）没有可报告月份`;
  const answerSummary = [
    formatPeriodSummary('最近', comparison.recent),
    formatPeriodSummary('前一', comparison.previous),
    deltaSummary,
    peakSummary,
    '以上是有界发布日期观察，不代表真实工作量、完整履历或历史趋势。',
  ].join('；');
  return {
    state: comparison.state,
    windowMonths: comparison.windowMonths,
    recent: projectPeriod(comparison.recent),
    previous: projectPeriod(comparison.previous),
    delta: {
      state: comparison.delta.state,
      ...(deltaCountsAvailable
        ? {
            ...deltaValues,
            ...(deltaValuesOmittedDueToCoverage ? { valuesOmittedDueToCoverage: true } : {}),
          }
        : { valuesOmittedDueToState: true }),
    },
    peak: {
      metric: comparison.peak.metric,
      state: comparison.peak.state,
      months: peakMonths,
      monthsOmittedFromText: comparison.peak.months.length - peakMonths.length,
    },
    sourceOperationsOmittedFromText:
      comparison.sourceOperations.recent.length + comparison.sourceOperations.previous.length,
    ...(includeAnswerSummary ? { answerSummary } : { answerSummaryOmittedFromText: true }),
    comparisonListItemsOmittedFromText:
      comparison.recent.summary.byRole.length -
      (canExposeComparisonCounts(comparison.recent)
        ? Math.min(detailLimit, comparison.recent.summary.byRole.length)
        : 0) +
      comparison.recent.summary.byMedia.length -
      (canExposeComparisonCounts(comparison.recent)
        ? Math.min(detailLimit, comparison.recent.summary.byMedia.length)
        : 0) +
      comparison.recent.summary.byMonth.length +
      comparison.recent.exclusions.length -
      Math.min(detailLimit, comparison.recent.exclusions.length) +
      comparison.previous.summary.byRole.length -
      (canExposeComparisonCounts(comparison.previous)
        ? Math.min(detailLimit, comparison.previous.summary.byRole.length)
        : 0) +
      comparison.previous.summary.byMedia.length -
      (canExposeComparisonCounts(comparison.previous)
        ? Math.min(detailLimit, comparison.previous.summary.byMedia.length)
        : 0) +
      comparison.previous.summary.byMonth.length +
      comparison.previous.exclusions.length -
      Math.min(detailLimit, comparison.previous.exclusions.length) +
      comparison.peak.months.length -
      peakMonths.length,
  };
}

function projectMinimalComparison(
  result: PersonActivityResult,
  textLimit = DISPLAY_TEXT_LIMIT,
  includeAnswerSummary = true,
) {
  const comparison = projectComparison(result, 0, textLimit, includeAnswerSummary, false);
  if (!comparison) return undefined;

  const { coverage: recentCoverage, ...recent } = comparison.recent;
  const { coverage: previousCoverage, ...previous } = comparison.previous;
  return {
    ...comparison,
    recent: {
      ...recent,
      coverage: { rowsEligible: recentCoverage.rowsEligible, detailsOmittedFromText: true },
    },
    previous: {
      ...previous,
      coverage: { rowsEligible: previousCoverage.rowsEligible, detailsOmittedFromText: true },
    },
  };
}

function createPersonActivityProjection(
  result: PersonActivityResult,
  rowLimit: number,
  monthLimit: number,
  warningLimit: number,
  limitationLimit: number,
  comparisonDetailLimit: number,
) {
  const rows = result.rows.slice(0, rowLimit).map(projectPersonRow);
  const messages = projectMessages(
    result.warnings,
    result.limitations,
    warningLimit,
    limitationLimit,
  );
  const comparison = projectComparison(result, comparisonDetailLimit);
  return {
    personId: result.personId,
    ...(result.person ? { person: projectPersonIdentity(result.person) } : {}),
    state: result.state,
    kind: result.kind,
    media: result.media,
    ...(result.staffRole ? { staffRole: result.staffRole } : {}),
    window: projectActivityWindow(result.window),
    summary: projectWindowSummary(result.summary, monthLimit),
    ...(comparison ? { comparison } : {}),
    coverage: projectPersonCoverage(result.coverage),
    rows,
    exclusions: result.exclusions.map(({ reason, count }) => ({ reason, count })),
    ...messages,
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      fullRowsReturned: result.rows.length,
      rowsIncluded: rows.length,
      rowsOmittedFromText: result.rows.length - rows.length,
      rowNamesTextTruncated: rows.filter((row) => row.displayNameTextTruncated === true).length,
      fullMonthBucketsReturned: result.summary.byMonth.length,
      monthBucketsIncluded: Math.min(result.summary.byMonth.length, monthLimit),
      monthBucketsOmittedFromText: Math.max(0, result.summary.byMonth.length - monthLimit),
      evidenceRecordsOmittedFromText: result.evidence.length,
      sourceOperationRecordsOmittedFromText: result.comparison
        ? result.sourceOperations.length +
          result.comparison.sourceOperations.recent.length +
          result.comparison.sourceOperations.previous.length
        : result.sourceOperations.length,
      coverageDetailFieldsOmittedFromText: [
        'coverage.detailConcurrency',
        'coverage.responseLimitBytes',
        'coverage.subjectIdsObserved/subjectIdsSelected/subjectIdsDroppedAtRelationLimit',
        'coverage.missingSubjectIdRows',
      ],
      exclusionSampleIdsOmittedFromText: result.exclusions.reduce(
        (total, exclusion) => total + exclusion.sampleSubjectIds.length,
        0,
      ),
    },
  };
}

function compactPersonActivity(result: PersonActivityResult): string {
  let rowLimit = Math.min(MAX_PERSON_ROWS, result.rows.length);
  let monthLimit = Math.min(MAX_MONTH_BUCKETS, result.summary.byMonth.length);
  let warningLimit = Math.min(MAX_WARNINGS, result.warnings.length);
  let limitationLimit = Math.min(MAX_LIMITATIONS, result.limitations.length);
  let comparisonDetailLimit = MAX_COMPARISON_DETAILS;

  while (true) {
    const projection = createPersonActivityProjection(
      result,
      rowLimit,
      monthLimit,
      warningLimit,
      limitationLimit,
      comparisonDetailLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (limitationLimit > 1) limitationLimit -= 1;
    else if (warningLimit > 1) warningLimit -= 1;
    else if (result.comparison && comparisonDetailLimit > 0) comparisonDetailLimit -= 1;
    else if (monthLimit > 3) monthLimit -= 1;
    else if (rowLimit > 1) rowLimit -= 1;
    else if (monthLimit > 0) monthLimit -= 1;
    else if (rowLimit > 0) rowLimit -= 1;
    else if (warningLimit > 0) warningLimit -= 1;
    else if (limitationLimit > 0) limitationLimit -= 1;
    else return minimalPersonActivityProjection(result);
  }
}

function minimalPersonActivityProjection(result: PersonActivityResult): string {
  const projection = {
    personId: result.personId,
    ...(result.person ? { person: projectPersonIdentity(result.person) } : {}),
    state: result.state,
    kind: result.kind,
    media: result.media,
    window: projectActivityWindow(result.window),
    ...(result.comparison ? { comparison: projectComparison(result, 0) } : {}),
    summary: {
      creditRows: result.summary.creditRows,
      uniqueSubjects: result.summary.uniqueSubjects,
      uniqueCharacters: result.summary.uniqueCharacters,
      origin: { ...result.summary.origin },
    },
    coverage: {
      relationRowsObserved: result.coverage.relationRowsObserved,
      relationRowsSelected: result.coverage.relationRowsSelected,
      rowsEligible: result.coverage.rowsEligible,
      rowsReturned: result.coverage.rowsReturned,
      uniqueSubjects: result.coverage.uniqueSubjects,
      truncated: result.coverage.truncated,
    },
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      rowsOmittedFromText: result.rows.length,
      evidenceRecordsOmittedFromText: result.evidence.length,
      sourceOperationRecordsOmittedFromText: result.sourceOperations.length,
      warningRecordsOmittedFromText: result.warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length,
      detail: 'Detailed rows and provenance are available in structuredContent.',
    },
  };
  const text = JSON.stringify(projection);
  if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

  let minimalText = JSON.stringify(
    createMinimalPersonActivityProjection(result, DISPLAY_TEXT_LIMIT, true),
  );
  if (utf8Bytes(minimalText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return minimalText;

  minimalText = JSON.stringify(
    createMinimalPersonActivityProjection(result, DISPLAY_TEXT_LIMIT, false),
  );
  if (utf8Bytes(minimalText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return minimalText;

  for (let textLimit = DISPLAY_TEXT_LIMIT - 1; textLimit >= 0; textLimit -= 1) {
    minimalText = JSON.stringify(createMinimalPersonActivityProjection(result, textLimit, false));
    if (utf8Bytes(minimalText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return minimalText;
  }

  throw new Error('Unable to produce bounded MCP person activity text projection');
}

function createMinimalPersonActivityProjection(
  result: PersonActivityResult,
  textLimit: number,
  includeAnswerSummary: boolean,
) {
  return {
    state: result.state,
    personId: result.personId,
    ...(result.person ? { person: projectPersonIdentity(result.person, textLimit) } : {}),
    kind: result.kind,
    media: result.media,
    window: projectActivityWindow(result.window, textLimit),
    ...(result.comparison
      ? { comparison: projectMinimalComparison(result, textLimit, includeAnswerSummary) }
      : {}),
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      warningRecordsOmittedFromText: result.warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length,
      summaryOmittedFromText: true,
    },
  };
}

function projectOverviewCoverage(coverage: SubjectOverviewResult['coverage']) {
  return {
    sourceRequestsAttempted: coverage.sourceRequestsAttempted,
    sourceRequestsSucceeded: coverage.sourceRequestsSucceeded,
    sectionsComplete: coverage.sectionsComplete,
    sectionsPartial: coverage.sectionsPartial,
    sectionsUnavailable: coverage.sectionsUnavailable,
    sectionsNotComputable: coverage.sectionsNotComputable,
    truncatedSections: [...coverage.truncatedSections],
    limits: { ...coverage.limits },
    actorLimits: { ...coverage.actorLimits },
  };
}

function projectOverviewSectionCoverage<T extends { state: string; coverage: unknown }>(
  section: T,
) {
  return {
    state: section.state,
    coverage: isJsonObject(section.coverage) ? { ...section.coverage } : section.coverage,
  };
}

function projectSubjectIdentity(subject: SubjectOverviewResult['subject']) {
  if (!subject) return undefined;
  const name = clippedDisplayText(subject.name);
  const nameCn = clippedDisplayText(subject.nameCn);
  return {
    id: subject.id,
    name: name.text,
    nameCn: nameCn.text,
    ...(name.clipped || nameCn.clipped ? { displayNameTextTruncated: true } : {}),
    type: subject.type,
    ...(subject.date ? { date: subject.date } : {}),
    ...(subject.platform ? { platform: subject.platform } : {}),
    ...(subject.eps ? { eps: subject.eps } : {}),
    ...(subject.totalEpisodes ? { totalEpisodes: subject.totalEpisodes } : {}),
  };
}

function projectOverviewStats(stats: SubjectOverviewResult['stats']) {
  const data = stats.data;
  return {
    ...projectOverviewSectionCoverage(stats),
    ...(data
      ? {
          data: {
            score: data.score,
            rank: data.rank,
            ratingTotal: data.ratingTotal,
            ratingHistogram: { ...data.ratingHistogram },
            ...(data.ratingHistogramPresence
              ? { ratingHistogramPresence: { ...data.ratingHistogramPresence } }
              : {}),
            collection: { ...data.collection },
            ...(data.collectionPresence
              ? { collectionPresence: { ...data.collectionPresence } }
              : {}),
          },
        }
      : {}),
    ...(stats.conflicts
      ? {
          conflicts: stats.conflicts.map((conflict) => {
            const reasons = clippedMessage(conflict.reason);
            return {
              state: conflict.state,
              reason: reasons.text,
              ...(reasons.clipped ? { reasonTextTruncated: true } : {}),
              candidateCount: conflict.candidates.length,
              candidateValuesOmittedFromText: true,
            };
          }),
        }
      : {}),
  };
}

function projectCastItem(item: SubjectOverviewResult['cast']['items'][number], actorLimit: number) {
  const characterName = clippedDisplayText(item.character.name);
  const actors = item.actors.slice(0, actorLimit).map((actor) => {
    const name = clippedDisplayText(actor.name);
    return {
      id: actor.id,
      name: name.text,
      career: [...actor.career],
      ...(name.clipped ? { displayNameTextTruncated: true } : {}),
    };
  });
  return {
    character: {
      id: item.character.id,
      name: characterName.text,
      type: item.character.type,
      ...(characterName.clipped ? { displayNameTextTruncated: true } : {}),
    },
    relation: item.relation,
    actors,
    actorCount: item.actors.length,
    actorCoverage: { ...item.actorCoverage },
  };
}

function projectStaffGroup(
  result: SubjectOverviewResult,
  group: SubjectOverviewResult['staff']['groups'][number],
  memberLimit: number,
) {
  const findMember = (id: number) =>
    result.staff.items.find(
      (member) => member.id === id && (member.rawRelation || member.relation) === group.relation,
    ) ?? result.staff.items.find((member) => member.id === id);
  const members = group.memberIds
    .map(findMember)
    .filter((member) => member !== undefined)
    .slice(0, memberLimit)
    .map((member) => {
      const name = clippedDisplayText(member.name);
      return {
        id: member.id,
        name: name.text,
        relation: member.rawRelation || member.relation,
        career: [...member.career],
        ...(name.clipped ? { displayNameTextTruncated: true } : {}),
      };
    });
  return {
    relation: group.relation,
    count: members.length,
    sourceCount: group.count,
    memberIds: members.map((member) => member.id),
    items: members,
    membersOmittedFromText: Math.max(0, group.memberIds.length - members.length),
  };
}

function projectRelationItem(item: SubjectOverviewResult['relations']['items'][number]) {
  const name = clippedDisplayText(item.name);
  const nameCn = clippedDisplayText(item.nameCn);
  return {
    id: item.id,
    type: item.type,
    name: name.text,
    nameCn: nameCn.text,
    relation: item.relation,
    ...(name.clipped || nameCn.clipped ? { displayNameTextTruncated: true } : {}),
  };
}

function createSubjectOverviewProjection(
  result: SubjectOverviewResult,
  castLimit: number,
  staffGroupLimit: number,
  staffMemberLimitPerGroup: number,
  relationLimit: number,
  warningLimit: number,
  limitationLimit: number,
) {
  const groupViews = result.staff.groups
    .slice(0, staffGroupLimit)
    .map((group) => projectStaffGroup(result, group, staffMemberLimitPerGroup));
  const groups = groupViews.map(
    ({ relation, count, sourceCount, memberIds, membersOmittedFromText }) => ({
      relation,
      count,
      sourceCount,
      memberIds,
      membersOmittedFromText,
    }),
  );
  const staffItems = groupViews.flatMap((group) => group.items);
  const messages = projectMessages(
    result.warnings,
    result.limitations,
    warningLimit,
    limitationLimit,
  );
  const castItems = result.cast.items
    .slice(0, castLimit)
    .map((item) => projectCastItem(item, MAX_ACTORS_PER_CHARACTER));
  const relationItems = result.relations.items.slice(0, relationLimit).map(projectRelationItem);

  return {
    state: result.state,
    subjectId: result.subjectId,
    ...(result.subject ? { subject: projectSubjectIdentity(result.subject) } : {}),
    stats: projectOverviewStats(result.stats),
    cast: {
      ...projectOverviewSectionCoverage(result.cast),
      actorCoverage: { ...result.cast.actorCoverage },
      items: castItems,
      actorCountOmittedFromText: result.cast.items.reduce(
        (total, item, index) =>
          total +
          (index < castLimit
            ? Math.max(0, item.actors.length - MAX_ACTORS_PER_CHARACTER)
            : item.actors.length),
        0,
      ),
    },
    staff: {
      ...projectOverviewSectionCoverage(result.staff),
      groups,
      items: staffItems,
    },
    relations: {
      ...projectOverviewSectionCoverage(result.relations),
      items: relationItems,
    },
    coverage: projectOverviewCoverage(result.coverage),
    ...messages,
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      castItemsReturned: result.cast.items.length,
      castItemsIncluded: castItems.length,
      castItemsOmittedFromText: result.cast.items.length - castItems.length,
      staffGroupsReturned: result.staff.groups.length,
      staffGroupsIncluded: groups.length,
      staffGroupsOmittedFromText: result.staff.groups.length - groups.length,
      staffMembersReturned: result.staff.items.length,
      staffMembersIncluded: staffItems.length,
      staffMembersOmittedFromText: Math.max(0, result.staff.items.length - staffItems.length),
      relationItemsReturned: result.relations.items.length,
      relationItemsIncluded: relationItems.length,
      relationItemsOmittedFromText: result.relations.items.length - relationItems.length,
      warningRecordsOmittedFromText: messages.warningsOmittedFromText,
      limitationRecordsOmittedFromText: messages.limitationsOmittedFromText,
      evidenceRecordsOmittedFromText: result.evidence.length,
      statsConflictCandidateCountOmittedFromText: (result.stats.conflicts ?? []).reduce(
        (total, conflict) => total + conflict.candidates.length,
        0,
      ),
      summaryOmittedFromText: Boolean(result.subject?.summary),
    },
  };
}

function compactSubjectOverview(result: SubjectOverviewResult): string {
  let castLimit = Math.min(MAX_SECTION_ITEMS, result.cast.items.length);
  let staffGroupLimit = Math.min(MAX_STAFF_GROUPS, result.staff.groups.length);
  let staffMemberLimitPerGroup = 1;
  let relationLimit = Math.min(MAX_SECTION_ITEMS, result.relations.items.length);
  let warningLimit = Math.min(MAX_WARNINGS, result.warnings.length);
  let limitationLimit = Math.min(MAX_LIMITATIONS, result.limitations.length);

  while (true) {
    const projection = createSubjectOverviewProjection(
      result,
      castLimit,
      staffGroupLimit,
      staffMemberLimitPerGroup,
      relationLimit,
      warningLimit,
      limitationLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (limitationLimit > 1) limitationLimit -= 1;
    else if (warningLimit > 1) warningLimit -= 1;
    else if (relationLimit > 1) relationLimit -= 1;
    else if (castLimit > 1) castLimit -= 1;
    else if (staffGroupLimit > 2) staffGroupLimit -= 1;
    else if (staffMemberLimitPerGroup > 0) staffMemberLimitPerGroup -= 1;
    else if (staffGroupLimit > 1) staffGroupLimit -= 1;
    else if (relationLimit > 0) relationLimit -= 1;
    else if (castLimit > 0) castLimit -= 1;
    else if (staffGroupLimit > 0) staffGroupLimit -= 1;
    else if (warningLimit > 0) warningLimit -= 1;
    else if (limitationLimit > 0) limitationLimit -= 1;
    else return minimalSubjectOverviewProjection(result);
  }
}

function minimalSubjectOverviewProjection(result: SubjectOverviewResult): string {
  const roleLabels = result.staff.groups
    .filter((group) => Array.from(group.relation).length <= MESSAGE_TEXT_LIMIT)
    .slice(0, 8)
    .map((group) => group.relation);
  const projection = {
    state: result.state,
    subjectId: result.subjectId,
    ...(result.subject ? { subject: projectSubjectIdentity(result.subject) } : {}),
    stats: {
      ...projectOverviewSectionCoverage(result.stats),
      ...(result.stats.data
        ? {
            data: {
              score: result.stats.data.score,
              rank: result.stats.data.rank,
              ratingTotal: result.stats.data.ratingTotal,
              collection: { ...result.stats.data.collection },
            },
          }
        : {}),
    },
    cast: projectOverviewSectionCoverage(result.cast),
    staff: {
      ...projectOverviewSectionCoverage(result.staff),
      roleLabels,
      roleLabelsOmittedFromText: Math.max(0, result.staff.groups.length - roleLabels.length),
    },
    relations: projectOverviewSectionCoverage(result.relations),
    coverage: projectOverviewCoverage(result.coverage),
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      castItemsOmittedFromText: result.cast.items.length,
      staffMembersOmittedFromText: result.staff.items.length,
      relationItemsOmittedFromText: result.relations.items.length,
      evidenceRecordsOmittedFromText: result.evidence.length,
      warningRecordsOmittedFromText: result.warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length,
      detail: 'Detailed rows and provenance are available in structuredContent.',
    },
  };
  const text = JSON.stringify(projection);
  return utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES
    ? text
    : JSON.stringify({
        state: result.state,
        subjectId: result.subjectId,
        mcpTextProjection: {
          version: 'mcp-text-projection-v1',
          maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
          structuredContentHasFullResult: true,
          textViewScope: TEXT_VIEW_SCOPE_NOTE,
          warningRecordsOmittedFromText: result.warnings.length,
          limitationRecordsOmittedFromText: result.limitations.length,
          summaryOmittedFromText: true,
        },
      });
}

function projectComparisonSource(
  source:
    SubjectComparisonResult['source']['official'] | SubjectComparisonResult['source']['derived'],
  operationLimit: number,
) {
  const operations = source.operations
    .slice(0, operationLimit)
    .map((operation) => clippedDisplayText(operation, MESSAGE_TEXT_LIMIT));
  return {
    class: source.class,
    operations: operations.map((operation) => operation.text),
    operationsOmittedFromText: Math.max(0, source.operations.length - operations.length),
    attemptedAt: source.attemptedAt,
    ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
  };
}

function projectComparisonConflict(
  conflict: {
    reason?: string;
    resolution?: string;
    candidates?: unknown[];
  },
  includeDetails = true,
) {
  const candidateCount = conflict.candidates?.length ?? 0;
  if (!includeDetails) {
    return {
      candidateCount,
      candidateValuesOmittedFromText: true,
      conflictDetailsOmittedFromText: true,
    };
  }
  const reason = clippedMessage(conflict.reason || '冲突原因未提供');
  const resolution = conflict.resolution ? clippedMessage(conflict.resolution) : undefined;
  return {
    reason: reason.text,
    ...(reason.clipped ? { reasonTextTruncated: true } : {}),
    ...(resolution
      ? {
          resolution: resolution.text,
          ...(resolution.clipped ? { resolutionTextTruncated: true } : {}),
        }
      : {}),
    candidateCount,
    candidateValuesOmittedFromText: true,
    conflictDetailsOmittedFromText: false,
  };
}

function projectComparisonFormula(
  formula: SubjectStatsIntelligenceResult['collection']['formulas']['completion'],
) {
  const description = clippedDisplayText(formula.description, MESSAGE_TEXT_LIMIT * 2);
  return {
    id: formula.id,
    version: formula.version,
    evidenceStatus: formula.evidenceStatus,
    description: description.text,
    ...(description.clipped ? { descriptionTextTruncated: true } : {}),
  };
}

function projectComparisonWarning(warning: {
  code: string;
  state: string;
  message: string;
  subjectId?: number;
}) {
  const message = clippedMessage(warning.message);
  return {
    code: warning.code,
    state: warning.state,
    ...(warning.subjectId === undefined ? {} : { subjectId: warning.subjectId }),
    message: message.text,
    ...(message.clipped ? { messageTextTruncated: true } : {}),
  };
}

function projectComparisonSubject(
  subject: SubjectComparisonResult['subjects'][number],
  warningLimit: number,
  limitationLimit: number,
) {
  const name = subject.subject
    ? clippedDisplayText(subject.subject.name, DISPLAY_TEXT_LIMIT / 5)
    : undefined;
  const nameCn = subject.subject?.nameCn
    ? clippedDisplayText(subject.subject.nameCn, DISPLAY_TEXT_LIMIT / 5)
    : undefined;
  const conflicts = Object.entries(subject.stats.conflicts || {}).flatMap(([metric, conflict]) =>
    conflict ? [{ metric, ...projectComparisonConflict(conflict) }] : [],
  );
  const warnings = subject.warnings.slice(0, warningLimit).map(projectComparisonWarning);
  const limitations = subject.limitations
    .slice(0, limitationLimit)
    .map((limitation) => clippedMessage(limitation));

  return {
    subjectId: subject.subjectId,
    state: subject.state,
    ...(subject.subject
      ? {
          subject: {
            id: subject.subject.id,
            type: subject.subject.type,
            name: name!.text,
            ...(name!.clipped ? { nameTextTruncated: true } : {}),
            ...(nameCn ? { nameCn: nameCn.text } : {}),
            ...(nameCn?.clipped ? { nameCnTextTruncated: true } : {}),
            ...(subject.subject.date ? { date: subject.subject.date } : {}),
            ...(subject.subject.platform ? { platform: subject.subject.platform } : {}),
            ...(subject.subject.episodesReported === undefined
              ? {}
              : { episodesReported: subject.subject.episodesReported }),
            ...(subject.subject.totalEpisodesReported === undefined
              ? {}
              : { totalEpisodesReported: subject.subject.totalEpisodesReported }),
          },
        }
      : {}),
    stats: {
      state: subject.stats.state,
      conflictCount: conflicts.length,
    },
    sections: { ...subject.sections },
    coverage: {
      truncatedSections: [...subject.coverage.truncatedSections],
      limits: {
        maxCast: subject.coverage.limits.maxCast,
        maxStaff: subject.coverage.limits.maxStaff,
        maxRelations: subject.coverage.limits.maxRelations,
      },
    },
    ...(subject.statistics
      ? {
          statistics: {
            state: subject.statistics.state,
            collection: {
              state: subject.statistics.collection.state,
              ...(subject.statistics.collection.completionRate === undefined
                ? {}
                : { completionRate: subject.statistics.collection.completionRate }),
              completionState: subject.statistics.collection.completionState,
              conflictCount: subject.statistics.collection.conflicts?.length ?? 0,
            },
            collectionCoverage: {
              expectedBuckets: subject.statistics.coverage.collectionBucketsExpected,
              observedBuckets: subject.statistics.coverage.collectionBucketsObserved,
            },
          },
        }
      : {}),
    warnings,
    warningRecordsOmittedFromText: subject.warnings.length - warnings.length,
    limitations: limitations.map((limitation) => limitation.text),
    limitationRecordsOmittedFromText: subject.limitations.length - limitations.length,
    ...(subject.error
      ? {
          error: {
            code: subject.error.code,
            message: clippedMessage(subject.error.message).text,
            ...(subject.error.retryable === undefined
              ? {}
              : { retryable: subject.error.retryable }),
            ...(subject.error.nextAction
              ? { nextAction: clippedMessage(subject.error.nextAction).text }
              : {}),
          },
        }
      : {}),
  };
}

function projectComparisonOverlap(
  overlap:
    SubjectComparisonResult['overlaps']['cast'] | SubjectComparisonResult['overlaps']['staff'],
) {
  return {
    state: overlap.state,
    sourceReturned: overlap.coverage.returned,
    sourceOmitted: overlap.coverage.omitted,
    truncated: overlap.coverage.truncated,
    itemsOmittedFromText: overlap.items.length,
  };
}

function createSubjectComparisonProjection(
  result: SubjectComparisonResult,
  warningLimit: number,
  limitationLimit: number,
  evidenceLimit: number,
  operationLimit: number,
  includeConflictDetails = true,
) {
  const warnings = result.warnings.slice(0, warningLimit).map(projectComparisonWarning);
  const limitations = result.limitations
    .slice(0, limitationLimit)
    .map((limitation) => clippedMessage(limitation).text);
  const evidence = result.evidence.slice(0, evidenceLimit).map((item) => ({
    source: item.source,
    operation: clippedDisplayText(item.operation, MESSAGE_TEXT_LIMIT).text,
    ...(item.attemptedAt ? { attemptedAt: item.attemptedAt } : {}),
    ...(item.retrievedAt ? { retrievedAt: item.retrievedAt } : {}),
    ...(item.formulaVersion ? { formulaVersion: item.formulaVersion } : {}),
    ...(item.subjectIds ? { subjectIds: [...item.subjectIds] } : {}),
  }));
  const projectedMetricKeys = new Set([
    'score',
    'episodesReported',
    'totalEpisodesReported',
    'collectionCompletionRate',
  ]);
  const metrics = result.metrics.filter((metric) => projectedMetricKeys.has(metric.key));
  const completionFormula = result.subjects.find((subject) => subject.statistics)?.statistics
    ?.collection.formulas.completion;

  return {
    state: result.state,
    subjectIds: [...result.subjectIds],
    subjects: result.subjects.map((subject) =>
      projectComparisonSubject(subject, warningLimit, limitationLimit),
    ),
    metrics: metrics.map((metric) => ({
      key: metric.key,
      values: [...metric.values],
      delta: metric.delta,
      deltaPrecision: metric.deltaPrecision,
      state: metric.state,
      ...(metric.conflicts
        ? {
            conflicts: metric.conflicts.map((conflict) => ({
              side: conflict.side,
              ...projectComparisonConflict(conflict, includeConflictDetails),
            })),
          }
        : {}),
    })),
    ...(completionFormula
      ? { collectionCompletionFormula: projectComparisonFormula(completionFormula) }
      : {}),
    overlaps: {
      cast: projectComparisonOverlap(result.overlaps.cast),
      staff: projectComparisonOverlap(result.overlaps.staff),
    },
    coverage: {
      requestedSubjects: result.coverage.requestedSubjects,
      returnedSubjects: result.coverage.returnedSubjects,
      metricsComplete: result.coverage.metricsComplete,
      metricsUnknown: result.coverage.metricsUnknown,
      metricsConflict: result.coverage.metricsConflict,
    },
    source: {
      official: projectComparisonSource(result.source.official, operationLimit),
      derived: projectComparisonSource(result.source.derived, operationLimit),
    },
    evidence,
    warnings,
    limitations,
    ...(result.error
      ? {
          error: {
            code: result.error.code,
            message: clippedMessage(result.error.message).text,
            ...(result.error.retryable === undefined ? {} : { retryable: result.error.retryable }),
            ...(result.error.nextAction
              ? { nextAction: clippedMessage(result.error.nextAction).text }
              : {}),
          },
        }
      : {}),
    mcpTextProjection: {
      version: 'subject-comparison-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: 'Omission is not evidence of absence; full structuredContent returned.',
      ratingDistributionBucketsOmittedFromText: result.subjects.reduce(
        (total, subject) => total + (subject.statistics?.rating.distribution.length ?? 0),
        0,
      ),
      metricsOmittedFromText: result.metrics.length - metrics.length,
      overlapItemsOmittedFromText:
        result.overlaps.cast.items.length + result.overlaps.staff.items.length,
      evidenceRecordsOmittedFromText: result.evidence.length - evidence.length,
      warningRecordsOmittedFromText: result.warnings.length - warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length - limitations.length,
      conflictDetailsOmittedFromText: includeConflictDetails
        ? 0
        : result.metrics.reduce((count, metric) => count + (metric.conflicts?.length ?? 0), 0),
    },
  };
}

function createMinimumSubjectComparisonProjection(result: SubjectComparisonResult) {
  const metricKeys = new Set([
    'score',
    'episodesReported',
    'totalEpisodesReported',
    'collectionCompletionRate',
  ]);
  const metrics = result.metrics.filter((metric) => metricKeys.has(metric.key));
  const conflictCount = result.metrics.reduce(
    (count, metric) => count + (metric.conflicts?.length ?? 0),
    0,
  );
  const sourceSummary = (
    source:
      SubjectComparisonResult['source']['official'] | SubjectComparisonResult['source']['derived'],
  ) => ({
    class: source.class,
    operation: clippedDisplayText(source.operations[0] ?? '', 48).text,
    operationCount: source.operations.length,
    operationsOmittedFromText: Math.max(0, source.operations.length - 1),
    attemptedAt: clippedDisplayText(source.attemptedAt, 32).text,
    ...(source.retrievedAt ? { retrievedAt: clippedDisplayText(source.retrievedAt, 32).text } : {}),
  });
  const completionFormula = result.subjects.find((subject) => subject.statistics)?.statistics
    ?.collection.formulas.completion;
  const evidenceRecordsOmitted = result.evidence.length;
  const warningRecordsOmitted = result.warnings.length;
  const limitationRecordsOmitted = result.limitations.length;
  const ratingBucketsOmitted = result.subjects.reduce(
    (total, subject) => total + (subject.statistics?.rating.distribution.length ?? 0),
    0,
  );
  const overlapItemsOmitted =
    result.overlaps.cast.items.length + result.overlaps.staff.items.length;

  return {
    state: result.state,
    subjectIds: [...result.subjectIds],
    subjects: result.subjects.map((subject) => {
      const name = subject.subject ? clippedDisplayText(subject.subject.name, 64) : undefined;
      const nameCn = subject.subject?.nameCn
        ? clippedDisplayText(subject.subject.nameCn, 64)
        : undefined;
      const statConflicts = Object.values(subject.stats.conflicts ?? {}).filter(Boolean).length;
      return {
        subjectId: subject.subjectId,
        state: subject.state,
        ...(subject.subject
          ? {
              subject: {
                id: subject.subject.id,
                type: subject.subject.type,
                name: name!.text,
                ...(name!.clipped ? { nameTextTruncated: true } : {}),
                ...(nameCn ? { nameCn: nameCn.text } : {}),
                ...(nameCn?.clipped ? { nameCnTextTruncated: true } : {}),
                ...(subject.subject.episodesReported === undefined
                  ? {}
                  : { episodesReported: subject.subject.episodesReported }),
                ...(subject.subject.totalEpisodesReported === undefined
                  ? {}
                  : { totalEpisodesReported: subject.subject.totalEpisodesReported }),
              },
            }
          : {}),
        stats: { state: subject.stats.state, conflictCount: statConflicts },
        coverage: {
          truncatedSections: [...subject.coverage.truncatedSections],
          limits: { ...subject.coverage.limits },
        },
        ...(subject.statistics
          ? {
              statistics: {
                state: subject.statistics.state,
                collection: {
                  state: subject.statistics.collection.state,
                  ...(subject.statistics.collection.completionRate === undefined
                    ? {}
                    : { completionRate: subject.statistics.collection.completionRate }),
                  completionState: subject.statistics.collection.completionState,
                  conflictCount: subject.statistics.collection.conflicts?.length ?? 0,
                },
                collectionCoverage: {
                  expectedBuckets: subject.statistics.coverage.collectionBucketsExpected,
                  observedBuckets: subject.statistics.coverage.collectionBucketsObserved,
                },
              },
            }
          : {}),
        warningRecordsOmittedFromText: subject.warnings.length,
        limitationRecordsOmittedFromText: subject.limitations.length,
      };
    }),
    metrics: metrics.map((metric) => ({
      key: metric.key,
      values: [...metric.values],
      delta: metric.delta,
      deltaPrecision: metric.deltaPrecision,
      state: metric.state,
      ...(metric.conflicts?.length
        ? {
            conflicts: metric.conflicts.map((conflict) => ({
              side: conflict.side,
              candidateCount: conflict.candidates?.length ?? 0,
              candidateValuesOmittedFromText: true,
              conflictDetailsOmittedFromText: true,
            })),
          }
        : {}),
    })),
    ...(completionFormula
      ? {
          collectionCompletionFormula: {
            id: clippedDisplayText(completionFormula.id, 40).text,
            version: completionFormula.version,
            evidenceStatus: completionFormula.evidenceStatus,
            description: clippedDisplayText(completionFormula.description, 96).text,
          },
        }
      : {}),
    overlaps: {
      cast: projectComparisonOverlap(result.overlaps.cast),
      staff: projectComparisonOverlap(result.overlaps.staff),
    },
    coverage: {
      requestedSubjects: result.coverage.requestedSubjects,
      returnedSubjects: result.coverage.returnedSubjects,
      subjectsComplete: result.coverage.subjectsComplete,
      subjectsPartial: result.coverage.subjectsPartial,
      subjectsUnavailable: result.coverage.subjectsUnavailable,
      subjectsNotFound: result.coverage.subjectsNotFound,
      metricsComplete: result.coverage.metricsComplete,
      metricsUnknown: result.coverage.metricsUnknown,
      metricsConflict: result.coverage.metricsConflict,
    },
    source: {
      official: sourceSummary(result.source.official),
      derived: sourceSummary(result.source.derived),
    },
    mcpTextProjection: {
      version: 'subject-comparison-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: 'Minimum bounded text; omitted details remain in full structuredContent.',
      ratingDistributionBucketsOmittedFromText: ratingBucketsOmitted,
      metricsOmittedFromText: result.metrics.length - metrics.length,
      overlapItemsOmittedFromText: overlapItemsOmitted,
      evidenceRecordsOmittedFromText: evidenceRecordsOmitted,
      warningRecordsOmittedFromText: warningRecordsOmitted,
      limitationRecordsOmittedFromText: limitationRecordsOmitted,
      conflictDetailsOmittedFromText: conflictCount,
      sourceOperationsOmittedFromText:
        Math.max(0, result.source.official.operations.length - 1) +
        Math.max(0, result.source.derived.operations.length - 1),
    },
  };
}

function compactSubjectComparison(result: SubjectComparisonResult): string {
  let warningLimit = Math.min(MAX_WARNINGS, result.warnings.length);
  let limitationLimit = Math.min(MAX_LIMITATIONS, result.limitations.length);
  let evidenceLimit = Math.min(2, result.evidence.length);
  let operationLimit = 1;
  let includeConflictDetails = true;

  while (true) {
    const projection = createSubjectComparisonProjection(
      result,
      warningLimit,
      limitationLimit,
      evidenceLimit,
      operationLimit,
      includeConflictDetails,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (evidenceLimit > 0) evidenceLimit -= 1;
    else if (limitationLimit > 0) limitationLimit -= 1;
    else if (warningLimit > 0) warningLimit -= 1;
    else if (operationLimit > 1) operationLimit -= 1;
    else if (includeConflictDetails) includeConflictDetails = false;
    else {
      const minimumText = JSON.stringify(createMinimumSubjectComparisonProjection(result));
      if (utf8Bytes(minimumText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return minimumText;
      throw new Error('Minimum subject-comparison MCP text projection exceeded its byte limit');
    }
  }
}

function projectSubjectStaffGroup(
  result: SubjectStaffToolResult,
  group: SubjectStaffGroup,
  memberLimit: number,
  textLimit: number,
) {
  const relation = clippedDisplayText(group.relation, textLimit);
  const findMember = (id: number) =>
    result.productionStaff.find(
      (member) => member.id === id && member.relation === group.relation,
    ) ?? result.productionStaff.find((member) => member.id === id);
  const members = group.memberIds
    .slice(0, memberLimit)
    .map(findMember)
    .filter((member): member is SubjectStaffMember => member !== undefined)
    .map((member) => {
      const name = clippedDisplayText(member.name, textLimit);
      const rawRelationSource = member.rawRelation ?? member.relation;
      const rawRelation = clippedDisplayText(rawRelationSource, textLimit);
      return {
        id: member.id,
        name: name.text,
        ...(rawRelationSource !== group.relation ? { rawRelation: rawRelation.text } : {}),
        ...(name.clipped ? { nameTruncated: true } : {}),
        ...(rawRelationSource !== group.relation && rawRelation.clipped
          ? { rawRelationTextTruncated: true }
          : {}),
      };
    });
  return {
    relation: relation.text,
    count: group.count,
    members,
    ...(relation.clipped ? { relationTextTruncated: true } : {}),
  };
}

function projectSubjectStaffCastItem(item: SubjectCastItem, actorLimit: number, textLimit: number) {
  const characterName = clippedDisplayText(item.character.name, textLimit);
  const relation = clippedDisplayText(item.relation, textLimit);
  const actors = item.actors.slice(0, actorLimit).map((actor) => {
    const name = clippedDisplayText(actor.name, textLimit);
    return {
      id: actor.id,
      name: name.text,
      ...(name.clipped ? { displayNameTextTruncated: true } : {}),
    };
  });
  return {
    character: {
      id: item.character.id,
      name: characterName.text,
      type: item.character.type,
      ...(characterName.clipped ? { displayNameTextTruncated: true } : {}),
    },
    relation: relation.text,
    ...(relation.clipped ? { relationTextTruncated: true } : {}),
    actors,
    actorCount: item.actors.length,
    actorsOmittedFromText: Math.max(0, item.actors.length - actors.length),
  };
}

function createSubjectStaffProjection(
  result: SubjectStaffToolResult,
  groupLimit: number,
  membersPerGroup: number,
  castLimit: number,
  actorsPerCharacter: number,
  textLimit: number,
) {
  const groups = result.groups
    .slice(0, groupLimit)
    .map((group) => projectSubjectStaffGroup(result, group, membersPerGroup, textLimit));
  const castItems = result.cast
    .slice(0, castLimit)
    .map((item) => projectSubjectStaffCastItem(item, actorsPerCharacter, textLimit));
  const groupMembershipsReturned = result.groups.reduce(
    (total, group) => total + group.memberIds.length,
    0,
  );
  const groupMembershipsIncluded = groups.reduce((total, group) => total + group.members.length, 0);
  const castActorsReturned = result.cast.reduce((total, item) => total + item.actors.length, 0);
  const castActorsIncluded = castItems.reduce((total, item) => total + item.actors.length, 0);

  return {
    state: result.state,
    subjectId: result.subjectId,
    productionStaff: { groups },
    cast: { items: castItems },
    coverage: {
      state: result.coverage.state,
      retrievedAt: result.coverage.retrievedAt,
      productionStaff: { ...result.coverage.productionStaff },
      cast: { ...result.coverage.cast },
      limit: result.coverage.limit,
    },
    capabilityStates: { ...result.capabilityStates },
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      staffGroupsOmittedFromText: result.groups.length - groups.length,
      staffGroupMembershipsOmittedFromText: Math.max(
        0,
        groupMembershipsReturned - groupMembershipsIncluded,
      ),
      castItemsOmittedFromText: result.cast.length - castItems.length,
      castActorsOmittedFromText: Math.max(0, castActorsReturned - castActorsIncluded),
      staffMemberDetailsOmittedFromText: true,
      castCharacterDetailsOmittedFromText: true,
      evidenceRecordsOmittedFromText: result.evidence.length,
      warningRecordsOmittedFromText: result.warnings.length,
    },
  };
}

function compactSubjectStaff(result: SubjectStaffToolResult): string {
  let groupLimit = result.groups.length;
  let membersPerGroup = Math.min(2, result.productionStaff.length);
  let castLimit = Math.min(MAX_SECTION_ITEMS, result.cast.length);
  let actorsPerCharacter = MAX_ACTORS_PER_CHARACTER;
  let textLimit = DISPLAY_TEXT_LIMIT;

  while (true) {
    const projection = createSubjectStaffProjection(
      result,
      groupLimit,
      membersPerGroup,
      castLimit,
      actorsPerCharacter,
      textLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (actorsPerCharacter > 1) actorsPerCharacter -= 1;
    else if (castLimit > 2) castLimit -= 1;
    else if (membersPerGroup > 1) membersPerGroup -= 1;
    else if (textLimit > 8) textLimit = Math.max(8, textLimit - 8);
    else if (castLimit > 0) castLimit -= 1;
    else if (groupLimit > 1) groupLimit -= 1;
    else if (membersPerGroup > 0) membersPerGroup -= 1;
    else if (textLimit > 0) textLimit -= 1;
    else if (groupLimit > 0) groupLimit -= 1;
    else throw new Error('Unable to produce bounded MCP subject staff text projection');
  }
}

function createSubjectCastProjection(
  result: SubjectCastResult,
  castLimit: number,
  actorsPerCharacter: number,
  textLimit: number,
) {
  const cast = result.cast
    .slice(0, castLimit)
    .map((item) => projectSubjectStaffCastItem(item, actorsPerCharacter, textLimit));
  const actorRowsReturned = result.cast.reduce((total, item) => total + item.actors.length, 0);
  const actorRowsIncluded = cast.reduce((total, item) => total + item.actors.length, 0);

  return {
    status: result.status,
    subjectId: result.subjectId,
    coverage: {
      observed: result.observed,
      returned: result.returned,
      truncated: result.truncated,
      schemaDriftRows: result.schemaDriftRows,
      invalidActorIdRows: result.invalidActorIdRows,
    },
    cast,
    mcpTextProjection: {
      version: 'mcp-text-projection-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      textViewScope: TEXT_VIEW_SCOPE_NOTE,
      castRowsReturned: result.cast.length,
      castRowsIncluded: cast.length,
      castRowsOmittedFromText: result.cast.length - cast.length,
      actorRowsReturned,
      actorRowsIncluded,
      actorRowsOmittedFromText: Math.max(0, actorRowsReturned - actorRowsIncluded),
      characterNamesTruncated: cast.filter(
        (item) => item.character.displayNameTextTruncated === true,
      ).length,
      relationLabelsTruncated: cast.filter((item) => item.relationTextTruncated === true).length,
      actorNamesTruncated: cast.reduce(
        (total, item) =>
          total + item.actors.filter((actor) => actor.displayNameTextTruncated === true).length,
        0,
      ),
      characterSummariesAndImagesOmittedFromText: true,
      actorCareersAndImagesOmittedFromText: true,
    },
  };
}

function compactSubjectCast(result: SubjectCastResult): string {
  let castLimit = Math.min(MAX_SECTION_ITEMS, result.cast.length);
  let actorsPerCharacter = MAX_ACTORS_PER_CHARACTER;
  let textLimit = DISPLAY_TEXT_LIMIT;

  while (true) {
    const projection = createSubjectCastProjection(
      result,
      castLimit,
      actorsPerCharacter,
      textLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (actorsPerCharacter > 1) actorsPerCharacter -= 1;
    else if (castLimit > 1) castLimit -= 1;
    else if (textLimit > 8) textLimit = Math.max(8, textLimit - 8);
    else if (castLimit > 0) castLimit -= 1;
    else if (actorsPerCharacter > 0) actorsPerCharacter -= 1;
    else if (textLimit > 0) textLimit -= 1;
    else throw new Error('Unable to produce bounded MCP subject cast text projection');
  }
}

const SERIES_WATCH_ORDER_SCOPE_NOTE =
  'Bounded deterministic recommendation; not one official order. Omitted rows do not prove absence.';

interface SeriesProjectionOptions {
  orderLimit: number;
  relatedLimit: number;
  edgeLimit: number;
  exclusionSampleLimit: number;
  sourceLimit: number;
  warningLimit: number;
  limitationLimit: number;
  labelLimit: number;
  kindLimit: number;
  nameCharacters: number;
  labelCharacters: number;
  includeNameCn: boolean;
  includePlacementReason: boolean;
}

interface MinimumSeriesProjectionOptions {
  orderLimit: number;
  nameCharacters: number;
  labelCharacters: number;
  metadataTextCharacters: number;
  truncationReasonLimit: number;
  sourceLimit: number;
  warningLimit: number;
  limitationLimit: number;
  includeCapabilityState: boolean;
}

function compactSeriesWatchOrder(result: SeriesWatchOrderResult): string {
  const options: SeriesProjectionOptions = {
    orderLimit: Math.min(17, result.watchOrder.length),
    relatedLimit: Math.min(6, result.related.length),
    edgeLimit: Math.min(8, result.edges.length),
    exclusionSampleLimit: Math.min(2, result.excluded.samples.length),
    sourceLimit: Math.min(2, result.evidence.sources.length),
    warningLimit: Math.min(2, result.warnings.length),
    limitationLimit: Math.min(2, result.limitations.length),
    labelLimit: 3,
    kindLimit: 3,
    nameCharacters: 72,
    labelCharacters: 48,
    includeNameCn: true,
    includePlacementReason: true,
  };

  while (true) {
    const projection = createSeriesWatchOrderProjection(result, options);
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (options.relatedLimit > 0) options.relatedLimit = Math.floor(options.relatedLimit / 2);
    else if (options.exclusionSampleLimit > 0) options.exclusionSampleLimit -= 1;
    else if (options.sourceLimit > 0) options.sourceLimit -= 1;
    else if (options.warningLimit > 1) options.warningLimit -= 1;
    else if (options.limitationLimit > 1) options.limitationLimit -= 1;
    else if (options.edgeLimit > 1) options.edgeLimit = Math.floor(options.edgeLimit / 2);
    else if (options.includePlacementReason) options.includePlacementReason = false;
    else if (options.includeNameCn) options.includeNameCn = false;
    else if (options.nameCharacters > 12)
      options.nameCharacters = Math.floor(options.nameCharacters / 2);
    else if (options.labelCharacters > 12)
      options.labelCharacters = Math.floor(options.labelCharacters / 2);
    else if (options.labelLimit > 1) options.labelLimit -= 1;
    else if (options.kindLimit > 1) options.kindLimit -= 1;
    else if (options.orderLimit > Math.min(4, result.watchOrder.length)) options.orderLimit -= 1;
    else if (options.nameCharacters > 0) options.nameCharacters -= 1;
    else if (options.orderLimit > 1) options.orderLimit -= 1;
    else if (options.edgeLimit > 0) options.edgeLimit = 0;
    else return compactMinimumSeriesWatchOrder(result);
  }
}

function compactMinimumSeriesWatchOrder(result: SeriesWatchOrderResult): string {
  const options: MinimumSeriesProjectionOptions = {
    orderLimit: Math.min(17, result.watchOrder.length),
    nameCharacters: 12,
    labelCharacters: 12,
    metadataTextCharacters: 48,
    truncationReasonLimit: 2,
    sourceLimit: 1,
    warningLimit: 1,
    limitationLimit: 1,
    includeCapabilityState: true,
  };

  while (true) {
    const text = JSON.stringify(createMinimumSeriesWatchOrderProjection(result, options));
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (options.orderLimit > 1)
      options.orderLimit = Math.max(1, Math.floor(options.orderLimit / 2));
    else if (options.nameCharacters > 0) options.nameCharacters -= 1;
    else if (options.labelCharacters > 0) options.labelCharacters -= 1;
    else if (options.metadataTextCharacters > 0) options.metadataTextCharacters -= 1;
    else if (options.truncationReasonLimit > 0) options.truncationReasonLimit -= 1;
    else if (options.sourceLimit > 0) options.sourceLimit -= 1;
    else if (options.warningLimit > 0) options.warningLimit -= 1;
    else if (options.limitationLimit > 0) options.limitationLimit -= 1;
    else if (options.includeCapabilityState) options.includeCapabilityState = false;
    else {
      const minimalText = JSON.stringify(createBareMinimumSeriesWatchOrderProjection(result));
      if (utf8Bytes(minimalText) > MCP_TOOL_TEXT_MAX_UTF8_BYTES) {
        throw new Error('Unable to produce bounded MCP series watch-order text');
      }
      return minimalText;
    }
  }
}

function createSeriesWatchOrderProjection(
  result: SeriesWatchOrderResult,
  options: SeriesProjectionOptions,
) {
  const clipped = {
    displayNames: 0,
    relationLabels: 0,
    pathLabels: 0,
    placementReasons: 0,
    warnings: 0,
    limitations: 0,
    sourceText: 0,
  };
  const omitted = {
    nameCnFields: 0,
    placementReasons: 0,
  };
  const projectText = (value: string, limit: number, field: keyof typeof clipped): string => {
    const projection = clippedDisplayText(value, limit);
    if (projection.clipped) clipped[field] += 1;
    return projection.text;
  };
  const projectLabels = (labels: string[]) =>
    labels
      .slice(0, options.labelLimit)
      .map((label) => projectText(label, options.labelCharacters, 'relationLabels'));
  const projectPath = (path: SeriesWatchOrderResult['edges'][number]) => ({
    fromId: path.fromId,
    toId: path.toId,
    depth: path.depth,
    relation: projectText(path.relation, options.labelCharacters, 'pathLabels'),
    relationKind: path.relationKind,
    pathIds: path.pathIds.slice(0, 3),
    pathIdsOmittedFromText: Math.max(0, path.pathIds.length - 3),
    pathKinds: path.pathKinds.slice(0, 3),
    direct: path.direct,
  });
  const projectOrderItem = (item: SeriesWatchOrderResult['watchOrder'][number]) => {
    const name = projectText(item.name, options.nameCharacters, 'displayNames');
    if (!options.includeNameCn && item.nameCn) omitted.nameCnFields += 1;
    const nameCn = options.includeNameCn
      ? projectText(item.nameCn, options.nameCharacters, 'displayNames')
      : undefined;
    const relationLabels = projectLabels(item.relationLabels);
    if (!options.includePlacementReason && item.placementReason) omitted.placementReasons += 1;
    const placementReason = options.includePlacementReason
      ? projectText(item.placementReason, 56, 'placementReasons')
      : undefined;
    return {
      id: item.id,
      type: item.type,
      name,
      ...(nameCn ? { nameCn } : {}),
      ...(item.date ? { date: item.date } : {}),
      position: item.position,
      placement: item.placement,
      ...(placementReason ? { placementReason } : {}),
      ...(item.derivedDepth === undefined ? {} : { derivedDepth: item.derivedDepth }),
      relationLabels,
      relationLabelsOmittedFromText: Math.max(
        0,
        item.relationLabels.length - relationLabels.length,
      ),
      relationKinds: item.relationKinds.slice(0, options.kindLimit),
      relationKindsOmittedFromText: Math.max(0, item.relationKinds.length - options.kindLimit),
      relationPaths: item.relationPaths.slice(0, 1).map(projectPath),
      relationPathsOmittedFromText: Math.max(0, item.relationPaths.length - 1),
    };
  };
  const projectNode = (item: SeriesWatchOrderResult['root']) => {
    const name = projectText(item.name, options.nameCharacters, 'displayNames');
    if (!options.includeNameCn && item.nameCn) omitted.nameCnFields += 1;
    const nameCn = options.includeNameCn
      ? projectText(item.nameCn, options.nameCharacters, 'displayNames')
      : undefined;
    const relationLabels = projectLabels(item.relationLabels);
    return {
      id: item.id,
      type: item.type,
      name,
      ...(nameCn ? { nameCn } : {}),
      ...(item.date ? { date: item.date } : {}),
      relationLabels,
      relationLabelsOmittedFromText: Math.max(
        0,
        item.relationLabels.length - relationLabels.length,
      ),
      relationKinds: item.relationKinds.slice(0, options.kindLimit),
      relationKindsOmittedFromText: Math.max(0, item.relationKinds.length - options.kindLimit),
    };
  };
  const projectRelated = (item: SeriesWatchOrderResult['related'][number]) => {
    const name = projectText(item.name, options.nameCharacters, 'displayNames');
    if (!options.includeNameCn && item.nameCn) omitted.nameCnFields += 1;
    const nameCn = options.includeNameCn
      ? projectText(item.nameCn, options.nameCharacters, 'displayNames')
      : undefined;
    const relationLabels = projectLabels(item.relationLabels);
    return {
      id: item.id,
      type: item.type,
      name,
      ...(nameCn ? { nameCn } : {}),
      depth: item.depth,
      includedInWatchOrder: item.includedInWatchOrder,
      ...(item.exclusionReason ? { exclusionReason: item.exclusionReason } : {}),
      relationLabels,
      relationLabelsOmittedFromText: Math.max(
        0,
        item.relationLabels.length - relationLabels.length,
      ),
      relationKinds: item.relationKinds.slice(0, options.kindLimit),
      relationKindsOmittedFromText: Math.max(0, item.relationKinds.length - options.kindLimit),
      relationPathsOmittedFromText: item.relationPaths.length,
    };
  };
  const projectExclusionSample = (item: SeriesWatchOrderResult['excluded']['samples'][number]) => {
    const name = projectText(item.name, options.nameCharacters, 'displayNames');
    if (!options.includeNameCn && item.nameCn) omitted.nameCnFields += 1;
    const nameCn = options.includeNameCn
      ? projectText(item.nameCn, options.nameCharacters, 'displayNames')
      : undefined;
    const relationLabels = projectLabels(item.relationLabels);
    return {
      id: item.id,
      type: item.type,
      name,
      ...(nameCn ? { nameCn } : {}),
      relationLabels,
      relationLabelsOmittedFromText: Math.max(
        0,
        item.relationLabels.length - relationLabels.length,
      ),
      reason: item.reason,
      relationPathsOmittedFromText: item.relationPaths.length,
    };
  };

  const watchOrder = result.watchOrder.slice(0, options.orderLimit).map(projectOrderItem);
  const related = result.related.slice(0, options.relatedLimit).map(projectRelated);
  const edges = result.edges.slice(0, options.edgeLimit).map(projectPath);
  const exclusionSamples = result.excluded.samples
    .slice(0, options.exclusionSampleLimit)
    .map(projectExclusionSample);
  const sources = result.evidence.sources.slice(0, options.sourceLimit).map((source) => ({
    operation: projectText(source.operation, 56, 'sourceText'),
    path: projectText(source.path, 72, 'sourceText'),
    status: source.status,
    subjectId: source.subjectId,
    ...(source.depth === undefined ? {} : { depth: source.depth }),
  }));
  const warnings = result.warnings
    .slice(0, options.warningLimit)
    .map((warning) => projectText(warning, 120, 'warnings'));
  const limitations = result.limitations
    .slice(0, options.limitationLimit)
    .map((limitation) => projectText(limitation, 160, 'limitations'));
  const pathRowsReturned =
    result.root.relationPaths.length +
    result.watchOrder.reduce((total, item) => total + item.relationPaths.length, 0) +
    result.related.reduce((total, item) => total + item.relationPaths.length, 0) +
    result.excluded.samples.reduce((total, item) => total + item.relationPaths.length, 0);
  const root = projectNode(result.root);
  const relationLabelsOmittedFromText =
    root.relationLabelsOmittedFromText +
    watchOrder.reduce((total, item) => total + item.relationLabelsOmittedFromText, 0) +
    related.reduce((total, item) => total + item.relationLabelsOmittedFromText, 0) +
    exclusionSamples.reduce((total, item) => total + item.relationLabelsOmittedFromText, 0);
  const relationKindsOmittedFromText =
    root.relationKindsOmittedFromText +
    watchOrder.reduce((total, item) => total + item.relationKindsOmittedFromText, 0) +
    related.reduce((total, item) => total + item.relationKindsOmittedFromText, 0);
  const relationPathsOmittedFromText =
    result.root.relationPaths.length +
    watchOrder.reduce((total, item) => total + item.relationPathsOmittedFromText, 0) +
    related.reduce((total, item) => total + item.relationPathsOmittedFromText, 0) +
    exclusionSamples.reduce((total, item) => total + item.relationPathsOmittedFromText, 0);

  return {
    state: result.state,
    subjectId: result.subjectId,
    root,
    capabilityStates: { ...result.capabilityStates },
    watchOrder,
    related,
    edges,
    excluded: {
      count: result.excluded.count,
      byReason: result.excluded.byReason.slice(0, 8).map((item) => ({
        reason: item.reason,
        count: item.count,
      })),
      byReasonOmittedFromText: Math.max(0, result.excluded.byReason.length - 8),
      samples: exclusionSamples,
      samplesOmittedFromText: result.excluded.samples.length - exclusionSamples.length,
    },
    coverage: {
      depth: result.coverage.depth,
      maxNodes: result.coverage.maxNodes,
      media: result.coverage.media,
      animeNodeLimit: result.coverage.animeNodeLimit,
      nonAnimeEvidenceLimit: result.coverage.nonAnimeEvidenceLimit,
      relatedLimit: result.coverage.relatedLimit,
      relationRequests: result.coverage.relationRequests,
      relationRowsObserved: result.coverage.relationRowsObserved,
      uniqueRelatedObserved: result.coverage.uniqueRelatedObserved,
      uniqueRelatedReturned: result.coverage.uniqueRelatedReturned,
      animeNodesObserved: result.coverage.animeNodesObserved,
      animeNodesSelected: result.coverage.animeNodesSelected,
      nonAnimeRowsObserved: result.coverage.nonAnimeRowsObserved,
      nonAnimeRowsReturned: result.coverage.nonAnimeRowsReturned,
      detailsAttempted: result.coverage.detailsAttempted,
      detailsFetched: result.coverage.detailsFetched,
      detailsFailed: result.coverage.detailsFailed,
      relationFailures: result.coverage.relationFailures,
      edgeEvidenceLimit: result.coverage.edgeEvidenceLimit,
      edgeEvidenceReturned: result.coverage.edgeEvidenceReturned,
      edgeEvidenceTruncated: result.coverage.edgeEvidenceTruncated,
      relatedEvidenceTruncated: result.coverage.relatedEvidenceTruncated,
      truncated: result.coverage.truncated,
      truncationReasons: result.coverage.truncationReasons.slice(0, 4),
      truncationReasonsOmittedFromText: Math.max(0, result.coverage.truncationReasons.length - 4),
      retrievedAt: result.coverage.retrievedAt,
    },
    evidence: {
      derivation: result.evidence.derivation,
      retrievedAt: result.evidence.retrievedAt,
      sources,
      sourceOperationsOmittedFromText: result.evidence.sources.length - sources.length,
    },
    warnings,
    warningsOmittedFromText: result.warnings.length - warnings.length,
    limitations,
    limitationsOmittedFromText: result.limitations.length - limitations.length,
    mcpTextProjection: {
      version: 'series-watch-order-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      fullResultUtf8Bytes: utf8Bytes(JSON.stringify(result, null, 2)),
      structuredContentHasFullResult: true,
      textViewScope: SERIES_WATCH_ORDER_SCOPE_NOTE,
      watchOrderRowsReturned: result.watchOrder.length,
      watchOrderRowsIncluded: watchOrder.length,
      watchOrderRowsOmittedFromText: result.watchOrder.length - watchOrder.length,
      relatedRowsReturned: result.related.length,
      relatedRowsIncluded: related.length,
      relatedRowsOmittedFromText: result.related.length - related.length,
      edgeRowsReturned: result.edges.length,
      edgeRowsIncluded: edges.length,
      edgeRowsOmittedFromText: result.edges.length - edges.length,
      relationPathRowsReturned: pathRowsReturned,
      exclusionSamplesReturned: result.excluded.samples.length,
      exclusionSamplesIncluded: exclusionSamples.length,
      exclusionSamplesOmittedFromText: result.excluded.samples.length - exclusionSamples.length,
      exclusionReasonRowsOmittedFromText: Math.max(0, result.excluded.byReason.length - 8),
      sourceOperationsReturned: result.evidence.sources.length,
      sourceOperationsIncluded: sources.length,
      sourceOperationsOmittedFromText: result.evidence.sources.length - sources.length,
      warningRecordsOmittedFromText: result.warnings.length - warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length - limitations.length,
      displayNamesTruncated: clipped.displayNames,
      relationLabelsTruncated: clipped.relationLabels + clipped.pathLabels,
      relationLabelsOmittedFromText,
      relationKindsOmittedFromText,
      relationPathsOmittedFromText,
      placementReasonsTruncated: clipped.placementReasons,
      nameCnFieldsOmittedFromText: omitted.nameCnFields,
      placementReasonsOmittedFromText: omitted.placementReasons,
      sourceTextTruncated: clipped.sourceText,
      warningTextTruncated: clipped.warnings,
      limitationTextTruncated: clipped.limitations,
    },
  };
}

function createMinimumSeriesWatchOrderProjection(
  result: SeriesWatchOrderResult,
  options: MinimumSeriesProjectionOptions,
) {
  let displayNamesTruncated = 0;
  let relationLabelsTruncated = 0;
  let relationLabelsOmittedFromText = 0;
  let nameCnFieldsOmittedFromText = 0;
  let placementReasonsOmittedFromText = 0;
  let datesOmittedFromText = 0;
  let metadataTextTruncated = 0;
  let truncationReasonTextTruncated = 0;
  let sourceTextTruncated = 0;
  let warningTextTruncated = 0;
  let limitationTextTruncated = 0;
  const clipMetadata = (value: string) => {
    const clipped = clippedDisplayText(value, options.metadataTextCharacters);
    if (clipped.clipped) metadataTextTruncated += 1;
    return clipped.text;
  };
  const rootName = clippedDisplayText(
    result.root.nameCn || result.root.name,
    options.nameCharacters,
  );
  if (rootName.clipped) displayNamesTruncated += 1;
  const watchOrder = result.watchOrder.slice(0, options.orderLimit).map((item) => {
    const name = clippedDisplayText(item.nameCn || item.name, options.nameCharacters);
    if (name.clipped) displayNamesTruncated += 1;
    nameCnFieldsOmittedFromText += item.nameCn ? 1 : 0;
    placementReasonsOmittedFromText += item.placementReason ? 1 : 0;
    datesOmittedFromText += item.date ? 1 : 0;
    const relationLabels = item.relationLabels
      .slice(0, options.labelCharacters > 0 ? 1 : 0)
      .map((label) => {
        const clippedLabel = clippedDisplayText(label, options.labelCharacters);
        if (clippedLabel.clipped) relationLabelsTruncated += 1;
        return clippedLabel.text;
      });
    relationLabelsOmittedFromText += Math.max(
      0,
      item.relationLabels.length - relationLabels.length,
    );
    return {
      id: item.id,
      position: item.position,
      placement: item.placement,
      name: name.text,
      relationLabels,
      relationLabelsOmittedFromText: Math.max(
        0,
        item.relationLabels.length - relationLabels.length,
      ),
    };
  });
  const rootDateOmittedFromText = result.root.date ? 1 : 0;
  nameCnFieldsOmittedFromText += result.root.nameCn ? 1 : 0;
  const sources = result.evidence.sources.slice(0, options.sourceLimit).map((source) => ({
    operation: clipMetadata(source.operation),
    path: clipMetadata(source.path),
    status: source.status,
    subjectId: source.subjectId,
  }));
  sourceTextTruncated = metadataTextTruncated;
  const truncationReasons = result.coverage.truncationReasons
    .slice(0, options.truncationReasonLimit)
    .map((reason) => {
      const clipped = clippedDisplayText(reason, options.metadataTextCharacters);
      if (clipped.clipped) truncationReasonTextTruncated += 1;
      return clipped.text;
    });
  const warnings = result.warnings.slice(0, options.warningLimit).map((warning) => {
    const clipped = clippedDisplayText(warning, options.metadataTextCharacters);
    if (clipped.clipped) warningTextTruncated += 1;
    return clipped.text;
  });
  const limitations = result.limitations.slice(0, options.limitationLimit).map((limitation) => {
    const clipped = clippedDisplayText(limitation, options.metadataTextCharacters);
    if (clipped.clipped) limitationTextTruncated += 1;
    return clipped.text;
  });
  const capabilityState = options.includeCapabilityState
    ? clipMetadata(result.capabilityStates.watchOrder)
    : undefined;
  const derivation = clipMetadata(result.evidence.derivation);
  const coverageRetrievedAt = clipMetadata(result.coverage.retrievedAt);
  const evidenceRetrievedAt = clipMetadata(result.evidence.retrievedAt);
  const rootType = clipMetadata(result.root.type);
  relationLabelsOmittedFromText += result.root.relationLabels.length;
  const relationKindsOmittedFromText =
    result.root.relationKinds.length +
    result.watchOrder
      .slice(0, options.orderLimit)
      .reduce((total, item) => total + item.relationKinds.length, 0);
  const relationPathsOmittedFromText =
    result.root.relationPaths.length +
    result.watchOrder.reduce((total, item) => total + item.relationPaths.length, 0) +
    result.related.reduce((total, item) => total + item.relationPaths.length, 0) +
    result.excluded.samples.reduce((total, item) => total + item.relationPaths.length, 0);
  return {
    state: result.state,
    subjectId: result.subjectId,
    root: {
      id: result.root.id,
      type: rootType,
      name: rootName.text,
    },
    ...(capabilityState === undefined
      ? { capabilityStates: {}, capabilityStateOmittedFromText: true }
      : { capabilityStates: { watchOrder: capabilityState } }),
    watchOrder,
    coverage: {
      depth: result.coverage.depth,
      maxNodes: result.coverage.maxNodes,
      media: result.coverage.media,
      relationRequests: result.coverage.relationRequests,
      relationRowsObserved: result.coverage.relationRowsObserved,
      uniqueRelatedObserved: result.coverage.uniqueRelatedObserved,
      uniqueRelatedReturned: result.coverage.uniqueRelatedReturned,
      nonAnimeRowsObserved: result.coverage.nonAnimeRowsObserved,
      nonAnimeRowsReturned: result.coverage.nonAnimeRowsReturned,
      edgeEvidenceTruncated: result.coverage.edgeEvidenceTruncated,
      relatedEvidenceTruncated: result.coverage.relatedEvidenceTruncated,
      truncated: result.coverage.truncated,
      truncationReasons,
      truncationReasonsOmittedFromText: Math.max(
        0,
        result.coverage.truncationReasons.length - truncationReasons.length,
      ),
      retrievedAt: coverageRetrievedAt,
    },
    evidence: {
      derivation,
      retrievedAt: evidenceRetrievedAt,
      sources,
      sourceOperationsOmittedFromText: result.evidence.sources.length - sources.length,
    },
    warnings,
    warningsOmittedFromText: result.warnings.length - warnings.length,
    limitations: [...limitations, SERIES_WATCH_ORDER_SCOPE_NOTE],
    limitationsOmittedFromText: Math.max(0, result.limitations.length - limitations.length),
    mcpTextProjection: {
      version: 'series-watch-order-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      fullResultUtf8Bytes: utf8Bytes(JSON.stringify(result, null, 2)),
      structuredContentHasFullResult: true,
      textViewScope: SERIES_WATCH_ORDER_SCOPE_NOTE,
      minimumProjectionUsed: true,
      watchOrderRowsReturned: result.watchOrder.length,
      watchOrderRowsIncluded: watchOrder.length,
      watchOrderRowsOmittedFromText: result.watchOrder.length - watchOrder.length,
      displayNamesTruncated,
      relationLabelsTruncated,
      relationLabelsOmittedFromText,
      nameCnFieldsOmittedFromText,
      placementReasonsOmittedFromText,
      datesOmittedFromText: rootDateOmittedFromText + datesOmittedFromText,
      relatedRowsOmittedFromText: result.related.length,
      edgeRowsOmittedFromText: result.edges.length,
      exclusionSamplesOmittedFromText: result.excluded.samples.length,
      exclusionReasonRowsOmittedFromText: result.excluded.byReason.length,
      sourceOperationsOmittedFromText: result.evidence.sources.length - sources.length,
      warningRecordsOmittedFromText: result.warnings.length - warnings.length,
      limitationRecordsOmittedFromText: Math.max(0, result.limitations.length - limitations.length),
      truncationReasonsOmittedFromText: Math.max(
        0,
        result.coverage.truncationReasons.length - truncationReasons.length,
      ),
      sourceTextTruncated,
      warningTextTruncated,
      limitationTextTruncated,
      truncationReasonTextTruncated,
      metadataTextTruncated,
      retrievedAtTextOmittedFromText:
        options.metadataTextCharacters === 0
          ? Number(Boolean(result.coverage.retrievedAt)) +
            Number(Boolean(result.evidence.retrievedAt))
          : 0,
      relationKindsOmittedFromText,
      relationPathsOmittedFromText,
      relationPathRowsReturned: relationPathsOmittedFromText,
    },
  };
}

function createBareMinimumSeriesWatchOrderProjection(result: SeriesWatchOrderResult) {
  const watchOrder = result.watchOrder.slice(0, 1).map((item) => ({
    id: item.id,
    position: item.position,
    placement: item.placement,
    name: '',
    relationLabels: [],
    relationLabelsOmittedFromText: item.relationLabels.length,
  }));
  return {
    state: result.state,
    subjectId: result.subjectId,
    root: { id: result.root.id, type: '', name: '' },
    capabilityStates: {},
    capabilityStateOmittedFromText: true,
    watchOrder,
    coverage: {
      depth: result.coverage.depth,
      maxNodes: result.coverage.maxNodes,
      media: result.coverage.media,
      relationRowsObserved: result.coverage.relationRowsObserved,
      uniqueRelatedObserved: result.coverage.uniqueRelatedObserved,
      uniqueRelatedReturned: result.coverage.uniqueRelatedReturned,
      nonAnimeRowsObserved: result.coverage.nonAnimeRowsObserved,
      nonAnimeRowsReturned: result.coverage.nonAnimeRowsReturned,
      truncated: result.coverage.truncated,
      truncationReasons: [],
      truncationReasonsOmittedFromText: result.coverage.truncationReasons.length,
      retrievedAt: '',
    },
    evidence: {
      derivation: '',
      retrievedAt: '',
      sources: [],
      sourceOperationsOmittedFromText: result.evidence.sources.length,
    },
    warnings: [],
    warningsOmittedFromText: result.warnings.length,
    limitations: [SERIES_WATCH_ORDER_SCOPE_NOTE],
    limitationsOmittedFromText: result.limitations.length,
    mcpTextProjection: {
      version: 'series-watch-order-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      fullResultUtf8Bytes: utf8Bytes(JSON.stringify(result, null, 2)),
      structuredContentHasFullResult: true,
      textViewScope: SERIES_WATCH_ORDER_SCOPE_NOTE,
      minimumProjectionUsed: true,
      watchOrderRowsReturned: result.watchOrder.length,
      watchOrderRowsIncluded: watchOrder.length,
      watchOrderRowsOmittedFromText: result.watchOrder.length - watchOrder.length,
      displayNamesTruncated:
        Number(Boolean(result.root.name || result.root.nameCn)) +
        Number(Boolean(result.watchOrder[0]?.name || result.watchOrder[0]?.nameCn)),
      relationLabelsTruncated: 0,
      relationLabelsOmittedFromText:
        result.root.relationLabels.length + (result.watchOrder[0]?.relationLabels.length ?? 0),
      nameCnFieldsOmittedFromText:
        (result.root.nameCn ? 1 : 0) + (result.watchOrder[0]?.nameCn ? 1 : 0),
      placementReasonsOmittedFromText: result.watchOrder[0]?.placementReason ? 1 : 0,
      datesOmittedFromText: (result.root.date ? 1 : 0) + (result.watchOrder[0]?.date ? 1 : 0),
      relatedRowsOmittedFromText: result.related.length,
      edgeRowsOmittedFromText: result.edges.length,
      exclusionSamplesOmittedFromText: result.excluded.samples.length,
      exclusionReasonRowsOmittedFromText: result.excluded.byReason.length,
      sourceOperationsOmittedFromText: result.evidence.sources.length,
      warningRecordsOmittedFromText: result.warnings.length,
      limitationRecordsOmittedFromText: result.limitations.length,
      truncationReasonsOmittedFromText: result.coverage.truncationReasons.length,
      sourceTextTruncated: 0,
      warningTextTruncated: 0,
      limitationTextTruncated: 0,
      truncationReasonTextTruncated: 0,
      metadataTextTruncated: 0,
      retrievedAtTextOmittedFromText:
        Number(Boolean(result.coverage.retrievedAt)) + Number(Boolean(result.evidence.retrievedAt)),
      relationKindsOmittedFromText:
        result.root.relationKinds.length + (result.watchOrder[0]?.relationKinds.length ?? 0),
      relationPathsOmittedFromText:
        result.root.relationPaths.length +
        result.watchOrder.reduce((total, item) => total + item.relationPaths.length, 0) +
        result.related.reduce((total, item) => total + item.relationPaths.length, 0) +
        result.excluded.samples.reduce((total, item) => total + item.relationPaths.length, 0),
      relationPathRowsReturned:
        result.root.relationPaths.length +
        result.watchOrder.reduce((total, item) => total + item.relationPaths.length, 0) +
        result.related.reduce((total, item) => total + item.relationPaths.length, 0) +
        result.excluded.samples.reduce((total, item) => total + item.relationPaths.length, 0),
    },
  };
}
