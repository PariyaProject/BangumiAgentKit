import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  createC07RenderComparisonOfflineFetch,
  assertC07RenderComparisonOfflineFixtureProfile,
} from '../../scripts/lib/c07-render-comparison-offline-fixture.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  assertC07RenderComparisonOfflineProfile,
  getC07RenderComparisonOfflineConfig,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { validateC07RenderComparisonOfflineRunnerArgs } from '../../scripts/acceptance/run-c07-render-comparison-offline-agent-mcp.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/c07-render-comparison-v2-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const V1 = getAgentMcpProfileById(C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID);
const V2 = getAgentMcpProfileById(C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID);
const V2_CONFIG = getC07RenderComparisonOfflineConfig(V2.id);
const V3 = getAgentMcpProfileById(C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID);
const V3_CONFIG = getC07RenderComparisonOfflineConfig(V3.id);

test('C07 v2 is distinct and cannot accept v1 profile fields or arguments', () => {
  assert.equal(assertC07RenderComparisonOfflineProfile(V2), true);
  assert.equal(V2.epochId, 'run95-c07-render-comparison-offline-agent-mcp-matrix-v2-20261018');
  assert.notEqual(V2.networkMode, V1.networkMode);
  assert.notDeepEqual(V2.calls[0].arguments, V1.calls[0].arguments);
  assert.equal(assertC07RenderComparisonOfflineFixtureProfile(V2), true);
  assert.throws(() =>
    assertC07RenderComparisonOfflineProfile({
      ...V2,
      calls: V1.calls,
    }),
  );
  assert.throws(() =>
    assertC07RenderComparisonOfflineProfile({
      ...V2,
      networkMode: V1.networkMode,
    }),
  );
});

test('C07 v2 MCP profile selects only its exact offline fixture route', async () => {
  const serverConfig = parseCodexOneToolMcpArguments(['--profile-id', V2.id, ...REQUIRED]);
  assert.equal(serverConfig.profile.id, V2.id);
  assert.equal(serverConfig.networkMode, V2_CONFIG.networkMode);
  assert.deepEqual(serverConfig.expectedArgumentSequence, [V2_CONFIG.expectedArguments]);

  const fixture = createC07RenderComparisonOfflineFetch(V2);
  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    body: JSON.stringify({
      keyword: V2_CONFIG.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  const detail = await fixture.fetchFn(`https://api.bgm.tv/v0/subjects/${V2_CONFIG.subjectId}`);
  assert.equal((await search.json()).data[0].id, 991224);
  assert.equal((await detail.json()).id, 991224);
  assert.equal(fixture.snapshot().profile, V2_CONFIG.networkMode);
  assert.equal(fixture.snapshot().expectedOperationsComplete, true);
});

test('C07 v2 and v3 runners recognize only their exact registry identities', async () => {
  assert.equal(
    validateC07RenderComparisonOfflineRunnerArgs([
      '--run',
      '95',
      '--profile-id',
      C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
    ]),
    'run',
  );
  assert.equal(
    validateC07RenderComparisonOfflineRunnerArgs([
      '--run',
      '95',
      '--profile-id',
      C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
    ]),
    'run',
  );
  assert.equal(assertC07RenderComparisonOfflineProfile(V3), true);
  assert.equal(V3_CONFIG.subjectId, 991226);
  assert.notDeepEqual(V3.calls[0].arguments, V2.calls[0].arguments);
  const v3ServerConfig = parseCodexOneToolMcpArguments(['--profile-id', V3.id, ...REQUIRED]);
  assert.equal(v3ServerConfig.profile.id, V3.id);
  assert.equal(v3ServerConfig.networkMode, V3_CONFIG.networkMode);
  assert.deepEqual(v3ServerConfig.expectedArgumentSequence, [V3_CONFIG.expectedArguments]);
  const v3Fixture = createC07RenderComparisonOfflineFetch(V3);
  const v3Search = await v3Fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      body: JSON.stringify({ keyword: V3_CONFIG.keyword, sort: 'match', filter: { type: [2] } }),
    },
  );
  const v3Detail = await v3Fixture.fetchFn(`https://api.bgm.tv/v0/subjects/${V3_CONFIG.subjectId}`);
  assert.equal((await v3Search.json()).data[0].id, 991226);
  assert.equal((await v3Detail.json()).id, 991226);
  assert.equal(v3Fixture.snapshot().expectedOperationsComplete, true);
  const summary = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-v2-artifact' } },
    V2_CONFIG.expectedArguments,
    V2.id,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 640,
      height: 480,
      byteLength: 1234,
      sha256: 'c'.repeat(64),
      pngSignatureValid: true,
    },
    'bangumi.render_subject_cohort_comparison',
  );
  assert.equal(summary.resultState, 'artifact_returned');
  assert.equal(summary.artifact.width, 640);
  assert.equal(JSON.stringify(summary).includes('ephemeral-v2-artifact'), false);

  const v3Summary = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-v3-artifact' } },
    V3_CONFIG.expectedArguments,
    V3.id,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 640,
      height: 480,
      byteLength: 1234,
      sha256: 'd'.repeat(64),
      pngSignatureValid: true,
    },
    'bangumi.render_subject_cohort_comparison',
  );
  assert.equal(v3Summary.resultState, 'artifact_returned');
  assert.equal(v3Summary.artifact.width, 640);
  assert.equal(JSON.stringify(v3Summary).includes('ephemeral-v3-artifact'), false);
});
