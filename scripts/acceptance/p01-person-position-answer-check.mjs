import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const P01_ANSWER_CHECK_METHOD = 'p01-bounded-person-role-frequency-answer-v1';
export const P01_ARGUMENT_PROFILE = 'fixed-p01-person-1040-staff-anime-36m-48r-16d-8rows-v1';
export const P01_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  personId: 1040,
  kind: 'staff',
  media: 'anime',
  windowMonths: 36,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});

export const P01_COVERAGE_FIELDS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'relationSelectionStrategy',
  'sampled',
  'subjectIdsObserved',
  'subjectIdsSelected',
  'subjectIdsDroppedAtRelationLimit',
  'subjectDetailIdsObserved',
  'subjectDetailRequests',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'subjectDetailIdsDroppedAtLimit',
  'rowsEligible',
  'rowsReturned',
  'outputTruncated',
  'uniqueSubjects',
  'uniqueCharacters',
  'missingSubjectIdRows',
  'missingDateRows',
  'invalidDateRows',
  'outsideWindowRows',
  'mediaExcludedRows',
  'mediaUnknownRows',
  'staffRoleExcludedRows',
  'staffRoleUnknownRows',
  'maxRelations',
  'maxSubjectDetails',
  'maxRows',
  'detailConcurrency',
  'responseLimitBytes',
  'truncated',
  'retrievedAt',
]);

