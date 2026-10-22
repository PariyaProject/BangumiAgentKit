import { Buffer } from 'node:buffer';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const P03_PROFILE_ID = 'p03-person-name-cn-agent-mcp-v1';
export const P03_V2_PROFILE_ID = 'p03-person-name-cn-agent-mcp-v2';
export const P03_V3_PROFILE_ID = 'p03-person-name-cn-agent-mcp-v3';
export const P03_FRESH_PUBLIC_PROFILE_IDS = Object.freeze([P03_V2_PROFILE_ID, P03_V3_PROFILE_ID]);
export const P03_MAX_TITLE_BYTES = 160;
export const P03_MAX_LISTED_ROWS = 6;
export const P03_CANONICAL_COVERAGE_NOTE =
  '官方 name_cn 去除首尾空白后非空才算来源已提供；若 name_cn 与原名相同，这只证明字段有值，不证明发生了翻译；空字符串、纯空白、缺失或无效值不证明没有中文名；上游关系完整性未声明；未列出的作品不代表没有中文名；这不是完整生涯列表；列表中的超长标题可能用省略号截断。';
export const P03_CANONICAL_TEXT_SOURCE_SEMANTICS =
  'nameCnSource 去除首尾空白后非空表示官方 name_cn 已提供；空字符串或纯空白字符串归为 empty，缺失或非字符串值归为 unavailable，不能据此断言字段未返回或作品没有中文名。';
export const P03_CANONICAL_TEXT_SCOPE_NOTE =
  '仅本次收到的作品关系行；上游关系完整性未声明，文本省略也不代表作品不存在。';
export const P03_ANSWER_CHECK_FIELDS = Object.freeze([
  'validJsonShape',
  'exactPersonIdentity',
  'exactPositiveSourceRows',
  'longTitleClippingDisclosed',
  'exactReturnedCoverageCounts',
  'truncationIsDisclosed',
  'exactOmittedPositiveCount',
  'trimmedNameCnIsPositiveEvidence',
  'nameCnValueNotTranslationProof',
  'emptyAndUnavailableAreNotAbsenceEvidence',
  'undocumentedCompletenessDisclosed',
  'omittedRowsAreNotAbsenceEvidence',
  'coverageNoteIsCanonical',
  'noCareerCompletenessClaim',
]);

const PROFILE = getAgentMcpProfileById(P03_PROFILE_ID);
const COUNTS = Object.freeze(['present', 'empty', 'unavailable']);

function clipUtf8(value, maximumBytes = P03_MAX_TITLE_BYTES) {
  if (Buffer.byteLength(value, 'utf8') <= maximumBytes) return { value, clipped: false };
  const ellipsis = '…';
  const maxPrefix = maximumBytes - Buffer.byteLength(ellipsis, 'utf8');
  let prefix = '';
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > maxPrefix) break;
    prefix += character;
    bytes += size;
  }
  return { value: `${prefix}${ellipsis}`, clipped: true };
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function resultPersonName(person) {
  const value =
    typeof person?.nameCn === 'string' && person.nameCn.trim().length > 0
      ? person.nameCn
      : person?.name;
  return typeof value === 'string' ? clipUtf8(value).value : null;
}

export function summarizeP03PersonProfileToolResult(
  result,
  expectedArguments,
  profileId = P03_PROFILE_ID,
) {
  const profile = getAgentMcpProfileById(profileId);
  if (
    !profile ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !expectedArguments ||
    canonicalAgentMcpProfileJson(expectedArguments) !==
      canonicalAgentMcpProfileJson(profile.calls[0].arguments)
  ) {
    throw new TypeError('P03 summary requires the exact registered person-profile arguments.');
  }
  const rows = result.credits?.subjects;
  if (!Array.isArray(rows)) {
    throw new Error('P03 requires included person-work credit rows.');
  }
  const subjectCoverage = result.coverage?.subjects;
  const counts = { present: 0, empty: 0, unavailable: 0 };
  const positiveRows = [];
  for (const row of rows) {
    const sourceName = row?.nameCnSource;
    if (typeof sourceName !== 'string') {
      counts.unavailable += 1;
      continue;
    }
    if (sourceName.trim().length === 0) {
      counts.empty += 1;
      continue;
    }
    counts.present += 1;
    if (positiveRows.length < P03_MAX_LISTED_ROWS) {
      const clipped = clipUtf8(sourceName);
      positiveRows.push({
        subjectId: Number.isSafeInteger(row?.id) && row.id > 0 ? row.id : null,
        nameCnSource: clipped.value,
        titleClipped: clipped.clipped,
      });
    }
  }
  const observed = subjectCoverage?.observed;
  const returned = subjectCoverage?.returned;
  const truncated = subjectCoverage?.truncated;
  return {
    personId: Number.isSafeInteger(result.person?.id) ? result.person.id : null,
    personName: resultPersonName(result.person),
    state: typeof result.state === 'string' ? result.state : 'unknown',
    coverage: {
      state: typeof result.coverage?.state === 'string' ? result.coverage.state : 'unknown',
      subjectsObserved: nonnegativeInteger(observed) ? observed : null,
      subjectsReturned: nonnegativeInteger(returned) ? returned : null,
      subjectsTruncated: typeof truncated === 'boolean' ? truncated : null,
      sourceCompleteness: subjectCoverage?.sourceCompleteness ?? null,
    },
    returnedCreditRowsObserved: rows.length,
    nameCnSourceCounts: counts,
    positiveNameCnRowsObserved: counts.present,
    sourceNameCnRows: positiveRows,
    nameCnRowsOmittedFromText: Math.max(0, counts.present - positiveRows.length),
  };
}

