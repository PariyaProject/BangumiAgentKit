import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/c07-render-comparison-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

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

test('one-tool MCP server module imports without starting its stdio entry point', async () => {
  const serverModule = await import('../../apps/mcp/codex-one-tool-mcp-server.mjs');
  assert.equal(typeof serverModule, 'object');
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
