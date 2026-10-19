export const P02_PERSON_PROFILE_OFFLINE_PROFILE_ID = 'p02-person-profile-offline-agent-mcp-v1';
export const P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID = 'p02-person-profile-offline-agent-mcp-v2';
export const P02_PERSON_PROFILE_OFFLINE_EPOCH_ID =
  'run95-p02-get-person-profile-agent-mcp-offline-20261016';
export const P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE = 'run95-p02-person-profile-offline-v1';
export const P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE = 'run95-p02-person-profile-offline-v2';
export const P02_PERSON_PROFILE_ARGUMENT_PROFILE =
  'fixed-p02-synthetic-person-990701-one-subject-one-character-v1';
export const P02_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID =
  'run95-p02-person-profile-offline-v2-matrix-20261019';
export const P02_PERSON_PROFILE_OFFLINE_V2_ARGUMENT_PROFILE =
  'fixed-p02-synthetic-person-990711-one-subject-one-character-v2';
export const P02_PERSON_PROFILE_SYNTHETIC_ID = 990701;
export const P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID = 990711;
export const P02_PERSON_PROFILE_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P02_PERSON_PROFILE_SYNTHETIC_ID,
  includeCredits: true,
  maxSubjects: 1,
  maxCharacters: 1,
  includeChronology: false,
});
export const P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID,
  includeCredits: true,
  maxSubjects: 1,
  maxCharacters: 1,
  includeChronology: false,
});

const PROFILE_SPECS = Object.freeze({
  [P02_PERSON_PROFILE_OFFLINE_PROFILE_ID]: Object.freeze({
    epochId: P02_PERSON_PROFILE_OFFLINE_EPOCH_ID,
    networkMode: P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
    argumentProfile: P02_PERSON_PROFILE_ARGUMENT_PROFILE,
    personId: P02_PERSON_PROFILE_SYNTHETIC_ID,
    subjectId: 990702,
    characterId: 990703,
    expectedArguments: P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
    reportPath: 'docs/live-probes/p02-person-profile-agent-mcp-run95.json',
    selectionEvidencePath:
      'docs/research/run95-p02-person-profile-agent-mcp-offline-matrix-contract-2026-10-16.md',
    evidenceKind: 'codex_cli_p02_person_profile_offline_agent_mcp',
    answerCheckMethod: 'p02-exact-synthetic-person-profile-execution-only-v1',
    acknowledgement: 'P02_SYNTHETIC_PROFILE_READ',
    serverId: 'bgk_p02_profile',
    reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v1',
    receiptKind: 'p02-person-profile-offline-runner-receipt-v1',
  }),
  [P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID]: Object.freeze({
    epochId: P02_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID,
    networkMode: P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
    argumentProfile: P02_PERSON_PROFILE_OFFLINE_V2_ARGUMENT_PROFILE,
    personId: P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID,
    subjectId: 990712,
    characterId: 990713,
    expectedArguments: P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS,
    reportPath: 'docs/live-probes/p02-person-profile-agent-mcp-v2-run95.json',
    selectionEvidencePath:
      'docs/research/run95-p02-person-profile-agent-mcp-offline-matrix-v2-contract-2026-10-19.md',
    evidenceKind: 'codex_cli_p02_person_profile_offline_agent_mcp_v2',
    answerCheckMethod: 'p02-exact-synthetic-person-profile-execution-only-v2',
    acknowledgement: 'P02_SYNTHETIC_PROFILE_READ_V2',
    serverId: 'bgk_p02_profile_v2',
    reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v2',
    receiptKind: 'p02-person-profile-offline-runner-receipt-v2',
  }),
});

export function getP02PersonProfileOfflineSpec(profileId) {
  return PROFILE_SPECS[profileId] ?? null;
}

const ORIGIN = 'https://api.bgm.tv';

function matchesExpectedArguments(value, expectedArguments) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === Object.keys(expectedArguments).sort().join(',') &&
    Object.entries(expectedArguments).every(([key, expected]) => value[key] === expected)
  );
}

export function assertP02PersonProfileOfflineProfile(profile) {
  const spec = getP02PersonProfileOfflineSpec(profile?.id);
  if (!spec) return false;
  if (
    profile.networkMode !== spec.networkMode ||
    profile.toolName !== 'bangumi.get_person_profile' ||
    profile.frontierId !== 'P02' ||
    profile.epochId !== spec.epochId ||
    profile.argumentProfile !== spec.argumentProfile ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== spec.reportPath ||
    profile.selectionEvidencePath !== spec.selectionEvidencePath ||
    profile.evidenceKind !== spec.evidenceKind ||
    profile.answerCheckMethod !== spec.answerCheckMethod ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.get_person_profile' ||
    !matchesExpectedArguments(profile.calls[0]?.arguments, spec.expectedArguments)
  ) {
    throw new Error(
      'P02 offline mode only accepts its immutable registered person-profile profile.',
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
  throw new Error('P02 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function syntheticPerson(spec) {
  return {
    id: spec.personId,
    name: `Synthetic Person ${spec.personId}`,
    type: 1,
    career: ['voice actor'],
    short_summary: 'Synthetic fixture only; not a Bangumi person.',
    infobox: [],
  };
}

function syntheticSubjects(spec) {
  return [
    {
      id: spec.subjectId,
      type: 2,
      name: `Synthetic Work ${spec.subjectId}`,
      name_cn: `合成作品 ${spec.subjectId}`,
      staff: '合成配音',
      eps: '12',
      image: '',
    },
  ];
}

function syntheticCharacters(spec) {
  return [
    {
      id: spec.characterId,
      type: 1,
      name: `Synthetic Character ${spec.characterId}`,
      images: { large: '', medium: '', small: '', grid: '' },
      subject_id: spec.subjectId,
      subject_type: 2,
      subject_name: `Synthetic Work ${spec.subjectId}`,
      subject_name_cn: `合成作品 ${spec.subjectId}`,
      staff: '合成角色',
    },
  ];
}

export function createP02PersonProfileOfflineFetch(
  profileId = P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
) {
  const spec = getP02PersonProfileOfflineSpec(profileId);
  if (!spec) throw new Error('P02 offline fixture requires a registered profile version.');
  const operations = new Map([
    [`/v0/persons/${spec.personId}`, () => syntheticPerson(spec)],
    [`/v0/persons/${spec.personId}/subjects`, () => syntheticSubjects(spec)],
    [`/v0/persons/${spec.personId}/characters`, () => syntheticCharacters(spec)],
  ]);
  const observed = new Set();
  const counters = {
    profile: spec.networkMode,
    requestCount: 0,
    personRequestCount: 0,
    subjectsRequestCount: 0,
    charactersRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let url;
    try {
      url = toUrl(input);
    } catch {
      counters.unexpectedRequestCount += 1;
      return new Response('P02 offline fixture denied an invalid URL.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) counters.authorizationHeaderCount += 1;

    const operation = operations.get(url.pathname);
    const valid =
      url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      method === 'GET' &&
      url.href === `${ORIGIN}${url.pathname}` &&
      url.search === '' &&
      url.hash === '' &&
      init?.body === undefined &&
      !headers.has('authorization') &&
      operation !== undefined;
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('P02 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('P02 offline fixture denied a duplicate request.', { status: 599 });
    }

    observed.add(url.pathname);
    if (url.pathname.endsWith('/subjects')) counters.subjectsRequestCount += 1;
    else if (url.pathname.endsWith('/characters')) counters.charactersRequestCount += 1;
    else counters.personRequestCount += 1;
    return response(operation());
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = observed.size === operations.size;
      return { ...counters };
    },
  };
}
