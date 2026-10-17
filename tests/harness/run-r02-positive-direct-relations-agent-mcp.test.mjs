import assert from 'node:assert/strict';
import test from 'node:test';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  assertR02CandidateReviewGate,
  buildR02CodexExecArgs,
  classifyR02AssertionFailure,
  r02CodexCliVersionIsSupported,
  validateR02RunnerArgs,
  validateR02ServerSummary,
} from '../../scripts/acceptance/run-r02-positive-direct-relations-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  expectedR02PositiveDirectRelationsRequestScope,
  R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT,
  R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
  R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
} from '../../scripts/lib/r02-positive-direct-relations-profile.mjs';

const PROFILE = getAgentMcpProfileById('r02-positive-direct-relations-agent-mcp-v1');
const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const bundleSha = 'c'.repeat(64);
const reviewerId = 'gpt-6-luna-max-run95-pr291-round1';
const branch = 'codex/epoch-run95-r02-positive-direct-relations-agent-mcp-20261016';

test('R02 runner requires only Run 95 and supported stable Codex CLI versions', () => {
  assert.equal(validateR02RunnerArgs(['--help']), 'help');
  assert.equal(validateR02RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR02RunnerArgs(['--run', '94']));
  assert.equal(r02CodexCliVersionIsSupported('0.162.9'), false);
  assert.equal(r02CodexCliVersionIsSupported('0.163.0'), true);
  assert.equal(r02CodexCliVersionIsSupported('0.164.0'), true);
  assert.equal(r02CodexCliVersionIsSupported('1.0.0'), true);
  assert.equal(r02CodexCliVersionIsSupported('0.163.0-beta.1'), false);
});

test('R02 Codex invocation is strict, ephemeral, read-only, and allows one exact MCP tool', () => {
  const args = buildR02CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/r02-summary.json',
    sourceRevision: candidateSha,
    bundleSha256: bundleSha,
  });
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.equal(args.at(-1).includes(R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT), true);
  const config = args.filter((value, index) => args[index - 1] === '--config');
  assert.ok(
    config.includes('mcp_servers.bgk_r02_direct_relations.default_tools_approval_mode="approve"'),
  );
  assert.ok(
    config.includes(
      'mcp_servers.bgk_r02_direct_relations.enabled_tools=["bangumi.get_subject_relations"]',
    ),
  );
  assert.equal(
    config.some((setting) => setting.includes('mcp_servers.bgk_r02_direct_relations.tools.')),
    false,
  );
  assert.ok(config.includes('features.shell_tool=false'));
  assert.ok(config.includes('features.multi_agent=false'));
  assert.ok(config.includes('web_search="disabled"'));
  assert.equal(
    config.filter((entry) => entry.startsWith('mcp_servers.') && entry.includes('.enabled_tools='))
      .length,
    1,
  );
});

