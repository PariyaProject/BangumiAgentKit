import { Buffer } from 'node:buffer';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const R05_PROFILE_ID = 'r05-k-on-season-shared-person-v1';
export const R05_SUBJECT_IDS = Object.freeze([1424, 3774]);
export const R05_COVERAGE_NOTE =
  '只覆盖本次官方 v0 返回的有界关系行，不代表完整演职员表或完整关系图；未返回内容不构成否定证据。';
export const R05_ANSWER_CHECK_FIELDS = Object.freeze([
  'validJsonShape',
  'exactSubjectIds',
  'exactSharedPersonId',
  'creditEvidenceForBothSubjects',
  'castStateCopied',
  'boundedCoverageDisclosure',
  'positiveOnlyOutput',
]);
export const R05_PREFLIGHT_SHARED_PERSON_IDS = Object.freeze([
  3847, 4011, 4633, 5001, 5003, 5072, 5104, 5117, 5118, 5119, 5127, 5228, 23302, 58216, 58217,
  58222, 72254, 78942, 78943, 79084,
]);

const PROFILE = getAgentMcpProfileById(R05_PROFILE_ID);
const STATES = new Set(['complete', 'partial', 'unavailable', 'not_found', 'not_computable']);
const RELATION_STATES = new Set(['complete', 'partial', 'unavailable', 'not_computable']);

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, expected) {
  return (
    isRecord(value) &&
    canonicalAgentMcpProfileJson(Object.keys(value).sort()) ===
      canonicalAgentMcpProfileJson([...expected].sort())
  );
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function sourceTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function validateR05SelectionEvidence(value) {
  const topFields = [
    'schemaVersion',
    'evidenceKind',
    'epochId',
    'observedDate',
    'recordedAt',
    'subjectSearch',
    'selectedSubjects',
    'characterRows',
    'sharedPersonIds',
    'interpretationLimit',
    'authenticationUsed',
    'oauthAttempted',
    'accountDataRead',
    'rawResponsesStored',
    'personNamesStored',
  ];
  if (
    !PROFILE ||
    !exactKeys(value, topFields) ||
    value.schemaVersion !== 1 ||
    value.evidenceKind !== 'bangumi_official_public_r05_shared_person_preflight_v1' ||
    value.epochId !== PROFILE.epochId ||
    value.observedDate !== '2026-10-15' ||
    !sourceTimestamp(value.recordedAt) ||
    !exactKeys(value.subjectSearch, [
      'endpoint',
      'method',
      'keyword',
      'typeFilter',
      'returnedCount',
    ]) ||
    value.subjectSearch.endpoint !== 'https://api.bgm.tv/v0/search/subjects' ||
    value.subjectSearch.method !== 'POST' ||
    value.subjectSearch.keyword !== '轻音少女' ||
    canonicalAgentMcpProfileJson(value.subjectSearch.typeFilter) !== '[2]' ||
    value.subjectSearch.returnedCount !== 3 ||
    !Array.isArray(value.selectedSubjects) ||
    value.selectedSubjects.length !== 2 ||
    !Array.isArray(value.characterRows) ||
    value.characterRows.length !== 2 ||
    !Array.isArray(value.sharedPersonIds) ||
    canonicalAgentMcpProfileJson(value.sharedPersonIds) !==
      canonicalAgentMcpProfileJson(R05_PREFLIGHT_SHARED_PERSON_IDS) ||
    value.interpretationLimit !==
      'Intersection applies only to actor IDs in the returned current rows; it does not establish exhaustive cast coverage or global connectivity.' ||
    value.authenticationUsed !== false ||
    value.oauthAttempted !== false ||
    value.accountDataRead !== false ||
    value.rawResponsesStored !== false ||
    value.personNamesStored !== false
  ) {
    return false;
  }
  const expectedSubjects = [
    { id: 1424, name: 'けいおん！', nameCn: '轻音少女', type: 2, date: '2009-04-02' },
    { id: 3774, name: 'けいおん！！', nameCn: '轻音少女 第二季', type: 2, date: '2010-04-06' },
  ];
  const expectedRows = [
    { subjectId: 1424, rowsReceived: 37, distinctActorIdsReturned: 38 },
    { subjectId: 3774, rowsReceived: 64, distinctActorIdsReturned: 42 },
  ];
  return (
    value.selectedSubjects.length === expectedSubjects.length &&
    value.selectedSubjects.every(
      (subject, index) =>
        exactKeys(subject, ['id', 'name', 'nameCn', 'type', 'date']) &&
        canonicalAgentMcpProfileJson(subject) ===
          canonicalAgentMcpProfileJson(expectedSubjects[index]),
    ) &&
    value.characterRows.length === expectedRows.length &&
    value.characterRows.every(
      (row, index) =>
        exactKeys(row, ['subjectId', 'rowsReceived', 'distinctActorIdsReturned']) &&
        canonicalAgentMcpProfileJson(row) === canonicalAgentMcpProfileJson(expectedRows[index]),
    )
  );
}

function expectedArgumentsMatch(expectedArguments) {
  return Boolean(
    PROFILE &&
    canonicalAgentMcpProfileJson(expectedArguments) ===
      canonicalAgentMcpProfileJson(PROFILE.calls[0].arguments),
  );
}

function projectSideCoverage(side, subjectId) {
  if (
    !isRecord(side) ||
    side.subjectId !== subjectId ||
    !RELATION_STATES.has(side.state) ||
    !nonnegativeInteger(side.rowsObserved) ||
    !nonnegativeInteger(side.rowsReturned) ||
    !nonnegativeInteger(side.uniqueIdsReturned) ||
    !nonnegativeInteger(side.missingIdRows) ||
    typeof side.truncated !== 'boolean' ||
    (side.unknownRoleRows !== undefined && !nonnegativeInteger(side.unknownRoleRows))
  ) {
    throw new Error('R05 side coverage is invalid or not bound to the exact subject.');
  }
  return {
    subjectId,
    state: side.state,
    rowsObserved: side.rowsObserved,
    rowsReturned: side.rowsReturned,
    uniqueIdsReturned: side.uniqueIdsReturned,
    missingIdRows: side.missingIdRows,
    unknownRoleRows: side.unknownRoleRows ?? null,
    truncated: side.truncated,
  };
}

function projectSharedPerson(item) {
  if (!isRecord(item) || !positiveInteger(item.personId) || !Array.isArray(item.credits)) {
    throw new Error('R05 overlap contains an invalid shared-person row.');
  }
  const creditIds = [];
  for (const credit of item.credits) {
    if (
      !isRecord(credit) ||
      !positiveInteger(credit.subjectId) ||
      !Array.isArray(credit.characters)
    ) {
      throw new Error('R05 shared-person credit is invalid.');
    }
    if (!creditIds.includes(credit.subjectId)) creditIds.push(credit.subjectId);
  }
  creditIds.sort((left, right) => left - right);
  return creditIds.length === 2 &&
    creditIds[0] === R05_SUBJECT_IDS[0] &&
    creditIds[1] === R05_SUBJECT_IDS[1]
    ? { personId: item.personId, creditSubjectIds: creditIds }
    : null;
}

export function summarizeR05SubjectOverlapToolResult(result, expectedArguments) {
  if (
    !PROFILE ||
    !isRecord(result) ||
    !expectedArgumentsMatch(expectedArguments) ||
    canonicalAgentMcpProfileJson(result.subjectIds) !==
      canonicalAgentMcpProfileJson(R05_SUBJECT_IDS) ||
    !STATES.has(result.state) ||
    result.kind !== 'cast' ||
    result.castRole !== 'all' ||
    result.formulaVersion !== 'subject-overlap-v1' ||
    !Array.isArray(result.subjects) ||
    result.subjects.length !== 2 ||
    !Array.isArray(result.pairs) ||
    result.pairs.length !== 1
  ) {
    throw new TypeError('R05 summary requires the exact registered K-On! overlap profile.');
  }

  const subjects = result.subjects.map((item, index) => {
    const subjectId = R05_SUBJECT_IDS[index];
    if (
      !isRecord(item) ||
      item.subjectId !== subjectId ||
      !STATES.has(item.state) ||
      !isRecord(item.subject) ||
      item.subject.id !== subjectId ||
      item.subject.type !== 'anime'
    ) {
      throw new Error('R05 subject identity is missing, mismatched, or not an anime.');
    }
    return { subjectId, type: 'anime', state: item.state };
  });

  const pair = result.pairs[0];
  if (
    !isRecord(pair) ||
    pair.pairId !== '1424:3774' ||
    pair.leftSubjectId !== R05_SUBJECT_IDS[0] ||
    pair.rightSubjectId !== R05_SUBJECT_IDS[1] ||
    !isRecord(pair.cast) ||
    !RELATION_STATES.has(pair.cast.state) ||
    !Array.isArray(pair.cast.items) ||
    !isRecord(pair.cast.coverage)
  ) {
    throw new Error('R05 pair result is missing or does not match the fixed subject pair.');
  }

  const castCoverage = pair.cast.coverage;
  const coverage = result.coverage;
  const limits = coverage?.limits;
  if (
    !isRecord(coverage) ||
    coverage.requestedSubjects !== 2 ||
    !nonnegativeInteger(coverage.returnedSubjects) ||
    coverage.requestedPairs !== 1 ||
    coverage.returnedPairs !== 1 ||
    coverage.omittedPairs !== 0 ||
    typeof coverage.truncated !== 'boolean' ||
    !isRecord(limits) ||
    limits.maxCast !== 80 ||
    limits.maxPairs !== 1 ||
    limits.maxPeople !== 8 ||
    !RELATION_STATES.has(castCoverage.state) ||
    castCoverage.returned !== pair.cast.items.length ||
    !nonnegativeInteger(castCoverage.returned) ||
    !nonnegativeInteger(castCoverage.omitted) ||
    typeof castCoverage.truncated !== 'boolean'
  ) {
    throw new Error('R05 result coverage or fixed tool limits are invalid.');
  }

  const left = projectSideCoverage(castCoverage.left, R05_SUBJECT_IDS[0]);
  const right = projectSideCoverage(castCoverage.right, R05_SUBJECT_IDS[1]);
  const sharedPeople = [];
  for (const item of pair.cast.items) {
    const person = projectSharedPerson(item);
    if (person && sharedPeople.length === 0) sharedPeople.push(person);
  }

  const official = result.source?.official;
  const derived = result.source?.derived;
  const officialOperations = Array.isArray(official?.operations)
    ? official.operations.filter(
        (operation) =>
          typeof operation === 'string' && /^[A-Za-z0-9_ ./:{}-]{1,100}$/u.test(operation),
      )
    : [];
  const derivedOperations = Array.isArray(derived?.operations)
    ? derived.operations.filter(
        (operation) =>
          typeof operation === 'string' && /^[A-Za-z0-9_ ./:{}-]{1,100}$/u.test(operation),
      )
    : [];
  if (
    !isRecord(official) ||
    official.class !== 'official-v0' ||
    officialOperations.length === 0 ||
    !sourceTimestamp(official.attemptedAt) ||
    (official.retrievedAt !== undefined && !sourceTimestamp(official.retrievedAt)) ||
    !isRecord(derived) ||
    derived.class !== 'derived-s7' ||
    derivedOperations.length === 0 ||
    !sourceTimestamp(derived.attemptedAt) ||
    !sourceTimestamp(derived.retrievedAt) ||
    !Array.isArray(result.warnings)
  ) {
    throw new Error('R05 source provenance is incomplete.');
  }

  return {
    subjectIds: [...R05_SUBJECT_IDS],
    state: result.state,
    kind: 'cast',
    castRole: 'all',
    formulaVersion: 'subject-overlap-v1',
    subjects,
    pair: {
      pairId: '1424:3774',
      leftSubjectId: R05_SUBJECT_IDS[0],
      rightSubjectId: R05_SUBJECT_IDS[1],
      rank: pair.rank,
      cast: {
        state: pair.cast.state,
        sharedPeople,
        coverage: {
          state: castCoverage.state,
          left,
          right,
          candidateIds: nonnegativeInteger(castCoverage.candidateIds)
            ? castCoverage.candidateIds
            : null,
          matchedIds: nonnegativeInteger(castCoverage.matchedIds) ? castCoverage.matchedIds : null,
          unionIds: nonnegativeInteger(castCoverage.unionIds) ? castCoverage.unionIds : null,
          returned: castCoverage.returned,
          omitted: castCoverage.omitted,
          truncated: castCoverage.truncated,
        },
      },
    },
    coverage: {
      requestedSubjects: 2,
      returnedSubjects: coverage.returnedSubjects,
      requestedPairs: 1,
      returnedPairs: 1,
      omittedPairs: 0,
      limits: {
        maxCast: limits.maxCast,
        maxPairs: limits.maxPairs,
        maxPeople: limits.maxPeople,
      },
      truncated: coverage.truncated,
    },
    source: {
      official: {
        class: 'official-v0',
        operations: officialOperations,
        attemptedAt: official.attemptedAt,
        retrievedAt: official.retrievedAt ?? null,
      },
      derived: {
        class: 'derived-s7',
        operations: derivedOperations,
        attemptedAt: derived.attemptedAt,
        retrievedAt: derived.retrievedAt,
      },
    },
    warnings: result.warnings.map((warning) => {
      if (!isRecord(warning) || typeof warning.code !== 'string' || !STATES.has(warning.state)) {
        throw new Error('R05 warning summary is invalid.');
      }
      return {
        code: warning.code,
        state: warning.state,
        subjectId: positiveInteger(warning.subjectId) ? warning.subjectId : null,
      };
    }),
  };
}

export function buildR05McpTextProjection(resultSummary) {
  if (!validateR05ResultSummary(resultSummary)) {
    throw new TypeError('R05 text projection requires a validated sanitized result summary.');
  }
  return {
    subjectIds: resultSummary.subjectIds,
    kind: resultSummary.kind,
    castRole: resultSummary.castRole,
    pairs: [
      {
        pairId: resultSummary.pair.pairId,
        leftSubjectId: resultSummary.pair.leftSubjectId,
        rightSubjectId: resultSummary.pair.rightSubjectId,
        rank: resultSummary.pair.rank,
        cast: {
          state: resultSummary.pair.cast.state,
          sharedPeople: resultSummary.pair.cast.sharedPeople,
          sharedPeopleOmittedFromText: Math.max(
            0,
            resultSummary.pair.cast.coverage.returned - resultSummary.pair.cast.sharedPeople.length,
          ),
          coverage: {
            state: resultSummary.pair.cast.coverage.state,
            returned: resultSummary.pair.cast.coverage.returned,
            omitted: resultSummary.pair.cast.coverage.omitted,
            truncated: resultSummary.pair.cast.coverage.truncated,
          },
        },
      },
    ],
    pairsOmittedFromText: 0,
    coverage: {
      requestedSubjects: resultSummary.coverage.requestedSubjects,
      returnedSubjects: resultSummary.coverage.returnedSubjects,
      requestedPairs: resultSummary.coverage.requestedPairs,
      returnedPairs: resultSummary.coverage.returnedPairs,
      omittedPairs: resultSummary.coverage.omittedPairs,
      truncated: resultSummary.coverage.truncated,
    },
    scopeNote: R05_COVERAGE_NOTE,
  };
}

export function validateR05ResultSummary(value) {
  const summaryFields = [
    'subjectIds',
    'state',
    'kind',
    'castRole',
    'formulaVersion',
    'subjects',
    'pair',
    'coverage',
    'source',
    'warnings',
  ];
  if (
    !PROFILE ||
    !exactKeys(value, summaryFields) ||
    canonicalAgentMcpProfileJson(value.subjectIds) !==
      canonicalAgentMcpProfileJson(R05_SUBJECT_IDS) ||
    !STATES.has(value.state) ||
    value.kind !== 'cast' ||
    value.castRole !== 'all' ||
    value.formulaVersion !== 'subject-overlap-v1' ||
    !Array.isArray(value.subjects) ||
    value.subjects.length !== 2 ||
    !value.subjects.every(
      (subject, index) =>
        exactKeys(subject, ['subjectId', 'type', 'state']) &&
        subject.subjectId === R05_SUBJECT_IDS[index] &&
        subject.type === 'anime' &&
        STATES.has(subject.state),
    ) ||
    !exactKeys(value.pair, ['pairId', 'leftSubjectId', 'rightSubjectId', 'rank', 'cast']) ||
    value.pair.pairId !== '1424:3774' ||
    value.pair.leftSubjectId !== R05_SUBJECT_IDS[0] ||
    value.pair.rightSubjectId !== R05_SUBJECT_IDS[1] ||
    value.pair.rank !== 1 ||
    !exactKeys(value.pair.cast, ['state', 'sharedPeople', 'coverage']) ||
    !RELATION_STATES.has(value.pair.cast.state) ||
    !Array.isArray(value.pair.cast.sharedPeople) ||
    value.pair.cast.sharedPeople.length > 1 ||
    !exactKeys(value.pair.cast.coverage, [
      'state',
      'left',
      'right',
      'candidateIds',
      'matchedIds',
      'unionIds',
      'returned',
      'omitted',
      'truncated',
    ]) ||
    value.pair.cast.coverage.state !== value.pair.cast.state ||
    !exactKeys(value.pair.cast.coverage.left, [
      'subjectId',
      'state',
      'rowsObserved',
      'rowsReturned',
      'uniqueIdsReturned',
      'missingIdRows',
      'unknownRoleRows',
      'truncated',
    ]) ||
    !exactKeys(value.pair.cast.coverage.right, [
      'subjectId',
      'state',
      'rowsObserved',
      'rowsReturned',
      'uniqueIdsReturned',
      'missingIdRows',
      'unknownRoleRows',
      'truncated',
    ]) ||
    value.pair.cast.coverage.left.subjectId !== R05_SUBJECT_IDS[0] ||
    value.pair.cast.coverage.right.subjectId !== R05_SUBJECT_IDS[1] ||
    ![value.pair.cast.coverage.left, value.pair.cast.coverage.right].every(
      (side) =>
        RELATION_STATES.has(side.state) &&
        nonnegativeInteger(side.rowsObserved) &&
        nonnegativeInteger(side.rowsReturned) &&
        nonnegativeInteger(side.uniqueIdsReturned) &&
        nonnegativeInteger(side.missingIdRows) &&
        (side.unknownRoleRows === null || nonnegativeInteger(side.unknownRoleRows)) &&
        typeof side.truncated === 'boolean',
    ) ||
    ![
      value.pair.cast.coverage.candidateIds,
      value.pair.cast.coverage.matchedIds,
      value.pair.cast.coverage.unionIds,
    ].every((count) => count === null || nonnegativeInteger(count)) ||
    !nonnegativeInteger(value.pair.cast.coverage.returned) ||
    !nonnegativeInteger(value.pair.cast.coverage.omitted) ||
    typeof value.pair.cast.coverage.truncated !== 'boolean' ||
    !exactKeys(value.coverage, [
      'requestedSubjects',
      'returnedSubjects',
      'requestedPairs',
      'returnedPairs',
      'omittedPairs',
      'limits',
      'truncated',
    ]) ||
    value.coverage.requestedSubjects !== 2 ||
    value.coverage.returnedSubjects !== 2 ||
    value.coverage.requestedPairs !== 1 ||
    value.coverage.returnedPairs !== 1 ||
    value.coverage.omittedPairs !== 0 ||
    !exactKeys(value.coverage.limits, ['maxCast', 'maxPairs', 'maxPeople']) ||
    value.coverage.limits.maxCast !== 80 ||
    value.coverage.limits.maxPairs !== 1 ||
    value.coverage.limits.maxPeople !== 8 ||
    typeof value.coverage.truncated !== 'boolean' ||
    !exactKeys(value.source, ['official', 'derived']) ||
    !exactKeys(value.source.official, ['class', 'operations', 'attemptedAt', 'retrievedAt']) ||
    value.source.official.class !== 'official-v0' ||
    !Array.isArray(value.source.official.operations) ||
    value.source.official.operations.length === 0 ||
    !value.source.official.operations.every(
      (operation) =>
        typeof operation === 'string' && /^[A-Za-z0-9_ ./:{}-]{1,100}$/u.test(operation),
    ) ||
    !sourceTimestamp(value.source.official.attemptedAt) ||
    (value.source.official.retrievedAt !== null &&
      !sourceTimestamp(value.source.official.retrievedAt)) ||
    !exactKeys(value.source.derived, ['class', 'operations', 'attemptedAt', 'retrievedAt']) ||
    value.source.derived.class !== 'derived-s7' ||
    !Array.isArray(value.source.derived.operations) ||
    value.source.derived.operations.length === 0 ||
    !value.source.derived.operations.every(
      (operation) =>
        typeof operation === 'string' && /^[A-Za-z0-9_ ./:{}-]{1,100}$/u.test(operation),
    ) ||
    !sourceTimestamp(value.source.derived.attemptedAt) ||
    !sourceTimestamp(value.source.derived.retrievedAt) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        exactKeys(warning, ['code', 'state', 'subjectId']) &&
        typeof warning.code === 'string' &&
        /^[A-Z0-9_]{1,80}$/u.test(warning.code) &&
        STATES.has(warning.state) &&
        (warning.subjectId === null || positiveInteger(warning.subjectId)),
    )
  ) {
    return false;
  }
  return value.pair.cast.sharedPeople.every(
    (person) =>
      exactKeys(person, ['personId', 'creditSubjectIds']) &&
      positiveInteger(person.personId) &&
      R05_PREFLIGHT_SHARED_PERSON_IDS.includes(person.personId) &&
      canonicalAgentMcpProfileJson(person.creditSubjectIds) ===
        canonicalAgentMcpProfileJson(R05_SUBJECT_IDS),
  );
}

