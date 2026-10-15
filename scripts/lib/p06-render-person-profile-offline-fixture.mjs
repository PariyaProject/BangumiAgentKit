export const P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID =
  'p06-render-person-profile-offline-agent-mcp-v1';
export const P06_RENDER_PERSON_PROFILE_OFFLINE_EPOCH_ID =
  'run95-p06-render-person-profile-agent-mcp-offline-20261016';
export const P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE =
  'run95-p06-render-person-profile-offline-v1';
export const P06_RENDER_PERSON_PROFILE_ARGUMENT_PROFILE =
  'fixed-p06-synthetic-person-990601-one-subject-one-character-v1';
export const P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID = 990601;
export const P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID,
  maxSubjects: 1,
  maxCharacters: 1,
  maxCredits: 1,
  includeChronology: false,
});

const SUBJECT_ID = 990602;
const CHARACTER_ID = 990603;
const ORIGIN = 'https://api.bgm.tv';

function matchesExpectedArguments(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') ===
      Object.keys(P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS).sort().join(',') &&
    Object.entries(P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}

export function assertP06RenderPersonProfileOfflineProfile(profile) {
  if (profile?.id !== P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID) return false;
  if (
    profile.networkMode !== P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE ||
    profile.toolName !== 'bangumi.render_person_profile' ||
    profile.frontierId !== 'P06' ||
    profile.epochId !== P06_RENDER_PERSON_PROFILE_OFFLINE_EPOCH_ID ||
    profile.argumentProfile !== P06_RENDER_PERSON_PROFILE_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== 'docs/live-probes/p06-render-person-profile-agent-mcp-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-p06-render-person-profile-agent-mcp-offline-fixture-source-contract-2026-10-16.md' ||
    profile.evidenceKind !== 'codex_cli_p06_render_person_profile_offline_agent_mcp' ||
    profile.answerCheckMethod !== 'p06-exact-synthetic-renderer-execution-only-v1' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.render_person_profile' ||
    !matchesExpectedArguments(profile.calls[0]?.arguments)
  ) {
    throw new Error('P06 offline mode only accepts its immutable registered renderer profile.');
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
  throw new Error('P06 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function syntheticPerson() {
  return {
    id: P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID,
    name: 'Synthetic Person 990601',
    type: 1,
    career: ['voice actor'],
    short_summary: 'Synthetic fixture only; not a Bangumi person.',
    images: { large: '', medium: '', small: '', grid: '' },
    infobox: [{ key: '简体中文名', value: '合成人员 990601' }],
  };
}

function syntheticSubjects() {
  return [
    {
      id: SUBJECT_ID,
      type: 2,
      name: 'Synthetic Work 990602',
      name_cn: '合成作品 990602',
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
      name: 'Synthetic Character 990603',
      images: { large: '', medium: '', small: '', grid: '' },
      subject_id: SUBJECT_ID,
      subject_type: 2,
      subject_name: 'Synthetic Work 990602',
      subject_name_cn: '合成作品 990602',
      staff: '合成角色',
    },
  ];
}

export function createP06RenderPersonProfileOfflineFetch() {
  const operations = new Map([
    [`/v0/persons/${P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID}`, syntheticPerson],
    [`/v0/persons/${P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID}/subjects`, syntheticSubjects],
    [`/v0/persons/${P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID}/characters`, syntheticCharacters],
  ]);
  const observed = new Set();
  const counters = {
    profile: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
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
      return new Response('P06 offline fixture denied an invalid URL.', { status: 599 });
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
      return new Response('P06 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('P06 offline fixture denied a duplicate request.', { status: 599 });
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

export function createP06RenderPersonProfileAssetGuard() {
  const counters = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
  };
  const assetResolver = {
    async resolveAsset(url) {
      counters.assetResolutionCallCount += 1;
      if (typeof url === 'string' && url.length > 0) counters.nonEmptyAssetUrlCount += 1;
      counters.blockedAssetRequestCount += 1;
      throw new Error('P06 offline profile rejects all renderer asset resolution.');
    },
  };
  return {
    assetResolver,
    snapshot() {
      return { ...counters };
    },
  };
}
