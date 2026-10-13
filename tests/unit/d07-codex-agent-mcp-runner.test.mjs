import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCurrentD07ReviewGate,
  buildD07CodexExecArgs,
  d07EventSummariesMatchServer,
  validateD07RunnerArgs,
} from '../../scripts/acceptance/run-d07-codex-agent-mcp.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';
import { summarizeD07QueryResult } from '../../scripts/lib/d07-query-sequence.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);

function resultFor(year, index) {
  const coverageState = ['unknown', 'partial', 'complete'][index % 3];
  return {
    state: coverageState === 'partial' ? 'partial' : 'ok',
    operation: 'browseSubjects',
    totalKind: 'exact',
    retrievedAt: `2026-10-13T12:${String(index).padStart(2, '0')}:00.000Z`,
    coverage: {
      state: coverageState,
      requested: 1,
      scanned: coverageState === 'complete' ? 8 : 20,
      matched: coverageState === 'complete' ? 4 : 7,
      returned: 1,
    },
    itemCount: 1,
    items: [{ id: 10000 + year, rank: index + 1, displayName: `Anime ${year}` }],
  };
}

function approvedGate() {
  const reviewerId = 'gpt-6-luna-max-run95-pr158-round1';
  const review = {
    candidate_sha: candidate,
    reviewed_base_sha: base,
    verdict: 'PASS',
    reviewer_id: reviewerId,
  };
  return {
    run: {
      number: 95,
      profile: 'AUTONOMOUS_EVOLUTION',
      state: 'EPOCH_ACTIVE',
      active_epoch_pr: 158,
      pending_epoch: null,
    },
    epoch: {
      state: 'REVIEW_PASSED',
      epoch_id: 'run95-d07-current-rank-by-release-year',
      pr_number: 158,
      branch: 'codex/epoch-run95-d07-current-rank-by-release-year',
      base_branch: 'master',
      base_sha: base,
      reviewed_base_sha: base,
      candidate_sha: candidate,
      ci: { sha: candidate, status: 'SUCCESS' },
      review_pass_sha: candidate,
      scope_closure: { related_work_remaining: false },
      adversarial_preflight: { completed: true },
      review_history: [review],
    },
    pr: {
      number: 158,
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'master',
      headRefName: 'codex/epoch-run95-d07-current-rank-by-release-year',
      headRefOid: candidate,
      statusCheckRollup: [
        'harness-control',
        'sqlite-default',
        'host-integration',
        'standalone-release-smoke',
        'postgres-compat',
        'provider-foundation',
        'discovery-foundation',
      ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    },
    currentBaseSha: base,
    sourceRevision: candidate,
    branch: 'codex/epoch-run95-d07-current-rank-by-release-year',
    workingTreeClean: true,
    reviewerId,
  };
}

test('builds a Luna Max ephemeral Codex call with only the exact D07 MCP tool enabled', () => {
  const args = buildD07CodexExecArgs({
    root: '/repo',
    nodePath: '/runtime/node',
    serverScript: '/repo/apps/mcp/d07-one-tool-mcp-server.mjs',
    summaryPath: '/tmp/d07/summary.json',
    sourceRevision: candidate,
    bundleSha256: 'c'.repeat(64),
    runnerPid: 123,
    claimId: 'd07-run-95-pr-158-8b935648f793-cccccccccccc',
  });

  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--model'));
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.ok(args.includes('model_reasoning_effort="max"'));
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.multi_agent=false'));
  assert.ok(args.includes('mcp_servers.bgk_d07_one_tool.enabled_tools=["bangumi.query_subjects"]'));
  assert.equal(args.at(-1).includes('2016, 2017, 2018'), true);
  assert.equal(
    args.some((item) => item.includes('bangumi.get_')),
    false,
  );
});

test('D07 runner accepts only the Harness run entry point', () => {
  assert.equal(validateD07RunnerArgs(['--help']), 'help');
  assert.equal(validateD07RunnerArgs(['--run']), 'run');
  assert.throws(() => validateD07RunnerArgs([]), /only through the Harness/u);
  assert.throws(() => validateD07RunnerArgs(['--run', '95']), /only through the Harness/u);
});

test('requires every exact Candidate, Base, CI, closure, and Luna Max review gate', () => {
  const gate = approvedGate();
  const authorization = assertCurrentD07ReviewGate(gate);
  assert.deepEqual(authorization, {
    runNumber: 95,
    prNumber: 158,
    candidateSha: candidate,
    baseSha: base,
    reviewerId: 'gpt-6-luna-max-run95-pr158-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
  });

  const staleBase = approvedGate();
  staleBase.currentBaseSha = 'd'.repeat(40);
  assert.throws(() => assertCurrentD07ReviewGate(staleBase), /exact Candidate/u);
  const extraCheck = approvedGate();
  extraCheck.pr.statusCheckRollup.push(extraCheck.pr.statusCheckRollup[0]);
  assert.throws(() => assertCurrentD07ReviewGate(extraCheck), /exact Candidate/u);
});

test('matches each Codex MCP result to its ordered sanitized server result', () => {
  const completedMcpCalls = [];
  const callSummaries = D07_EXPECTED_YEARS.map((year, index) => {
    const result = resultFor(year, index);
    completedMcpCalls.push({
      tool: 'bangumi.query_subjects',
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      },
    });
    return summarizeD07QueryResult(year, result);
  });

  assert.equal(d07EventSummariesMatchServer(completedMcpCalls, { callSummaries }), true);
  const mismatched = structuredClone(completedMcpCalls);
  mismatched[4].result.content[0].text = JSON.stringify(resultFor(2020, 9));
  assert.equal(d07EventSummariesMatchServer(mismatched, { callSummaries }), false);
  assert.deepEqual(D07_QUERY_ARGUMENTS_BY_YEAR[2016], {
    media: 'anime',
    year: 2016,
    sort: 'rank',
    resultMode: 'top',
    limit: 1,
    explain: 'compact',
  });
});
