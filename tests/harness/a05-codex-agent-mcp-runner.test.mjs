import assert from 'node:assert/strict';
import test from 'node:test';
import {
  a05CodexCompletionIsClean,
  assertA05CandidateReviewGate,
  buildA05CodexExecArgs,
} from '../../scripts/acceptance/run-a05-codex-agent-mcp.mjs';

const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const mandatoryChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

function passingGate() {
  const status = {
    git: {
      status: '',
      head: candidateSha,
      branch: 'codex/epoch-run95-a05-collection-completion-filter',
    },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 146,
      },
    },
    epoch: {
      number: 146,
      github_state: 'OPEN',
      state: {
        pr_number: 146,
        branch: 'codex/epoch-run95-a05-collection-completion-filter',
        epoch_id: 'run95-a05-collection-completion-filter',
        base_branch: 'master',
        base_sha: baseSha,
        candidate_sha: candidateSha,
        reviewed_base_sha: baseSha,
        ci: { sha: candidateSha, status: 'SUCCESS' },
        state: 'REVIEW_PASSED',
        review_pass_sha: candidateSha,
        review_history: [
          {
            candidate_sha: candidateSha,
            verdict: 'PASS',
            reviewer_id: 'gpt-6-luna-max-run95-pr146-round1',
          },
        ],
        scope_closure: {
          related_work_remaining: false,
          why_not_review_earlier: 'The exact A05 runner and its Candidate CI are ready.',
          why_not_extend_further:
            'A05 is a single bounded one-shot and all other scope is excluded.',
        },
        adversarial_preflight: {
          completed: true,
          summary: 'The one-tool allowlist, no-account scope, and no-retry latch were verified.',
        },
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    headRefOid: candidateSha,
    headRefName: 'codex/epoch-run95-a05-collection-completion-filter',
    baseRefName: 'master',
    statusCheckRollup: mandatoryChecks,
  };
  return { status, pr };
}

test('A05 Codex invocation is pinned to Luna Max, read-only, and one MCP tool', () => {
  const args = buildA05CodexExecArgs({
    root: '/tmp/a05-fixture',
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/a05-summary.json',
    candidateSha,
    bundleSha256: 'c'.repeat(64),
  });

  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('model_reasoning_effort="max"'));
  assert.ok(args.includes('mcp_servers.bgk_a05_one_tool.enabled_tools=["bangumi.query_subjects"]'));
  assert.ok(args.includes('mcp_servers.bgk_a05_one_tool.required=true'));
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('web_search="disabled"'));
  const mcpConfig = args.filter((item) => item.startsWith('mcp_servers.'));
  const mcpServerNames = [
    ...new Set(
      mcpConfig.map((item) => item.match(/^mcp_servers\.([^.]+)\./u)?.[1]).filter(Boolean),
    ),
  ].sort();
  assert.deepEqual(mcpServerNames, ['bgk_a05_one_tool']);
  assert.deepEqual(
    mcpConfig.filter((item) => item.includes('.enabled_tools=')),
    ['mcp_servers.bgk_a05_one_tool.enabled_tools=["bangumi.query_subjects"]'],
  );
});

test('A05 completion gate rejects incomplete streams and every nonzero or unknown error count', () => {
  assert.equal(
    a05CodexCompletionIsClean(
      { parsed: true },
      { eventStreamComplete: true, codexErrorItemCount: 0 },
    ),
    true,
  );
  assert.equal(
    a05CodexCompletionIsClean(
      { parsed: true },
      { eventStreamComplete: false, codexErrorItemCount: 0 },
    ),
    false,
  );
  assert.equal(
    a05CodexCompletionIsClean(
      { parsed: true },
      { eventStreamComplete: true, codexErrorItemCount: 1 },
    ),
    false,
  );
  assert.equal(
    a05CodexCompletionIsClean(
      { parsed: false },
      { eventStreamComplete: true, codexErrorItemCount: 0 },
    ),
    false,
  );
  assert.equal(a05CodexCompletionIsClean({ parsed: true }, { eventStreamComplete: true }), false);
});

test('A05 one-shot gate requires the exact current Candidate/Base, clean CI, and Luna Max PASS', () => {
  const { status, pr } = passingGate();
  assert.deepEqual(
    assertA05CandidateReviewGate(status, pr, { candidateSha, currentBaseSha: baseSha }),
    { prNumber: 146, candidateSha, baseSha },
  );

  const staleBase = structuredClone(status);
  staleBase.epoch.state.reviewed_base_sha = 'd'.repeat(40);
  assert.throws(
    () => assertA05CandidateReviewGate(staleBase, pr, { candidateSha, currentBaseSha: baseSha }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongEpochBase = structuredClone(status);
  wrongEpochBase.epoch.state.base_sha = 'd'.repeat(40);
  assert.throws(
    () =>
      assertA05CandidateReviewGate(wrongEpochBase, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongCandidate = structuredClone(status);
  wrongCandidate.epoch.state.candidate_sha = 'e'.repeat(40);
  assert.throws(
    () =>
      assertA05CandidateReviewGate(wrongCandidate, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongPrHead = { ...pr, headRefOid: 'f'.repeat(40) };
  assert.throws(
    () =>
      assertA05CandidateReviewGate(status, wrongPrHead, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongPrBase = { ...pr, baseRefName: 'stale-base' };
  assert.throws(
    () =>
      assertA05CandidateReviewGate(status, wrongPrBase, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongCiSha = structuredClone(status);
  wrongCiSha.epoch.state.ci.sha = '1'.repeat(40);
  assert.throws(
    () =>
      assertA05CandidateReviewGate(wrongCiSha, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const failedCi = structuredClone(status);
  failedCi.epoch.state.ci.status = 'FAILED_OR_PENDING';
  assert.throws(
    () =>
      assertA05CandidateReviewGate(failedCi, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const missingCheck = {
    ...pr,
    statusCheckRollup: mandatoryChecks.filter((check) => check.name !== 'harness-control'),
  };
  assert.throws(
    () =>
      assertA05CandidateReviewGate(status, missingCheck, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );

  const wrongReviewer = structuredClone(status);
  wrongReviewer.epoch.state.review_history[0].reviewer_id = 'legacy-reviewer-run95-pr146-round1';
  assert.throws(
    () =>
      assertA05CandidateReviewGate(wrongReviewer, pr, { candidateSha, currentBaseSha: baseSha }),
    /exact-Candidate current-base CI and GPT-6 Luna Max PASS/u,
  );
});
