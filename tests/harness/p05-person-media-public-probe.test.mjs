import assert from 'node:assert/strict';
import test from 'node:test';
import {
  P05_ARGUMENTS,
  P05_EPOCH_ID,
  P05_REQUIRED_CHECKS,
  p05CandidateGateIsReady,
  p05PersonMediaSummaryIsValid,
  projectP05PersonMediaSummary,
} from '../../scripts/acceptance/p05-person-media-public-probe.mjs';

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
    run: { state: { state: 'ACTIVE', active_epoch_pr: 166 } },
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
        review: { reviewer_id: reviewerId },
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
