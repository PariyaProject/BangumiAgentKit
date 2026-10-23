import { getAgentMcpProfileById } from './agent-mcp-profile-claims.mjs';
import {
  getR03RelationsOfflineProfileSpec,
  R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
  R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
  assertR03RelationsOfflineProfile,
} from './r03-relations-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const ROUTES = Object.freeze({
  direct: '/v0/subjects/991020/subjects',
  twoHopRoot: '/v0/subjects/993811/subjects',
  twoHopIntermediate: '/v0/subjects/993812/subjects',
  twoHopIntermediateDetail: '/v0/subjects/993812',
  twoHopTargetDetail: '/v0/subjects/993813',
});
const EXPECTED_REQUEST_HEADERS = Object.freeze({
  accept: 'application/json',
  'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
});

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
  throw new Error('R03 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function hasExactExpectedHeaders(headers) {
  const entries = [...headers.entries()];
  return (
    entries.length === Object.keys(EXPECTED_REQUEST_HEADERS).length &&
    entries.every(([name, value]) => EXPECTED_REQUEST_HEADERS[name] === value)
  );
}

const syntheticDirectRelations = () => [
  {
    id: 991021,
    type: 2,
    name: 'Synthetic R03 matrix target 991021',
    name_cn: '合成 R03 矩阵目标 991021',
    relation: '续篇',
  },
];

const syntheticTwoHopRelations = (rows) => () => rows.map((row) => ({ ...row }));
const syntheticTwoHopSubject = ({ id, score, total }) => () => ({
  id,
  type: 2,
  name: 'Synthetic R03 subject ' + id,
  name_cn: '合成 R03 作品 ' + id,
  summary: 'Synthetic offline fixture only.',
  nsfw: false,
  locked: false,
  platform: '',
  images: {},
  rating: { score, total },
});

export function createR03RelationsOfflineFetch(profile = R03_RELATIONS_OFFLINE_PROFILE_ID) {
  const spec = getR03RelationsOfflineProfileSpec(profile);
  const registeredProfile =
    typeof profile === 'string' ? getAgentMcpProfileById(profile) : profile;
  if (!spec || !registeredProfile || !assertR03RelationsOfflineProfile(registeredProfile)) {
    throw new Error('R03 offline fixture requires an exact registered profile.');
  }
  const twoHop = spec.id === R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID;
  const operations = twoHop
    ? new Map([
        [
          ROUTES.twoHopRoot,
          {
            name: 'root-relations',
            kind: 'root',
            respond: syntheticTwoHopRelations([
              {
                id: 993812,
                type: 2,
                name: 'Synthetic R03 intermediate 993812',
                name_cn: '合成 R03 中间作品 993812',
                relation: '续集',
              },
            ]),
          },
        ],
        [
          ROUTES.twoHopIntermediate,
          {
            name: 'intermediate-relations',
            kind: 'intermediate',
            respond: syntheticTwoHopRelations([
              {
                id: 993813,
                type: 2,
                name: 'Synthetic R03 target 993813',
                name_cn: '合成 R03 目标 993813',
                relation: '续集',
              },
            ]),
          },
        ],
        [
          ROUTES.twoHopIntermediateDetail,
          {
            name: 'intermediate-detail',
            kind: 'detail',
            respond: syntheticTwoHopSubject({ id: 993812, score: 8.1, total: 18 }),
          },
        ],
        [
          ROUTES.twoHopTargetDetail,
          {
            name: 'target-detail',
            kind: 'detail',
            respond: syntheticTwoHopSubject({ id: 993813, score: 9.2, total: 37 }),
          },
        ],
      ])
    : new Map([[ROUTES.direct, { name: 'direct', kind: 'root', respond: syntheticDirectRelations }]]);
  const observed = new Set();
  const counters = {
    profile: spec.networkMode,
    requestCount: 0,
    relationRequestCount: 0,
    rootRequestCount: 0,
    intermediateRequestCount: 0,
    subjectDetailRequestCount: 0,
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
      return new Response('R03 offline fixture denied an invalid request.', { status: 599 });
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
      hasExactExpectedHeaders(headers) &&
      operation !== undefined;
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('R03 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R03 offline fixture denied a duplicate request.', { status: 599 });
    }
    observed.add(url.pathname);
    if (operation.kind === 'detail') {
      counters.subjectDetailRequestCount += 1;
    } else {
      counters.relationRequestCount += 1;
      if (operation.kind === 'intermediate') counters.intermediateRequestCount += 1;
      else counters.rootRequestCount += 1;
    }
    return response(operation.respond());
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = observed.size === operations.size;
      if (!twoHop) {
        const legacySnapshot = { ...counters };
        delete legacySnapshot.subjectDetailRequestCount;
        return legacySnapshot;
      }
      return { ...counters };
    },
  };
}

export function assertR03RelationsOfflineFixture(profile) {
  if (
    ![R03_RELATIONS_OFFLINE_NETWORK_MODE, R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE].includes(
      profile?.networkMode,
    )
  ) {
    throw new Error('R03 offline fixture requires its exact registered profile.');
  }
  return assertR03RelationsOfflineProfile(profile);
}
