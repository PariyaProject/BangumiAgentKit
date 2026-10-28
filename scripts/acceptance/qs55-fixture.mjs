// The only substituted boundary is official-provider I/O; business/VM/PNG stay native.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire('/opt/bangumi/package.json');
const sdk = createRequire(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
const express = createRequire(sdk.resolve('express'));
if (process.env.QS55_FORCE === 'require') express('qs');
if (process.env.QS55_FORCE === 'import') await import(pathToFileURL(express.resolve('qs')));
const toolsRequire = createRequire(require.resolve('@bangumi-agent-kit/tools'));
const rendererEntry = toolsRequire.resolve('@bangumi-agent-kit/renderer');
const factsPath = '/tmp/qs55-output/provider.json';
const facts = {
  schema: 'qs55-fake-provider/v1',
  calls: [],
  denied: 0,
  assetAttempts: 0,
  renderCalls: 0,
  privateCacheDisabled: true,
  cacheWrites: 0,
};
const publish = () => fs.writeFileSync(factsPath, JSON.stringify(facts), { mode: 0o600 });
publish();
const deny = () => {
  facts.denied++;
  publish();
  throw Error('QS55_PROVIDER_DENIED');
};
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init),
    url = new URL(request.url);
  const step = JSON.parse(fs.readFileSync('/tmp/qs55-output/step.json', 'utf8'));
  const tool = step.name;
  if (request.method !== 'GET' || facts.calls.length >= 64) return deny();
  const calendar = url.origin === 'https://api.bgm.tv' && url.pathname === '/calendar';
  if (calendar) {
    if (
      !/backlog|schedule|dashboard/u.test(tool) ||
      url.search ||
      request.headers.has('authorization')
    )
      return deny();
    facts.calls.push({ kind: 'calendar', step: step.index });
    publish();
    return Response.json(
      Array.from({ length: 7 }, (_, i) => ({
        weekday: { id: i + 1, en: 'day', cn: '周' },
        items:
          i === 2
            ? [
                {
                  id: 991402,
                  type: 2,
                  name: 'Synthetic',
                  name_cn: '合成番剧',
                  air_date: '2026-10-01',
                  air_weekday: 3,
                },
              ]
            : [],
      })),
    );
  }
  if (
    url.origin !== 'https://api.bgm.tv' ||
    request.headers.get('authorization') !== 'Bearer qs55-fake-access'
  )
    return deny();
  const collection = url.pathname === '/v0/users/qs55-fake-user/collections';
  const episodes = url.pathname === '/v0/users/-/collections/991402/episodes';
  if (!collection && !episodes) return deny();
  const limit = Number(url.searchParams.get('limit'));
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 2 ||
    [...url.searchParams.keys()].some(
      (k) => !['limit', 'offset', 'type', 'subject_type', 'episode_type'].includes(k),
    )
  )
    return deny();
  facts.calls.push({ kind: episodes ? 'episodes' : 'collections', step: step.index, limit });
  publish();
  if (episodes)
    return Response.json({
      total: 20,
      limit,
      offset: Number(url.searchParams.get('offset')),
      data: [
        {
          type: 1,
          episode: {
            id: 882501,
            subject_id: 991402,
            type: 0,
            sort: 1,
            ep: 1,
            name: 'Synthetic episode',
            duration: '00:24:00',
            duration_seconds: 1440,
          },
        },
      ],
    });
  const type = tool.includes('series') ? 1 : 2;
  return Response.json({
    total: 20,
    limit,
    offset: Number(url.searchParams.get('offset')),
    data: [
      {
        subject_id: 991402,
        subject_type: type,
        type: tool === 'bangumi.list_collections' ? 3 : 1,
        rate: 8,
        ep_status: 0,
        tags: ['synthetic'],
        updated_at: '2026-10-01T12:00:00Z',
        subject: { id: 991402, type, name: 'Synthetic title', name_cn: '合成番剧', eps: 12 },
      },
    ],
  });
};
const { NodeAssetHttpTransport, DefaultAssetNetworkResolver } = await import(
  pathToFileURL(path.join(path.dirname(rendererEntry), 'asset-transport.js'))
);
const assetDeny = async () => {
  facts.assetAttempts++;
  publish();
  throw Error('QS55_ASSET_DENIED');
};
NodeAssetHttpTransport.prototype.request = assetDeny;
DefaultAssetNetworkResolver.prototype.resolve = assetDeny;
const { RenderService } = await import(pathToFileURL(rendererEntry));
const originalRender = RenderService.prototype.renderCard;
RenderService.prototype.renderCard = async function (vm, options) {
  facts.renderCalls++;
  facts.privateCacheDisabled &&= options?.cache === false;
  publish();
  return originalRender.call(this, vm, options);
};
const { RendererLruCache } = await import(
  pathToFileURL(path.join(path.dirname(rendererEntry), 'lru-cache.js'))
);
const originalSet = RendererLruCache.prototype.set;
RendererLruCache.prototype.set = function (key, value) {
  if (Buffer.isBuffer(value?.buffer)) {
    facts.cacheWrites++;
    publish();
  }
  return originalSet.call(this, key, value);
};
