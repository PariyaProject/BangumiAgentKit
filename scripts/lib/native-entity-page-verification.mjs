import { isDeepStrictEqual } from 'node:util';

// Public example from the pinned official OpenAPI User schema. This is not
// the operator's bound account. The target never enters result projections.
const TARGET = 'sai';
export const NATIVE_PAGE_VERIFICATION_CONTRACT = 'native-entity-page-observation-v1';
export const NATIVE_PAGE_SOURCE_CONTRACT = 'server-243e2cd5-entity-page-v1';
export const NATIVE_PAGE_CALLS = Object.freeze(
  ['person', 'character'].map((kind) => Object.freeze({
    toolName: `bangumi.list_${kind}_collections`,
    arguments: Object.freeze({ username: TARGET, maxItems: 1, offset: 0 }),
  })),
);
const routes = ['persons', 'characters'].map(
  (kind) => `/v0/users/${TARGET}/collections/-/${kind}`,
);
const noResult = () => { throw new Error('NATIVE_PAGE_RESULT_INVALID'); };
const count = (value) => Number.isSafeInteger(value) && value >= 0;

/** Validate semantics before dropping all identity, row and untrusted text. */
export function projectNativeEntityPageResult(result, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= NATIVE_PAGE_CALLS.length)
    return noResult();
  const coverage = result?.coverage;
  const page = result?.pagination;
  const source = result?.source;
  const total = result?.total ?? null;
  const inconsistent = page?.totalInconsistent;
  if (
    !result || result.ok === false ||
    result.limit !== 1 || result.offset !== 0 ||
    !Array.isArray(result.items) || result.items.length > 1 ||
    !count(result.observed) || result.observed > 1 ||
    !count(result.returned) || result.returned !== result.items.length ||
    !count(result.invalidRows) || result.returned + result.invalidRows !== result.observed ||
    typeof inconsistent !== 'boolean' ||
    (inconsistent ? total !== null || result.observed !== 1 : !count(total) || total < result.observed) ||
    page?.requestedLimit !== 1 || page.requestedOffset !== 0 || page.validated !== true ||
    page.order !== 'created_time_desc' || page.stableSnapshot !== false ||
    coverage?.sourceTotal !== result.total || coverage.observed !== result.observed ||
    coverage.returned !== result.returned || coverage.maxItems !== 1 ||
    coverage.truncated !== result.truncated ||
    source?.source !== 'official-v0' || source.authScope !== 'public' ||
    source.paginationContract !== NATIVE_PAGE_SOURCE_CONTRACT ||
    source.operation !== `GET /v0/users/{username}/collections/-/${index === 0 ? 'persons' : 'characters'}` ||
    typeof result.retrievedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(result.retrievedAt) ||
    !Number.isFinite(Date.parse(result.retrievedAt)) || source.retrievedAt !== result.retrievedAt
  ) return noResult();
  const hasMore = inconsistent ? null : total > 1;
  const nextOffset = hasMore === true ? 1 : null;
  const empty = result.observed === 0 ? total === 0 ? 'collection_empty' : 'page_empty' : null;
  const truncated = inconsistent || result.invalidRows > 0 || result.observed < total;
  if (
    (page.hasMore ?? null) !== hasMore || (page.nextOffset ?? null) !== nextOffset ||
    (page.empty ?? null) !== empty || result.truncated !== truncated
  ) return noResult();
  return Object.freeze({
    kind: index === 0 ? 'person' : 'character',
    total, observed: result.observed, returned: result.returned,
    invalidRows: result.invalidRows, limit: 1, offset: 0,
    hasMore, nextOffset, totalInconsistent: inconsistent, empty, truncated,
    stableSnapshot: false, order: 'created_time_desc', publicOnly: true,
  });
}

/**
 * Finite observation kernel, not an executable or invocation authorization.
 * No native-fetch default: offline tests must inject a synthetic provider.
 * A future reviewed host supplies fetch AND its real ToolRegistry executor.
 * Product transport owns the existing 256 KiB / 10s native page bounds.
 */
export function createNativeEntityPageVerification({ fetchImpl } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('An explicit fetch adapter is required.');
  const state = { phase: 'READY', requestCount: 0, deniedCount: 0, results: [] };
  let active = null;
  const fail = (code) => {
    state.phase = 'FAILED';
    state.deniedCount++;
    throw new Error(code);
  };
  const fetchFn = async (input, init = {}) => {
    if (state.phase !== 'RUNNING' || active === null || active.requested)
      return fail('NATIVE_PAGE_REQUEST_OUT_OF_SEQUENCE');
    let url, headers;
    try {
      if (typeof input !== 'string' && !(input instanceof URL))
        return fail('NATIVE_PAGE_REQUEST_INVALID');
      url = new URL(String(input));
      headers = new Headers(init.headers);
    } catch {
      return fail('NATIVE_PAGE_REQUEST_INVALID');
    }
    const expected = new URL(`https://api.bgm.tv${routes[active.index]}?limit=1&offset=0`);
    const allowedHeaders = new Set(['accept', 'user-agent']);
    if (
      url.href !== expected.href || (init.method ?? 'GET') !== 'GET' ||
      [...headers.keys()].some((key) => !allowedHeaders.has(key)) ||
      init.body != null || (init.credentials !== undefined && init.credentials !== 'omit') ||
      (init.redirect !== undefined && init.redirect !== 'error') ||
      !init.signal || init.signal.aborted
    ) return fail('NATIVE_PAGE_REQUEST_DENIED');
    active.requested = true;
    state.requestCount++;
    try {
      // Normalize rather than forward a Request object, preventing hidden
      // inherited bodies, headers, credentials or automatic redirects.
      return await fetchImpl(expected.href, {
        method: 'GET', headers, credentials: 'omit', redirect: 'error', signal: init.signal,
      });
    } catch {
      state.phase = 'FAILED';
      throw new Error('NATIVE_PAGE_FETCH_FAILED');
    }
  };
  return {
    fetchFn,
    async call(executeTool, name, args) {
      const index = state.results.length;
      const expected = NATIVE_PAGE_CALLS[index];
      if (
        state.phase !== 'READY' || !expected || typeof executeTool !== 'function' ||
        name !== expected.toolName || !isDeepStrictEqual(args, expected.arguments)
      ) return fail('NATIVE_PAGE_TOOL_DENIED');
      state.phase = 'RUNNING';
      const ownCall = { index, requested: false };
      active = ownCall;
      try {
        const raw = await executeTool(name, structuredClone(expected.arguments));
        if (state.phase !== 'RUNNING' || active !== ownCall || !ownCall.requested)
          return fail('NATIVE_PAGE_EXECUTION_INVALID');
        const projection = projectNativeEntityPageResult(raw, index);
        state.results.push(projection);
        state.phase = state.results.length === NATIVE_PAGE_CALLS.length ? 'COMPLETE' : 'READY';
        return projection;
      } catch {
        state.phase = 'FAILED';
        throw new Error('NATIVE_PAGE_OBSERVATION_FAILED');
      } finally {
        active = null;
      }
    },
    snapshot() {
      return structuredClone({
        contract: NATIVE_PAGE_VERIFICATION_CONTRACT,
        ...state, maxRequests: 2, maxResponseBytes: 256 * 1024,
        nativeCallDeadlineMs: 10_000, redirectPolicy: 'error',
        liveEvidence: false,
      });
    },
  };
}
