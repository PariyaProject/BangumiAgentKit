import assert from 'node:assert/strict';
import test from 'node:test';
import {
  P05_ARGUMENTS,
  P05_ARGUMENTS_SHA256,
  P05_EPOCH_ID,
  P05_REQUIRED_CHECKS,
  p05CandidateGateIsReady,
  p05OneShotClaimGateIsReady,
  p05PersonMediaSummaryIsValid,
  projectP05PersonMediaSummary,
} from '../../scripts/acceptance/p05-person-media-public-probe.mjs';
import {
  acquireP05OneShotGitHubLatch,
  claimP05OneShotAtomically,
  P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
  P05_ONE_SHOT_LATCH_LABEL_NAME,
  P05OneShotClaimError,
} from '../../scripts/lib/p05-one-shot-claim.mjs';

const profile = {
  state: 'partial',
  person: { id: 3474, name: 'Private source name', images: { large: 'private-image-url' } },
  summary: {
    subjectCredits: 3,
    uniqueSubjects: 2,
    subjectMedia: [
      { key: 'anime', label: 'anime', count: 2, uniqueSubjects: 1, rawCodes: [2], title: 'private title' },
      { key: 'music', label: 'music', count: 1, uniqueSubjects: 1, rawCodes: [3], name: 'private name' },
    ],
  },
  coverage: {
    subjects: { observed: 4, returned: 3, truncated: true, sourceCompleteness: 'undocumented' },
  },
  credits: { subjects: [{ id: 100, name: 'private relation title' }] },
};

test('P05 public summary keeps aggregate type counts and strips work-level source data', () => {
  const summary = projectP05PersonMediaSummary(profile);
  assert.deepEqual(summary, {
    state: 'partial',
    personId: 3474,
    subjectCredits: 3,
    uniqueSubjects: 2,
    subjectRowsObserved: 4,
    subjectRowsReturned: 3,
    subjectRowsTruncated: true,
    sourceCompleteness: 'undocumented',
    subjectMedia: [
      { key: 'anime', label: 'anime', count: 2, uniqueSubjects: 1, rawCodes: [2] },
      { key: 'music', label: 'music', count: 1, uniqueSubjects: 1, rawCodes: [3] },
    ],
  });
  const serialized = JSON.stringify(summary);
  for (const sourceText of [
    'Private source name',
    'private-image-url',
    'private title',
    'private name',
    'private relation title',
  ]) {
    assert.equal(serialized.includes(sourceText), false);
  }
  assert.equal(p05PersonMediaSummaryIsValid(summary), true);
});

test('P05 summary validation rejects unsupported completeness and inconsistent counts', () => {
  const summary = projectP05PersonMediaSummary(profile);
  assert.ok(summary);
  assert.equal(p05PersonMediaSummaryIsValid({ ...summary, sourceCompleteness: 'complete' }), false);
  assert.equal(p05PersonMediaSummaryIsValid({ ...summary, subjectCredits: 4 }), false);
  assert.equal(p05PersonMediaSummaryIsValid({ ...summary, subjectMedia: [] }), false);
  assert.equal(projectP05PersonMediaSummary({ person: {}, summary: {}, coverage: {} }), null);
  assert.deepEqual(P05_ARGUMENTS, {
    personId: 3474,
    includeCredits: false,
    maxSubjects: 500,
    maxCharacters: 1,
  });
});

function readyCandidate() {
  const candidate = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const reviewerId = 'gpt-6-luna-max-run95-pr166-round1';
  const branch = 'codex/epoch-run95-p05-person-media-distribution-public-probe-20261015';
  const status = {
    run: { state: {
      state: 'EPOCH_ACTIVE',
      profile: 'AUTONOMOUS_EVOLUTION',
      active_epoch_pr: 166,
      pending_epoch: null,
    } },
    epoch: {
      number: 166,
      state: {
        epoch_id: P05_EPOCH_ID,
        state: 'REVIEW_PASSED',
        branch,
        pr_number: 166,
        base_sha: base,
        reviewed_base_sha: base,
        candidate_sha: candidate,
        review_pass_sha: candidate,
        ci: { sha: candidate, status: 'SUCCESS' },
        review: { reviewer_id: null, runtime: { state: 'COMPLETED' } },
        review_history: [{
          reviewer_id: reviewerId,
          candidate_sha: candidate,
          reviewed_base_sha: base,
          verdict: 'PASS',
        }],
      },
    },
  };
  const pr = {
    number: 166,
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: branch,
    baseRefOid: base,
    headRefOid: candidate,
    statusCheckRollup: P05_REQUIRED_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
  };
  return { status, pr, candidate, base, branch };
}

function claimedCandidate() {
  const { status, pr, candidate, base, branch } = readyCandidate();
  const reviewerId = 'gpt-6-luna-max-run95-pr166-round1';
  const claimId = 'p05-run-95-pr-166-aaaaaaaaaaaa-test';
  status.epoch.state.adversarial_preflight = {
    p05_one_shot_disposition: {
      claimId,
      frontierId: 'P05',
      epochId: P05_EPOCH_ID,
      runNumber: 95,
      toolName: 'bangumi.get_person_profile',
      argumentProfile: 'p05-person-media-types-3474-500-subjects-v1',
      expectedArgumentsSha256: P05_ARGUMENTS_SHA256,
      state: 'CLAIMED',
      sourceCandidateSha: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      prNumber: 166,
      reviewerId,
      retryAllowed: false,
      reportWritten: false,
      globalLatch: {
        name: P05_ONE_SHOT_LATCH_LABEL_NAME,
        description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
      },
    },
  };
  return { status, pr, candidate, base, branch, reviewerId, claimId };
}

