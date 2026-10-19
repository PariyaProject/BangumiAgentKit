import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  getP02PersonProfileOfflineSpec,
} from '../../scripts/lib/p02-person-profile-offline-fixture.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  buildP02CodexExecArgs,
  classifyP02ReportWriteRecovery,
  isP02ProfileClaimCurrent,
  validateP02RunnerArgs,
  validateServerSummary,
} from '../../scripts/acceptance/run-p02-person-profile-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_PROFILE_ID);
const PROFILE_V2 = getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
const SPEC_V2 = getP02PersonProfileOfflineSpec(P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_p02_profile';

test('P02 report-write recovery distinguishes committed, stale-terminal, and pending states', () => {
  const claimId = 'p02-claim';
  const reportSha256 = 'd'.repeat(64);
  assert.equal(
    classifyP02ReportWriteRecovery(
      { state: 'REPORT_WRITTEN', disposition: { reportSha256 } },
      claimId,
      reportSha256,
    ),
    'REPORT_WRITTEN',
  );
  assert.equal(
    classifyP02ReportWriteRecovery(
      {
        state: 'INCONCLUSIVE',
        disposition: { unacceptedReportSha256: reportSha256, retryAllowed: false },
      },
      claimId,
      reportSha256,
    ),
    'INCONCLUSIVE',
  );
  assert.equal(
    classifyP02ReportWriteRecovery(
      { state: 'CLAIMED', disposition: { claimId } },
      claimId,
      reportSha256,
    ),
    'CHECK_CANDIDATE_STALENESS',
  );
  assert.equal(
    classifyP02ReportWriteRecovery(
      { state: 'CLAIMED', disposition: { claimId: 'other' } },
      claimId,
      reportSha256,
    ),
    'ACK_PENDING',
  );
});

test('P02 exact claim-current check accepts the assigned runtime reviewer and rejects drift', () => {
  const candidateSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const reviewerId = '/root/p02_v2_review';
  const claim = {
    claimId: 'profile-run-95-pr-237-aaaaaaaaaaaa-1792100000000',
    profileId: PROFILE_V2.id,
    epochId: SPEC_V2.epochId,
    prNumber: 237,
    baseSha,
    sourceCandidateSha: candidateSha,
    ciSha: candidateSha,
    ciRunId: '39207834428',
    ciChecks: [{ name: 'harness-control', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    reviewerId,
    bundleSha256: BUNDLE_SHA,
  };
  const epoch = {
    epoch_id: SPEC_V2.epochId,
    pr_number: 237,
    state: 'REVIEW_PASSED',
    advances_frontier_ids: ['P02'],
    scope_closure: { related_work_remaining: false },
    adversarial_preflight: { completed: true },
    base_branch: 'master',
    base_sha: baseSha,
    reviewed_base_sha: baseSha,
    candidate_sha: candidateSha,
    review_pass_sha: candidateSha,
    ci: { sha: candidateSha, status: 'SUCCESS' },
    branch: 'codex/p02-v2',
    review_history: [
      {
        candidate_sha: candidateSha,
        reviewed_base_sha: baseSha,
        reviewer_id: reviewerId,
        verdict: 'PASS',
      },
    ],
  };
  const status = {
    git: { branch: epoch.branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 237,
        pending_epoch: null,
      },
    },
    epoch: { number: 237, state: epoch },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: epoch.branch,
    headRefOid: candidateSha,
  };
  const inputs = {
    profileStatus: { state: 'CLAIMED', disposition: { claimId: claim.claimId } },
    epochStatus: status,
    pr,
    currentBaseSha: baseSha,
    localBranch: epoch.branch,
    localHead: candidateSha,
    localWorktreeStatus: `?? ${PROFILE_V2.reportPath}`,
    bundleCurrent: true,
    ciEvidence: { ciRunId: claim.ciRunId, ciChecks: claim.ciChecks },
  };
  assert.equal(isP02ProfileClaimCurrent(claim, inputs), true);
  assert.equal(
    isP02ProfileClaimCurrent(claim, { ...inputs, currentBaseSha: 'c'.repeat(40) }),
    false,
  );
  assert.equal(isP02ProfileClaimCurrent(claim, { ...inputs, localHead: 'c'.repeat(40) }), false);
});

test('P02 Codex invocation is ephemeral, read-only, and exposes only the fixed offline tool', () => {
  assert.deepEqual(validateP02RunnerArgs(['--help']), { mode: 'help' });
  assert.deepEqual(validateP02RunnerArgs(['--run', '95']), {
    mode: 'run',
    profileId: P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  });
  assert.throws(() => validateP02RunnerArgs(['--run', '94']));
  assert.throws(() =>
    validateP02RunnerArgs(['--run', '95', '--profile-id', 'unregistered-p02-profile']),
  );
  assert.deepEqual(
    validateP02RunnerArgs([
      '--run',
      '95',
      '--profile-id',
      P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
    ]),
    { mode: 'run', profileId: P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID },
  );
  const args = buildP02CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p02-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gpt-6-luna'));
  const joined = args.join('\n');
  assert.match(joined, /mcp_servers\.bgk_p02_profile\.enabled_tools/u);
  assert.match(joined, /bangumi\.get_person_profile/u);
  assert.match(joined, /p02-person-profile-offline-agent-mcp-v1/u);
  assert.match(joined, /features\.shell_tool=false/u);
  assert.match(joined, /features\.web_search=false/u);
  assert.doesNotMatch(joined, /render_person_profile/u);
  const v2Args = buildP02CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p02-v2-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    profileId: P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  });
  const v2Joined = v2Args.join('\n');
  assert.match(v2Joined, /mcp_servers\.bgk_p02_profile_v2\.enabled_tools/u);
  assert.match(v2Joined, /p02-person-profile-offline-agent-mcp-v2/u);
  assert.match(v2Joined, /990711/u);
  assert.match(v2Joined, /P02_SYNTHETIC_PROFILE_READ_V2/u);
  assert.doesNotMatch(v2Joined, /bgk_p02_profile\.enabled_tools/u);
});