export function verifyP03Answer(answer, resultSummary) {
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    parsed = null;
  }
  const fields = [
    'personId',
    'personName',
    'sourceNameCnRows',
    'subjectsObserved',
    'subjectsReturned',
    'subjectsTruncated',
    'sourceCompleteness',
    'returnedCreditRowsObserved',
    'nameCnSourceCounts',
    'nameCnRowsOmittedFromText',
    'coverageNote',
  ];
  const validJsonShape = Boolean(
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    canonicalAgentMcpProfileJson(Object.keys(parsed).sort()) ===
      canonicalAgentMcpProfileJson([...fields].sort()) &&
    Array.isArray(parsed.sourceNameCnRows) &&
    parsed.nameCnSourceCounts &&
    typeof parsed.nameCnSourceCounts === 'object' &&
    canonicalAgentMcpProfileJson(Object.keys(parsed.nameCnSourceCounts).sort()) ===
      canonicalAgentMcpProfileJson([...COUNTS].sort()) &&
    typeof parsed.coverageNote === 'string',
  );
  const expectedRows = (resultSummary?.sourceNameCnRows ?? []).map(
    ({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    }),
  );
  const exactPositiveSourceRows =
    validJsonShape &&
    canonicalAgentMcpProfileJson(parsed.sourceNameCnRows) ===
      canonicalAgentMcpProfileJson(expectedRows) &&
    parsed.sourceNameCnRows.every(
      (row) =>
        Object.keys(row ?? {})
          .sort()
          .join('\0') === ['id', 'nameCnSource'].sort().join('\0') &&
        Number.isSafeInteger(row?.id) &&
        row.id > 0 &&
        typeof row?.nameCnSource === 'string' &&
        row.nameCnSource.trim().length > 0,
    );
  const countsMatch =
    validJsonShape &&
    COUNTS.every(
      (key) => parsed.nameCnSourceCounts[key] === resultSummary?.nameCnSourceCounts?.[key],
    );
  const note = validJsonShape ? parsed.coverageNote : '';
  const answerChecks = {
    validJsonShape,
    exactPersonIdentity:
      validJsonShape &&
      parsed.personId === resultSummary?.personId &&
      parsed.personName === resultSummary?.personName,
    exactPositiveSourceRows,
    longTitleClippingDisclosed: validJsonShape && note.includes('列表中的超长标题可能用省略号截断'),
    exactReturnedCoverageCounts:
      validJsonShape &&
      countsMatch &&
      parsed.subjectsObserved === resultSummary?.coverage?.subjectsObserved &&
      parsed.subjectsReturned === resultSummary?.coverage?.subjectsReturned &&
      parsed.subjectsTruncated === resultSummary?.coverage?.subjectsTruncated &&
      parsed.sourceCompleteness === resultSummary?.coverage?.sourceCompleteness &&
      parsed.returnedCreditRowsObserved === resultSummary?.returnedCreditRowsObserved,
    truncationIsDisclosed:
      validJsonShape &&
      parsed.subjectsTruncated === resultSummary?.coverage?.subjectsTruncated &&
      typeof parsed.subjectsTruncated === 'boolean',
    exactOmittedPositiveCount:
      validJsonShape &&
      parsed.nameCnRowsOmittedFromText === resultSummary?.nameCnRowsOmittedFromText,
    trimmedNameCnIsPositiveEvidence:
      validJsonShape && note.includes('去除首尾空白后非空') && exactPositiveSourceRows,
    nameCnValueNotTranslationProof:
      validJsonShape && note.includes('若 name_cn 与原名相同，这只证明字段有值，不证明发生了翻译'),
    emptyAndUnavailableAreNotAbsenceEvidence:
      validJsonShape && note.includes('空字符串、纯空白、缺失或无效值不证明没有中文名'),
    undocumentedCompletenessDisclosed:
      validJsonShape &&
      note.includes('上游关系完整性未声明') &&
      resultSummary?.coverage?.sourceCompleteness === 'undocumented',
    omittedRowsAreNotAbsenceEvidence:
      validJsonShape && note.includes('未列出的作品不代表没有中文名'),
    coverageNoteIsCanonical: validJsonShape && parsed.coverageNote === P03_CANONICAL_COVERAGE_NOTE,
    noCareerCompletenessClaim: validJsonShape && note.includes('这不是完整生涯列表'),
  };
  return {
    passed: P03_ANSWER_CHECK_FIELDS.every((field) => answerChecks[field] === true),
    answerChecks,
    parsed: validJsonShape ? parsed : null,
  };
}

