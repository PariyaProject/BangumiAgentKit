import { canonicalHash } from '../lib/frontier-ledger.mjs';
import {
  P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
  P05_ONE_SHOT_LATCH_LABEL_NAME,
} from '../lib/p05-one-shot-claim.mjs';

export const P05_TOOL_NAME = 'bangumi.get_person_profile';
export const P05_EPOCH_ID = 'run95-p05-person-media-distribution-public-probe-20261015';
export const P05_ARGUMENT_PROFILE = 'p05-person-media-types-3474-500-subjects-v1';
export const P05_ARGUMENTS = Object.freeze({
  personId: 3474,
  includeCredits: false,
  maxSubjects: 500,
  maxCharacters: 1,
});

export const P05_REQUIRED_CHECKS = Object.freeze([
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
]);
export const P05_ARGUMENTS_SHA256 = canonicalHash(P05_ARGUMENTS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function projectP05PersonMediaSummary(result) {
  if (!isRecord(result)) return null;
  const person = isRecord(result.person) ? result.person : null;
  const sourceSummary = isRecord(result.summary) ? result.summary : null;
  const coverage = isRecord(result.coverage) ? result.coverage : null;
  const subjects = isRecord(coverage?.subjects) ? coverage.subjects : null;
  if (!person || !sourceSummary || !subjects || !Array.isArray(sourceSummary.subjectMedia)) {
    return null;
  }

  return {
    state: result.state,
    personId: person.id,
    subjectCredits: sourceSummary.subjectCredits,
    uniqueSubjects: sourceSummary.uniqueSubjects,
    subjectRowsObserved: subjects.observed,
    subjectRowsReturned: subjects.returned,
    subjectRowsTruncated: subjects.truncated,
    sourceCompleteness: subjects.sourceCompleteness,
    subjectMedia: sourceSummary.subjectMedia.map((item) => {
      const bucket = isRecord(item) ? item : null;
      return {
        key: bucket?.key,
        label: bucket?.label,
        count: bucket?.count,
        uniqueSubjects: bucket?.uniqueSubjects,
        rawCodes: Array.isArray(bucket?.rawCodes) ? bucket.rawCodes : [],
      };
    }),
  };
}

export function p05PersonMediaSummaryIsValid(summary) {
  if (
    !isRecord(summary) ||
    !['partial', 'complete'].includes(summary.state) ||
    summary.personId !== P05_ARGUMENTS.personId ||
    summary.sourceCompleteness !== 'undocumented' ||
    !Number.isSafeInteger(summary.subjectCredits) ||
    !Number.isSafeInteger(summary.uniqueSubjects) ||
    !Number.isSafeInteger(summary.subjectRowsObserved) ||
    !Number.isSafeInteger(summary.subjectRowsReturned) ||
    typeof summary.subjectRowsTruncated !== 'boolean' ||
    !Array.isArray(summary.subjectMedia) ||
    summary.subjectMedia.length === 0
  ) {
    return false;
  }

  const allowedKeys = new Set(['book', 'anime', 'music', 'game', 'real', 'other']);
  const seenKeys = new Set();
  let countTotal = 0;
  let uniqueSubjectTotal = 0;
  for (const bucket of summary.subjectMedia) {
    if (
      !isRecord(bucket) ||
      Object.keys(bucket).sort().join(',') !== 'count,key,label,rawCodes,uniqueSubjects' ||
      typeof bucket.key !== 'string' ||
      !allowedKeys.has(bucket.key) ||
      seenKeys.has(bucket.key) ||
      typeof bucket.label !== 'string' ||
      !bucket.label.trim() ||
      !Number.isSafeInteger(bucket.count) ||
      bucket.count < 1 ||
      !Number.isSafeInteger(bucket.uniqueSubjects) ||
      bucket.uniqueSubjects < 0 ||
      bucket.uniqueSubjects > bucket.count ||
      !Array.isArray(bucket.rawCodes) ||
      bucket.rawCodes.some((code) => !Number.isSafeInteger(code) || code < 1)
    ) {
      return false;
    }
    seenKeys.add(bucket.key);
    countTotal += bucket.count;
    uniqueSubjectTotal += bucket.uniqueSubjects;
  }

  return (
    summary.subjectRowsReturned <= summary.subjectRowsObserved &&
    summary.subjectRowsReturned <= P05_ARGUMENTS.maxSubjects &&
    summary.subjectRowsTruncated === (summary.subjectRowsObserved > summary.subjectRowsReturned) &&
    summary.subjectCredits === summary.subjectRowsReturned &&
    summary.uniqueSubjects <= summary.subjectCredits &&
    countTotal === summary.subjectCredits &&
    uniqueSubjectTotal >= summary.uniqueSubjects &&
    uniqueSubjectTotal <= summary.subjectCredits
  );
}

function p05ReviewedCandidateFieldsAreReady({
  status,
  pr,
  currentHead,
  currentBaseSha,
  currentBranch,
}) {
  const run = status?.run?.state;
  const epochView = status?.epoch;
  const epoch = epochView?.state;
  const history = Array.isArray(epoch?.review_history) ? epoch.review_history : [];
  const latestReview = history.at(-1);
  if (
    run?.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== pr?.number ||
    run.pending_epoch != null ||
    epochView?.number !== pr?.number ||
    epoch?.epoch_id !== P05_EPOCH_ID ||
    epoch?.state !== 'REVIEW_PASSED' ||
    epoch?.branch !== currentBranch ||
    epoch?.pr_number !== pr?.number ||
    epoch?.base_sha !== currentBaseSha ||
    epoch?.reviewed_base_sha !== currentBaseSha ||
    epoch?.candidate_sha !== currentHead ||
    epoch?.review_pass_sha !== currentHead ||
    epoch?.ci?.sha !== currentHead ||
    epoch?.ci?.status !== 'SUCCESS' ||
    latestReview?.verdict !== 'PASS' ||
    latestReview?.candidate_sha !== currentHead ||
    latestReview?.reviewed_base_sha !== currentBaseSha ||
    !/^gpt-6-luna-max-run95-pr166-round\d+$/u.test(latestReview?.reviewer_id ?? '') ||
    epoch?.review?.reviewer_id != null ||
    epoch?.review?.runtime?.state !== 'COMPLETED' ||
    pr?.state !== 'OPEN' ||
    pr?.isDraft !== false ||
    pr?.baseRefName !== 'master' ||
    pr?.headRefName !== currentBranch ||
    pr?.baseRefOid !== currentBaseSha ||
    pr?.headRefOid !== currentHead
  ) {
    return false;
  }

  const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : [];
  const named = new Map();
  for (const check of checks) {
    if (!P05_REQUIRED_CHECKS.includes(check?.name)) continue;
    const values = named.get(check.name) ?? [];
    values.push(check);
    named.set(check.name, values);
  }
  return P05_REQUIRED_CHECKS.every((name) => {
    const occurrences = named.get(name);
    return occurrences?.length > 0 && occurrences.every(
      (check) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS',
    );
  });
}

export function p05CandidateGateIsReady(input) {
  const epoch = input?.status?.epoch?.state;
  return (
    p05ReviewedCandidateFieldsAreReady(input) &&
    !Object.hasOwn(epoch?.adversarial_preflight ?? {}, 'p05_one_shot_disposition')
  );
}

export function p05OneShotClaimGateIsReady(input) {
  const { claimId } = input;
  if (!p05ReviewedCandidateFieldsAreReady(input)) return false;
  const epoch = input.status.epoch.state;
  const claim = epoch.adversarial_preflight?.p05_one_shot_disposition;
  const latestReview = epoch.review_history.at(-1);
  return (
    typeof claimId === 'string' &&
    claim?.claimId === claimId &&
    claim.frontierId === 'P05' &&
    claim.epochId === P05_EPOCH_ID &&
    claim.runNumber === 95 &&
    claim.prNumber === input.pr.number &&
    claim.toolName === P05_TOOL_NAME &&
    claim.argumentProfile === P05_ARGUMENT_PROFILE &&
    claim.expectedArgumentsSha256 === P05_ARGUMENTS_SHA256 &&
    claim.state === 'CLAIMED' &&
    claim.sourceCandidateSha === input.currentHead &&
    claim.baseSha === input.currentBaseSha &&
    claim.ciSha === input.currentHead &&
    claim.ciStatus === 'SUCCESS' &&
    claim.reviewerId === latestReview.reviewer_id &&
    claim.retryAllowed === false &&
    claim.reportWritten === false &&
    claim.globalLatch?.name === P05_ONE_SHOT_LATCH_LABEL_NAME &&
    claim.globalLatch?.description === P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION
  );
}
