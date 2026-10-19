export const C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID =
  'c03-person-activity-offline-agent-mcp-matrix-v2';
export const C03_PERSON_ACTIVITY_OFFLINE_V2_EPOCH_ID =
  'run95-c03-person-activity-offline-agent-mcp-matrix-v2-20261019';
export const C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE =
  'run95-c03-person-activity-offline-matrix-v2';
export const C03_PERSON_ACTIVITY_OFFLINE_V2_ARGUMENT_PROFILE =
  'fixed-c03-synthetic-person-activity-v2-20261019-one-person-12m-v1';
export const C03_PERSON_ACTIVITY_OFFLINE_V2_PERSON_ID = 991237;
export const C03_PERSON_ACTIVITY_OFFLINE_V2_SUBJECT_ID = 991238;
export const C03_PERSON_ACTIVITY_TOOL_NAME = 'bangumi.get_person_activity';
export const C03_PERSON_ACTIVITY_OFFLINE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  personId: C03_PERSON_ACTIVITY_OFFLINE_V2_PERSON_ID,
  kind: 'voice',
  media: 'tv',
  windowMonths: 12,
  maxRelations: 1,
  maxSubjectDetails: 1,
  maxRows: 1,
});
export const C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS = Object.freeze([
  'resultState',
  'windowMonths',
  'uniqueSubjects',
  'roleCounts',
  'coverage',
]);
export const C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'rowsEligible',
  'rowsReturned',
  'unknownRoleRows',
  'outputTruncated',
  'truncated',
]);

const OPTIONAL_COUNT = Object.freeze({
  anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }],
});
const OPTIONAL_BOOLEAN = Object.freeze({ anyOf: [{ type: 'boolean' }, { type: 'null' }] });
export const C03_PERSON_ACTIVITY_OFFLINE_V2_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    resultState: { enum: ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'] },
    windowMonths: { type: 'integer', minimum: 0, maximum: 120 },
    uniqueSubjects: OPTIONAL_COUNT,
    roleCounts: {
      type: 'object',
      properties: { main: OPTIONAL_COUNT, support: OPTIONAL_COUNT, unknown: OPTIONAL_COUNT },
      required: ['main', 'support', 'unknown'],
      additionalProperties: false,
    },
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
        unknownRoleRows: OPTIONAL_COUNT,
        outputTruncated: OPTIONAL_BOOLEAN,
        truncated: OPTIONAL_BOOLEAN,
      },
      required: [...C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS],
      additionalProperties: false,
    },
  },
  required: [...C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS],
  additionalProperties: false,
});

const REQUESTS = Object.freeze([
  {
    path: '/v0/persons/991237',
    operation: 'person',
    response: {
      id: C03_PERSON_ACTIVITY_OFFLINE_V2_PERSON_ID,
      name: 'Synthetic Person Activity Fixture',
      career: ['seiyu'],
      infobox: [],
    },
  },
  {
    path: '/v0/persons/991237/characters',
    operation: 'characters',
    response: [
      {
        id: 991247,
        name: 'Synthetic Role',
        subject_id: C03_PERSON_ACTIVITY_OFFLINE_V2_SUBJECT_ID,
        subject_type: 2,
        subject_name: 'Synthetic Activity Work',
        staff: '主角',
      },
    ],
  },
  {
    path: '/v0/subjects/991238',
    operation: 'subject_detail',
    response: {
      id: C03_PERSON_ACTIVITY_OFFLINE_V2_SUBJECT_ID,
      type: 2,
      name: 'Synthetic Activity Work',
      name_cn: '合成作品',
      date: '2026-08-14',
      platform: 'TV',
      rating: { score: 8.4, rank: 1, total: 1, count: {} },
      meta_tags: ['原创'],
    },
  },
]);

export function isC03PersonActivityOfflineV2ProfileId(profileId) {
  return profileId === C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID;
}

export function assertC03PersonActivityOfflineV2Profile(profile) {
  return Boolean(
    profile &&
    profile.id === C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID &&
    profile.frontierId === 'C03' &&
    profile.epochId === C03_PERSON_ACTIVITY_OFFLINE_V2_EPOCH_ID &&
    profile.toolName === C03_PERSON_ACTIVITY_TOOL_NAME &&
    profile.argumentProfile === C03_PERSON_ACTIVITY_OFFLINE_V2_ARGUMENT_PROFILE &&
    profile.claimLabelName === 'harness-r95-c03-activity-mtx-v2-claimed' &&
    profile.reportPath === 'docs/live-probes/c03-person-activity-offline-agent-mcp-run95-v2.json' &&
    profile.selectionEvidencePath ===
      'docs/research/run95-c03-person-activity-offline-matrix-v2-contract-2026-10-19.md' &&
    profile.evidenceKind === 'codex_cli_c03_person_activity_offline_agent_mcp_matrix_v2' &&
    profile.answerCheckMethod === 'c03-synthetic-person-activity-result-schema-v1' &&
    profile.acceptanceScope === 'agent-mcp-matrix-only' &&
    profile.networkMode === C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE &&
    profile.model === 'gpt-6-luna' &&
    profile.reasoningEffort === 'max' &&
    profile.maxAnswerBytes === 1536 &&
    Array.isArray(profile.calls) &&
    profile.calls.length === 1 &&
    profile.calls[0]?.toolName === C03_PERSON_ACTIVITY_TOOL_NAME &&
    JSON.stringify(profile.calls[0]?.arguments) ===
      JSON.stringify(C03_PERSON_ACTIVITY_OFFLINE_V2_EXPECTED_ARGUMENTS),
  );
}

