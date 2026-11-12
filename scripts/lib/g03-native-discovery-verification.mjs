import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { inspectC07PngArtifact } from './c07-png-artifact-validation.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const G03_NATIVE_QUERY = freeze({
  media: 'anime',
  from: '2024-01-01',
  to: '2024-05-01',
  rating: { min: 8 },
  ratingCount: { min: 5001 },
  sort: 'date',
  order: 'asc',
});
export const G03_NATIVE_CALLS = freeze(
  ['query_subjects', 'render_query_subjects'].map((name) => ({
    toolName: `bangumi.${name}`,
    arguments: G03_NATIVE_QUERY,
  })),
);
export const G03_NATIVE_ROWS = freeze([
  { id: 9631002, date: '2024-04-01' },
  { id: 9631005, date: '2024-04-03' },
  { id: 9631003, date: '2024-04-04' },
  { id: 9631006, date: null },
]);
const FIXTURES = [
  ['范围外，详情日期无效', '2024-05-01', '2024-02-30'],
  ['搜索日期保留', '2024-04-01', ''],
  ['详情有效且在范围内', '2024-05-01', '2024-04-04'],
  ['详情有效但在范围外', '2024-04-02', '2024-05-01'],
  ['详情日期不完整', '2024-04-03', '2024-04'],
  ['日期待确认', undefined, '2024-00-00'],
];
const SEARCH_ROWS = FIXTURES.map(([name, date], index) => ({
  id: 9631001 + index,
  type: 2,
  name,
  name_cn: name,
  date,
  rating: { total: 6000 },
}));
const DETAILS = new Map(
  SEARCH_ROWS.map((row, index) => [
    row.id,
    {
      ...row,
      date: FIXTURES[index][2],
      summary: '',
      nsfw: false,
      locked: false,
      platform: 'TV',
      images: {},
      eps: 12,
      total_episodes: 12,
      tags: [],
      meta_tags: ['原创'],
      rating: { rank: 10, score: 8, total: 6000, count: { 8: 6000 } },
      collection: { wish: 0, collect: 0, doing: 0, on_hold: 0, dropped: 0 },
    },
  ]),
);
const SEARCH_BODY = {
  keyword: '',
  sort: 'match',
  filter: {
    type: [2],
    air_date: ['>=2024-01-01', '<2024-05-01'],
    rating: ['>=8'],
    rating_count: ['>=5001'],
  },
};
const EXPECTED_COVERAGE = {
  scanned: 6,
  matched: 4,
  returned: 4,
  pagesScanned: 1,
  totalKind: 'estimated',
  upstreamExhausted: true,
  budgetExceeded: false,
  hydrationsAttempted: 6,
  hydrationsSucceeded: 6,
  hydrationsFailed: 0,
  unresolvedCandidates: 0,
};
const QUERY_CAVEAT =
  '起始日计入，结束日为排除上界。完整有效的日期会在本地复核，其他日期依赖上游筛选。';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const select = (value, keys) => Object.fromEntries(keys.map((key) => [key, value?.[key]]));
const rowsOf = (items) => items?.map(({ id, date }) => ({ id, date: date ?? null }));
const validMeasuredRow = (row) =>
  row.score === 8 &&
  row.ratingCount === 6000 &&
  !row.image &&
  row.name === DETAILS.get(row.id)?.name;
const required = (condition) => {
  if (!condition) throw new Error('G03_NATIVE_RESULT_INVALID');
};

export function projectG03NativeQuery(result) {
  required(result?.state === 'ok' && Array.isArray(result.items));
  required(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 512 * 1024);
  required(isDeepStrictEqual(rowsOf(result.items), G03_NATIVE_ROWS));
  required(result.items.every((row) => row.media === 'anime' && validMeasuredRow(row)));
  required(
    isDeepStrictEqual(select(result.coverage, Object.keys(EXPECTED_COVERAGE)), EXPECTED_COVERAGE),
  );
  required(
    result.coverage.postFilterCount === 2 &&
      result.plan?.source === 'official_v0' &&
      result.plan.operation === 'searchSubjects' &&
      result.plan.sort === 'date' &&
      result.plan.order === 'asc' &&
      result.plan.totalKind === 'estimated',
  );
  required(result.plan.limitations.includes(QUERY_CAVEAT));
  required(result.warnings?.some((warning) => warning.code === 'EXPERIMENTAL_SOURCE'));
  return {
    rows: structuredClone(G03_NATIVE_ROWS),
    coverage: { ...EXPECTED_COVERAGE },
    synthetic: true,
    unknownDatesDependOnUpstream: true,
  };
}