export function verifyR05Answer(answerText, resultSummary) {
  const failedChecks = Object.fromEntries(R05_ANSWER_CHECK_FIELDS.map((field) => [field, false]));
  if (
    typeof answerText !== 'string' ||
    Buffer.byteLength(answerText, 'utf8') > (PROFILE?.maxAnswerBytes ?? 0) ||
    !validateR05ResultSummary(resultSummary)
  ) {
    return {
      passed: false,
      reason: 'R05_ANSWER_BYTES_OR_SUMMARY_INVALID',
      answerChecks: failedChecks,
    };
  }
  let answer;
  try {
    answer = JSON.parse(answerText);
  } catch {
    return { passed: false, reason: 'R05_ANSWER_JSON_INVALID', answerChecks: failedChecks };
  }
  const sharedPerson = resultSummary.pair.cast.sharedPeople[0] ?? null;
  const validJsonShape = exactKeys(answer, [
    'subjectIds',
    'sharedPerson',
    'castState',
    'coverageNote',
  ]);
  const checks = {
    validJsonShape,
    exactSubjectIds:
      validJsonShape &&
      canonicalAgentMcpProfileJson(answer.subjectIds) ===
        canonicalAgentMcpProfileJson(R05_SUBJECT_IDS),
    exactSharedPersonId:
      validJsonShape &&
      sharedPerson !== null &&
      exactKeys(answer.sharedPerson, ['personId', 'creditSubjectIds']) &&
      canonicalAgentMcpProfileJson(answer.sharedPerson) ===
        canonicalAgentMcpProfileJson(sharedPerson),
    creditEvidenceForBothSubjects:
      validJsonShape &&
      sharedPerson !== null &&
      canonicalAgentMcpProfileJson(answer.sharedPerson?.creditSubjectIds) ===
        canonicalAgentMcpProfileJson(R05_SUBJECT_IDS),
    castStateCopied: validJsonShape && answer.castState === resultSummary.pair.cast.state,
    boundedCoverageDisclosure: validJsonShape && answer.coverageNote === R05_COVERAGE_NOTE,
    positiveOnlyOutput:
      validJsonShape &&
      sharedPerson !== null &&
      Object.keys(answer).length === R05_ANSWER_CHECK_FIELDS.length - 3,
  };
  return {
    passed: R05_ANSWER_CHECK_FIELDS.every((field) => checks[field] === true),
    reason: R05_ANSWER_CHECK_FIELDS.every((field) => checks[field] === true)
      ? null
      : 'R05_ANSWER_ASSERTION_FAILED',
    answerChecks: checks,
  };
}

export function validateR05McpTextProjection(text, resultSummary) {
  if (typeof text !== 'string' || !validateR05ResultSummary(resultSummary)) {
    return { passed: false, reason: 'R05_MCP_TEXT_OR_SUMMARY_INVALID' };
  }
  let projection;
  try {
    projection = JSON.parse(text);
  } catch {
    return { passed: false, reason: 'R05_MCP_TEXT_NOT_JSON' };
  }
  const expected = buildR05McpTextProjection(resultSummary);
  const passed =
    Buffer.byteLength(text, 'utf8') <= 3600 &&
    canonicalAgentMcpProfileJson(projection) === canonicalAgentMcpProfileJson(expected);
  return { passed, reason: passed ? null : 'R05_MCP_TEXT_PROJECTION_MISMATCH' };
}
