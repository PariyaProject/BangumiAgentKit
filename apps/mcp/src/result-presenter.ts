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
const MESSAGE_TEXT_LIMIT = 80;
const DISPLAY_TEXT_LIMIT = 120;

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

function clippedDisplayText(value: string): { text: string; clipped: boolean } {
  const characters = Array.from(value);
  if (characters.length <= DISPLAY_TEXT_LIMIT) return { text: value, clipped: false };
  return {
    text: characters.slice(0, DISPLAY_TEXT_LIMIT - 1).join('') + '…',
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

function projectPersonIdentity(person: NonNullable<PersonActivityResult['person']>) {
  const name = clippedDisplayText(person.name);
  const nameCn = person.nameCn ? clippedDisplayText(person.nameCn) : undefined;
  return {
    id: person.id,
    name: name.text,
    ...(nameCn ? { nameCn: nameCn.text } : {}),
    ...(name.clipped || nameCn?.clipped ? { displayNameTextTruncated: true } : {}),
  };
}

function projectComparison(result: PersonActivityResult) {
  if (!result.comparison) return undefined;
  const comparison = result.comparison;
  const projectPeriod = (period: typeof comparison.recent) => ({
    state: period.state,
    window: {
      months: period.window.months,
      start: period.window.start,
      end: period.window.end,
      asOfSemantics: period.window.asOfSemantics,
    },
    summary: {
      creditRows: period.summary.creditRows,
      uniqueSubjects: period.summary.uniqueSubjects,
      uniqueCharacters: period.summary.uniqueCharacters,
      byRole: period.summary.byRole.slice(0, 6),
      byMedia: period.summary.byMedia.slice(0, 6),
      byMonthBucketsOmittedFromText: period.summary.byMonth.length,
      origin: { ...period.summary.origin },
    },
    coverage: projectPersonCoverage(period.coverage),
    exclusions: period.exclusions.map(({ reason, count }) => ({ reason, count })),
  });
  return {
    state: comparison.state,
    windowMonths: comparison.windowMonths,
    recent: projectPeriod(comparison.recent),
    previous: projectPeriod(comparison.previous),
    delta: { ...comparison.delta },
    peak: {
      metric: comparison.peak.metric,
      state: comparison.peak.state,
      months: comparison.peak.months.slice(0, MAX_MONTH_BUCKETS),
      monthsOmittedFromText: Math.max(0, comparison.peak.months.length - MAX_MONTH_BUCKETS),
    },
    sourceOperationsOmittedFromText:
      comparison.sourceOperations.recent.length + comparison.sourceOperations.previous.length,
  };
}

function createPersonActivityProjection(
  result: PersonActivityResult,
  rowLimit: number,
  monthLimit: number,
  warningLimit: number,
  limitationLimit: number,
) {
  const rows = result.rows.slice(0, rowLimit).map(projectPersonRow);
  const messages = projectMessages(
    result.warnings,
    result.limitations,
    warningLimit,
    limitationLimit,
  );
  const comparison = projectComparison(result);
  return {
    personId: result.personId,
    ...(result.person ? { person: projectPersonIdentity(result.person) } : {}),
    state: result.state,
    kind: result.kind,
    media: result.media,
    ...(result.staffRole ? { staffRole: result.staffRole } : {}),
    window: {
      months: result.window.months,
      start: result.window.start,
      end: result.window.end,
      asOfSemantics: result.window.asOfSemantics,
    },
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

  while (true) {
    const projection = createPersonActivityProjection(
      result,
      rowLimit,
      monthLimit,
      warningLimit,
      limitationLimit,
    );
    const text = JSON.stringify(projection);
    if (utf8Bytes(text) <= MCP_TOOL_TEXT_MAX_UTF8_BYTES) return text;

    if (limitationLimit > 1) limitationLimit -= 1;
    else if (warningLimit > 1) warningLimit -= 1;
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
    window: {
      months: result.window.months,
      start: result.window.start,
      end: result.window.end,
      asOfSemantics: result.window.asOfSemantics,
    },
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
      rowsOmittedFromText: result.rows.length,
      evidenceRecordsOmittedFromText: result.evidence.length,
      sourceOperationRecordsOmittedFromText: result.sourceOperations.length,
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
        personId: result.personId,
        window: {
          months: result.window.months,
          start: result.window.start,
          end: result.window.end,
        },
        mcpTextProjection: {
          version: 'mcp-text-projection-v1',
          maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
          structuredContentHasFullResult: true,
          warningRecordsOmittedFromText: result.warnings.length,
          limitationRecordsOmittedFromText: result.limitations.length,
          summaryOmittedFromText: true,
        },
      });
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
    count: group.count,
    members,
    membersIncluded: members.length,
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
  const groups = result.staff.groups
    .slice(0, staffGroupLimit)
    .map((group) => projectStaffGroup(result, group, staffMemberLimitPerGroup));
  const includedStaffRows = new Set(
    groups.flatMap((group) =>
      group.members.map((member) => `${member.id}\u0000${member.relation}`),
    ),
  );
  const includedStaffMemberCount = result.staff.items.filter((member) =>
    includedStaffRows.has(`${member.id}\u0000${member.rawRelation || member.relation}`),
  ).length;
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
      castItemsReturned: result.cast.items.length,
      castItemsIncluded: castItems.length,
      castItemsOmittedFromText: result.cast.items.length - castItems.length,
      staffGroupsReturned: result.staff.groups.length,
      staffGroupsIncluded: groups.length,
      staffGroupsOmittedFromText: result.staff.groups.length - groups.length,
      staffMembersReturned: result.staff.items.length,
      staffMembersIncluded: includedStaffMemberCount,
      staffMembersOmittedFromText: Math.max(
        0,
        result.staff.items.length - includedStaffMemberCount,
      ),
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
          warningRecordsOmittedFromText: result.warnings.length,
          limitationRecordsOmittedFromText: result.limitations.length,
          summaryOmittedFromText: true,
        },
      });
}
