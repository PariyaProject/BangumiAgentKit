import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
} from '../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
import { R04_SERIES_WATCH_ORDER_V3_PROFILE_ID } from '../../scripts/lib/r04-series-watch-order-offline-v3-fixture.mjs';
import {
  assertR04CandidateReviewGate,
  buildR04CodexExecArgs,
  classifyR04AssertionFailure,
  configureR04RunnerProfile,
  recoverR04RunnerFailure,
  r04ClaimBelongsToRunner,
  validateR04RunnerArgs,
  validateR04ServerSummary,
} from '../../scripts/acceptance/run-r04-series-watch-order-offline-agent-mcp-v2.mjs';

const PROFILE = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const V3_PROFILE = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const ACK = 'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ';
const SERVER_ID = 'bgk_r04_watch_order_v2';
const REVIEWER_ID = '/root/run95_pr267_review';
const PR_NUMBER = 267;

function candidateReviewGateFixture(reviewerId) {
  const branch = 'codex/epoch-run95-r04-series-watch-order-offline-matrix-v3';
  const ciRunId = '1234567890';
  return {
    status: {
      git: { status: '', head: SOURCE_SHA, branch },
      run: {
        state: {
          state: 'EPOCH_ACTIVE',
          profile: 'AUTONOMOUS_EVOLUTION',
          active_epoch_pr: PR_NUMBER,
          pending_epoch: null,
        },
      },
      epoch: {
        number: PR_NUMBER,
        github_state: 'OPEN',
        state: {
          epoch_id: V3_PROFILE.epochId,
          branch,
          pr_number: PR_NUMBER,
          base_branch: 'master',
          base_sha: BASE_SHA,
          reviewed_base_sha: BASE_SHA,
          candidate_sha: SOURCE_SHA,
          review_pass_sha: SOURCE_SHA,
          ci: {
            sha: SOURCE_SHA,
            status: 'SUCCESS',
            url: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`,
          },
          state: 'REVIEW_PASSED',
          advances_frontier_ids: ['R04'],
          scope_closure: { related_work_remaining: false },
          adversarial_preflight: { completed: true },
          review_history: [
            {
              candidate_sha: SOURCE_SHA,
              reviewed_base_sha: BASE_SHA,
              verdict: 'PASS',
              reviewer_id: reviewerId,
            },
          ],
        },
      },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'master',
      baseRefOid: BASE_SHA,
      headRefName: branch,
      headRefOid: SOURCE_SHA,
      statusCheckRollup: P06_REQUIRED_CI_CHECKS.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}/job/120000`,
      })),
    },
  };
}

function serverSummary() {
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: 'c'.repeat(64),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: 'd'.repeat(64),
    inputSchemaSha256: 'e'.repeat(64),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          state: 'complete',
          subjectId: 990817,
          watchOrderCount: 2,
          watchOrder: [
            { id: 990818, isRoot: false, placement: 'before_root' },
            { id: 990817, isRoot: true, placement: 'root' },
          ],
          relatedCount: 1,
          relatedIds: [990818],
          relationRequests: 2,
          relationRowsObserved: 1,
          detailsAttempted: 1,
        },
      },
    ],
    offlineFixture: {
      profile: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
      requestCount: 4,
      subjectRequestCount: 2,
      relationsRequestCount: 2,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
}

