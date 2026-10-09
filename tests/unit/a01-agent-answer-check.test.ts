import { describe, expect, it } from 'vitest';
import {
  A01_EXPECTED_QUERY_ARGUMENTS,
  expectedA01AnswerLines,
  verifyA01AgentAnswer,
} from '../../scripts/acceptance/a01-agent-answer-check.mjs';

const queryCoverage = {
  state: 'partial',
  requested: 8,
  scanned: 8,
  matched: 2,
  returned: 2,
  pagesRequested: 1,
  pagesScanned: 1,
  upstreamExhausted: false,
  budgetExceeded: true,
  postFilterCount: 0,
  totalKind: 'estimated',
  hydrationsAttempted: 2,
  hydrationsSucceeded: 2,
  hydrationsFailed: 0,
  hydrationsUnresolved: 0,
};

function subject(
  id: number,
  name: string,
  sd: number | undefined,
  state = 'available',
) {
  return {
    id,
    name,
    displayName: name,
    date: '2017-10-06',
    ratingCount: 100,
    ratingHistogramPopulation: 100,
    ...(sd === undefined ? {} : { ratingStandardDeviation: sd }),
    metricStates: {
      ratingStandardDeviation: state,
    },
  };
}

function cohort(label: string, query: unknown, rows: ReturnType<typeof subject>[]) {
  return {
    label,
    query,
    querySummary: label,
    subjects: rows,
    coverage: {
      query: {
        state: 'partial',
        coverage: queryCoverage,
        plan: {
          source: 'official_v0',
          operation: 'searchSubjects',
          season: '2017-autumn',
          totalKind: 'estimated',
          resultMode: 'all',
          pushdown: [],
          postFilters: [],
          derivedFilters: [],
          unsupported: [],
          hydrationRequired: true,
          hydrationRequirements: [],
          requestedTopN: 8,
          quality: 'experimental',
          budget: { maxRequests: 12 },
          steps: [],
          limitations: ['bounded return sample'],
        },
      },
      detailHydrationsAttempted: rows.length,
      detailHydrationsSucceeded: rows.length,
      detailHydrationsFailed: 0,
      metrics: {
        ratingStandardDeviation: {
          valid: rows.length,
          partial: 0,
          missing: 0,
          conflicts: 0,
          notComputable: 0,
          state: 'complete',
        },
      },
    },
  };
}

function fixture() {
  const cohorts = [
    cohort('目标作品', A01_EXPECTED_QUERY_ARGUMENTS.cohorts[0].query, [
      { ...subject(218707, '少女終末旅行', 1.23456), displayName: '少女终末旅行' },
    ]),
    cohort('2017-autumn 动画返回样本', A01_EXPECTED_QUERY_ARGUMENTS.cohorts[1].query, [
      { ...subject(218707, '少女終末旅行', 1.23456), displayName: '少女终末旅行' },
      subject(200001, '同季样本', 2.34567),
    ]),
  ];
  const result = {
    state: 'partial',
    cohorts,
    metrics: [
      {
        key: 'ratingStandardDeviation',
        label: '平均评分总体标准差',
        sourceField: 'subject.rating.count[1..10]',
        averages: [1.23456, 1.790115],
        delta: 0.555555,
        validCounts: [1, 2],
        partialCounts: [0, 0],
        missingCounts: [0, 0],
        conflictCounts: [0, 0],
        notComputableCounts: [0, 0],
        formula: {
          id: 'bangumi.rating.population_sd.v1',
          version: 1,
          description: 'population standard deviation',
        },
        state: 'complete',
      },
    ],
    formulaVersion: 'subject-cohort-comparison-v1',
    coverage: {
      maxSubjectsPerCohort: 8,
      totalSubjectsReturned: 3,
      cohortsComplete: 0,
      cohortsPartial: 2,
      detailHydrationsAttempted: 3,
      detailHydrationsSucceeded: 3,
      detailHydrationsFailed: 0,
      truncated: true,
      overlap: { subjectIds: [218707], count: 1 },
      evidence: { retained: 4, omitted: 0, truncated: false },
    },
    source: {
      official: {
        class: 'official-v0',
        operations: ['POST /v0/search/subjects', 'GET /v0/subjects/{subject_id}'],
        attemptedAt: '2026-10-09T00:00:00.000Z',
        retrievedAt: '2026-10-09T00:00:01.000Z',
      },
      derived: {
        class: 'derived-s7',
        operations: ['subject-cohort-comparison'],
        attemptedAt: '2026-10-09T00:00:01.000Z',
        retrievedAt: '2026-10-09T00:00:01.000Z',
      },
    },
    retrievedAt: '2026-10-09T00:00:01.000Z',
    evidence: [],
    warnings: [{ code: 'QUERY_PARTIAL', state: 'partial', message: 'bounded' }],
    limitations: ['bounded current snapshot'],
  };
  const expected = expectedA01AnswerLines(result);
  const answer = [
    ...expected.rows,
    expected.averageLine,
    `范围：${expected.scopeTokens.join(';')}`,
  ].join('\n');
  return { result, answer };
}