/** Finite synthetic observation only. There is no model, live fetch or invocation entry. */
export function createG03NativeVerification({ readArtifact, timeoutMs = 20000 } = {}) {
  if (
    typeof readArtifact !== 'function' ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20000
  )
    throw new TypeError('An artifact reader and a bounded deadline are required.');
  let phase = 'READY',
    active = null,
    closed = false;
  let searchRequests = 0,
    detailRequests = 0,
    denied = 0,
    observation = null,
    image = null;

  const refuse = (code = 'G03_NATIVE_OPERATION_DENIED') => {
    const error = new Error(code);
    denied++;
    phase = 'FAILED';
    active?.controller.abort();
    active?.reject?.(error);
    throw error;
  };
  const requireActive = (index) => {
    if (
      closed ||
      phase !== 'RUNNING' ||
      !active ||
      active.controller.signal.aborted ||
      (index !== undefined && active.index !== index)
    )
      refuse();
    return active;
  };
  const fetchFn = async (input, init = {}) => {
    const current = requireActive();
    try {
      required(typeof input === 'string' || input instanceof URL);
      required(
        Object.keys(init).every((key) => ['method', 'headers', 'body', 'signal'].includes(key)),
      );
      const url = new URL(input);
      required(url.origin === 'https://api.bgm.tv' && !url.username && !url.password && !url.hash);
      required(!init.signal?.aborted);
      const headers = new Headers(init.headers);
      required(
        [...headers.keys()].every((key) => ['accept', 'content-type', 'user-agent'].includes(key)),
      );
      let body;
      if (url.pathname === '/v0/search/subjects') {
        required(
          init.method === 'POST' && url.search === '?limit=20&offset=0' && !current.searched,
        );
        required(isDeepStrictEqual(JSON.parse(init.body), SEARCH_BODY));
        current.searched = true;
        searchRequests++;
        body = { data: SEARCH_ROWS, total: 6, limit: 20, offset: 0 };
      } else {
        const id = Number(url.pathname.match(/^\/v0\/subjects\/(\d+)$/u)?.[1]);
        required(init.method === 'GET' && !url.search && init.body == null && current.searched);
        required(DETAILS.has(id) && !current.details.has(id));
        current.details.add(id);
        detailRequests++;
        body = DETAILS.get(id);
      }
      return Response.json(body);
    } catch {
      return refuse('G03_NATIVE_FIXTURE_REQUEST_INVALID');
    }
  };

  const admitRender = (viewModel, options) => {
    const current = requireActive(1);
    try {
      required(current.searched && current.details.size === 6 && !image);
      required(viewModel?.template === 'discovery-results');
      required(isDeepStrictEqual(rowsOf(viewModel.items), G03_NATIVE_ROWS));
      const { scanned, ...viewCoverage } = EXPECTED_COVERAGE;
      required(
        isDeepStrictEqual(select(viewModel.coverage, Object.keys(viewCoverage)), viewCoverage),
      );
      required(viewModel.coverage.observed === scanned && viewModel.coverage.rendered === 4);
      required(
        viewModel.source?.experimental === true &&
          viewModel.plan?.limitations?.includes(QUERY_CAVEAT),
      );
      required(viewModel.items.every(validMeasuredRow));
      required(
        options.width === 360 && options.deviceScaleFactor === 2 && options.theme === 'light',
      );
    } catch {
      refuse('G03_NATIVE_RENDER_INVALID');
    }
  };
  const observeRender = (viewModel, result, options) => {
    admitRender(viewModel, options);
    try {
      required(result?.width === 720 && result.height >= 720 && result.height <= 4096);
      const facts = inspectC07PngArtifact(result.buffer, result.width, result.height);
      required(facts.decoded && facts.dimensionsMatch && facts.nonblankPixelSignalVerified);
      image = {
        width: result.width,
        height: result.height,
        bytes: result.buffer.length,
        sha256: sha(result.buffer),
        rows: structuredClone(G03_NATIVE_ROWS),
        decoded: true,
      };
    } catch {
      refuse('G03_NATIVE_RENDER_INVALID');
    }
  };

  const call = async (execute, name, args, { signal } = {}) => {
    const index = phase === 'READY' ? 0 : phase === 'QUERY_VERIFIED' ? 1 : -1;
    if (
      closed ||
      index < 0 ||
      typeof execute !== 'function' ||
      signal?.aborted ||
      name !== G03_NATIVE_CALLS[index].toolName ||
      !isDeepStrictEqual(args, G03_NATIVE_QUERY)
    )
      refuse();
    const current = {
      index,
      searched: false,
      details: new Set(),
      controller: new AbortController(),
    };
    active = current;
    phase = 'RUNNING';
    let rejectPending;
    const interrupt = () => {
      if (phase === 'RUNNING' && active === current) {
        try {
          refuse('G03_NATIVE_CANCELLED');
        } catch (error) {
          rejectPending(error);
        }
      }
    };
    const interrupted = new Promise((_, reject) => {
      rejectPending = reject;
    });
    current.reject = rejectPending;
    current.interrupt = interrupt;
    signal?.addEventListener('abort', interrupt, { once: true });
    const deadline = setTimeout(interrupt, timeoutMs);
    try {
      const work = async () => {
        const result = await execute(name, structuredClone(args), {
          signal: current.controller.signal,
        });
        requireActive(index);
        required(current.searched && current.details.size === 6);
        if (index === 0) observation = projectG03NativeQuery(result);
        else {
          const artifact = result?.artifact;
          required(
            image &&
              current.saved &&
              artifact?.mimeType === 'image/png' &&
              /^art_[0-9a-f]{32}$/u.test(artifact.id),
          );
          required(artifact.width === image.width && artifact.height === image.height);
          const stored = await readArtifact(artifact);
          requireActive(index);
          required(
            Buffer.isBuffer(stored) &&
              stored.length === image.bytes &&
              sha(stored) === image.sha256,
          );
        }
        return result;
      };
      const result = await Promise.race([work(), interrupted]);
      requireActive(index);
      phase = index === 0 ? 'QUERY_VERIFIED' : 'COMPLETE';
      return result;
    } catch (error) {
      if (phase === 'RUNNING') refuse('G03_NATIVE_EXECUTION_FAILED');
      throw error;
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', interrupt);
      if (active === current) active = null;
    }
  };
  return {
    fetchFn,
    call,
    admitRender,
    observeRender,
    admitArtifactWrite(buffer, mimeType, options) {
      const current = requireActive(1);
      try {
        required(image && !current.saved && mimeType === 'image/png');
        required(options.width === image.width && options.height === image.height);
        required(Buffer.isBuffer(buffer) && sha(buffer) === image.sha256);
        current.saved = true;
      } catch {
        refuse('G03_NATIVE_ARTIFACT_INVALID');
      }
    },
    snapshot: () =>
      structuredClone({
        contract: 'g03-native-date-and-png-v1',
        phase,
        searchRequests,
        detailRequests,
        denied,
        observation,
        image,
        maxSearchRequests: 2,
        maxDetailRequests: 12,
        deadlineMs: timeoutMs,
        syntheticSource: true,
        modelEvidence: false,
        liveEvidence: false,
      }),
    stop() {
      if (phase === 'RUNNING') active.interrupt();
      else if (phase !== 'COMPLETE' && phase !== 'FAILED') phase = 'STOPPED';
      closed = true;
    },
  };
}