export function summarizeC03PersonActivityOfflineV2Result(result) {
  const states = new Set(['complete', 'partial', 'unavailable', 'not_computable']);
  const byRole = Array.isArray(result?.summary?.byRole) ? result.summary.byRole : [];
  const counter = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
  const roleCounts = Object.fromEntries(
    ['main', 'support', 'unknown'].map((key) => {
      const role = byRole.find((item) => item?.key === key);
      return [key, counter(role?.uniqueSubjects)];
    }),
  );
  const coverage = result?.coverage;
  return {
    resultState: states.has(result?.state) ? result.state : 'unknown',
    windowMonths: counter(result?.window?.months),
    uniqueSubjects: counter(result?.summary?.uniqueSubjects),
    roleCounts,
    coverage: {
      relationRowsObserved: counter(coverage?.relationRowsObserved),
      relationRowsSelected: counter(coverage?.relationRowsSelected),
      relationRowsDroppedAtLimit: counter(coverage?.relationRowsDroppedAtLimit),
      subjectDetailsSucceeded: counter(coverage?.subjectDetailsSucceeded),
      subjectDetailsFailed: counter(coverage?.subjectDetailsFailed),
      rowsEligible: counter(coverage?.rowsEligible),
      rowsReturned: counter(coverage?.rowsReturned),
      unknownRoleRows: counter(coverage?.staffRoleUnknownRows),
      outputTruncated:
        typeof coverage?.outputTruncated === 'boolean' ? coverage.outputTruncated : null,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
    },
  };
}

export function isC03PersonActivityOfflineV2Projection(value) {
  const isCount = (item) => item === null || (Number.isSafeInteger(item) && item >= 0);
  const exactKeys = (item, keys) =>
    Boolean(
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      JSON.stringify(Object.keys(item).sort()) === JSON.stringify([...keys].sort()),
    );
  return Boolean(
    exactKeys(value, C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS) &&
    ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      value.resultState,
    ) &&
    Number.isSafeInteger(value.windowMonths) &&
    value.windowMonths >= 0 &&
    value.windowMonths <= 120 &&
    isCount(value.uniqueSubjects) &&
    exactKeys(value.roleCounts, ['main', 'support', 'unknown']) &&
    Object.values(value.roleCounts).every(isCount) &&
    exactKeys(value.coverage, C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS) &&
    C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS.every((key) =>
      ['outputTruncated', 'truncated'].includes(key)
        ? value.coverage[key] === null || typeof value.coverage[key] === 'boolean'
        : isCount(value.coverage[key]),
    ),
  );
}

export function createC03PersonActivityOfflineV2Fetch(profile) {
  if (!assertC03PersonActivityOfflineV2Profile(profile)) {
    throw new Error('The registered C03 activity v2 profile does not match its fixed fixture.');
  }
  let requestCount = 0;
  let personRequestCount = 0;
  let characterRequestCount = 0;
  let subjectDetailRequestCount = 0;
  let unexpectedRequestCount = 0;
  let authorizationHeaderCount = 0;
  let expectedIndex = 0;
  const operations = [];

  const snapshot = () => ({
    profile: profile.networkMode,
    requestCount,
    personRequestCount,
    characterRequestCount,
    subjectDetailRequestCount,
    unexpectedRequestCount,
    authorizationHeaderCount,
    expectedOperationsComplete:
      requestCount === REQUESTS.length &&
      expectedIndex === REQUESTS.length &&
      unexpectedRequestCount === 0,
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
    let pathname = null;
    try {
      pathname = new URL(
        input instanceof Request ? input.url : input instanceof URL ? input.href : String(input),
      ).pathname;
    } catch {
      pathname = '';
    }
    const expected = REQUESTS[expectedIndex];
    if (!expected || method !== 'GET' || pathname !== expected.path) {
      unexpectedRequestCount += 1;
      operations.push('unexpected');
      return new Response(JSON.stringify({ error: 'unexpected synthetic request' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    expectedIndex += 1;
    operations.push(expected.operation);
    if (expected.operation === 'person') personRequestCount += 1;
    else if (expected.operation === 'characters') characterRequestCount += 1;
    else if (expected.operation === 'subject_detail') subjectDetailRequestCount += 1;
    return new Response(JSON.stringify(expected.response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetchFn, snapshot };
}