test('P02 server summary requires exactly the three synthetic responses', () => {
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: 'run95-p02-person-profile-offline-v1',
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: { personId: 990701, state: 'partial' },
      },
    ],
    offlineFixture: {
      profile: 'run95-p02-person-profile-offline-v1',
      requestCount: 3,
      personRequestCount: 1,
      subjectsRequestCount: 1,
      charactersRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
  assert.equal(validateServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateServerSummary(
      { ...summary, offlineFixture: { ...summary.offlineFixture, requestCount: 4 } },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateServerSummary({ ...summary, deniedCallCount: 1 }, SOURCE_SHA, BUNDLE_SHA),
    false,
  );
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [{ ...summary.results[0], resultSummary: { personId: 4765, state: 'partial' } }],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  const mismatchedResultSummary = summarizeProfileToolResult(
    { person: { id: 990702 }, state: 'partial' },
    P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
    PROFILE.id,
  );
  assert.deepEqual(mismatchedResultSummary, { personId: 990702, state: 'partial' });
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [
          {
            ...summary.results[0],
            resultSummary: mismatchedResultSummary,
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  const missingResultIdentitySummary = summarizeProfileToolResult(
    { person: {}, state: 'partial' },
    P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
    PROFILE.id,
  );
  assert.deepEqual(missingResultIdentitySummary, { personId: null, state: 'partial' });
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [
          {
            ...summary.results[0],
            resultSummary: missingResultIdentitySummary,
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(SERVER_ID, 'bgk_p02_profile');
  const v2Summary = {
    ...summary,
    profileId: PROFILE_V2.id,
    argumentProfile: PROFILE_V2.argumentProfile,
    networkMode: SPEC_V2.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE_V2),
    toolName: PROFILE_V2.toolName,
    serverToolNames: [PROFILE_V2.toolName],
    results: [
      {
        ...summary.results[0],
        resultSummary: { ...summary.results[0].resultSummary, personId: 990711 },
      },
    ],
    offlineFixture: { ...summary.offlineFixture, profile: SPEC_V2.networkMode },
  };
  assert.equal(validateServerSummary(v2Summary, SOURCE_SHA, BUNDLE_SHA, PROFILE_V2.id), true);
  assert.equal(
    validateServerSummary(
      {
        ...v2Summary,
        results: [
          { ...v2Summary.results[0], resultSummary: { personId: 990701, state: 'partial' } },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
      PROFILE_V2.id,
    ),
    false,
  );
});
