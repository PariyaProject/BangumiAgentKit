import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  createP06RenderPersonProfileOfflineRuntime,
  P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
} from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p06-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('registered P06 profile selects only its immutable offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS]);
});

test('registered P06 v2 profile selects only its distinct offline network mode and arguments', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
  ]);
});

test('registered P06 v3 profile selects only chronology-v3 offline mode and arguments', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
  ]);
});

test('P06 server runtime binds v3 to its offline fixture and asset guard', async () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
    ...REQUIRED,
  ]);
  const runtime = createP06RenderPersonProfileOfflineRuntime(config);

  assert.ok(runtime);
  assert.equal(
    runtime.offlineFixture.snapshot().profile,
    P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE,
  );
  const personResponse = await runtime.offlineFixture.fetchFn(
    'https://api.bgm.tv/v0/persons/990606',
  );
  assert.equal(personResponse.status, 200);
  assert.equal((await personResponse.json()).id, 990606);

  const unselectedDetail = await runtime.offlineFixture.fetchFn(
    'https://api.bgm.tv/v0/subjects/990609',
  );
  assert.equal(unselectedDetail.status, 599);
  assert.equal(runtime.offlineFixture.snapshot().unexpectedRequestCount, 1);

  await assert.rejects(
    runtime.assetGuard.assetResolver.resolveAsset('https://images.example.invalid/a.png'),
    /P06 offline profile rejects all renderer asset resolution/u,
  );
  assert.deepEqual(runtime.assetGuard.snapshot(), {
    assetResolutionCallCount: 1,
    nonEmptyAssetUrlCount: 1,
    blockedAssetRequestCount: 1,
  });

  assert.throws(
    () =>
      createP06RenderPersonProfileOfflineRuntime({
        ...config,
        networkMode: 'unregistered-p06-network-mode',
      }),
    /exact registered network mode/u,
  );
});

test('P06 v3 profile summary retains only bounded artifact metadata', () => {
  assert.deepEqual(
    summarizeProfileToolResult(
      { artifact: { id: 'synthetic-artifact' }, resultText: 'private renderer output' },
      P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
      P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
      {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1280,
        byteLength: 42000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
      'bangumi.render_person_profile',
    ),
    {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1280,
        byteLength: 42000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  );
});

test('P06 registered profile rejects arbitrary arguments and caller-selected network modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--network-mode',
      P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--tool',
      'bangumi.render_person_profile',
      ...REQUIRED,
    ]),
  );
});

test('P06 offline network mode cannot be selected by an arbitrary one-tool invocation', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--tool',
      'bangumi.render_person_profile',
      '--arguments-json',
      JSON.stringify(P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS),
      '--network-mode',
      P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});
