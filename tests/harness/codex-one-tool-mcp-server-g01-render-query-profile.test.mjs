import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS,
  G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
  G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
  G01_RENDER_QUERY_OFFLINE_V2_EXPECTED_ARGUMENTS,
  G01_RENDER_QUERY_OFFLINE_V2_NETWORK_MODE,
  G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID,
} from '../../scripts/lib/g01-render-query-subjects-offline-profile.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/g01-render-query-subjects-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const SERVER_SOURCE = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);

test('registered G01 profile selects only its immutable offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_query_subjects');
  assert.equal(config.profile.id, G01_RENDER_QUERY_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, G01_RENDER_QUERY_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS]);
});

test('registered G01 v2 profile selects its distinct immutable offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_query_subjects');
  assert.equal(config.profile.id, G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID);
  assert.equal(config.networkMode, G01_RENDER_QUERY_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    G01_RENDER_QUERY_OFFLINE_V2_EXPECTED_ARGUMENTS,
  ]);
  assert.notEqual(config.networkMode, G01_RENDER_QUERY_OFFLINE_NETWORK_MODE);
});

test('one-tool MCP server imports G01 constants from their defining module', () => {
  const profileImport = SERVER_SOURCE.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/scripts\/lib\/g01-render-query-subjects-offline-profile\.mjs['"]/u,
  );
  assert.ok(profileImport);
  assert.match(profileImport[1], /\bgetG01RenderQueryOfflineProfileSpec\b/u);
  assert.match(profileImport[1], /\bisG01RenderQueryOfflineProfileId\b/u);

  const fixtureImport = SERVER_SOURCE.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/scripts\/lib\/g01-render-query-subjects-offline-fixture\.mjs['"]/u,
  );
  assert.ok(fixtureImport);
  assert.match(fixtureImport[1], /\bassertG01RenderQueryOfflineFixtureProfile\b/u);
  assert.match(fixtureImport[1], /\bcreateG01RenderQueryOfflineFetch\b/u);
  assert.doesNotMatch(
    fixtureImport[1],
    /\bG01_RENDER_QUERY_OFFLINE_(?:NETWORK_MODE|PROFILE_ID)\b/u,
  );
});

test('G01 registered profile rejects arbitrary arguments and caller-selected network modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
      '--network-mode',
      G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
      '--tool',
      'bangumi.render_query_subjects',
      ...REQUIRED,
    ]),
  );
});

test('G01 offline network mode cannot be selected by an arbitrary one-tool invocation', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--tool',
      'bangumi.render_query_subjects',
      '--arguments-json',
      JSON.stringify(G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS),
      '--network-mode',
      G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});
