import type {
  PersonActivityResult,
  PersonActivityWindowSummary,
  SubjectCastItem,
  SubjectCastResult,
  SubjectComparisonResult,
  SubjectOverviewResult,
  SubjectStatsIntelligenceResult,
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

const PERSON_ACTIVITY_TOOL = 'bangumi.get_person_activity';
const SUBJECT_STAFF_TOOL = 'bangumi.get_subject_staff';
const SUBJECT_CAST_TOOL = 'bangumi.get_subject_cast';
const SUBJECT_OVERVIEW_TOOL = 'bangumi.get_subject_overview';
const SUBJECT_COMPARISON_TOOL = 'bangumi.get_subject_comparison';
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
  if (utf8Bytes(fullText) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) {
    return { text: fullText };
  }

  if (!isJsonObject(result)) {
    return { text: fullText };
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

  return { text: fullText };
}

function serializeFullResult(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2) ?? 'null';
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function projectComparisonConflict(conflict: {
  reason?: string;
  resolution?: string;
  candidates?: unknown[];
}) {
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
    candidateCount: conflict.candidates?.length ?? 0,
    candidateValuesOmittedFromText: true,
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
              ...projectComparisonConflict(conflict),
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
    },
  };
}

function compactSubjectComparison(result: SubjectComparisonResult): string {
  let warningLimit = Math.min(MAX_WARNINGS, result.warnings.length);
  let limitationLimit = Math.min(MAX_LIMITATIONS, result.limitations.length);
  let evidenceLimit = Math.min(2, result.evidence.length);
  let operationLimit = 1;

  while (true) {
    const projection = createSubjectComparisonProjection(
      result,
      warningLimit,
      limitationLimit,
      evidenceLimit,
      operationLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (evidenceLimit > 0) evidenceLimit -= 1;
    else if (limitationLimit > 0) limitationLimit -= 1;
    else if (warningLimit > 0) warningLimit -= 1;
    else if (operationLimit > 1) operationLimit -= 1;
    else return JSON.stringify(createSubjectComparisonProjection(result, 0, 0, 0, 1));
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
