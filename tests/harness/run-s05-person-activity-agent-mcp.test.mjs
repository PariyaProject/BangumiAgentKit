import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildS05CodexExecArgs,
  validateS05RunnerArgs,
  validateS05ServerSummary,
} from '../../scripts/acceptance/run-s05-person-activity-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  S05_PROFILE_ID,
  summarizeS05PersonActivityToolResult,
} from '../../scripts/lib/s05-person-activity-evidence.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const profile = getAgentMcpProfileById(S05_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function resultFixture() {
  return {
    personId: 3474,
    kind: 'voice',
    media: 'anime',
    state: 'partial',
    window: {
      months: 6,
      start: '2026-05-01',
      end: '2026-10-17',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      {
        subjectId: 101,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-06-10',
        platform: 'OVA',
        subjectName: 'private fixture title',
      },
      {
        subjectId: 102,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-07-12',
        platform: 'TV',
        subjectName: 'private fixture title',
      },
      {
        subjectId: 103,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-09-05',
        platform: 'unclassified platform',
        subjectName: 'private fixture title',
      },
    ],
    coverage: {
      relationRowsObserved: 60,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 12,
      sampled: true,
      subjectDetailRequests: 16,
      subjectDetailsSucceeded: 16,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 3,
      rowsReturned: 3,
      missingDateRows: 1,
      invalidDateRows: 0,
      outputTruncated: false,
      truncated: true,
      retrievedAt: '2026-10-16T02:00:00.000Z',
    },
  };
}

test('S05 runner accepts only the fixed Run 95 entry point', () => {
  assert.equal(validateS05RunnerArgs(['--help']), 'help');
  assert.equal(validateS05RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateS05RunnerArgs([]));
  assert.throws(() => validateS05RunnerArgs(['--run', '94']));
  assert.throws(() => validateS05RunnerArgs(['--run', '95', '--retry']));
});

test('S05 Codex config is ephemeral/read-only and exposes exactly the fixed MCP tool', () => {
  const args = buildS05CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/s05-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(
    args.includes('mcp_servers.bgk_s05_non_tv_voice.enabled_tools=["bangumi.get_person_activity"]'),
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
  assert.ok(args.at(-1).includes('non-TV'));
  assert.ok(args.at(-1).includes('not established'));
});

test('S05 server summary binds the sanitized positive-only observation and current catalog', () => {
  const raw = resultFixture();
  const resultSummary = summarizeS05PersonActivityToolResult(raw, profile.calls[0].arguments);
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
    validateS05ServerSummary(summary, summary.sourceRevision, summary.bundleSha256),
    true,
  );
  const altered = structuredClone(summary);
  altered.results[0].resultSummary.platformCounts.nonTv += 1;
  assert.equal(
    validateS05ServerSummary(altered, summary.sourceRevision, summary.bundleSha256),
    false,
  );
});

test('S05 profile summary dispatch drops raw titles and returned subject IDs', () => {
  const raw = resultFixture();
  const summary = summarizeProfileToolResult(raw, profile.calls[0].arguments, profile.id);
  assert.deepEqual(summary, summarizeS05PersonActivityToolResult(raw, profile.calls[0].arguments));
  assert.equal(Object.hasOwn(summary, 'rows'), false);
  assert.equal(JSON.stringify(summary).includes('private fixture title'), false);
  assert.equal(JSON.stringify(summary).includes('subjectId'), false);
});
