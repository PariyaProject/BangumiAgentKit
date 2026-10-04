import type {
  PersonActivityResult,
  PersonActivityWindowSummary,
  SubjectOverviewResult,
} from '@bangumi-agent-kit/bangumi-core';

export const MCP_TOOL_TEXT_MAX_UTF8_BYTES = 3600;

export interface McpToolResultPresentation {
  text: string;
  structuredContent?: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

const PERSON_ACTIVITY_TOOL = 'bangumi.get_person_activity';
const SUBJECT_OVERVIEW_TOOL = 'bangumi.get_subject_overview';
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

  if (toolName === SUBJECT_OVERVIEW_TOOL && isSubjectOverviewResult(result)) {
    const text = compactSubjectOverview(result);
    return {
      text,
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
