import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildP07CodexExecArgs,
  validateP07RunnerArgs,
  validateP07ServerSummary,
} from '../../scripts/acceptance/run-p07-person-season-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P07_PROFILE_ID,
  summarizeP07PersonActivityToolResult,
} from '../../scripts/lib/p07-person-season-evidence.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const profile = getAgentMcpProfileById(P07_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function resultFixture() {
  return {
    personId: 3474,
    kind: 'staff',
    media: 'anime',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-10-01',
      end: '2026-10-15',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      { subjectId: 101, firstAirDate: '2024-01-10', subjectName: 'private fixture title' },
      { subjectId: 102, firstAirDate: '2024-03-31', subjectName: 'private fixture title' },
      { subjectId: 103, firstAirDate: '2024-04-01', subjectName: 'private fixture title' },
    ],
    coverage: {
      relationRowsObserved: 24,
      relationRowsSelected: 24,
      relationRowsDroppedAtLimit: 0,
      sampled: false,
      subjectDetailRequests: 8,
      subjectDetailsSucceeded: 8,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 3,
      rowsReturned: 3,
      missingDateRows: 1,
      invalidDateRows: 1,
      outputTruncated: false,
      truncated: false,
      retrievedAt: '2026-10-16T02:00:00.000Z',
    },
  };
}

test('P07 runner accepts only the fixed Run 95 entry point', () => {
  assert.equal(validateP07RunnerArgs(['--help']), 'help');
  assert.equal(validateP07RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateP07RunnerArgs([]));
  assert.throws(() => validateP07RunnerArgs(['--run', '94']));
  assert.throws(() => validateP07RunnerArgs(['--run', '95', '--retry']));
});

test('P07 Codex config is ephemeral/read-only and exposes exactly the fixed MCP tool', () => {
  const args = buildP07CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p07-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(
    args.includes(
      'mcp_servers.bgk_p07_person_season.enabled_tools=["bangumi.get_person_activity"]',
    ),
  );
  for (const disabled of [
    'features.shell_tool=false',
    'features.browser_use=false',
    'features.computer_use=false',
    'features.multi_agent=false',
    'features.web_search=false',
  ]) {
    assert.ok(args.includes(disabled), `missing ${disabled}`);
  }
  assert.equal((args.at(-1).match(/Call its sole tool/g) ?? []).length, 1);
  assert.ok(args.at(-1).includes('calendar quarters'));
  assert.ok(args.at(-1).includes('Do not add tags'));
});

test('P07 server summary binds the sanitized quarter distribution and current catalog', () => {
  const raw = resultFixture();
  const resultSummary = summarizeP07PersonActivityToolResult(raw, profile.calls[0].arguments);
  assert.ok(resultSummary);
  assert.equal(JSON.stringify(resultSummary).includes('private fixture title'), false);
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
    validateP07ServerSummary(summary, summary.sourceRevision, summary.bundleSha256),
    true,
  );
  const altered = structuredClone(summary);
  altered.results[0].resultSummary.coverage.rowsReturned += 1;
  assert.equal(
    validateP07ServerSummary(altered, summary.sourceRevision, summary.bundleSha256),
    false,
  );
});

test('P07 profile summary dispatch drops raw titles and returned subject IDs', () => {
  const raw = resultFixture();
  const summary = summarizeProfileToolResult(raw, profile.calls[0].arguments, profile.id);
  assert.deepEqual(summary, summarizeP07PersonActivityToolResult(raw, profile.calls[0].arguments));
  assert.equal(Object.hasOwn(summary, 'rows'), false);
  assert.equal(JSON.stringify(summary).includes('private fixture title'), false);
  assert.equal(JSON.stringify(summary).includes('subjectId'), false);
});
