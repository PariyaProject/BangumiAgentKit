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

const ORIGIN = 'https://api.bgm.tv';
const PATH = `/v0/subjects/${G06_CAST_OFFLINE_SYNTHETIC_SUBJECT_ID}/characters`;

function exactArguments(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'limit,subjectId' &&
    value.subjectId === G06_CAST_OFFLINE_SYNTHETIC_SUBJECT_ID &&
    value.limit === 2
  );
}

export function assertG06SubjectCastOfflineProfile(profile) {
  if (profile?.id !== G06_CAST_OFFLINE_PROFILE_ID) return false;
  if (
    profile.frontierId !== 'G06' ||
    profile.epochId !== G06_CAST_OFFLINE_EPOCH_ID ||
    profile.toolName !== 'bangumi.get_subject_cast' ||
    profile.argumentProfile !== G06_CAST_OFFLINE_ARGUMENT_PROFILE ||
    profile.claimLabelName !== 'harness-r95-g06-cast-offline-matrix-claimed' ||
    profile.reportPath !== G06_CAST_OFFLINE_REPORT_PATH ||
    profile.selectionEvidencePath !== G06_CAST_OFFLINE_SELECTION_PATH ||
    profile.evidenceKind !== G06_CAST_OFFLINE_EVIDENCE_KIND ||
    profile.answerCheckMethod !== G06_CAST_OFFLINE_ANSWER_CHECK_METHOD ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== G06_CAST_OFFLINE_NETWORK_MODE ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 2048 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== profile.toolName ||
    !exactArguments(profile.calls[0]?.arguments)
  ) {
    throw new Error('G06 offline mode only accepts its immutable synthetic matrix profile.');
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

function syntheticCastRows() {
  return [
    {
      id: 990805,
      name: 'Synthetic Character 990805',
      type: 1,
      summary: 'Synthetic fixture only; not a Bangumi character.',
      relation: '主角',
      actors: [{ id: 990807, name: 'Synthetic Person 990807', career: ['seiyu'] }],
    },
    {
      id: 990806,
      name: 'Synthetic Character 990806',
      type: 1,
      summary: 'Synthetic fixture only; not a Bangumi character.',
      relation: '配角',
      actors: [{ id: 990807, name: 'Synthetic Person 990807', career: ['seiyu'] }],
    },
  ];
}

export function createG06SubjectCastOfflineFetch() {
  const observed = new Set();
  const counters = {
    profile: G06_CAST_OFFLINE_NETWORK_MODE,
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
      url.pathname === PATH &&
      url.href === `${ORIGIN}${PATH}` &&
      requestMethod(input, init) === 'GET' &&
      !hasAuthorization &&
      !hasBody;
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('G06 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(PATH)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('G06 offline fixture denied a duplicate request.', { status: 599 });
    }

    observed.add(PATH);
    counters.allowedRequestCount += 1;
    const rows = syntheticCastRows();
    counters.rowsReturned = rows.length;
    return response(rows);
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationComplete = observed.has(PATH);
      return { ...counters };
    },
  };
}