const ANSWER_KEYS = [
  'personId',
  'kind',
  'media',
  'state',
  'window',
  'summary',
  'roleFrequency',
  'unknownRoleRows',
  'coverage',
  'rows',
  'caveat',
];
const SUMMARY_KEYS = ['creditRows', 'uniqueSubjects', 'uniqueCharacters'];
const EXPECTED_CAVEATS = Object.freeze([
  '本次只统计当前官方人物关系和已成功读取的动画作品样本，时间窗为36个日历月，不代表完整生涯。频次只按本次返回行中的完全相同官方职位标签计算；缺失或未知标签单列，关系、详情或输出上限会使观察保持部分。未返回的作品或职位不等于不存在，也没有历史快照。',
  'This counts exact official staff-role labels only in the returned current anime relation and successfully read subject-detail sample over 36 calendar months; it is not a complete career. Missing or unknown labels remain separate, relation/detail/output caps keep the observation partial, unreturned works or roles do not prove absence, and no historical snapshot exists.',
]);
const UNSUPPORTED_CLAIMS = [
  /(?:完整履历|全部职位|所有职位|完整生涯|全部作品|所有作品|一生中|从业以来)/u,
  /\b(?:complete|full|entire|all|lifetime)\s+(?:career|filmography|staff\s+roles|credits|works)\b/iu,
];

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : isRecord(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function parseObject(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function exactTextResult(toolOutput) {
  if (
    !isRecord(toolOutput) ||
    !Array.isArray(toolOutput.content) ||
    toolOutput.content.length !== 1 ||
    toolOutput.content[0]?.type !== 'text' ||
    typeof toolOutput.content[0]?.text !== 'string' ||
    Buffer.byteLength(toolOutput.content[0].text, 'utf8') > 3600
  )
    return null;
  const parsed = parseObject(toolOutput.content[0].text);
  return parsed ? findP01Activity(parsed) : null;
}

function findP01Activity(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try {
      return findP01Activity(JSON.parse(value), seen, depth + 1);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  if (
    value.personId === P01_EXPECTED_QUERY_ARGUMENTS.personId &&
    value.kind === 'staff' &&
    value.staffRole === undefined &&
    value.media === 'anime' &&
    isRecord(value.window) &&
    isRecord(value.coverage) &&
    isRecord(value.summary) &&
    Array.isArray(value.rows)
  )
    return value;
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findP01Activity(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
    if (key in value) {
      const found = findP01Activity(value[key], seen, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function projectWindow(window, retrievedAt) {
  if (
    !isRecord(window) ||
    window.months !== 36 ||
    window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    !validDateOnly(window.start) ||
    !validDateOnly(window.end) ||
    !Array.isArray(window.monthKeys) ||
    window.monthKeys.length !== 36 ||
    !window.monthKeys.every(validMonthKey)
  )
    return null;
  const end = new Date(`${window.end}T00:00:00.000Z`);
  const startIndex = end.getUTCFullYear() * 12 + end.getUTCMonth() - 35;
  const startYear = Math.floor(startIndex / 12);
  const startMonth = ((startIndex % 12) + 12) % 12;
  const expectedStart = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const expectedMonths = Array.from({ length: 36 }, (_, offset) => {
    const index = startIndex + offset;
    const year = Math.floor(index / 12);
    const month = (((index % 12) + 12) % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
  if (window.start !== expectedStart || !sameJson(window.monthKeys, expectedMonths)) return null;
  const retrieved = Date.parse(retrievedAt ?? '');
  const retrievedDate = Number.isFinite(retrieved)
    ? new Date(retrieved).toISOString().slice(0, 10)
    : null;
  if (!retrievedDate || !validDateOnly(retrievedDate)) return null;
  const deltaDays = Math.abs(
    (Date.parse(`${retrievedDate}T00:00:00.000Z`) - Date.parse(`${window.end}T00:00:00.000Z`)) /
      86_400_000,
  );
  if (deltaDays > 1) return null;
  return {
    months: window.months,
    start: window.start,
    end: window.end,
    monthKeys: window.monthKeys,
    asOfSemantics: window.asOfSemantics,
  };
}

function validMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(value);
}

function projectCoverage(coverage) {
  if (!isRecord(coverage)) return null;
  const output = {};
  for (const key of P01_COVERAGE_FIELDS) {
    const value = coverage[key];
    if (key === 'outputTruncated' || key === 'sampled' || key === 'truncated') {
      if (typeof value !== 'boolean') return null;
    } else if (key === 'relationSelectionStrategy') {
      if (!['all', 'deterministic_even_spread'].includes(value)) return null;
    } else if (key === 'retrievedAt') {
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
    } else if (!Number.isSafeInteger(value) || value < 0) return null;
    output[key] = value;
  }
  return output;
}

function projectRow(row) {
  if (!isRecord(row)) return null;
  return {
    subjectId: row.subjectId,
    title: row.subjectNameCn || row.subjectName,
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationId: row.relationId ?? row.subjectId,
    rawRole: typeof row.rawRole === 'string' && row.rawRole.trim() ? row.rawRole : null,
    roleFamily: row.roleFamily,
  };
}

function validRow(row, window) {
  return (
    isRecord(row) &&
    Number.isSafeInteger(row.subjectId) &&
    row.subjectId > 0 &&
    typeof (row.subjectNameCn || row.subjectName) === 'string' &&
    validDateOnly(row.firstAirDate) &&
    row.firstAirDate >= window.start &&
    row.firstAirDate <= window.end &&
    row.month === row.firstAirDate.slice(0, 7) &&
    row.relationKind === 'staff' &&
    row.subjectType === 'anime' &&
    (row.relationId === undefined || row.relationId === row.subjectId) &&
    ['staff', 'unknown'].includes(row.roleFamily) &&
    row.characterName === undefined &&
    (row.rawRole === undefined || row.rawRole === null || typeof row.rawRole === 'string')
  );
}

function roleFrequency(rows) {
  const counts = new Map();
  let unknownRoleRows = 0;
  for (const row of rows) {
    if (!isRecord(row) || typeof row.rawRole !== 'string' || !row.rawRole.trim()) {
      unknownRoleRows += 1;
      continue;
    }
    counts.set(row.rawRole, (counts.get(row.rawRole) ?? 0) + 1);
  }
  const frequency = [...counts.entries()]
    .map(([rawRole, count]) => ({ rawRole, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        (left.rawRole < right.rawRole ? -1 : left.rawRole > right.rawRole ? 1 : 0),
    );
  return { frequency, unknownRoleRows };
}

function coverageIsConsistent(coverage, result, rows) {
  const relationRowsMatched = coverage.relationRowsSelected + coverage.relationRowsDroppedAtLimit;
  const capped =
    coverage.subjectDetailIdsDroppedAtLimit > 0 ||
    coverage.relationRowsDroppedAtLimit > 0 ||
    coverage.outputTruncated;
  const sourceIsIncomplete =
    capped ||
    coverage.subjectDetailsFailed > 0 ||
    coverage.missingSubjectIdRows > 0 ||
    coverage.missingDateRows > 0 ||
    coverage.invalidDateRows > 0 ||
    coverage.mediaUnknownRows > 0 ||
    coverage.staffRoleUnknownRows > 0 ||
    rows.some((row) => !isRecord(row) || typeof row.rawRole !== 'string' || !row.rawRole.trim());
  return (
    coverage.relationRowsSelected <= coverage.maxRelations &&
    coverage.relationRowsObserved === relationRowsMatched &&
    coverage.relationRowsDroppedAtLimit ===
      coverage.relationRowsObserved - coverage.relationRowsSelected &&
    coverage.sampled === coverage.relationRowsDroppedAtLimit > 0 &&
    coverage.subjectIdsSelected <= coverage.subjectIdsObserved &&
    coverage.subjectIdsObserved <= coverage.relationRowsObserved &&
    coverage.subjectIdsDroppedAtRelationLimit ===
      coverage.subjectIdsObserved - coverage.subjectIdsSelected &&
    coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= coverage.maxSubjectDetails &&
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed ===
      coverage.subjectDetailRequests &&
    coverage.subjectDetailIdsDroppedAtLimit ===
      coverage.subjectIdsSelected - coverage.subjectDetailRequests &&
    coverage.rowsEligible === result.summary.creditRows &&
    coverage.rowsReturned === rows.length &&
    coverage.rowsReturned <= coverage.maxRows &&
    coverage.rowsEligible >= coverage.rowsReturned &&
    coverage.outputTruncated === coverage.rowsEligible > coverage.rowsReturned &&
    coverage.uniqueSubjects === result.summary.uniqueSubjects &&
    coverage.uniqueCharacters === result.summary.uniqueCharacters &&
    coverage.maxRelations === P01_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.maxSubjectDetails === P01_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.maxRows === P01_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.responseLimitBytes === 1_048_576 &&
    coverage.truncated === capped &&
    (!sourceIsIncomplete || result.state === 'partial')
  );
}

function sourceOperationsAreConsistent(result, coverage) {
  if (
    !Array.isArray(result.sourceOperations) ||
    result.sourceOperations.length !== 3 ||
    result.sourceOperations.some((entry) => !isRecord(entry))
  )
    return false;
  const byPath = new Map(result.sourceOperations.map((entry) => [entry.operation, entry]));
  const person = byPath.get('GET /v0/persons/{person_id}');
  const relations = byPath.get('GET /v0/persons/{person_id}/subjects');
  const details = byPath.get('GET /v0/subjects/{subject_id}');
  if (byPath.size !== 3) return false;
  return (
    [person, relations].every(
      (entry) => entry?.attempted === 1 && entry.succeeded === 1 && entry.failed === 0,
    ) &&
    details?.attempted === coverage.subjectDetailRequests &&
    details.succeeded === coverage.subjectDetailsSucceeded &&
    details.failed === coverage.subjectDetailsFailed
  );
}

function caveatValid(caveat) {
  return typeof caveat === 'string' && EXPECTED_CAVEATS.includes(caveat.trim());
}

function answerRowMatches(answerRow, sourceRow, window) {
  if (!isRecord(answerRow)) return false;
  const expected = projectRow(sourceRow);
  if (!isRecord(expected)) return false;
  return (
    Object.keys(answerRow).length === Object.keys(expected).length &&
    Object.keys(answerRow).every((key) => Object.hasOwn(expected, key)) &&
    sameJson(answerRow, expected) &&
    validRow(sourceRow, window)
  );
}

function answerFrequencyMatches(answerFrequency, expected) {
  return (
    Array.isArray(answerFrequency) &&
    answerFrequency.length === expected.length &&
    answerFrequency.every(
      (item, index) =>
        isRecord(item) &&
        Object.keys(item).length === 2 &&
        item.rawRole === expected[index].rawRole &&
        item.count === expected[index].count,
    )
  );
}

export function summarizeP01PersonPositionResult(result) {
  const coverage = projectCoverage(result?.coverage);
  const window = projectWindow(result?.window, result?.coverage?.retrievedAt);
  if (!coverage || !window || !isRecord(result?.summary) || !Array.isArray(result?.rows))
    return null;
  const frequencies = roleFrequency(result.rows);
  const serializedRows = JSON.stringify(result.rows.map(projectRow));
  return {
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    state: result.state,
    window,
    summary: {
      creditRows: result.summary.creditRows,
      uniqueSubjects: result.summary.uniqueSubjects,
      uniqueCharacters: result.summary.uniqueCharacters,
    },
    coverage,
    rowCount: result.rows.length,
    roleLabelCount: frequencies.frequency.length,
    unknownRoleRows: frequencies.unknownRoleRows,
    sourceRowDigest: sha256(serializedRows),
    sourceOperations: Array.isArray(result.sourceOperations)
      ? result.sourceOperations
          .filter(isRecord)
          .map(({ operation, attempted, succeeded, failed }) => ({
            operation,
            attempted,
            succeeded,
            failed,
          }))
      : null,
  };
}

export function verifyP01PersonPositionAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const parsed = parseObject(answer);
  const structuredResult = isRecord(toolOutput?.structuredContent)
    ? findP01Activity(toolOutput.structuredContent)
    : null;
  const textFallbackResult = structuredResult ? null : exactTextResult(toolOutput);
  const result = structuredResult ?? textFallbackResult;
  const coverage = projectCoverage(result?.coverage);
  const window = result ? projectWindow(result.window, result.coverage?.retrievedAt) : null;
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const expectedRoles = roleFrequency(rows);
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_person_activity' &&
    toolCalls[0]?.state === 'DONE' &&
    sameJson(toolCalls[0]?.arguments, P01_EXPECTED_QUERY_ARGUMENTS);
  const sourceRowsValid =
    Boolean(window) &&
    rows.length <= P01_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    rows.every((row) => validRow(row, window));
  const sourceRowsDistinct =
    new Set(
      rows.map((row, index) =>
        isRecord(row)
          ? `${row.relationKind}:${row.relationId ?? row.subjectId}`
          : `malformed:${index}`,
      ),
    ).size === rows.length;
  const summaryValid =
    isRecord(result?.summary) &&
    SUMMARY_KEYS.every(
      (key) => Number.isSafeInteger(result.summary[key]) && result.summary[key] >= 0,
    ) &&
    result.summary.creditRows === coverage?.rowsEligible &&
    result.summary.uniqueSubjects <= result.summary.creditRows &&
    result.summary.uniqueCharacters === 0;
  const answerRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const expectedRows = rows.map(projectRow);
  const answerCoverage = isRecord(parsed?.coverage) ? parsed.coverage : null;
  const caveat = parsed?.caveat;
  const stateValid = ['complete', 'partial'].includes(result?.state);
  const checks = {
    exactQueryArguments: sameJson(queryArguments, P01_EXPECTED_QUERY_ARGUMENTS),
    exactSingleToolCall,
    completeSourceReadback:
      Boolean(structuredResult || textFallbackResult) &&
      (Boolean(structuredResult) ||
        (Number.isSafeInteger(toolTextUtf8Bytes) &&
          toolTextUtf8Bytes > 0 &&
          toolTextUtf8Bytes <= 3600)),
    targetIdentityAndScope:
      result?.personId === P01_EXPECTED_QUERY_ARGUMENTS.personId &&
      result.kind === 'staff' &&
      result.staffRole === undefined &&
      result.media === 'anime',
    calendarWindowValid:
      Boolean(window) && isRecord(parsed?.window) && sameJson(parsed.window, window),
    successfulOfficialSources:
      stateValid && Boolean(coverage) && sourceOperationsAreConsistent(result, coverage),
    boundedCoverageConsistent: Boolean(
      coverage && summaryValid && coverageIsConsistent(coverage, result, rows),
    ),
    sourceRowsValid,
    sourceRowsDistinct,
    answerShapeValid:
      isRecord(parsed) &&
      Object.keys(parsed).length === ANSWER_KEYS.length &&
      ANSWER_KEYS.every((key) => Object.hasOwn(parsed, key)),
    answerIdentityAndStateMatch:
      parsed?.personId === result?.personId &&
      parsed?.kind === 'staff' &&
      parsed?.media === 'anime' &&
      parsed?.state === result?.state,
    answerSummaryMatches: sameJson(
      parsed?.summary,
      result?.summary
        ? {
            creditRows: result.summary.creditRows,
            uniqueSubjects: result.summary.uniqueSubjects,
            uniqueCharacters: result.summary.uniqueCharacters,
          }
        : null,
    ),
    answerRoleFrequencyMatches: answerFrequencyMatches(
      parsed?.roleFrequency,
      expectedRoles.frequency,
    ),
    answerUnknownRoleRowsMatch: parsed?.unknownRoleRows === expectedRoles.unknownRoleRows,
    answerCoverageMatches: Boolean(
      coverage &&
      answerCoverage &&
      Object.keys(answerCoverage).length === P01_COVERAGE_FIELDS.length &&
      Object.keys(answerCoverage).every((key) => P01_COVERAGE_FIELDS.includes(key)) &&
      sameJson(answerCoverage, coverage),
    ),
    answerRowsMatch:
      answerRows.length === expectedRows.length &&
      expectedRows.every((expected, index) =>
        answerRowMatches(answerRows[index], rows[index], window),
      ),
    boundedSampleCaveatPresent: caveatValid(caveat),
    noUnsupportedCareerClaim:
      typeof caveat === 'string' &&
      EXPECTED_CAVEATS.includes(caveat.trim()) &&
      !UNSUPPORTED_CLAIMS.some((pattern) =>
        pattern.test(caveat.replace(/不代表完整生涯|not a complete career/gu, '')),
      ),
    plainJsonWithoutMarkdown:
      typeof answer === 'string' &&
      parsed !== null &&
      !/^\s*```/u.test(answer) &&
      !/^\s*#/mu.test(answer),
    boundedAnswerBytes: typeof answer === 'string' && Buffer.byteLength(answer, 'utf8') <= 16_384,
    boundedMcpTextView:
      Number.isSafeInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600,
  };
  const passed = Object.values(checks).every(Boolean);
  const answerCounters = {
    sourceRows: rows.length,
    answerRows: answerRows.length,
    rowsMatched: expectedRows.filter((expected, index) =>
      answerRowMatches(answerRows[index], rows[index], window),
    ).length,
    sourceRoleLabels: expectedRoles.frequency.length,
    answerRoleLabels: Array.isArray(parsed?.roleFrequency) ? parsed.roleFrequency.length : 0,
    knownRoleRows: rows.length - expectedRoles.unknownRoleRows,
    unknownRoleRows: expectedRoles.unknownRoleRows,
    coverageFieldsMatched: isRecord(coverage)
      ? P01_COVERAGE_FIELDS.filter((key) => Object.hasOwn(coverage, key)).length
      : 0,
    toolTextUtf8Bytes: Number.isSafeInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : 0,
  };
  const serializedResult = result ? JSON.stringify(result) : '';
  return {
    passed,
    answerChecks: checks,
    answerCounters,
    resultSummary: result ? summarizeP01PersonPositionResult(result) : null,
    resultSha256: result ? sha256(serializedResult) : null,
    resultByteLength: result ? Buffer.byteLength(serializedResult, 'utf8') : 0,
    answerSha256: typeof answer === 'string' ? sha256(answer) : null,
    answerUtf8Bytes: typeof answer === 'string' ? Buffer.byteLength(answer, 'utf8') : 0,
  };
}
