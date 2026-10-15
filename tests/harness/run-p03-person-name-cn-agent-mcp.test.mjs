import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildP03CodexExecArgs,
  validateP03RunnerArgs,
  validateP03ServerSummary,
} from '../../scripts/acceptance/run-p03-person-name-cn-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  summarizeP03PersonProfileToolResult,
  P03_PROFILE_ID,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const profile = getAgentMcpProfileById(P03_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function resultFixture() {
  return {
    state: 'partial',
    person: { id: 4765, name: 'Inori Minase', nameCn: '水濑祈' },
    coverage: {
      state: 'partial',
      subjects: { observed: 3, returned: 3, truncated: false, sourceCompleteness: 'undocumented' },
    },
    credits: {
      subjects: [
        { id: 1, name: 'Name A', nameCnSource: '作品甲' },
        { id: 2, name: 'Name B', nameCnSource: '作品乙' },
        { id: 3, name: 'Name C', nameCnSource: '' },
      ],
    },
  };
}

test('P03 runner accepts only the fixed Run 95 entry point', () => {
  assert.equal(validateP03RunnerArgs(['--help']), 'help');
  assert.equal(validateP03RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateP03RunnerArgs([]));
  assert.throws(() => validateP03RunnerArgs(['--run', '94']));
  assert.throws(() => validateP03RunnerArgs(['--run', '95', '--retry']));
});

test('P03 Codex config exposes one read-only MCP tool and disables other routes', () => {
  const args = buildP03CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p03-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(
    args.includes('mcp_servers.bgk_p03_name_cn.enabled_tools=["bangumi.get_person_profile"]'),
  );
  for (const forbidden of [
    'features.shell_tool=false',
    'features.browser_use=false',
    'features.computer_use=false',
    'features.multi_agent=false',
    'features.web_search=false',
  ]) {
    assert.ok(args.includes(forbidden), `missing ${forbidden}`);
  }
  const prompt = args.at(-1);
  assert.equal((prompt.match(/Call its sole tool/g) ?? []).length, 1);
  assert.ok(prompt.includes('exact argument object'));
  assert.ok(prompt.includes('不证明没有中文名'));
  assert.ok(prompt.includes('上游关系完整性未声明'));
  assert.ok(prompt.includes('未列出的作品不代表没有中文名'));
  assert.ok(prompt.includes('这不是完整生涯列表'));
});

test('P03 server summary binds the exact public read result and source coverage', () => {
  const profileResult = resultFixture();
  const resultSummary = summarizeP03PersonProfileToolResult(
    profileResult,
    profile.calls[0].arguments,
  );
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    toolName: profile.toolName,
    serverToolCount: 1,
    serverToolNames: [profile.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
  assert.equal(
    validateP03ServerSummary(summary, summary.sourceRevision, summary.bundleSha256),
    true,
  );

  const badCounts = structuredClone(summary);
  badCounts.results[0].resultSummary.nameCnSourceCounts.empty = 0;
  assert.equal(
    validateP03ServerSummary(badCounts, summary.sourceRevision, summary.bundleSha256),
    false,
  );

  const badArguments = structuredClone(summary);
  badArguments.expectedArgumentsSha256 = '0'.repeat(64);
  assert.equal(
    validateP03ServerSummary(badArguments, summary.sourceRevision, summary.bundleSha256),
    false,
  );
});

test('P03 MCP profile summary dispatches to the title-source projection', () => {
  const result = resultFixture();
  const actual = summarizeProfileToolResult(result, profile.calls[0].arguments, profile.id);
  const expected = summarizeP03PersonProfileToolResult(result, profile.calls[0].arguments);
  assert.deepEqual(actual, expected);
});
