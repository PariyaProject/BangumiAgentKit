import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertC03PersonActivityOfflineV2CandidateGate,
  buildC03PersonActivityOfflineV2CodexExecArgs,
  extractC03PersonActivityOfflineV2ToolProjection,
  validateC03PersonActivityOfflineV2RunnerArgs,
} from '../../scripts/acceptance/run-c03-person-activity-offline-matrix-v2.mjs';
import { canonicalAgentMcpProfileJson } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const summary = {
  resultState: 'partial',
  windowMonths: 12,
  uniqueSubjects: 1,
  roleCounts: { main: 1, support: 0, unknown: 0 },
  coverage: {
    relationRowsObserved: 1,
    relationRowsSelected: 1,
    relationRowsDroppedAtLimit: 0,
    subjectDetailsSucceeded: 1,
    subjectDetailsFailed: 0,
    rowsEligible: 1,
    rowsReturned: 1,
    unknownRoleRows: 0,
    outputTruncated: false,
    truncated: false,
  },
};

test('C03 v2 Codex invocation constrains one tool, Luna Max, and JSON output schema', () => {
  const args = buildC03PersonActivityOfflineV2CodexExecArgs({
    root: '/repo',
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/server-summary.json',
    schemaPath: '/tmp/output-schema.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]] : []));
  assert.equal(args.includes('--output-schema'), true);
  assert.equal(args[args.indexOf('--output-schema') + 1], '/tmp/output-schema.json');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(configs.includes('model_reasoning_effort="max"'), true);
  assert.equal(configs.includes('features.shell_tool=false'), true);
  assert.equal(configs.includes('features.multi_agent=false'), true);
  assert.equal(
    configs.includes(
      'mcp_servers.bgk_c03_person_activity_offline_v2.enabled_tools=["bangumi.get_person_activity"]',
    ),
    true,
  );
  assert.equal(args.at(-1).includes('personId'), true);
});

test('C03 v2 runner accepts only its fixed one-shot invocation', () => {
  assert.equal(validateC03PersonActivityOfflineV2RunnerArgs(['--help']), 'help');
  assert.equal(validateC03PersonActivityOfflineV2RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateC03PersonActivityOfflineV2RunnerArgs([]));
  assert.throws(() => validateC03PersonActivityOfflineV2RunnerArgs(['--run', '95', '--retry']));
});

test('C03 v2 invocation gate rejects a Base change after the review PASS', () => {
  const candidate = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const status = {
    git: { status: '', head: candidate, branch: 'codex/c03-v2' },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 42,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 42,
      github_state: 'OPEN',
      state: {
        epoch_id: 'run95-c03-person-activity-offline-agent-mcp-matrix-v2-20261019',
        branch: 'codex/c03-v2',
        pr_number: 42,
        base_branch: 'master',
        base_sha: base,
        reviewed_base_sha: base,
        candidate_sha: candidate,
        review_pass_sha: candidate,
        ci: { sha: candidate, status: 'SUCCESS' },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['C03'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            candidate_sha: candidate,
            reviewed_base_sha: base,
            verdict: 'PASS',
            reviewer_id: 'gpt-6-luna-max-run95-pr42-round1',
          },
        ],
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: 'codex/c03-v2',
    headRefOid: candidate,
    statusCheckRollup: checks,
  };
  assert.deepEqual(
    assertC03PersonActivityOfflineV2CandidateGate(status, pr, {
      sourceRevision: candidate,
      currentBaseSha: base,
      gitStatus: '',
      gitHead: candidate,
    }),
    {
      candidateSha: candidate,
      baseSha: base,
      prNumber: 42,
      reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    },
  );
  assert.throws(() =>
    assertC03PersonActivityOfflineV2CandidateGate(status, pr, {
      sourceRevision: candidate,
      currentBaseSha: 'c'.repeat(40),
      gitStatus: '',
      gitHead: candidate,
    }),
  );
});

test('C03 v2 accepts exact structured or text-only readback and rejects disagreement', () => {
  const text = JSON.stringify(summary);
  const structuredAndText = extractC03PersonActivityOfflineV2ToolProjection({
    isError: false,
    structuredContent: summary,
    content: [{ type: 'text', text }],
  });
  assert.equal(structuredAndText.valid, true);
  assert.equal(
    canonicalAgentMcpProfileJson(structuredAndText.projection),
    canonicalAgentMcpProfileJson(summary),
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      content: [{ type: 'text', text }],
    }).valid,
    true,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: JSON.stringify({ ...summary, uniqueSubjects: 0 }) }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'text', text: 'not JSON' }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [{ type: 'image', data: 'ignored' }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: true,
      content: [{ type: 'text', text }],
    }).valid,
    false,
  );
  assert.equal(
    extractC03PersonActivityOfflineV2ToolProjection({
      isError: false,
      structuredContent: summary,
      content: [
        { type: 'text', text },
        { type: 'text', text: 'unexpected extra result' },
      ],
    }).valid,
    false,
  );
});
