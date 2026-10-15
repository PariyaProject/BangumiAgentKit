import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertC01CandidateReviewGate,
  buildC01CodexExecArgs,
  classifyC01ProfileAttempt,
  validateC01RunnerArgs,
  validateC01ServerSummary,
} from '../../scripts/acceptance/run-c01-rating-count-agent-mcp.mjs';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const PROFILE = getAgentMcpProfileById('c01-rating-count-gap-v1');
const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const reviewerId = 'gpt-6-luna-max-run95-pr180-round1';
const requiredChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

function makeGate() {
  const status = {
    git: {
      status: '',
      head: candidateSha,
      branch: 'codex/epoch-run95-c01-rating-count-gap-agent-mcp-20261015',
    },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 180,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 180,
      github_state: 'OPEN',
      state: {
        epoch_id: PROFILE.epochId,
        branch: 'codex/epoch-run95-c01-rating-count-gap-agent-mcp-20261015',
        pr_number: 180,
        base_branch: 'master',
        base_sha: baseSha,
        reviewed_base_sha: baseSha,
        candidate_sha: candidateSha,
        review_pass_sha: candidateSha,
        ci: { sha: candidateSha, status: 'SUCCESS' },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['C01'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            reviewer_id: reviewerId,
            candidate_sha: candidateSha,
            reviewed_base_sha: baseSha,
            verdict: 'PASS',
          },
        ],
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    baseRefOid: baseSha,
    headRefName: status.git.branch,
    headRefOid: candidateSha,
    mergeStateStatus: 'CLEAN',
    statusCheckRollup: requiredChecks,
  };
  return { status, pr };
}

test('C01 runner accepts only the governed Run #95 invocation', () => {
  assert.equal(validateC01RunnerArgs(['--help']), 'help');
  assert.equal(validateC01RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateC01RunnerArgs(['--run', '94']));
  assert.throws(() => validateC01RunnerArgs(['--run', '95', '--retry']));
});

test('C01 Codex request is ephemeral, read-only, Luna Max, and exposes exactly one tool', () => {
  const args = buildC01CodexExecArgs({
    nodePath: '/runtime/node',
    summaryPath: '/tmp/c01-summary.json',
    sourceRevision: candidateSha,
    bundleSha256: 'c'.repeat(64),
  });
  assert.deepEqual(args.slice(0, 8), [
    'exec',
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--model',
    'gpt-6-luna',
    '--sandbox',
  ]);
  assert.ok(args.includes('read-only'));
  assert.ok(args.some((entry) => entry.includes('features.shell_tool=false')));
  assert.ok(args.some((entry) => entry.includes('features.multi_agent=false')));
  assert.ok(args.some((entry) => entry.includes('mcp_servers.bgk_c01_one_tool.enabled_tools=')));
  assert.ok(args.some((entry) => entry.includes('bangumi.get_subject_comparison')));
  assert.equal(args.at(-1).includes('exactly once'), true);
  assert.equal(args.at(-1).includes('Do not call the gap significant'), true);
});

test('C01 review gate binds exact candidate, current base, seven checks, and same-PR Luna Max PASS', () => {
  const { status, pr } = makeGate();
  const gitTextFn = (...args) => (args[0] === 'status' ? '' : candidateSha);
  assert.deepEqual(
    assertC01CandidateReviewGate(status, pr, {
      sourceRevision: candidateSha,
      currentBaseSha: baseSha,
      gitTextFn,
    }),
    { candidateSha, baseSha, prNumber: 180, reviewerId },
  );
  const stale = structuredClone(status);
  stale.epoch.state.ci.sha = 'd'.repeat(40);
  assert.throws(() =>
    assertC01CandidateReviewGate(stale, pr, {
      sourceRevision: candidateSha,
      currentBaseSha: baseSha,
      gitTextFn,
    }),
  );
  assert.throws(() =>
    assertC01CandidateReviewGate(
      status,
      { ...pr, mergeStateStatus: 'DIRTY' },
      {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
        gitTextFn,
      },
    ),
  );
});

test('C01 attempt classification never invokes an already claimed or terminal profile again', () => {
  assert.equal(
    classifyC01ProfileAttempt({ state: 'UNCLAIMED', disposition: null }, false),
    'START',
  );
  assert.equal(
    classifyC01ProfileAttempt({ state: 'UNCLAIMED', disposition: null }, true),
    'REJECT_ORPHAN_REPORT',
  );
  assert.equal(
    classifyC01ProfileAttempt({ state: 'CLAIMED', disposition: { claimId: 'x' } }, false),
    'FINALIZE_INCONCLUSIVE',
  );
  assert.equal(
    classifyC01ProfileAttempt({ state: 'INCONCLUSIVE', disposition: { claimId: 'x' } }, false),
    'TERMINAL',
  );
  assert.equal(
    classifyC01ProfileAttempt({ state: 'REPORT_WRITTEN', disposition: { claimId: 'x' } }, true),
    'TERMINAL',
  );
});

test('C01 server summary binds the current public read tool and fixed argument hash', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === PROFILE.toolName);
  const summary = {
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision: candidateSha,
    bundleSha256: 'c'.repeat(64),
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedArgumentsSha256: createHash('sha256')
      .update(canonicalAgentMcpProfileJson(PROFILE.calls[0].arguments))
      .digest('hex'),
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    result: { resultState: 'partial' },
    toolDescriptionSha256: createHash('sha256').update(tool.description, 'utf8').digest('hex'),
    inputSchemaSha256: createHash('sha256')
      .update(canonicalAgentMcpProfileJson(tool.inputSchema))
      .digest('hex'),
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      rawResultStored: false,
      credentialsStored: false,
    },
  };
  assert.equal(validateC01ServerSummary(summary, candidateSha, 'c'.repeat(64)), true);
  assert.equal(
    validateC01ServerSummary({ ...summary, allowedCallCount: 2 }, candidateSha, 'c'.repeat(64)),
    false,
  );
});
