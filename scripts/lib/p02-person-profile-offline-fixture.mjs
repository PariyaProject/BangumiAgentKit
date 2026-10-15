export const P02_PERSON_PROFILE_OFFLINE_PROFILE_ID = 'p02-person-profile-offline-agent-mcp-v1';
export const P02_PERSON_PROFILE_OFFLINE_EPOCH_ID =
  'run95-p02-get-person-profile-agent-mcp-offline-20261016';
export const P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE = 'run95-p02-person-profile-offline-v1';
export const P02_PERSON_PROFILE_ARGUMENT_PROFILE =
  'fixed-p02-synthetic-person-990701-one-subject-one-character-v1';
export const P02_PERSON_PROFILE_SYNTHETIC_ID = 990701;
export const P02_PERSON_PROFILE_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P02_PERSON_PROFILE_SYNTHETIC_ID,
  includeCredits: true,
  maxSubjects: 1,
  maxCharacters: 1,
  includeChronology: false,
});

const SUBJECT_ID = 990702;
const CHARACTER_ID = 990703;
const ORIGIN = 'https://api.bgm.tv';

function matchesExpectedArguments(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') ===
      Object.keys(P02_PERSON_PROFILE_EXPECTED_ARGUMENTS).sort().join(',') &&
    Object.entries(P02_PERSON_PROFILE_EXPECTED_ARGUMENTS).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}

export function assertP02PersonProfileOfflineProfile(profile) {
  if (profile?.id !== P02_PERSON_PROFILE_OFFLINE_PROFILE_ID) return false;
  if (
    profile.networkMode !== P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE ||
    profile.toolName !== 'bangumi.get_person_profile' ||
    profile.frontierId !== 'P02' ||
    profile.epochId !== P02_PERSON_PROFILE_OFFLINE_EPOCH_ID ||
    profile.argumentProfile !== P02_PERSON_PROFILE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== 'docs/live-probes/p02-person-profile-agent-mcp-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-p02-person-profile-agent-mcp-offline-matrix-contract-2026-10-16.md' ||
    profile.evidenceKind !== 'codex_cli_p02_person_profile_offline_agent_mcp' ||
    profile.answerCheckMethod !== 'p02-exact-synthetic-person-profile-execution-only-v1' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.get_person_profile' ||
    !matchesExpectedArguments(profile.calls[0]?.arguments)
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

function syntheticPerson() {
  return {
    id: P02_PERSON_PROFILE_SYNTHETIC_ID,
    name: 'Synthetic Person 990701',
    type: 1,
    career: ['voice actor'],
    short_summary: 'Synthetic fixture only; not a Bangumi person.',
    infobox: [],
  };
}

function syntheticSubjects() {
  return [
    {
      id: SUBJECT_ID,
      type: 2,
      name: 'Synthetic Work 990702',
      name_cn: '合成作品 990702',
      staff: '合成配音',
      eps: '12',
      image: '',
    },
  ];
}

function syntheticCharacters() {
  return [
    {
      id: CHARACTER_ID,
      type: 1,
      name: 'Synthetic Character 990703',
      images: { large: '', medium: '', small: '', grid: '' },
      subject_id: SUBJECT_ID,
      subject_type: 2,
      subject_name: 'Synthetic Work 990702',
      subject_name_cn: '合成作品 990702',
      staff: '合成角色',
    },
  ];
}

export function createP02PersonProfileOfflineFetch() {
  const operations = new Map([
    [`/v0/persons/${P02_PERSON_PROFILE_SYNTHETIC_ID}`, syntheticPerson],
    [`/v0/persons/${P02_PERSON_PROFILE_SYNTHETIC_ID}/subjects`, syntheticSubjects],
    [`/v0/persons/${P02_PERSON_PROFILE_SYNTHETIC_ID}/characters`, syntheticCharacters],
  ]);
  const observed = new Set();
  const counters = {
    profile: P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
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
