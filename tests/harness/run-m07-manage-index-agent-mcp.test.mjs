import assert from 'node:assert/strict';
import test from 'node:test';
import { buildM07CodexExecArgs } from '../../scripts/acceptance/run-m07-manage-index-agent-mcp.mjs';

test('M07 Codex invocation is ephemeral, read-only, and exposes only manage_index', () => {
  const args = buildM07CodexExecArgs({
    root: '/tmp/m07-candidate',
    nodePath: '/usr/bin/node',
    serverScript: '/tmp/m07-candidate/apps/mcp/codex-m07-manage-index-auth-gate-mcp-server.mjs',
    summaryPath: '/tmp/m07-summary.json',
    candidateSha: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--json'));
  assert.ok(args.includes('--sandbox'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');

  const configEntries = args.flatMap((value, index) =>
    value === '--config' ? [args[index + 1]] : [],
  );
  const serverConfigs = configEntries.filter((entry) => entry.startsWith('mcp_servers.'));
  assert.ok(serverConfigs.length > 0);
  assert.equal(new Set(serverConfigs.map((entry) => entry.split('.')[1])).size, 1);
  assert.ok(
    serverConfigs.includes(
      'mcp_servers.bgk_m07_manage_index_auth_gate.enabled_tools=["bangumi.manage_index"]',
    ),
  );
  assert.ok(configEntries.includes('features.shell_tool=false'));
  assert.ok(configEntries.includes('features.browser_use=false'));
  assert.ok(configEntries.includes('web_search="disabled"'));
});
