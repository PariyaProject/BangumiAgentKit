/** Synthetic provider only; original compiled MCP/Registry/business/rendering execute. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { installFixtureFetch } from './calendar-account-closed-guard.mjs';

const runtime = createRequire('/opt/bangumi/package.json');
const tools = createRequire(runtime.resolve('@bangumi-agent-kit/tools'));
const renderer = tools.resolve('@bangumi-agent-kit/renderer');
const output = '/tmp/person-account-mcp/provider.json';
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const facts = {
  schema: 'person-account-provider/v1',
  calls: [],
  denied: 0,
  assetAttempts: 0,
  renderCalls: 0,
  privateCacheDisabled: true,
  cacheWrites: 0,
};
const publish = () => fs.writeFileSync(output, JSON.stringify(facts), { mode: 0o600 });
const deny = () => {
  facts.denied++;
  publish();
  throw Error('PERSON_PROVIDER_DENIED');
};
const person = (id) => ({
  id,
  name: '合成人物' + id,
  type: 1,
  images: {},
  created_at: '2026-01-01T00:00:00Z',
  ...(id === 21 ? { career: [] } : {}),
  ...(id === 22 ? { career: ['future-role'] } : {}),
});
publish();
installFixtureFetch(async (input, init) => {
  const request = new Request(input, init),
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== 'https://api.bgm.tv' ||
    request.headers.get('authorization') !== 'Bearer person-fake-access' ||
    facts.calls.length >= 24
  )
    return deny();
  const step = JSON.parse(fs.readFileSync('/tmp/person-account-mcp/step.json', 'utf8'));
  let kind,
    body,
    status = 200;
  const single = /^\/v0\/users\/person-fake-user\/collections\/-\/persons\/(20|21|22|23|24)$/u.exec(
    url.pathname,
  );
  if (single && step.name === 'bangumi.get_person_collection' && !url.search) {
    const id = Number(single[1]);
    if (id !== step.personId) return deny();
    kind = 'single';
    body = id === 23 ? { ...person(id), career: 'invalid' } : person(id);
    if (id === 24) {
      body = { error: 'not found' };
      status = 404;
    }
  } else if (url.pathname === '/v0/users/person-fake-user/collections/-/persons' && !url.search) {
    if (
      ![
        'bangumi.list_person_collections',
        'bangumi.get_collection_entity_consistency',
        'bangumi.render_collection_entity_consistency',
      ].includes(step.name)
    )
      return deny();
    kind = 'persons';
    body = { total: 3, limit: 3, offset: 0, data: [20, 21, 22].map(person) };
  } else if (
    url.pathname === '/v0/users/person-fake-user/collections/-/characters' &&
    !url.search
  ) {
    kind = 'characters';
    body = { total: 0, limit: 0, offset: 0, data: [] };
  } else if (
    url.pathname === '/v0/users/person-fake-user/collections' &&
    url.searchParams.get('limit') === '50' &&
    url.searchParams.get('offset') === '0' &&
    [...url.searchParams.keys()].every((key) => ['limit', 'offset'].includes(key))
  ) {
    kind = 'subjects';
    body = {
      total: 1,
      limit: 50,
      offset: 0,
      data: [
        {
          subject_id: 100,
          subject_type: 2,
          type: 2,
          subject: { id: 100, type: 2, name: '合成作品' },
        },
      ],
    };
  } else if (url.pathname === '/v0/subjects/100/characters' && !url.search) {
    kind = 'subject-characters';
    body = [];
  } else if (url.pathname === '/v0/subjects/100/persons' && !url.search) {
    kind = 'subject-persons';
    body = [20, 21, 22].map((id) => ({
      id,
      name: '合成人物' + id,
      type: 1,
      career: ['seiyu'],
      relation: '制作',
      eps: '',
    }));
  } else return deny();
  if (
    !['single', 'persons'].includes(kind) &&
    ![
      'bangumi.get_collection_entity_consistency',
      'bangumi.render_collection_entity_consistency',
    ].includes(step.name)
  )
    return deny();
  facts.calls.push({ kind, step: step.index });
  publish();
  return Response.json(body, { status });
});

const { NodeAssetHttpTransport, DefaultAssetNetworkResolver } = await import(
  pathToFileURL(path.join(path.dirname(renderer), 'asset-transport.js'))
);
const noAssets = async () => {
  facts.assetAttempts++;
  publish();
  throw Error('PERSON_ASSET_DENIED');
};
NodeAssetHttpTransport.prototype.request = noAssets;
DefaultAssetNetworkResolver.prototype.resolve = noAssets;
const { RenderService } = await import(pathToFileURL(renderer));
const render = RenderService.prototype.renderCard;
RenderService.prototype.renderCard = async function (vm, options) {
  facts.renderCalls++;
  facts.privateCacheDisabled &&= options?.cache === false;
  publish();
  return render.call(this, vm, options);
};
const { RendererLruCache } = await import(
  pathToFileURL(path.join(path.dirname(renderer), 'lru-cache.js'))
);
const cache = RendererLruCache.prototype.set;
RendererLruCache.prototype.set = function (key, value) {
  if (Buffer.isBuffer(value?.buffer)) {
    facts.cacheWrites++;
    publish();
  }
  return cache.call(this, key, value);
};