test('P05 public query requires the exact reviewed Candidate, Base, and seven passing checks', () => {
  const { status, pr, candidate, base, branch } = readyCandidate();
  assert.equal(
    p05CandidateGateIsReady({ status, pr, currentHead: candidate, currentBaseSha: base, currentBranch: branch }),
    true,
  );
  assert.equal(
    p05CandidateGateIsReady({ status, pr, currentHead: 'c'.repeat(40), currentBaseSha: base, currentBranch: branch }),
    false,
  );
  const runningReviewStatus = structuredClone(status);
  runningReviewStatus.epoch.state.review.reviewer_id = 'gpt-6-luna-max-run95-pr166-round1';
  runningReviewStatus.epoch.state.review.runtime.state = 'ACTIVE';
  assert.equal(
    p05CandidateGateIsReady({ status: runningReviewStatus, pr, currentHead: candidate, currentBaseSha: base, currentBranch: branch }),
    false,
  );
  const failedCheckPr = {
    ...pr,
    statusCheckRollup: pr.statusCheckRollup.map((check, index) =>
      index === 0 ? { ...check, conclusion: 'FAILURE' } : check,
    ),
  };
  assert.equal(
    p05CandidateGateIsReady({ status, pr: failedCheckPr, currentHead: candidate, currentBaseSha: base, currentBranch: branch }),
    false,
  );
  const wrongReviewerStatus = structuredClone(status);
  wrongReviewerStatus.epoch.state.review_history[0].reviewer_id = 'unassigned-reviewer';
  wrongReviewerStatus.epoch.state.review.reviewer_id = 'unassigned-reviewer';
  assert.equal(
    p05CandidateGateIsReady({ status: wrongReviewerStatus, pr, currentHead: candidate, currentBaseSha: base, currentBranch: branch }),
    false,
  );
});

test('P05 query gate requires the exact repository latch and read-back PR claim', () => {
  const { status, pr, candidate, base, branch, claimId } = claimedCandidate();
  const input = {
    status,
    pr,
    currentHead: candidate,
    currentBaseSha: base,
    currentBranch: branch,
  };
  assert.equal(p05CandidateGateIsReady(input), false);
  assert.equal(p05OneShotClaimGateIsReady({ ...input, claimId }), true);
  assert.equal(
    p05OneShotClaimGateIsReady({ ...input, claimId: 'another-clone-claim' }),
    false,
  );
  const wrongLatch = structuredClone(status);
  wrongLatch.epoch.state.adversarial_preflight.p05_one_shot_disposition.globalLatch.name =
    'other-label';
  assert.equal(
    p05OneShotClaimGateIsReady({ ...input, status: wrongLatch, claimId }),
    false,
  );
});

test('P05 atomic claim fails closed across clones that share the repository label', () => {
  const labels = new Map();
  const gh = (...args) => {
    const name = P05_ONE_SHOT_LATCH_LABEL_NAME;
    if (args[0] === 'api' && args[1] === 'repos/{owner}/{repo}/labels') {
      const body = JSON.parse(args.at(-1).input);
      if (labels.has(body.name)) throw new Error('HTTP 422 Validation Failed');
      labels.set(body.name, body);
      return JSON.stringify(body);
    }
    if (args[0] === 'api' && args[1].endsWith(encodeURIComponent(name))) {
      const label = labels.get(name);
      if (!label) throw new Error('HTTP 404 Not Found');
      return JSON.stringify(label);
    }
    throw new Error('unexpected GitHub call');
  };
  const firstClaim = { claimId: 'first-clone', state: 'CLAIMED' };
  let firstPrClaim = null;
  let secondPrWasPatched = false;
  let queryCount = 0;
  claimP05OneShotAtomically({
    claim: firstClaim,
    assertReady: () => true,
    acquireGlobalLatch: () => acquireP05OneShotGitHubLatch(gh),
    persistClaim: (claim) => { firstPrClaim = claim; },
    readClaim: () => firstPrClaim,
    verifyClaim: (observed, expected) => JSON.stringify(observed) === JSON.stringify(expected),
  });
  queryCount += 1;

  assert.throws(
    () => claimP05OneShotAtomically({
      claim: { claimId: 'second-clone', state: 'CLAIMED' },
      assertReady: () => true,
      acquireGlobalLatch: () => acquireP05OneShotGitHubLatch(gh),
      persistClaim: () => { secondPrWasPatched = true; },
      readClaim: () => null,
      verifyClaim: () => false,
    }),
    (error) => error instanceof P05OneShotClaimError && error.code === 'P05_ONESHOT_ALREADY_CLAIMED',
  );
  assert.equal(firstPrClaim, firstClaim);
  assert.equal(secondPrWasPatched, false);
  assert.equal(queryCount, 1);
});
