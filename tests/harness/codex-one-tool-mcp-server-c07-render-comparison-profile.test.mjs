import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/c07-render-comparison-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const SERVER_SOURCE = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);

test('registered C07 profile selects only its immutable offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_subject_cohort_comparison');
  assert.equal(config.profile.id, C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  ]);
});

test('registered C07 v3 selects its exact synthetic cohort-E fixture', () => {
  const expected = getC07RenderComparisonOfflineConfig(C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.profile.id, C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID);
  assert.equal(config.networkMode, expected.networkMode);
  assert.equal(expected.subjectId, 991226);
  assert.equal(expected.keyword, 'run95 c07 synthetic cohort e offline matrix 20261018');
  assert.deepEqual(config.expectedArgumentSequence, [expected.expectedArguments]);
});

test('registered C07 v4 selects the exact two-cohort F/G fixture', () => {
  const expected = getC07RenderComparisonOfflineConfig(C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.profile.id, C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID);
  assert.equal(config.networkMode, expected.networkMode);
  assert.equal(expected.cohorts.length, 2);
  assert.deepEqual(expected.cohorts.map((cohort) => cohort.subjectId), [992401, 992402]);
  assert.equal(config.expectedArgumentSequence[0].cohorts.length, 2);
  assert.deepEqual(config.expectedArgumentSequence, [expected.expectedArguments]);
});

test('one-tool MCP server imports C07 profile selectors from their defining module', () => {
  const profileImport = SERVER_SOURCE.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/scripts\/lib\/c07-render-comparison-offline-profile\.mjs['"]/u,
  );
  assert.ok(profileImport);
  assert.match(profileImport[1], /\bisC07RenderComparisonOfflineNetworkMode\b/u);
  assert.match(profileImport[1], /\bisC07RenderComparisonOfflineProfileId\b/u);
  assert.match(profileImport[1], /\bC07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID\b/u);
  assert.match(profileImport[1], /\bC07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID\b/u);

  const fixtureImport = SERVER_SOURCE.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/scripts\/lib\/c07-render-comparison-offline-fixture\.mjs['"]/u,
  );
  assert.ok(fixtureImport);
  assert.match(fixtureImport[1], /\bassertC07RenderComparisonOfflineFixtureProfile\b/u);
  assert.match(fixtureImport[1], /\bcreateC07RenderComparisonOfflineFetch\b/u);
  assert.doesNotMatch(
    fixtureImport[1],
    /\bC07_RENDER_COMPARISON_OFFLINE_(?:NETWORK_MODE|PROFILE_ID)\b/u,
  );
});

test('C07 registered profile rejects arbitrary arguments and caller-selected network modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
      '--network-mode',
      C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
      '--tool',
      'bangumi.render_subject_cohort_comparison',
      ...REQUIRED,
    ]),
  );
});

test('C07 offline network mode cannot be selected by an arbitrary one-tool invocation', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--tool',
      'bangumi.render_subject_cohort_comparison',
      '--arguments-json',
      JSON.stringify(C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS),
      '--network-mode',
      C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});