test('R04 candidate gate accepts the Harness local Luna Max reviewer identity', () => {
  configureR04RunnerProfile(R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
  try {
    const { status, pr } = candidateReviewGateFixture(REVIEWER_ID);
    const readGit = (...args) => (args[0] === 'status' ? '' : SOURCE_SHA);
    const gate = assertR04CandidateReviewGate(status, pr, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit,
    });
    assert.equal(gate.reviewerId, REVIEWER_ID);

    const invalid = candidateReviewGateFixture('untrusted-reviewer-id');
    assert.throws(
      () =>
        assertR04CandidateReviewGate(invalid.status, invalid.pr, {
          sourceRevision: SOURCE_SHA,
          currentBaseSha: BASE_SHA,
          readGit,
        }),
      /same-identity Luna Max PASS/,
    );
  } finally {
    configureR04RunnerProfile(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
  }
});

test('R04 Codex invocation is ephemeral, read-only, and exposes only its fixed tool', () => {
  assert.equal(validateR04RunnerArgs(['--help']), 'help');
  assert.equal(validateR04RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR04RunnerArgs(['--run', '94']));

  const args = buildR04CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/r04-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
  for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral', '--json']) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
  assert.ok(args.includes('--model'));
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.ok(args.includes('--sandbox'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  for (const setting of [
    'features.multi_agent=false',
    'features.shell_tool=false',
    'web_search="disabled"',
    `mcp_servers.${SERVER_ID}.required=true`,
    `mcp_servers.${SERVER_ID}.enabled_tools=["${PROFILE.toolName}"]`,
  ])
    assert.ok(args.includes(setting), `missing ${setting}`);
  assert.equal(
    args.at(-1).includes(JSON.stringify(R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS)),
    true,
  );
});

test('R04 server summary accepts exactly four local fixture responses', () => {
  const summary = serverSummary();
  assert.equal(validateR04ServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateR04ServerSummary(
      {
        ...summary,
        offlineFixture: { ...summary.offlineFixture, requestCount: 3 },
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR04ServerSummary(
      {
        ...summary,
        results: [
          {
            ...summary.results[0],
            resultSummary: { ...summary.results[0].resultSummary, subjectId: 7 },
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
});

test('R04 assertion failure classification emits only fixed safe codes', () => {
  const base = {
    execution: {
      failed: false,
      spawnErrorCode: null,
      stderrPresent: true,
      rawStderr: 'PRIVATE OUTPUT',
    },
    parsed: { parsed: true },
    events: {
      eventStreamComplete: true,
      turnCompleted: true,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      mcpServerNames: [SERVER_ID],
      codexMcpToolEventCount: 1,
      completedMcpCalls: [
        { tool: PROFILE.toolName, arguments: R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS },
      ],
      answer: ACK,
    },
    exactCall: true,
    exactToolEvent: true,
    serverSummary: {},
    serverSummaryValid: true,
    candidateBundleCurrent: true,
  };
  assert.equal(classifyR04AssertionFailure(base), 'AGENT_MCP_ASSERTION_FAILED');
  assert.equal(
    classifyR04AssertionFailure({
      ...base,
      events: { ...base.events, nonMcpToolEventCount: 1 },
    }),
    'NON_MCP_TOOL_EVENT',
  );
  assert.equal(
    classifyR04AssertionFailure({ ...base, exactCall: false }),
    'MCP_CALL_ARGUMENT_MISMATCH',
  );
  assert.equal(JSON.stringify(classifyR04AssertionFailure(base)).includes('PRIVATE OUTPUT'), false);
});

test('R04 Codex errors before the MCP call are classified safely and keep the claim terminal', () => {
  const baseEvents = {
    eventStreamComplete: true,
    turnCompleted: true,
    codexErrorItemCount: 3,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [],
    codexMcpToolEventCount: 0,
    completedMcpCalls: [],
    answer: null,
  };
  const reason = classifyR04AssertionFailure({
    execution: { failed: false, spawnErrorCode: null },
    parsed: { parsed: true },
    events: baseEvents,
    exactCall: false,
    exactToolEvent: false,
    serverSummary: null,
    serverSummaryValid: false,
    candidateBundleCurrent: true,
  });
  assert.equal(reason, 'CODEX_ERROR_EVENT');
  assert.equal(JSON.stringify(reason).includes('PRIVATE OUTPUT'), false);

  const terminalizedClaims = [];
  const recovery = recoverR04RunnerFailure(
    {
      state: 'CLAIMED',
      disposition: { claimId: 'codex-error-claim', runnerReceiptPublicKey: 'runner-key' },
    },
    {
      claimId: 'codex-error-claim',
      runnerReceiptPublicKey: 'runner-key',
      recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
    },
  );
  assert.deepEqual(recovery, {
    state: 'INCONCLUSIVE_RECORDED',
    claimId: 'codex-error-claim',
  });
  assert.deepEqual(terminalizedClaims, ['codex-error-claim']);
});

test('R04 losing runner leaves the winner claim untouched', () => {
  const winnerStatus = {
    state: 'CLAIMED',
    disposition: {
      claimId: 'winner-claim',
      runnerReceiptPublicKey: 'winner-public-key',
    },
  };
  const terminalizedClaims = [];
  const recovery = recoverR04RunnerFailure(winnerStatus, {
    claimId: null,
    runnerReceiptPublicKey: 'loser-public-key',
    recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
  });

  assert.equal(
    r04ClaimBelongsToRunner(winnerStatus, {
      claimId: null,
      runnerReceiptPublicKey: 'loser-public-key',
    }),
    false,
  );
  assert.deepEqual(recovery, { state: 'R04_CLAIM_OWNERSHIP_MISMATCH' });
  assert.deepEqual(terminalizedClaims, []);
});

test('R04 runner terminalizes only its locally owned claim after failure', () => {
  const ownedStatus = {
    state: 'CLAIMED',
    disposition: {
      claimId: 'owned-claim',
      runnerReceiptPublicKey: 'runner-public-key',
    },
  };
  const terminalizedClaims = [];
  const recovery = recoverR04RunnerFailure(ownedStatus, {
    claimId: 'owned-claim',
    runnerReceiptPublicKey: 'runner-public-key',
    recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
  });

  assert.equal(
    r04ClaimBelongsToRunner(ownedStatus, {
      claimId: 'owned-claim',
      runnerReceiptPublicKey: 'runner-public-key',
    }),
    true,
  );
  assert.equal(
    r04ClaimBelongsToRunner(ownedStatus, {
      claimId: 'another-claim',
      runnerReceiptPublicKey: 'runner-public-key',
    }),
    false,
  );
  assert.deepEqual(recovery, { state: 'INCONCLUSIVE_RECORDED', claimId: 'owned-claim' });
  assert.deepEqual(terminalizedClaims, ['owned-claim']);
});

test('R04 runner can recover its claim by its unique key after lost claim acknowledgement', () => {
  const ownedStatus = {
    state: 'CLAIMED',
    disposition: {
      claimId: 'ack-lost-claim',
      runnerReceiptPublicKey: 'runner-public-key',
    },
  };
  const terminalizedClaims = [];
  const recovery = recoverR04RunnerFailure(ownedStatus, {
    claimId: null,
    runnerReceiptPublicKey: 'runner-public-key',
    recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
  });

  assert.deepEqual(recovery, { state: 'INCONCLUSIVE_RECORDED', claimId: 'ack-lost-claim' });
  assert.deepEqual(terminalizedClaims, ['ack-lost-claim']);
});
