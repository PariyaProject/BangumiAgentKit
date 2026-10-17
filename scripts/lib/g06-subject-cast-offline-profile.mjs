export const G06_CAST_OFFLINE_PROFILE_ID = 'g06-cast-offline-agent-mcp-matrix-v1';
export const G06_CAST_OFFLINE_EPOCH_ID = 'run95-g06-subject-cast-offline-agent-mcp-matrix-20261017';
export const G06_CAST_OFFLINE_NETWORK_MODE = 'run95-g06-subject-cast-offline-v1';
export const G06_CAST_OFFLINE_ARGUMENT_PROFILE = 'fixed-g06-synthetic-subject-cast-two-rows-v1';
export const G06_CAST_OFFLINE_SYNTHETIC_SUBJECT_ID = 990804;
export const G06_CAST_OFFLINE_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: G06_CAST_OFFLINE_SYNTHETIC_SUBJECT_ID,
  limit: 2,
});
export const G06_CAST_OFFLINE_REPORT_PATH =
  'docs/live-probes/g06-subject-cast-offline-agent-mcp-run95.json';
export const G06_CAST_OFFLINE_SELECTION_PATH =
  'docs/research/run95-g06-subject-cast-offline-agent-mcp-matrix-contract-2026-10-17.md';
export const G06_CAST_OFFLINE_EVIDENCE_KIND = 'codex_cli_g06_subject_cast_offline_agent_mcp';
export const G06_CAST_OFFLINE_ANSWER_CHECK_METHOD =
  'g06-exact-synthetic-subject-cast-execution-only-v1';

export const G06_CAST_OFFLINE_V2_PROFILE_ID = 'g06-cast-offline-agent-mcp-matrix-v2';
export const G06_CAST_OFFLINE_V2_EPOCH_ID = 'run95-g06-cast-offline-matrix-v2-20261018';
export const G06_CAST_OFFLINE_V2_NETWORK_MODE = 'run95-g06-subject-cast-offline-v2';
export const G06_CAST_OFFLINE_V2_ARGUMENT_PROFILE = 'fixed-g06-synthetic-subject-cast-two-rows-v2';
export const G06_CAST_OFFLINE_V2_SYNTHETIC_SUBJECT_ID = 990805;
export const G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: G06_CAST_OFFLINE_V2_SYNTHETIC_SUBJECT_ID,
  limit: 2,
});
export const G06_CAST_OFFLINE_V2_REPORT_PATH =
  'docs/live-probes/g06-subject-cast-offline-agent-mcp-run95-v2.json';
export const G06_CAST_OFFLINE_V2_SELECTION_PATH =
  'docs/research/run95-g06-subject-cast-offline-agent-mcp-matrix-v2-2026-10-18.md';
export const G06_CAST_OFFLINE_V2_EVIDENCE_KIND = 'codex_cli_g06_subject_cast_offline_agent_mcp_v2';
export const G06_CAST_OFFLINE_V2_ANSWER_CHECK_METHOD = 'g06-server-bound-synthetic-matrix-ack-v2';

const PROFILE_SPECS = new Map([
  [
    G06_CAST_OFFLINE_PROFILE_ID,
    {
      id: G06_CAST_OFFLINE_PROFILE_ID,
      epochId: G06_CAST_OFFLINE_EPOCH_ID,
      networkMode: G06_CAST_OFFLINE_NETWORK_MODE,
      argumentProfile: G06_CAST_OFFLINE_ARGUMENT_PROFILE,
      syntheticSubjectId: G06_CAST_OFFLINE_SYNTHETIC_SUBJECT_ID,
      expectedArguments: G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
      claimLabelName: 'harness-r95-g06-cast-offline-matrix-claimed',
      reportPath: G06_CAST_OFFLINE_REPORT_PATH,
      selectionEvidencePath: G06_CAST_OFFLINE_SELECTION_PATH,
      evidenceKind: G06_CAST_OFFLINE_EVIDENCE_KIND,
      answerCheckMethod: G06_CAST_OFFLINE_ANSWER_CHECK_METHOD,
      reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v1',
      syntheticCharacterIds: [990805, 990806],
      syntheticPersonId: 990807,
    },
  ],
  [
    G06_CAST_OFFLINE_V2_PROFILE_ID,
    {
      id: G06_CAST_OFFLINE_V2_PROFILE_ID,
      epochId: G06_CAST_OFFLINE_V2_EPOCH_ID,
      networkMode: G06_CAST_OFFLINE_V2_NETWORK_MODE,
      argumentProfile: G06_CAST_OFFLINE_V2_ARGUMENT_PROFILE,
      syntheticSubjectId: G06_CAST_OFFLINE_V2_SYNTHETIC_SUBJECT_ID,
      expectedArguments: G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS,
      claimLabelName: 'harness-r95-g06-cast-offline-matrix-v2-claimed',
      reportPath: G06_CAST_OFFLINE_V2_REPORT_PATH,
      selectionEvidencePath: G06_CAST_OFFLINE_V2_SELECTION_PATH,
      evidenceKind: G06_CAST_OFFLINE_V2_EVIDENCE_KIND,
      answerCheckMethod: G06_CAST_OFFLINE_V2_ANSWER_CHECK_METHOD,
      reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v2',
      syntheticCharacterIds: [990906, 990907],
      syntheticPersonId: 990908,
    },
  ],
]);