describe('A01 current-source answer checker', () => {
  it('accepts exact target rows, formula counts, query coverage, overlap, and non-inferential limits', () => {
    const { result, answer } = fixture();
    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.passed).toBe(true);
    expect(Object.values(verified.checks).every(Boolean)).toBe(true);
  });

  it('rejects a target cohort that resolves to a different subject', () => {
    const { result, answer } = fixture();
    result.cohorts[0]!.subjects[0]!.name = 'Not the target';
    result.cohorts[0]!.subjects[0]!.displayName = 'Unrelated target';

    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.passed).toBe(false);
    expect(verified.checks.targetIdentity).toBe(false);
  });

  it('accepts the canonical ID when the localized display title identifies the target', () => {
    const { result } = fixture();
    result.cohorts[0]!.subjects[0]!.name = "Girls' Last Tour";
    const expected = expectedA01AnswerLines(result);
    const answer = [
      ...expected.rows,
      expected.averageLine,
      `范围：${expected.scopeTokens.join(';')}`,
    ].join('\n');

    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(verified.checks.targetIdentity).toBe(true);
    expect(verified.passed).toBe(true);
  });

  it('rejects omitted sample rows and mismatched overlap diagnostics', () => {
    const { result, answer } = fixture();
    const missingRow = answer.replace(/^B｜200001.*(?:\n|$)/mu, '');
    const missingRowResult = verifyA01AgentAnswer({
      answer: missingRow,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(missingRowResult.checks.exactRows).toBe(false);

    const inventedRow = verifyA01AgentAnswer({
      answer: `${answer}\nA｜999999｜name=虚构作品｜displayName=虚构作品｜SD=0.000｜state=available｜ratingCount=1`,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(inventedRow.checks.exactRows).toBe(false);

    result.coverage.totalSubjectsReturned += 1;
    const badReturnedCount = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(badReturnedCount.checks.returnedRowCount).toBe(false);
    result.coverage.totalSubjectsReturned -= 1;

    result.coverage.overlap.subjectIds = [];
    result.coverage.overlap.count = 0;
    const badOverlap = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(badOverlap.checks.overlap).toBe(false);
  });

  it('rejects missing caveats, unsupported significance claims, and altered fixed arguments', () => {
    const { result, answer } = fixture();
    const missingCaveat = verifyA01AgentAnswer({
      answer: answer.replace('不能据此认定“明显”或因果、质量、极化、推荐关系。', ''),
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(missingCaveat.checks.exactScopeLine).toBe(false);

    const affirmative = verifyA01AgentAnswer({
      answer: `${answer}\n评分标准差明显高于同季平均。`,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(affirmative.checks.rejectsUnsupportedSignificance).toBe(false);
    const affirmativeVariant = verifyA01AgentAnswer({
      answer: `${answer}\n目标作品的评分标准差明显偏高。`,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(affirmativeVariant.checks.rejectsUnsupportedSignificance).toBe(false);

    const alteredArguments = verifyA01AgentAnswer({
      answer,
      queryArguments: { ...A01_EXPECTED_QUERY_ARGUMENTS, maxSubjects: 9 },
      toolResult: { structuredContent: result },
    });
    expect(alteredArguments.checks.fixedArguments).toBe(false);
  });

  it('rejects unsupported season-coverage, causal, quality, polarization, and recommendation claims', () => {
    const { result, answer } = fixture();
    const unsupportedClaims = [
      {
        text: '本次查询覆盖了2017年秋季的全部动画作品。',
        check: 'rejectsUnsupportedCompleteness',
      },
      {
        text: '2017年秋季所有动画都已纳入这个样本。',
        check: 'rejectsUnsupportedCompleteness',
      },
      {
        text: '标准差更高说明作品质量更好。',
        check: 'rejectsUnsupportedInterpretation',
      },
      {
        text: '标准差更高是因为作品质量更好。',
        check: 'rejectsUnsupportedInterpretation',
      },
      {
        text: '评分标准差更高证明作品两极化。',
        check: 'rejectsUnsupportedInterpretation',
      },
      {
        text: '这部作品更值得推荐。',
        check: 'rejectsUnsupportedInterpretation',
      },
    ] as const;
    for (const claim of unsupportedClaims) {
      const verified = verifyA01AgentAnswer({
        answer: `${answer}\n${claim.text}`,
        queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
        toolResult: { structuredContent: result },
      });
      expect(verified.checks[claim.check]).toBe(false);
    }

    const qualified = verifyA01AgentAnswer({
      answer: `${answer}\n本次有界返回不能代表2017年秋季全部动画的完整覆盖。\n“评分标准差是否明显高于同季平均？”目前不能据此判断。`,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(qualified.checks.rejectsUnsupportedCompleteness).toBe(true);
    expect(qualified.checks.rejectsUnsupportedSignificance).toBe(true);
    expect(qualified.checks.exactScopeLine).toBe(false);
  });

  it('does not accept private or non-v0 operations as anonymous official provenance', () => {
    const { result } = fixture();
    result.source.official.operations = ['GET /p1/topics'];
    const expected = expectedA01AnswerLines(result);
    const answer = [
      ...expected.rows,
      expected.averageLine,
      `范围：${expected.scopeTokens.join(';')}`,
    ].join('\n');

    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.passed).toBe(false);
    expect(verified.checks.officialPublicOperations).toBe(false);
  });

  it('preserves missing and conflict states instead of accepting fabricated zero values', () => {
    const { result } = fixture();
    result.cohorts[1]!.subjects[1] = subject(200001, '同季样本', undefined, 'missing');
    Object.assign(result.metrics[0]!, {
      averages: [1.23456, undefined],
      partialAverages: [undefined, 1.23456],
      delta: undefined,
      validCounts: [1, 1],
      missingCounts: [0, 1],
      state: 'partial',
    });
    const missingExpected = expectedA01AnswerLines(result);
    const missingAnswer = [
      ...missingExpected.rows,
      missingExpected.averageLine,
      `范围：${missingExpected.scopeTokens.join(';')}`,
    ].join('\n');
    const missingCheck = verifyA01AgentAnswer({
      answer: missingAnswer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(missingCheck.passed).toBe(true);
    expect(missingExpected.rows[2]).toContain('SD=missing｜state=missing');

    result.cohorts[1]!.subjects[1] = subject(200001, '同季样本', undefined, 'conflict');
    Object.assign(result.metrics[0]!, {
      averages: [1.23456, undefined],
      partialAverages: [undefined, 1.23456],
      missingCounts: [0, 0],
      conflictCounts: [0, 1],
      state: 'partial',
    });
    const conflictExpected = expectedA01AnswerLines(result);
    const conflictAnswer = [
      ...conflictExpected.rows,
      conflictExpected.averageLine,
      `范围：${conflictExpected.scopeTokens.join(';')}`,
    ].join('\n');
    const conflictCheck = verifyA01AgentAnswer({
      answer: conflictAnswer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(conflictCheck.passed).toBe(true);
    expect(conflictExpected.rows[2]).toContain('SD=conflict｜state=conflict');
    expect(
      verifyA01AgentAnswer({
        answer: conflictAnswer.replace('SD=conflict｜state=conflict', 'SD=0.000｜state=available'),
        queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
        toolResult: { structuredContent: result },
      }).checks.exactRows,
    ).toBe(false);
  });
});