function validCiRun() {
  const ciRunId = '38812509760';
  const runUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`;
  const statusCheckRollup = P06_REQUIRED_CI_CHECKS.map((name, index) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: `${runUrl}/job/${1000 + index}`,
  }));
  return { ciRunId, runUrl, statusCheckRollup };
}

function gateFixture() {
  const prNumber = 291;
  const ci = validCiRun();
  const latestReview = {
    candidate_sha: candidateSha,
    reviewed_base_sha: baseSha,
    reviewer_id: reviewerId,
    verdict: 'PASS',
  };
  const epochState = {
    epoch_id: PROFILE.epochId,
    pr_number: prNumber,
    branch,
    base_branch: 'master',
    base_sha: baseSha,
    reviewed_base_sha: baseSha,
    candidate_sha: candidateSha,
    review_pass_sha: candidateSha,
    ci: { sha: candidateSha, status: 'SUCCESS', url: ci.runUrl },
    state: 'REVIEW_PASSED',
    advances_frontier_ids: ['R02'],
    scope_closure: { related_work_remaining: false },
    adversarial_preflight: { completed: true },
    review_history: [latestReview],
  };
  const status = {
    git: { status: '', head: candidateSha, branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: prNumber,
        pending_epoch: null,
      },
    },
    epoch: { number: prNumber, github_state: 'OPEN', state: epochState },
  };
  const pr = {
    number: prNumber,
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: branch,
    headRefOid: candidateSha,
    statusCheckRollup: ci.statusCheckRollup,
  };
  const readGit = (...args) => (args[0] === 'rev-parse' ? candidateSha : '');
  return { status, pr, readGit, ciRunId: ci.ciRunId };
}

test('R02 claim gate binds clean Candidate, latest master, seven-check CI, and same-identity PASS', () => {
  const fixture = gateFixture();
  const gate = assertR02CandidateReviewGate(fixture.status, fixture.pr, {
    sourceRevision: candidateSha,
    currentBaseSha: baseSha,
    readGit: fixture.readGit,
  });
  assert.equal(gate.candidateSha, candidateSha);
  assert.equal(gate.baseSha, baseSha);
  assert.equal(gate.reviewerId, reviewerId);
  assert.equal(gate.ciRunId, fixture.ciRunId);
  assert.equal(gate.ciChecks.length, 7);

  assert.throws(() =>
    assertR02CandidateReviewGate(fixture.status, fixture.pr, {
      sourceRevision: candidateSha,
      currentBaseSha: 'd'.repeat(40),
      readGit: fixture.readGit,
    }),
  );
  const dirty = { ...fixture.status, git: { ...fixture.status.git, status: '?? unrelated.json' } };
  assert.throws(() =>
    assertR02CandidateReviewGate(dirty, fixture.pr, {
      sourceRevision: candidateSha,
      currentBaseSha: baseSha,
      readGit: fixture.readGit,
    }),
  );
});

test('R02 runner accepts only the exact three result sequence and anonymous request scope', () => {
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: candidateSha,
    bundleSha256: bundleSha,
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 3,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 3,
    deniedCallCount: 0,
    results: R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES.map(
      (resultSummary, sequenceIndex) => ({
        sequenceIndex,
        status: 'SUCCESS',
        resultSummary,
      }),
    ),
    publicRequestScope: expectedR02PositiveDirectRelationsRequestScope(),
  };
  assert.equal(validateR02ServerSummary(summary, candidateSha, bundleSha), true);
  const wrongOrder = {
    ...summary,
    results: [summary.results[1], summary.results[0], summary.results[2]],
  };
  assert.equal(validateR02ServerSummary(wrongOrder, candidateSha, bundleSha), false);
  const credentialed = {
    ...summary,
    publicRequestScope: { ...summary.publicRequestScope, credentialHeaderCount: 1 },
  };
  assert.equal(validateR02ServerSummary(credentialed, candidateSha, bundleSha), false);
});

test('R02 classifies only the bounded disabled-search errors as nonfatal', () => {
  assert.equal(
    classifyR02AssertionFailure({
      execution: { failed: false },
      parsed: { parsed: true },
      events: {
        eventStreamComplete: true,
        turnCompleted: true,
        unexpectedCodexErrorItemCount: 0,
        blockedWebSearchErrorItemCount: 4,
        codexErrorItemCount: 4,
      },
      exactCalls: false,
      exactToolEvents: false,
      serverSummaryValid: false,
      candidateBundleCurrent: false,
    }),
    'UNEXPECTED_CODEX_ERROR_EVENT',
  );
  assert.equal(
    classifyR02AssertionFailure({
      execution: { failed: false },
      parsed: { parsed: true },
      events: { eventStreamComplete: true, turnCompleted: false },
      exactCalls: false,
      exactToolEvents: false,
      serverSummaryValid: false,
      candidateBundleCurrent: false,
    }),
    'CODEX_TURN_INCOMPLETE',
  );
});
