import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectC01ComparisonResult,
  verifyC01Answer,
} from '../../scripts/lib/c01-rating-count-evidence.mjs';

const result = {
  subjectIds: [41529, 46729],
  state: 'partial',
  subjects: [
    {
      subjectId: 41529,
      state: 'complete',
      subject: { id: 41529, name: 'BTOOOM!', nameCn: '惊爆游戏' },
      stats: { ratingTotal: 1400 },
    },
    {
      subjectId: 46729,
      state: 'partial',
      subject: { id: 46729, name: 'Sample Work', nameCn: '' },
      stats: { ratingTotal: 250 },
    },
  ],
  metrics: [{ key: 'ratingTotal', state: 'complete', values: [1400, 250], delta: -1150 }],
  formulaVersion: 'subject-comparison-v2',
  source: {
    official: {
      class: 'official-v0',
      operations: ['GET /v0/subjects/{subject_id}'],
      attemptedAt: '2026-10-15T12:00:00.000Z',
      retrievedAt: '2026-10-15T12:00:01.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: ['subject-comparison'],
      attemptedAt: '2026-10-15T12:00:01.000Z',
      retrievedAt: '2026-10-15T12:00:01.000Z',
    },
  },
  coverage: {
    requestedSubjects: 2,
    returnedSubjects: 2,
    subjectsComplete: 1,
    subjectsPartial: 1,
    limits: { maxCast: 1, maxStaff: 1, maxRelations: 1 },
  },
};

const validAnswer = {
  schemaVersion: 1,
  subjects: [
    { subjectId: 41529, name: '惊爆游戏', ratingTotal: 1400 },
    { subjectId: 46729, name: 'Sample Work', ratingTotal: 250 },
  ],
  ratingTotalDelta: -1150,
  thresholdAssessment: 'not_assessable_without_threshold',
  statisticalSignificance: 'not_established',
  scopeNote:
    '这是两个条目的当前来源快照；未提供实践阈值，无法判断差异是否足够大；未进行统计显著性检验，本结果不代表统计显著性。',
};

test('C01 projects only the exact current rating totals and signed B-minus-A delta', () => {
  assert.deepEqual(projectC01ComparisonResult(result), {
    state: 'partial',
    subjectIds: [41529, 46729],
    subjects: [
      { subjectId: 41529, name: '惊爆游戏', ratingTotal: 1400 },
      { subjectId: 46729, name: 'Sample Work', ratingTotal: 250 },
    ],
    ratingTotal: { state: 'complete', values: [1400, 250], delta: -1150 },
    sourceEvidence: {
      officialOperations: ['GET /v0/subjects/{subject_id}'],
      officialAttemptedAt: '2026-10-15T12:00:00.000Z',
      officialRetrievedAt: '2026-10-15T12:00:01.000Z',
      derivedOperations: ['subject-comparison'],
      derivedFormulaVersion: 'subject-comparison-v2',
      derivedRetrievedAt: '2026-10-15T12:00:01.000Z',
    },
    coverage: {
      requestedSubjects: 2,
      returnedSubjects: 2,
      subjectsComplete: 1,
      subjectsPartial: 1,
      limits: { maxCast: 1, maxStaff: 1, maxRelations: 1 },
    },
  });
});

test('C01 accepts a source-grounded current pair answer with no invented threshold', () => {
  const verification = verifyC01Answer(JSON.stringify(validAnswer), result);
  assert.equal(verification.passed, true);
  assert.deepEqual(verification.checks, {
    exactSubjectIdsAndNames: true,
    exactRatingTotals: true,
    exactSignedDelta: true,
    thresholdNotInvented: true,
    statisticalSignificanceNotClaimed: true,
    currentComparisonState: 'partial',
  });
});

test('C01 rejects incorrect identity, count, delta, or unsupported significance', () => {
  for (const [field, value] of [
    ['subjects', [{ ...validAnswer.subjects[0], subjectId: 46729 }, validAnswer.subjects[1]]],
    ['subjects', [{ ...validAnswer.subjects[0], ratingTotal: 1401 }, validAnswer.subjects[1]]],
    ['ratingTotalDelta', 1150],
    ['statisticalSignificance', 'significant'],
  ]) {
    const answer = { ...validAnswer, [field]: value };
    assert.equal(verifyC01Answer(JSON.stringify(answer), result).passed, false);
  }
});

test('C01 requires both the practical-threshold and significance caveats', () => {
  assert.equal(
    verifyC01Answer(JSON.stringify({ ...validAnswer, scopeNote: '评分人数差了 1150。' }), result)
      .reason,
    'SCOPE_CAVEAT_MISSING',
  );
  assert.equal(
    verifyC01Answer(
      JSON.stringify({
        ...validAnswer,
        scopeNote: '未提供实践阈值，无法判断差异是否足够大；差异具有统计显著性。',
      }),
      result,
    ).reason,
    'SCOPE_CAVEAT_MISSING',
  );
});

test('C01 refuses unknown, conflicting, or mismatched source metrics', () => {
  assert.throws(
    () =>
      projectC01ComparisonResult({
        ...result,
        metrics: [{ ...result.metrics[0], state: 'unknown' }],
      }),
    /unknown, conflicting, or inconsistent/u,
  );
  assert.throws(
    () =>
      projectC01ComparisonResult({ ...result, metrics: [{ ...result.metrics[0], delta: 1150 }] }),
    /unknown, conflicting, or inconsistent/u,
  );
  assert.throws(
    () => projectC01ComparisonResult({ ...result, subjectIds: [46729, 41529] }),
    /registered subject pair/u,
  );
});
