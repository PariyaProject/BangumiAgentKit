export const R04_SERIES_WATCH_ORDER_V2_PROFILE_ID = 'r04-series-watch-order-offline-agent-mcp-v2';
export const R04_SERIES_WATCH_ORDER_V2_EPOCH_ID =
  'run95-r04-series-watch-order-agent-mcp-offline-v2-20261018';
export const R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE =
  'run95-r04-series-watch-order-offline-prequel-v2';
export const R04_SERIES_WATCH_ORDER_V2_ARGUMENT_PROFILE =
  'fixed-r04-synthetic-watch-order-990817-prequel-990818-depth1-max1-anime-v2';
export const R04_SERIES_WATCH_ORDER_V2_ROOT_ID = 990817;
export const R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID = 990818;
export const R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
  depth: 1,
  maxNodes: 1,
  media: 'anime',
});

const ORIGIN = 'https://api.bgm.tv';

function matchesExpectedArguments(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') ===
      Object.keys(R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS).sort().join(',') &&
    Object.entries(R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}

export function assertR04SeriesWatchOrderOfflineV2Profile(profile) {
  if (profile?.id !== R04_SERIES_WATCH_ORDER_V2_PROFILE_ID) return false;
  if (
    profile.networkMode !== R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE ||
    profile.toolName !== 'bangumi.get_series_watch_order' ||
    profile.frontierId !== 'R04' ||
    profile.epochId !== R04_SERIES_WATCH_ORDER_V2_EPOCH_ID ||
    profile.argumentProfile !== R04_SERIES_WATCH_ORDER_V2_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !==
      'docs/live-probes/r04-series-watch-order-offline-agent-mcp-v2-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-r04-series-watch-order-offline-matrix-v2-contract-2026-10-18.md' ||
    profile.evidenceKind !== 'codex_cli_r04_series_watch_order_offline_agent_mcp_v2' ||
    profile.answerCheckMethod !== 'r04-exact-synthetic-watch-order-prequel-chain-v2' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.get_series_watch_order' ||
    !matchesExpectedArguments(profile.calls[0]?.arguments)
  ) {
    throw new Error(
      'R04 offline v2 only accepts its immutable synthetic one-hop prequel matrix profile.',
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
  throw new Error('R04 offline v2 fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function syntheticRoot() {
  return {
    id: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
    type: 2,
    name: 'Synthetic Watch-Order Root 990817',
    name_cn: '合成观看顺序起点 990817',
    date: '2020-01-01',
    platform: 'TV',
    images: { large: '', common: '', medium: '', small: '', grid: '' },
  };
}

function syntheticPrequel() {
  return {
    id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID,
    type: 2,
    name: 'Synthetic Watch-Order Prequel 990818',
    name_cn: '合成前传 990818',
    date: '2019-01-01',
    platform: 'TV',
    images: { large: '', common: '', medium: '', small: '', grid: '' },
  };
}

export function createR04SeriesWatchOrderOfflineV2Fetch() {
  const rootPath = `/v0/subjects/${R04_SERIES_WATCH_ORDER_V2_ROOT_ID}`;
  const prequelPath = `/v0/subjects/${R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID}`;
  const operations = new Map([
    [rootPath, syntheticRoot],
    [
      `${rootPath}/subjects`,
      () => [
        {
          id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID,
          type: 2,
          name: 'Synthetic Watch-Order Prequel 990818',
          name_cn: '合成前传 990818',
          relation: '前传',
        },
      ],
    ],
    [`${prequelPath}/subjects`, () => []],
    [prequelPath, syntheticPrequel],
  ]);
  const observed = new Set();
  const counters = {
    profile: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    requestCount: 0,
    subjectRequestCount: 0,
    relationsRequestCount: 0,
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
      return new Response('R04 offline v2 fixture denied an invalid URL.', { status: 599 });
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
      return new Response('R04 offline v2 fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R04 offline v2 fixture denied a duplicate request.', { status: 599 });
    }

    observed.add(url.pathname);
    if (url.pathname.endsWith('/subjects')) counters.relationsRequestCount += 1;
    else counters.subjectRequestCount += 1;
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
