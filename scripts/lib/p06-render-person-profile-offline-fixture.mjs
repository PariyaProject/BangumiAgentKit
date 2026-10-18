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

export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID =
  'p06-render-person-profile-offline-agent-mcp-v2';
export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID =
  'run95-p06-render-person-profile-visual-matrix-v2-20261018';
export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE =
  'run95-p06-render-person-profile-offline-v2';
export const P06_RENDER_PERSON_PROFILE_V2_ARGUMENT_PROFILE =
  'fixed-p06-synthetic-person-990602-one-subject-one-character-v2';
export const P06_RENDER_PERSON_PROFILE_V2_SYNTHETIC_ID = 990602;
export const P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  personId: P06_RENDER_PERSON_PROFILE_V2_SYNTHETIC_ID,
  maxSubjects: 1,
  maxCharacters: 1,
  maxCredits: 1,
  includeChronology: false,
});

const P06_OFFLINE_PROFILE_CONFIGS = new Map([
  [
    P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
    Object.freeze({
      id: P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      epochId: P06_RENDER_PERSON_PROFILE_OFFLINE_EPOCH_ID,
      networkMode: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      argumentProfile: P06_RENDER_PERSON_PROFILE_ARGUMENT_PROFILE,
      reportPath: 'docs/live-probes/p06-render-person-profile-agent-mcp-run95.json',
      selectionEvidencePath:
        'docs/research/run95-p06-render-person-profile-agent-mcp-offline-fixture-source-contract-2026-10-16.md',
      evidenceKind: 'codex_cli_p06_render_person_profile_offline_agent_mcp',
      answerCheckMethod: 'p06-exact-synthetic-renderer-execution-only-v1',
      syntheticPersonId: P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID,
      subjectId: 990602,
      characterId: 990603,
      expectedArguments: P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS,
      version: 1,
    }),
  ],
  [
    P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
    Object.freeze({
      id: P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
      epochId: P06_RENDER_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID,
      networkMode: P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
      argumentProfile: P06_RENDER_PERSON_PROFILE_V2_ARGUMENT_PROFILE,
      reportPath: 'docs/live-probes/p06-render-person-profile-agent-mcp-v2-run95.json',
      selectionEvidencePath:
        'docs/research/run95-p06-render-person-profile-agent-mcp-offline-fixture-v2-source-contract-2026-10-18.md',
      evidenceKind: 'codex_cli_p06_render_person_profile_offline_agent_mcp_v2',
      answerCheckMethod: 'p06-exact-synthetic-renderer-execution-only-v2',
      syntheticPersonId: P06_RENDER_PERSON_PROFILE_V2_SYNTHETIC_ID,
      subjectId: 990604,
      characterId: 990605,
      expectedArguments: P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
      version: 2,
    }),
  ],
]);

export function getP06RenderPersonProfileOfflineConfig(profileId) {
  return P06_OFFLINE_PROFILE_CONFIGS.get(profileId) ?? null;
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

export function assertP06RenderPersonProfileOfflineProfile(profile) {
  const config = getP06RenderPersonProfileOfflineConfig(profile?.id);
  if (!config) return false;
  if (
    profile.networkMode !== config.networkMode ||
    profile.toolName !== 'bangumi.render_person_profile' ||
    profile.frontierId !== 'P06' ||
    profile.epochId !== config.epochId ||
    profile.argumentProfile !== config.argumentProfile ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !== config.reportPath ||
    profile.selectionEvidencePath !== config.selectionEvidencePath ||
    profile.evidenceKind !== config.evidenceKind ||
    profile.answerCheckMethod !== config.answerCheckMethod ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.render_person_profile' ||
    !matchesExpectedArguments(profile.calls[0]?.arguments, config.expectedArguments)
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

function syntheticPerson(config) {
  if (config.version === 2) {
    return {
      id: config.syntheticPersonId,
      name: '合成声优人物の日本語名 990602',
      name_cn: '合成声优人员 990602（长标题换行检查）',
      type: 1,
      career: ['voice actor'],
      gender: 'unknown',
      blood_type: null,
      short_summary:
        '仅供离线验收的合成资料；用于检查中文、日文混排、长文本换行和摘要截断。'.repeat(5),
      images: { large: '', medium: '', small: '', grid: '' },
    };
  }
  return {
    id: config.syntheticPersonId,
    name: 'Synthetic Person 990601',
    type: 1,
    career: ['voice actor'],
    short_summary: 'Synthetic fixture only; not a Bangumi person.',
    images: { large: '', medium: '', small: '', grid: '' },
    infobox: [{ key: '简体中文名', value: '合成人员 990601' }],
  };
}

function syntheticSubjects(config) {
  return [
    {
      id: config.subjectId,
      type: 2,
      name: config.version === 2 ? '合成作品の日本語原名 990604' : 'Synthetic Work 990602',
      name_cn:
        config.version === 2
          ? '合成作品：一个很长的中文条目标题用于移动端换行检查'
          : '合成作品 990602',
      staff: config.version === 2 ? 'voice actor' : '合成配音',
      eps: '12',
      image: '',
    },
  ];
}

function syntheticCharacters(config) {
  return [
    {
      id: config.characterId,
      type: 1,
      name: config.version === 2 ? '合成角色の長い日本語名' : 'Synthetic Character 990603',
      images: { large: '', medium: '', small: '', grid: '' },
      subject_id: config.subjectId,
      subject_type: 2,
      subject_name: config.version === 2 ? '合成作品の日本語原名 990604' : 'Synthetic Work 990602',
      subject_name_cn:
        config.version === 2
          ? '合成作品：一个很长的中文条目标题用于移动端换行检查'
          : '合成作品 990602',
      staff: config.version === 2 ? 'main' : '合成角色',
    },
  ];
}

export function createP06RenderPersonProfileOfflineFetch(
  profileId = P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
) {
  const config = getP06RenderPersonProfileOfflineConfig(profileId);
  if (!config) throw new Error('P06 offline fixture requires a registered P06 profile.');
  const operations = new Map([
    [`/v0/persons/${config.syntheticPersonId}`, () => syntheticPerson(config)],
    [`/v0/persons/${config.syntheticPersonId}/subjects`, () => syntheticSubjects(config)],
    [`/v0/persons/${config.syntheticPersonId}/characters`, () => syntheticCharacters(config)],
  ]);
  const observed = new Set();
  const counters = {
    profile: config.networkMode,
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