export function getG06CastOfflineProfileSpec(profileOrId) {
  const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
  return PROFILE_SPECS.get(profileId) ?? null;
}

const ORIGIN = 'https://api.bgm.tv';

function exactArguments(value, expectedArguments) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'limit,subjectId' &&
    value.subjectId === expectedArguments.subjectId &&
    value.limit === 2
  );
}

export function assertG06SubjectCastOfflineProfile(profile) {
  const spec = getG06CastOfflineProfileSpec(profile);
  if (!spec) return false;
  if (
    profile.frontierId !== 'G06' ||
    profile.epochId !== spec.epochId ||
    profile.toolName !== 'bangumi.get_subject_cast' ||
    profile.argumentProfile !== spec.argumentProfile ||
    profile.claimLabelName !== spec.claimLabelName ||
    profile.reportPath !== spec.reportPath ||
    profile.selectionEvidencePath !== spec.selectionEvidencePath ||
    profile.evidenceKind !== spec.evidenceKind ||
    profile.answerCheckMethod !== spec.answerCheckMethod ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== spec.networkMode ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 2048 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    !exactArguments(profile.calls[0]?.arguments, spec.expectedArguments)
  ) {
    throw new Error(
      'G06 offline mode only accepts an immutable registered synthetic matrix profile.',
    );
  }
  return true;
}

function response(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('G06 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function syntheticCastRows(spec) {
  return [
    {
      id: spec.syntheticCharacterIds[0],
      name: `Synthetic Character ${spec.syntheticCharacterIds[0]}`,
      type: 1,
      summary: 'Synthetic fixture only; not a Bangumi character.',
      relation: '主角',
      actors: [
        {
          id: spec.syntheticPersonId,
          name: `Synthetic Person ${spec.syntheticPersonId}`,
          career: ['seiyu'],
        },
      ],
    },
    {
      id: spec.syntheticCharacterIds[1],
      name: `Synthetic Character ${spec.syntheticCharacterIds[1]}`,
      type: 1,
      summary: 'Synthetic fixture only; not a Bangumi character.',
      relation: '配角',
      actors: [
        {
          id: spec.syntheticPersonId,
          name: `Synthetic Person ${spec.syntheticPersonId}`,
          career: ['seiyu'],
        },
      ],
    },
  ];
}

export function createG06SubjectCastOfflineFetch(profile = null) {
  const spec = getG06CastOfflineProfileSpec(profile ?? G06_CAST_OFFLINE_PROFILE_ID);
  if (!spec) throw new Error('G06 offline fixture requires a registered profile.');
  const route = `/v0/subjects/${spec.syntheticSubjectId}/characters`;
  const observed = new Set();
  const counters = {
    profile: spec.networkMode,
    requestCount: 0,
    allowedRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 0,
    expectedOperationComplete: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let url;
    try {
      url = toUrl(input);
    } catch {
      counters.unexpectedRequestCount += 1;
      return new Response('G06 offline fixture denied an invalid URL.', { status: 599 });
    }
    const headers = requestHeaders(input, init);
    const hasAuthorization = headers.has('authorization');
    const hasQuery = url.search !== '' || url.hash !== '';
    const hasBody = init?.body !== undefined || Boolean(input?.body);
    if (hasAuthorization) counters.authorizationHeaderCount += 1;
    if (hasQuery) counters.queryParameterCount += 1;
    if (hasBody) counters.requestBodyCount += 1;

    const valid =
      url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      url.pathname === route &&
      url.href === `${ORIGIN}${route}` &&
      requestMethod(input, init) === 'GET' &&
      !hasAuthorization &&
      !hasBody;
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('G06 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(route)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('G06 offline fixture denied a duplicate request.', { status: 599 });
    }

    observed.add(route);
    counters.allowedRequestCount += 1;
    const rows = syntheticCastRows(spec);
    counters.rowsReturned = rows.length;
    return response(rows);
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationComplete = observed.has(route);
      return { ...counters };
    },
  };
}