export function createP03McpTextProjection(resultSummary, profileId = P03_V2_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  if (
    !profile ||
    !validateP03ResultSummary(resultSummary, profile.calls[0]?.arguments, profileId)
  ) {
    throw new TypeError('P03 text projection requires a validated profile result summary.');
  }
  return {
    state: resultSummary.state,
    person: { id: resultSummary.personId, name: resultSummary.personName },
    coverage: {
      state: resultSummary.coverage.state,
      subjects: {
        observed: resultSummary.coverage.subjectsObserved,
        returned: resultSummary.coverage.subjectsReturned,
        truncated: resultSummary.coverage.subjectsTruncated,
        sourceCompleteness: resultSummary.coverage.sourceCompleteness,
        nameCnSourceSemantics: P03_CANONICAL_TEXT_SOURCE_SEMANTICS,
        creditRowsIncluded: true,
        nameCnSourceCounts: resultSummary.nameCnSourceCounts,
      },
    },
    sourceNameCnRows: resultSummary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    returnedCreditRowsObserved: resultSummary.returnedCreditRowsObserved,
    returnedCreditRowsWithNameCnSource: resultSummary.positiveNameCnRowsObserved,
    nameCnRowsOmittedFromText: resultSummary.nameCnRowsOmittedFromText,
    scopeNote: P03_CANONICAL_TEXT_SCOPE_NOTE,
  };
}

export function validateP03McpTextProjection(text, resultSummary, profileId = P03_PROFILE_ID) {
  let projection;
  try {
    projection = JSON.parse(text);
  } catch {
    projection = null;
  }
  const subjectCoverage = projection?.coverage?.subjects;
  const expectedRows = (resultSummary?.sourceNameCnRows ?? []).map(
    ({ subjectId, nameCnSource }) => ({ id: subjectId, nameCnSource }),
  );
  const actualRows = Array.isArray(projection?.sourceNameCnRows)
    ? projection.sourceNameCnRows.map((row) => ({ id: row?.id, nameCnSource: row?.nameCnSource }))
    : null;
  const countsMatch = COUNTS.every(
    (key) =>
      subjectCoverage?.nameCnSourceCounts?.[key] === resultSummary?.nameCnSourceCounts?.[key],
  );
  let expectedProjection = null;
  if (P03_FRESH_PUBLIC_PROFILE_IDS.includes(profileId)) {
    try {
      expectedProjection = createP03McpTextProjection(resultSummary, profileId);
    } catch {
      expectedProjection = null;
    }
  }
  const checks = {
    validJson: projection !== null && typeof projection === 'object' && !Array.isArray(projection),
    withinTextLimit: typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= 3600,
    exactProjection:
      !P03_FRESH_PUBLIC_PROFILE_IDS.includes(profileId) ||
      (expectedProjection !== null &&
        canonicalAgentMcpProfileJson(projection) ===
          canonicalAgentMcpProfileJson(expectedProjection)),
    exactPersonIdentity:
      projection?.person?.id === resultSummary?.personId &&
      (typeof projection?.person?.nameCn === 'string' && projection.person.nameCn.trim().length > 0
        ? projection.person.nameCn
        : projection?.person?.name) === resultSummary?.personName,
    exactPositiveRows:
      canonicalAgentMcpProfileJson(actualRows) === canonicalAgentMcpProfileJson(expectedRows) &&
      Array.isArray(actualRows) &&
      actualRows.every(
        (row) =>
          Number.isSafeInteger(row.id) &&
          row.id > 0 &&
          typeof row.nameCnSource === 'string' &&
          row.nameCnSource.trim().length > 0,
      ),
    exactCoverage:
      subjectCoverage?.observed === resultSummary?.coverage?.subjectsObserved &&
      subjectCoverage?.returned === resultSummary?.coverage?.subjectsReturned &&
      subjectCoverage?.truncated === resultSummary?.coverage?.subjectsTruncated &&
      subjectCoverage?.sourceCompleteness === resultSummary?.coverage?.sourceCompleteness &&
      subjectCoverage?.creditRowsIncluded === true &&
      countsMatch,
    exactRowCounts:
      projection?.returnedCreditRowsObserved === resultSummary?.returnedCreditRowsObserved &&
      projection?.returnedCreditRowsWithNameCnSource ===
        resultSummary?.positiveNameCnRowsObserved &&
      projection?.nameCnRowsOmittedFromText === resultSummary?.nameCnRowsOmittedFromText,
    sourceSemanticsDisclosed:
      typeof subjectCoverage?.nameCnSourceSemantics === 'string' &&
      subjectCoverage.nameCnSourceSemantics.includes('不能据此断言字段未返回或作品没有中文名'),
    returnedScopeDisclosed:
      typeof projection?.scopeNote === 'string' &&
      projection.scopeNote.includes('上游关系完整性未声明') &&
      projection.scopeNote.includes('文本省略也不代表作品不存在'),
  };
  return {
    passed:
      Object.values(checks).every(Boolean) &&
      (!P03_FRESH_PUBLIC_PROFILE_IDS.includes(profileId) || checks.exactProjection),
    checks,
    projection: checks.validJson ? projection : null,
  };
}

