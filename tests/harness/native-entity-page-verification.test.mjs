import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { ToolRegistry } from '../../packages/tools/dist/index.js';
import {
  createNativeEntityPageVerification,
  NATIVE_PAGE_CALLS,
  projectNativeEntityPageResult,
} from '../../scripts/lib/native-entity-page-verification.mjs';

const row = { id: 987654, name: 'untrusted-row-do-not-retain', type: 1, created_at: '2026-01-01T00:00:00Z' };
const page = (data = [row], total = 3) => ({ limit: 1, offset: 0, total, data });
const context = { principalId: 'synthetic', botInstanceId: 'synthetic', conversationId: 'synthetic' };

function fixture(bodies = [page(), page()], adapt = (value) => value) {
  const requests = [];
  let accountAttempts = 0;
  const verification = createNativeEntityPageVerification({
    fetchImpl: async (input, init) => {
      const index = requests.length;
      requests.push({ input, init });
      const body = bodies[index];
      if (body instanceof Error) throw body;
      return body instanceof Response ? body : Response.json(body);
    },
  });
  const publicHttpClient = new HttpClient({ fetchFn: verification.fetchFn });
  const publicClient = new GeneratedBangumiOpenApiClient(publicHttpClient);
  const denied = async () => { accountAttempts++; throw new Error('SYNTHETIC_ACCOUNT_DENIED'); };
  const denyService = new Proxy({}, { get: () => denied });
  const registry = new ToolRegistry({
    storage: new MemoryStorage(), publicHttpClient,
    clientProvider: { getPublicClient: async () => publicClient,
      getOptionalAuthenticatedClient: denied, requireAuthenticatedClient: denied },
    tokenBroker: denyService, oauthService: denyService, auditService: denyService,
  }, { profile: 'full' });
  const execute = async (name, args) => adapt(await registry.executeTool(name, args, context));
  const call = (index) => verification.call(execute, NATIVE_PAGE_CALLS[index].toolName, NATIVE_PAGE_CALLS[index].arguments);
  return { verification, requests, execute, call, accountAttempts: () => accountAttempts };
}

test('new native verification uses the actual full registry and exactly two anonymous native pages', async () => {
  const f = fixture();
  const first = await f.call(0);
  const second = await f.call(1);
  assert.equal(first.kind, 'person');
  assert.equal(second.kind, 'character');
  assert.equal(first.hasMore, true);
  assert.equal(first.nextOffset, 1);
  assert.equal(first.stableSnapshot, false);
  assert.equal(f.accountAttempts(), 0);
  assert.deepEqual(f.requests.map((r) => new URL(r.input).pathname.split('/').at(-1)), ['persons', 'characters']);
  for (const { input, init } of f.requests) {
    assert.equal(new URL(input).search, '?limit=1&offset=0');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).has('authorization'), false);
    assert.equal(init.signal.aborted, true); // Product transport has disposed both requests.
  }
  const snapshot = f.verification.snapshot();
  assert.equal(snapshot.phase, 'COMPLETE');
  assert.equal(snapshot.requestCount, 2);
  assert.equal(snapshot.liveEvidence, false);
  for (const forbidden of ['username', 'untrusted-row-do-not-retain', '987654', 'created_at', 'retrievedAt'])
    assert.equal(JSON.stringify(snapshot).includes(forbidden), false);
  await assert.rejects(f.call(0), /NATIVE_PAGE_TOOL_DENIED/u);
  assert.equal(f.requests.length, 2);
});

for (const [body, expected] of [
  [page([], 0), { empty: 'collection_empty', total: 0, hasMore: false, truncated: false }],
  [page([], 3), { empty: 'page_empty', total: 3, hasMore: true, truncated: true }],
  [page([{ malformed: true }], 3), { observed: 1, returned: 0, invalidRows: 1, hasMore: true, nextOffset: 1 }],
  [page([row], 0), { total: null, hasMore: null, nextOffset: null, totalInconsistent: true, truncated: true }],
]) test(`new verification preserves degraded native semantics ${JSON.stringify(expected)}`, async () => {
  const f = fixture([body]);
  const result = await f.call(0);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value);
  assert.equal(f.requests.length, 1);
});

for (const args of [
  {}, { maxItems: 1, offset: 0 }, { ...NATIVE_PAGE_CALLS[0].arguments, maxItems: 2 },
  { ...NATIVE_PAGE_CALLS[0].arguments, offset: 1 },
  { ...NATIVE_PAGE_CALLS[0].arguments, token: 'synthetic-token' },
]) test(`new verification rejects altered/implicit target arguments (${Object.keys(args).join(',')})`, async () => {
  const f = fixture();
  await assert.rejects(f.verification.call(f.execute, NATIVE_PAGE_CALLS[0].toolName, args), /NATIVE_PAGE_TOOL_DENIED/u);
  await assert.rejects(f.call(0), /NATIVE_PAGE_TOOL_DENIED/u);
  assert.equal(f.requests.length, 0);
  assert.equal(f.accountAttempts(), 0);
});

