import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

const PROFILE = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const COVERAGE_COUNTER_FIELDS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'rowsEligible',
  'rowsReturned',
  'unknownRoleRows',
]);
const COVERAGE_BOOLEAN_FIELDS = Object.freeze(['outputTruncated', 'truncated']);
const PROFILE_EVIDENCE_REFRESH_PATHS = new Set([
  PROFILE.reportPath,
  'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
  'docs/product/frontier-ledger.json',
]);

function dateParts(value) {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/u.test(value)) return null;
  const [, yearText, monthText, dayText] = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return null;
  return { year, month, day };
}

export function isC03CalendarWindow(window, expectedMonths) {
  if (!window || !integer(expectedMonths, 1) || window.months !== expectedMonths) return false;
  const start = dateParts(window.start);
  const end = dateParts(window.end);
  if (!start || !end) return false;
  const endMonthIndex = end.year * 12 + end.month - 1;
  const startMonthIndex = endMonthIndex - expectedMonths + 1;
  const startYear = Math.floor(startMonthIndex / 12);
  const startMonth = (startMonthIndex % 12) + 1;
  const expectedStart = `${String(startYear).padStart(4, '0')}-${String(startMonth).padStart(2, '0')}-01`;
  return window.start === expectedStart;
}

export function isC03ProfileEvidenceRefreshPaths(paths) {
  return (
    Array.isArray(paths) &&
    paths.length > 0 &&
    paths.includes(PROFILE.reportPath) &&
    paths.every((item) => typeof item === 'string' && PROFILE_EVIDENCE_REFRESH_PATHS.has(item))
  );
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function uniqueSortedIds(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function summarizeC03ActorResult(result, expectedArguments) {
  if (
    !PROFILE ||
    !result ||
    typeof result !== 'object' ||
    !expectedArguments ||
    expectedArguments.kind !== 'voice' ||
    !integer(expectedArguments.personId, 1)
  ) {
    throw new TypeError('C03 actor summary requires the registered voice-activity profile.');
  }
  const window = result.window;
  const summary = result.summary;
  const coverage = result.coverage;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const byRole = Array.isArray(summary?.byRole) ? summary.byRole : [];
  const roleKeys = byRole.map((item) => item?.key);
  if (
    roleKeys.some((role) => !['main', 'support', 'unknown'].includes(role)) ||
    new Set(roleKeys).size !== roleKeys.length ||
    byRole.some((item) => !integer(item?.creditRows) || !integer(item?.uniqueSubjects))
  ) {
    throw new Error(
      'C03 role distribution contains an invalid, duplicate, or non-voice role bucket.',
    );
  }
  if (rows.length > expectedArguments.maxRows) {
    throw new Error('C03 actor result exceeds the registered row cap.');
  }
  const subjectIds = rows.map((row) => row?.subjectId);
  if (subjectIds.some((id) => !integer(id, 1))) {
    throw new Error('C03 actor result contains an invalid subject id.');
  }
  const roleCounts = Object.fromEntries(
    ['main', 'support', 'unknown'].map((role) => {
      const item = byRole.find((entry) => entry?.key === role);
      return [role, item?.uniqueSubjects ?? 0];
    }),
  );
  const uniqueSubjects = summary?.uniqueSubjects;
  if (
    !integer(uniqueSubjects) ||
    Object.values(roleCounts).some((count) => count > uniqueSubjects)
  ) {
    throw new Error('C03 role counts do not match the bounded unique-subject summary.');
  }
  const state = ['complete', 'partial', 'unavailable', 'not_computable'].includes(result.state)
    ? result.state
    : 'unknown';
  return {
    personId: expectedArguments.personId,
    state,
    window: {
      months: integer(window?.months, 1) ? window.months : null,
      start: typeof window?.start === 'string' ? window.start : null,
      end: typeof window?.end === 'string' ? window.end : null,
      asOfSemantics: typeof window?.asOfSemantics === 'string' ? window.asOfSemantics : null,
    },
    uniqueSubjects,
    roleCounts,
    observedRows: rows.map((row) => ({
      subjectId: row.subjectId,
      roleFamily: ['main', 'support', 'unknown'].includes(row?.roleFamily)
        ? row.roleFamily
        : 'unknown',
    })),
    coverage: {
      relationRowsObserved: integer(coverage?.relationRowsObserved)
        ? coverage.relationRowsObserved
        : null,
      relationRowsSelected: integer(coverage?.relationRowsSelected)
        ? coverage.relationRowsSelected
        : null,
      relationRowsDroppedAtLimit: integer(coverage?.relationRowsDroppedAtLimit)
        ? coverage.relationRowsDroppedAtLimit
        : null,
      subjectDetailsSucceeded: integer(coverage?.subjectDetailsSucceeded)
        ? coverage.subjectDetailsSucceeded
        : null,
      subjectDetailsFailed: integer(coverage?.subjectDetailsFailed)
        ? coverage.subjectDetailsFailed
        : null,
      rowsEligible: integer(coverage?.rowsEligible) ? coverage.rowsEligible : null,
      rowsReturned: integer(coverage?.rowsReturned) ? coverage.rowsReturned : null,
      outputTruncated:
        typeof coverage?.outputTruncated === 'boolean' ? coverage.outputTruncated : null,
      unknownRoleRows: integer(coverage?.staffRoleUnknownRows)
        ? coverage.staffRoleUnknownRows
        : null,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
    },
  };
}

export function buildC03ObservedComparison(actors) {
  if (!PROFILE || !Array.isArray(actors) || actors.length !== PROFILE.calls.length) {
    throw new TypeError('C03 comparison requires the exact registered actor pair.');
  }
  for (let index = 0; index < PROFILE.calls.length; index += 1) {
    if (actors[index]?.personId !== PROFILE.calls[index].arguments.personId) {
      throw new Error('C03 actor order must match the registered argument profile.');
    }
  }
  const firstWindow = actors[0]?.window;
  const secondWindow = actors[1]?.window;
  if (
    !firstWindow ||
    !secondWindow ||
    firstWindow.months !== secondWindow.months ||
    firstWindow.start !== secondWindow.start ||
    firstWindow.end !== secondWindow.end ||
    firstWindow.asOfSemantics !== secondWindow.asOfSemantics
  ) {
    throw new Error('C03 comparison requires the same observed calendar window for both actors.');
  }
  const observedIds = actors.map((actor) =>
    uniqueSortedIds(actor.observedRows.map((row) => row.subjectId)),
  );
  const first = new Set(observedIds[0]);
  const sharedSubjectIds = observedIds[1].filter((id) => first.has(id));
  const observedMainRoleShares = actors.map((actor) => ({
    personId: actor.personId,
    numerator: actor.roleCounts.main,
    denominator: actor.uniqueSubjects,
    ratio: actor.uniqueSubjects > 0 ? actor.roleCounts.main / actor.uniqueSubjects : null,
    state: actor.state,
  }));
  return {
    observedSubjectIds: observedIds,
    sharedSubjectIds,
    observedCommonCount: sharedSubjectIds.length,
    observedMainRoleShares,
    coveragePartial: actors.some(
      (actor) =>
        actor.state !== 'complete' ||
        COVERAGE_COUNTER_FIELDS.some((field) => actor.coverage[field] === null) ||
        COVERAGE_BOOLEAN_FIELDS.some((field) => actor.coverage[field] === null) ||
        actor.coverage.outputTruncated === true ||
        actor.coverage.truncated === true ||
        (actor.coverage.relationRowsDroppedAtLimit ?? 0) > 0 ||
        (actor.coverage.subjectDetailsFailed ?? 0) > 0 ||
        actor.coverage.unknownRoleRows === null ||
        actor.coverage.unknownRoleRows > 0,
    ),
  };
}

export function verifyC03Answer(answerText, actors) {
  if (
    typeof answerText !== 'string' ||
    Buffer.byteLength(answerText, 'utf8') > PROFILE.maxAnswerBytes
  ) {
    return { passed: false, reason: 'ANSWER_BYTES_INVALID' };
  }
  let answer;
  try {
    answer = JSON.parse(answerText);
  } catch {
    return { passed: false, reason: 'ANSWER_NOT_JSON' };
  }
  const comparison = buildC03ObservedComparison(actors);
  const expectedKeys = [
    'schemaVersion',
    'sharedSubjectIds',
    'observedCommonCount',
    'observedMainRoleShares',
    'coverageNote',
  ].sort();
  if (
    !answer ||
    typeof answer !== 'object' ||
    Array.isArray(answer) ||
    Object.keys(answer).sort().join('\0') !== expectedKeys.join('\0') ||
    answer.schemaVersion !== 1 ||
    JSON.stringify(answer.sharedSubjectIds) !== JSON.stringify(comparison.sharedSubjectIds) ||
    answer.observedCommonCount !== comparison.observedCommonCount ||
    !Array.isArray(answer.observedMainRoleShares) ||
    answer.observedMainRoleShares.length !== comparison.observedMainRoleShares.length
  ) {
    return { passed: false, reason: 'ANSWER_SHAPE_OR_VALUES_MISMATCH' };
  }
  for (let index = 0; index < comparison.observedMainRoleShares.length; index += 1) {
    if (
      canonicalAgentMcpProfileJson(answer.observedMainRoleShares[index]) !==
      canonicalAgentMcpProfileJson(comparison.observedMainRoleShares[index])
    ) {
      return { passed: false, reason: 'ROLE_SHARE_MISMATCH' };
    }
  }
  if (
    typeof answer.coverageNote !== 'string' ||
    !/bounded|有限/u.test(answer.coverageNote) ||
    !/unreturned|未返回/u.test(answer.coverageNote) ||
    !/not.*complete|不代表.*全部/u.test(answer.coverageNote)
  ) {
    return { passed: false, reason: 'COVERAGE_LIMITS_OMITTED' };
  }
  return {
    passed: true,
    comparison,
    checks: {
      exactBoundedSubjectOverlap: true,
      exactObservedMainRoleShares: true,
      partialCoverageDisclosed: true,
      omittedWorksNotClaimedAbsent: true,
      noCareerCompletenessClaim: true,
    },
  };
}
