import { getAgentMcpProfileById } from './agent-mcp-profile-claims.mjs';

export const C01_PROFILE_ID = 'c01-rating-count-gap-v1';
export const C01_PROFILE = getAgentMcpProfileById(C01_PROFILE_ID);
export const C01_MAX_ANSWER_BYTES = 4096;
export const C01_SAFE_SCOPE_NOTE =
  '这是两个条目的当前来源快照；未提供实践阈值，无法判断差异是否足够大；未进行统计显著性检验。';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  return (
    isRecord(value) && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0')
  );
}

function fail(code) {
  return { passed: false, reason: code };
}

export function projectC01ComparisonResult(result) {
  if (!C01_PROFILE || !isRecord(result)) throw new TypeError('C01 profile/result is unavailable.');
  const expectedIds = C01_PROFILE.calls[0].arguments.subjectIds;
  if (
    !Array.isArray(result.subjectIds) ||
    result.subjectIds.length !== 2 ||
    result.subjectIds.some((id, index) => id !== expectedIds[index]) ||
    !Array.isArray(result.subjects) ||
    result.subjects.length !== 2 ||
    !Array.isArray(result.metrics)
  ) {
    throw new Error('C01 source result does not match the registered subject pair.');
  }
  const subjects = result.subjects.map((row, index) => {
    const subject = row?.subject;
    const name =
      typeof subject?.nameCn === 'string' && subject.nameCn.trim()
        ? subject.nameCn.trim()
        : typeof subject?.name === 'string'
          ? subject.name.trim()
          : '';
    const ratingTotal = row?.stats?.ratingTotal;
    if (
      row?.subjectId !== expectedIds[index] ||
      subject?.id !== expectedIds[index] ||
      !name ||
      !Number.isSafeInteger(ratingTotal) ||
      ratingTotal < 0
    ) {
      throw new Error('C01 source result is missing an exact identity or rating total.');
    }
    return { subjectId: expectedIds[index], name, ratingTotal };
  });
  const metric = result.metrics.find((item) => item?.key === 'ratingTotal');
  const official = result.source?.official;
  const derived = result.source?.derived;
  const values = subjects.map((item) => item.ratingTotal);
  const expectedDelta = values[1] - values[0];
  if (
    metric?.state !== 'complete' ||
    !Array.isArray(metric.values) ||
    metric.values.length !== 2 ||
    metric.values[0] !== values[0] ||
    metric.values[1] !== values[1] ||
    metric.delta !== expectedDelta ||
    !Number.isSafeInteger(metric.delta)
  ) {
    throw new Error('C01 ratingTotal metric is unknown, conflicting, or inconsistent.');
  }
  if (
    !isRecord(result.coverage) ||
    result.coverage.requestedSubjects !== 2 ||
    result.coverage.returnedSubjects !== 2 ||
    official?.class !== 'official-v0' ||
    !Array.isArray(official.operations) ||
    official.operations.length === 0 ||
    official.operations.some((operation) => typeof operation !== 'string' || !operation.trim()) ||
    typeof official.attemptedAt !== 'string' ||
    typeof official.retrievedAt !== 'string' ||
    derived?.class !== 'derived-s7' ||
    !Array.isArray(derived.operations) ||
    !derived.operations.includes('subject-comparison') ||
    result.formulaVersion !== 'subject-comparison-v2' ||
    !['complete', 'partial'].includes(result.state)
  ) {
    throw new Error('C01 comparison coverage is not a bounded two-subject response.');
  }
  return {
    state: result.state,
    subjectIds: [...expectedIds],
    subjects,
    ratingTotal: { state: metric.state, values, delta: expectedDelta },
    sourceEvidence: {
      officialOperations: [...new Set(official.operations)].sort(),
      officialAttemptedAt: official.attemptedAt,
      officialRetrievedAt: official.retrievedAt,
      derivedOperations: [...new Set(derived.operations)].sort(),
      derivedFormulaVersion: result.formulaVersion,
      derivedRetrievedAt: typeof derived.retrievedAt === 'string' ? derived.retrievedAt : null,
    },
    coverage: {
      requestedSubjects: result.coverage.requestedSubjects,
      returnedSubjects: result.coverage.returnedSubjects,
      subjectsComplete: Number.isSafeInteger(result.coverage.subjectsComplete)
        ? result.coverage.subjectsComplete
        : null,
      subjectsPartial: Number.isSafeInteger(result.coverage.subjectsPartial)
        ? result.coverage.subjectsPartial
        : null,
      limits: isRecord(result.coverage.limits)
        ? {
            maxCast: result.coverage.limits.maxCast,
            maxStaff: result.coverage.limits.maxStaff,
            maxRelations: result.coverage.limits.maxRelations,
          }
        : null,
    },
  };
}

export function verifyC01Answer(answerText, sourceResult) {
  if (!C01_PROFILE || typeof answerText !== 'string') return fail('ANSWER_INVALID');
  if (Buffer.byteLength(answerText, 'utf8') > C01_MAX_ANSWER_BYTES) return fail('ANSWER_TOO_LARGE');
  let source;
  let answer;
  try {
    source = projectC01ComparisonResult(sourceResult);
    answer = JSON.parse(answerText);
  } catch {
    return fail('SOURCE_OR_ANSWER_INVALID');
  }
  if (
    !exactKeys(answer, [
      'schemaVersion',
      'subjects',
      'ratingTotalDelta',
      'thresholdAssessment',
      'statisticalSignificance',
      'scopeNote',
    ])
  )
    return fail('ANSWER_FIELDS_INVALID');
  if (answer.schemaVersion !== 1 || !Array.isArray(answer.subjects) || answer.subjects.length !== 2)
    return fail('ANSWER_SCHEMA_INVALID');
  const subjectsMatch = answer.subjects.every(
    (row, index) =>
      exactKeys(row, ['subjectId', 'name', 'ratingTotal']) &&
      row.subjectId === source.subjects[index].subjectId &&
      row.name === source.subjects[index].name &&
      row.ratingTotal === source.subjects[index].ratingTotal,
  );
  if (!subjectsMatch) return fail('ANSWER_SUBJECTS_MISMATCH');
  if (answer.ratingTotalDelta !== source.ratingTotal.delta) return fail('ANSWER_DELTA_MISMATCH');
  if (answer.thresholdAssessment !== 'not_assessable_without_threshold')
    return fail('THRESHOLD_ASSESSMENT_UNSUPPORTED');
  if (answer.statisticalSignificance !== 'not_established')
    return fail('STATISTICAL_SIGNIFICANCE_UNSUPPORTED');
  if (answer.scopeNote !== C01_SAFE_SCOPE_NOTE) return fail('SCOPE_CAVEAT_MISSING');
  return {
    passed: true,
    reason: null,
    checks: {
      exactSubjectIdsAndNames: true,
      exactRatingTotals: true,
      exactSignedDelta: true,
      thresholdNotInvented: true,
      statisticalSignificanceNotClaimed: true,
      currentComparisonState: source.state,
    },
    source,
  };
}
