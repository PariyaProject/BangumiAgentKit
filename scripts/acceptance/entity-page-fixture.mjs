/** Nine finite synthetic responses; no real transport, assets, model or account. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { installFixtureFetch } from './calendar-account-closed-guard.mjs';
const runtime = createRequire('/opt/bangumi/package.json');
const tools = createRequire(runtime.resolve('@bangumi-agent-kit/tools'));
const renderer = tools.resolve('@bangumi-agent-kit/renderer');
const output = '/tmp/entity-page-mcp/provider.json';
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const facts = {
  schema: 'entity-page-provider/v1',
  calls: [],
  denied: 0,
  assetAttempts: 0,
  renderCalls: 0,
  offeredBytes: 0,
  bodyCancelled: false,
};
const publish = () => fs.writeFileSync(output, JSON.stringify(facts), { mode: 0o600 });
const deny = () => {
  facts.denied++;
  publish();
  throw Error('ECP_PROVIDER_DENIED');
};
const row = (id) => ({
  id,
  name: '合成记录' + id,
  type: 1,
  images: {},
  created_at: '2026-01-01T00:00:00Z',
});
publish();
installFixtureFetch(async (input, init) => {
  const request = new Request(input, init),
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== 'https://api.bgm.tv' ||
    request.headers.get('authorization') !== 'Bearer page-fake-access' ||
    facts.calls.length >= 9
  )
    return deny();
  const step = JSON.parse(fs.readFileSync('/tmp/entity-page-mcp/step.json', 'utf8'));
  if (step.index !== facts.calls.length) return deny(); // No retry, pagination, fallback or hydration.
  const character = step.index === 2 || step.index === 6;
  const kind = step.index === 1 ? 'single' : character ? 'characters' : 'persons';
  const route =
    '/v0/users/page-fake-user/collections/-/' + (kind === 'single' ? 'persons/20' : kind);
  const query = Object.fromEntries(url.searchParams);
  if (
    url.pathname !== route ||
    !isDeepStrictEqual(
      query,
      kind === 'single'
        ? {}
        : { limit: String(step.input.maxItems), offset: String(step.input.offset) },
    )
  )
    return deny();
  if (
    kind === 'single' &&
    (step.name !== 'bangumi.get_person_collection' || step.input.personId !== 20)
  )
    return deny();
  if (
    kind !== 'single' &&
    step.name !== 'bangumi.list_' + (character ? 'character' : 'person') + '_collections'
  )
    return deny();
  facts.calls.push({ kind, step: step.index, ...query });
  publish();
  if (step.index === 1) return Response.json(row(20));
  if (step.index === 6) return Response.json({ error: 'synthetic unavailable' }, { status: 503 });
  if (step.index === 8) {
    let offered = false;
    return new Response(
      new ReadableStream({
        pull(controller) {
          if (offered) return;
          offered = true;
          facts.offeredBytes = 262145;
          publish();
          controller.enqueue(new Uint8Array(facts.offeredBytes).fill(32));
        },
        cancel() {
          facts.bodyCancelled = true;
          publish();
        },
      }),
    );
  }
  const bodies = {
    0: { total: 4, limit: 1, offset: 0, data: [row(20)] },
    2: { total: 5, limit: 2, offset: 1, data: [row(30)] },
    3: { total: 0, limit: 1, offset: 9, data: [] },
    4: { total: 3, limit: 1, offset: 1, data: [] },
    5: { total: 4, limit: 30, offset: 0, data: [row(20)] },
    7: { total: 4, limit: 1, offset: 0, data: [row(20), row(21)] },
  };
  if (!Object.hasOwn(bodies, step.index)) return deny();
  return Response.json(bodies[step.index]);
});
const { NodeAssetHttpTransport, DefaultAssetNetworkResolver } = await import(
  pathToFileURL(path.join(path.dirname(renderer), 'asset-transport.js'))
);
const noAssets = async () => {
  facts.assetAttempts++;
  publish();
  throw Error('ECP_ASSET_DENIED');
};
NodeAssetHttpTransport.prototype.request = noAssets;
DefaultAssetNetworkResolver.prototype.resolve = noAssets;
const { RenderService } = await import(pathToFileURL(renderer));
RenderService.prototype.renderCard = async function () {
  facts.renderCalls++;
  publish();
  throw Error('ECP_UNEXPECTED_RENDER');
};
