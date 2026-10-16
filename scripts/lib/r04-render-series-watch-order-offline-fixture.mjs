export const R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID =
  'r04-render-series-watch-order-offline-agent-mcp-v1';
export const R04_RENDER_SERIES_WATCH_ORDER_EPOCH_ID =
  'run95-r04-render-series-watch-order-offline-matrix-20261017';
export const R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE =
  'run95-r04-render-series-watch-order-offline-v1';
export const R04_RENDER_SERIES_WATCH_ORDER_ARGUMENT_PROFILE =
  'fixed-r04-render-synthetic-watch-order-990802-depth0-max1-anime-v1';
export const R04_RENDER_SERIES_WATCH_ORDER_SYNTHETIC_ID = 990802;
export const R04_RENDER_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: R04_RENDER_SERIES_WATCH_ORDER_SYNTHETIC_ID,
  depth: 0,
  maxNodes: 1,
  media: 'anime',
});

const ORIGIN = 'https://api.bgm.tv';

function exactExpectedArguments(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') ===
      Object.keys(R04_RENDER_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS).sort().join(',') &&
    Object.entries(R04_RENDER_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}

export function assertR04RenderSeriesWatchOrderOfflineProfile(profile) {
  if (profile?.id !== R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID) return false;
  if (
    profile.networkMode !== R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE ||
    profile.toolName !== 'bangumi.render_series_watch_order' ||
    profile.frontierId !== 'R04' ||
    profile.epochId !== R04_RENDER_SERIES_WATCH_ORDER_EPOCH_ID ||
    profile.argumentProfile !== R04_RENDER_SERIES_WATCH_ORDER_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.reportPath !==
      'docs/live-probes/r04-render-series-watch-order-offline-agent-mcp-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-r04-render-series-watch-order-offline-matrix-contract-2026-10-17.md' ||
    profile.evidenceKind !== 'codex_cli_r04_render_series_watch_order_offline_agent_mcp' ||
    profile.answerCheckMethod !== 'r04-render-series-watch-order-synthetic-artifact-readback-v1' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 512 ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== 'bangumi.render_series_watch_order' ||
    !exactExpectedArguments(profile.calls[0]?.arguments)
  ) {
    throw new Error('R04 render offline mode only accepts its immutable one-tool profile.');
  }
  return true;
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('R04 render offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function response(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

export function createR04RenderSeriesWatchOrderOfflineFetch() {
  const id = R04_RENDER_SERIES_WATCH_ORDER_SYNTHETIC_ID;
  const root = {
    id,
    type: 2,
    name: 'Synthetic Renderer Watch-Order Root 990802',
    name_cn: '合成渲染观看顺序起点 990802',
    date: '2021-01-01',
    platform: 'TV',
    images: { large: '', common: '', medium: '', small: '', grid: '' },
  };
  const operations = new Map([
    [`/v0/subjects/${id}`, () => root],
    [`/v0/subjects/${id}/subjects`, () => []],
  ]);
  const observed = new Set();
  const counters = {
    profile: R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE,
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
      return new Response('R04 render fixture denied an invalid URL.', { status: 599 });
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
      return new Response('R04 render fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R04 render fixture denied a duplicate request.', { status: 599 });
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

export function createR04RenderSeriesWatchOrderAssetFence() {
  let requestCount = 0;
  return {
    assetResolver: {
      async resolveAsset() {
        requestCount += 1;
        throw new Error('R04 renderer asset requests are disabled for this profile.');
      },
    },
    snapshot() {
      return { requestCount };
    },
  };
}