export function validateP03ResultSummary(
  summary,
  expectedArguments = PROFILE?.calls?.[0]?.arguments,
  profileId = P03_PROFILE_ID,
) {
  const profile = getAgentMcpProfileById(profileId);
  if (!profile || !summary || typeof summary !== 'object' || Array.isArray(summary)) return false;
  const profileMaxSubjects = profile.calls?.[0]?.arguments?.maxSubjects;
  const fields = [
    'personId',
    'personName',
    'state',
    'coverage',
    'returnedCreditRowsObserved',
    'nameCnSourceCounts',
    'positiveNameCnRowsObserved',
    'sourceNameCnRows',
    'nameCnRowsOmittedFromText',
  ];
  if (
    canonicalAgentMcpProfileJson(Object.keys(summary).sort()) !==
      canonicalAgentMcpProfileJson([...fields].sort()) ||
    !expectedArguments ||
    canonicalAgentMcpProfileJson(expectedArguments) !==
      canonicalAgentMcpProfileJson(profile.calls[0].arguments) ||
    !Number.isSafeInteger(profileMaxSubjects) ||
    profileMaxSubjects < 0
  )
    return false;
  const counts = summary.nameCnSourceCounts;
  const coverage = summary.coverage;
  if (
    summary.personId !== expectedArguments?.personId ||
    typeof summary.personName !== 'string' ||
    summary.personName.trim().length === 0 ||
    !['complete', 'partial'].includes(summary.state) ||
    !coverage ||
    Object.keys(coverage).sort().join('\0') !==
      ['sourceCompleteness', 'state', 'subjectsObserved', 'subjectsReturned', 'subjectsTruncated']
        .sort()
        .join('\0') ||
    !['complete', 'partial'].includes(coverage.state) ||
    !nonnegativeInteger(coverage.subjectsObserved) ||
    !nonnegativeInteger(coverage.subjectsReturned) ||
    coverage.subjectsReturned > profileMaxSubjects ||
    coverage.subjectsObserved < coverage.subjectsReturned ||
    coverage.subjectsReturned !== summary.returnedCreditRowsObserved ||
    summary.returnedCreditRowsObserved !== counts?.present + counts?.empty + counts?.unavailable ||
    typeof coverage.subjectsTruncated !== 'boolean' ||
    coverage.subjectsTruncated !== coverage.subjectsObserved > coverage.subjectsReturned ||
    coverage.sourceCompleteness !== 'undocumented' ||
    canonicalAgentMcpProfileJson(Object.keys(counts ?? {}).sort()) !==
      canonicalAgentMcpProfileJson([...COUNTS].sort()) ||
    !COUNTS.every((key) => nonnegativeInteger(counts?.[key])) ||
    summary.positiveNameCnRowsObserved !== counts.present ||
    !nonnegativeInteger(summary.nameCnRowsOmittedFromText) ||
    !Array.isArray(summary.sourceNameCnRows) ||
    summary.sourceNameCnRows.length !== Math.min(P03_MAX_LISTED_ROWS, counts.present) ||
    summary.nameCnRowsOmittedFromText !== counts.present - summary.sourceNameCnRows.length
  )
    return false;
  return summary.sourceNameCnRows.every(
    (row) =>
      row &&
      Object.keys(row).sort().join('\0') ===
        ['nameCnSource', 'subjectId', 'titleClipped'].sort().join('\0') &&
      Number.isSafeInteger(row.subjectId) &&
      row.subjectId > 0 &&
      typeof row.nameCnSource === 'string' &&
      row.nameCnSource.trim().length > 0 &&
      Buffer.byteLength(row.nameCnSource, 'utf8') <= P03_MAX_TITLE_BYTES &&
      typeof row.titleClipped === 'boolean',
  );
}
