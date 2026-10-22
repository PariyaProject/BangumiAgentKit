export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID =
  'p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023';
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EPOCH_ID =
  'run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023';
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE =
  'run95-p01-person-activity-director-offline-matrix-v1-20261023';
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_ARGUMENT_PROFILE =
  'fixed-p01-synthetic-person-activity-director-36m-one-person-v1-20261023';
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PERSON_ID = 991337;
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_MATCH_SUBJECT_ID = 991338;
export const P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME = 'bangumi.get_person_activity';

export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PERSON_ID,
  kind: 'staff',
  staffRole: 'director',
  media: 'anime',
  windowMonths: 36,
  maxRelations: 3,
  maxSubjectDetails: 1,
  maxRows: 1,
});

export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROJECTION_KEYS = Object.freeze([
  'resultState',
  'windowMonths',
  'matchedDirectorRows',
  'excludedOtherRoleRows',
  'unknownRoleRows',
  'coverage',
]);
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_COVERAGE_KEYS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'rowsEligible',
  'rowsReturned',
  'outputTruncated',
  'truncated',
]);

const OPTIONAL_COUNT = Object.freeze({
  anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }],
});
const OPTIONAL_BOOLEAN = Object.freeze({ anyOf: [{ type: 'boolean' }, { type: 'null' }] });
export const P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    resultState: { enum: ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'] },
    windowMonths: { type: 'integer', minimum: 0, maximum: 120 },
    matchedDirectorRows: OPTIONAL_COUNT,
    excludedOtherRoleRows: OPTIONAL_COUNT,
    unknownRoleRows: OPTIONAL_COUNT,
    coverage: {
      type: 'object',
      properties: {
        relationRowsObserved: OPTIONAL_COUNT,
        relationRowsSelected: OPTIONAL_COUNT,
        relationRowsDroppedAtLimit: OPTIONAL_COUNT,
        subjectDetailsSucceeded: OPTIONAL_COUNT,
        subjectDetailsFailed: OPTIONAL_COUNT,
        rowsEligible: OPTIONAL_COUNT,
        rowsReturned: OPTIONAL_COUNT,
        outputTruncated: OPTIONAL_BOOLEAN,
        truncated: OPTIONAL_BOOLEAN,
      },
      required: [...P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_COVERAGE_KEYS],
      additionalProperties: false,
    },
  },
  required: [...P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROJECTION_KEYS],
  additionalProperties: false,
});

const ORIGIN = 'https://api.bgm.tv';
const REQUESTS = Object.freeze([
  {
    path: `/v0/persons/${P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PERSON_ID}`,
    operation: 'person',
    response: {
      id: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PERSON_ID,
      name: 'Synthetic Director Filter Fixture',
      career: ['staff'],
      infobox: [],
    },
  },
  {
    path: `/v0/persons/${P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PERSON_ID}/subjects`,
    operation: 'subjects',
    response: [
      {
        id: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_MATCH_SUBJECT_ID,
        type: 2,
        name: 'Synthetic Director Match',
        name_cn: '合成导演匹配',
        staff: 'director',
      },
      {
        id: 991339,
        type: 2,
        name: 'Synthetic Nonmatching Role',
        name_cn: '合成非匹配职务',
        staff: 'script',
      },
      {
        id: 991340,
        type: 2,
        name: 'Synthetic Unknown Role',
        name_cn: '合成未知职务',
        staff: '',
      },
    ],
  },
  {
    path: `/v0/subjects/${P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_MATCH_SUBJECT_ID}`,
    operation: 'subject_detail',
    response: {
      id: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_MATCH_SUBJECT_ID,
      type: 2,
      name: 'Synthetic Director Match',
      name_cn: '合成导演匹配',
      date: '2025-05-01',
      platform: 'TV',
      rating: { score: 8, rank: 1, total: 1, count: {} },
      meta_tags: ['原创'],
    },
  },
]);

export function isP01PersonActivityDirectorOfflineProfileId(profileId) {
  return profileId === P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID;
}

export function assertP01PersonActivityDirectorOfflineProfile(profile) {
  return Boolean(
    profile &&
    profile.id === P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID &&
    profile.frontierId === 'P01' &&
    profile.epochId === P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EPOCH_ID &&
    profile.toolName === P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME &&
    profile.argumentProfile === P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_ARGUMENT_PROFILE &&
    profile.claimLabelName === 'harness-r95-p01-person-director-mtx-v1-claimed' &&
    profile.reportPath === 'docs/live-probes/p01-person-activity-director-offline-run95-v1.json' &&
    profile.selectionEvidencePath ===
      'docs/research/run95-p01-person-activity-director-offline-matrix-contract-2026-10-23.md' &&
    profile.evidenceKind === 'codex_cli_p01_person_activity_director_offline_agent_mcp_matrix_v1' &&
    profile.answerCheckMethod === 'p01-director-filter-result-schema-v1' &&
    profile.acceptanceScope === 'agent-mcp-matrix-only' &&
    profile.networkMode === P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE &&
    profile.model === 'gpt-6-luna' &&
    profile.reasoningEffort === 'max' &&
    profile.maxAnswerBytes === 1536 &&
    Array.isArray(profile.calls) &&
    profile.calls.length === 1 &&
    profile.calls[0]?.toolName === P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME &&
    JSON.stringify(profile.calls[0]?.arguments) ===
      JSON.stringify(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EXPECTED_ARGUMENTS),
  );
}