for (const body of [
  { ...page(), limit: 50 }, { ...page(), offset: 1 },
  new Response('untrusted-error', { status: 429 }), new Error('untrusted-network-detail'),
  Response.json(page(), { headers: { 'content-length': '262145' } }),
]) test(`new verification terminalizes source failure without retry or second tool (${body.status ?? body.limit ?? body.offset ?? 'network'})`, async () => {
  const f = fixture([body]);
  await assert.rejects(f.call(0), /NATIVE_PAGE_OBSERVATION_FAILED/u);
  assert.equal(f.verification.snapshot().phase, 'FAILED');
  await assert.rejects(f.call(1), /NATIVE_PAGE_TOOL_DENIED/u);
  assert.equal(f.requests.length, 1);
});

test('new verification rejects reordered tools, fake no-fetch results and concurrent calls', async () => {
  const reordered = fixture();
  await assert.rejects(reordered.call(1), /NATIVE_PAGE_TOOL_DENIED/u);
  assert.equal(reordered.requests.length, 0);
  const absent = fixture();
  await assert.rejects(absent.verification.call(async () => ({}), NATIVE_PAGE_CALLS[0].toolName, NATIVE_PAGE_CALLS[0].arguments));
  assert.equal(absent.requests.length, 0);
  const f = fixture();
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const first = f.verification.call(async () => { await waiting; return {}; }, NATIVE_PAGE_CALLS[0].toolName, NATIVE_PAGE_CALLS[0].arguments);
  await assert.rejects(f.call(1), /NATIVE_PAGE_TOOL_DENIED/u);
  release();
  await assert.rejects(first, /NATIVE_PAGE_OBSERVATION_FAILED/u);
  assert.equal(f.requests.length, 0);
});

test('new verification denies extra fetches and unlisted request capabilities before provider I/O', async () => {
  const variants = [
    (url, init) => [url.replace('api.bgm.tv', 'example.com'), init],
    (url, init) => [url.replace('persons', 'characters'), init],
    (url, init) => [url + '&limit=1', init],
    (url, init) => [url.replace('offset=0', 'offset=1'), init],
    (url, init) => [url, { ...init, method: 'POST' }],
    (url, init) => [url, { ...init, headers: { authorization: 'synthetic' } }],
    (url, init) => [url, { ...init, headers: { cookie: 'synthetic' } }],
    (url, init) => [url, { ...init, credentials: 'include' }],
    (url, init) => [url, { ...init, redirect: 'follow' }],
    (url, init) => [url, { ...init, body: 'synthetic' }],
    (url, init) => [new Request(url), init],
    (url, init) => [url, { ...init, signal: undefined }],
  ];
  for (const change of variants) {
    const f = fixture();
    await assert.rejects(f.verification.call(async () => {
      const original = `https://api.bgm.tv/v0/users/${NATIVE_PAGE_CALLS[0].arguments.username}/collections/-/persons?limit=1&offset=0`;
      return f.verification.fetchFn(...change(original, { signal: new AbortController().signal }));
    }, NATIVE_PAGE_CALLS[0].toolName, NATIVE_PAGE_CALLS[0].arguments));
    assert.equal(f.requests.length, 0);
    assert.equal(f.verification.snapshot().phase, 'FAILED');
  }
  const f = fixture();
  await assert.rejects(f.verification.fetchFn('https://api.bgm.tv/'), /OUT_OF_SEQUENCE/u);
  assert.equal(f.requests.length, 0);
});

test('projection refuses forged completeness/source metadata and never forwards untrusted extras', async () => {
  let raw;
  const f = fixture(undefined, (value) => { raw = value; return value; });
  await f.call(0);
  for (const transform of [
    (r) => ({ ...r, pagination: { ...r.pagination, hasMore: false } }),
    (r) => ({ ...r, pagination: { ...r.pagination, nextOffset: 2 } }),
    (r) => ({ ...r, pagination: { ...r.pagination, stableSnapshot: true } }),
    (r) => ({ ...r, source: { ...r.source, authScope: 'account' } }),
    (r) => ({ ...r, coverage: { ...r.coverage, maxItems: 50 } }),
    (r) => ({ ...r, retrievedAt: 'invalid-time' }),
  ]) assert.throws(() => projectNativeEntityPageResult(transform(raw), 0), /RESULT_INVALID/u);
  assert.throws(() => projectNativeEntityPageResult(raw, 2), /RESULT_INVALID/u);
  assert.equal(JSON.stringify(projectNativeEntityPageResult({ ...raw, token: 'untrusted-extra' }, 0)).includes('untrusted'), false);
});

test('no implicit native fetch or execution authority is exposed by this preparation kernel', () => {
  assert.throws(() => createNativeEntityPageVerification(), /explicit fetch/u);
  assert.equal(Object.isFrozen(NATIVE_PAGE_CALLS), true);
  assert.equal(Object.isFrozen(NATIVE_PAGE_CALLS[0].arguments), true);
});