export function summarizeP01PersonActivityDirectorOfflineResult(result) {
  const states = new Set(['complete', 'partial', 'unavailable', 'not_computable']);
  const coverage = result?.coverage;
  const counter = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
  const excluded = counter(coverage?.staffRoleExcludedRows);
  const unknown = counter(coverage?.staffRoleUnknownRows);
  const observed = counter(coverage?.relationRowsObserved);
  return {
    resultState: states.has(result?.state) ? result.state : 'unknown',
    windowMonths: counter(result?.window?.months),
    matchedDirectorRows:
      excluded !== null && observed !== null ? Math.max(0, observed - excluded) : null,
    excludedOtherRoleRows:
      excluded !== null && unknown !== null ? Math.max(0, excluded - unknown) : null,
    unknownRoleRows: unknown,
    coverage: {
      relationRowsObserved: observed,
      relationRowsSelected: counter(coverage?.relationRowsSelected),
      relationRowsDroppedAtLimit: counter(coverage?.relationRowsDroppedAtLimit),
      subjectDetailsSucceeded: counter(coverage?.subjectDetailsSucceeded),
      subjectDetailsFailed: counter(coverage?.subjectDetailsFailed),
      rowsEligible: counter(coverage?.rowsEligible),
      rowsReturned: counter(coverage?.rowsReturned),
      outputTruncated:
        typeof coverage?.outputTruncated === 'boolean' ? coverage.outputTruncated : null,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
    },
  };
}

export function isP01PersonActivityDirectorOfflineProjection(value) {
  const isCount = (item) => item === null || (Number.isSafeInteger(item) && item >= 0);
  const exactKeys = (item, keys) =>
    Boolean(
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      JSON.stringify(Object.keys(item).sort()) === JSON.stringify([...keys].sort()),
    );
  return Boolean(
    exactKeys(value, P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROJECTION_KEYS) &&
    ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(value.resultState) &&
    Number.isSafeInteger(value.windowMonths) &&
    value.windowMonths >= 0 &&
    value.windowMonths <= 120 &&
    isCount(value.matchedDirectorRows) &&
    isCount(value.excludedOtherRoleRows) &&
    isCount(value.unknownRoleRows) &&
    exactKeys(value.coverage, P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_COVERAGE_KEYS) &&
    P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_COVERAGE_KEYS.every((key) =>
      ['outputTruncated', 'truncated'].includes(key)
        ? value.coverage[key] === null || typeof value.coverage[key] === 'boolean'
        : isCount(value.coverage[key]),
    ),
  );
}

export function createP01PersonActivityDirectorOfflineFetch(profile) {
  if (!assertP01PersonActivityDirectorOfflineProfile(profile)) {
    throw new Error('The P01 director profile does not match its fixed synthetic contract.');
  }
  let requestCount = 0;
  let personRequestCount = 0;
  let subjectsRequestCount = 0;
  let subjectDetailRequestCount = 0;
  let unexpectedRequestCount = 0;
  let authorizationHeaderCount = 0;
  let expectedIndex = 0;
  const operations = [];

  const snapshot = () => ({
    profile: profile.networkMode,
    requestCount,
    personRequestCount,
    subjectsRequestCount,
    subjectDetailRequestCount,
    unexpectedRequestCount,
    authorizationHeaderCount,
    expectedOperationsComplete:
      requestCount === REQUESTS.length &&
      expectedIndex === REQUESTS.length &&
      unexpectedRequestCount === 0 &&
      authorizationHeaderCount === 0,
    operations: [...operations],
  });

  const fetchFn = async (input, init = {}) => {
    requestCount += 1;
    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (headers.has('authorization')) authorizationHeaderCount += 1;
    const method = String(
      init.method ?? (input instanceof Request ? input.method : 'GET'),
    ).toUpperCase();
    const body = init.body ?? (input instanceof Request ? input.body : null);
    let url;
    try {
      url = new URL(
        input instanceof Request ? input.url : input instanceof URL ? input.href : String(input),
      );
    } catch {
      url = null;
    }
    const expected = REQUESTS[expectedIndex];
    const valid = Boolean(
      expected &&
      url &&
      url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      url.pathname === expected.path &&
      url.search === '' &&
      url.hash === '' &&
      method === 'GET' &&
      body === null &&
      !headers.has('authorization'),
    );
    if (!valid) {
      unexpectedRequestCount += 1;
      operations.push('denied');
      return new Response(JSON.stringify({ error: 'unexpected synthetic request' }), {
        status: headers.has('authorization') ? 401 : 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    expectedIndex += 1;
    operations.push(expected.operation);
    if (expected.operation === 'person') personRequestCount += 1;
    else if (expected.operation === 'subjects') subjectsRequestCount += 1;
    else if (expected.operation === 'subject_detail') subjectDetailRequestCount += 1;
    return new Response(JSON.stringify(expected.response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetchFn, snapshot };
}
