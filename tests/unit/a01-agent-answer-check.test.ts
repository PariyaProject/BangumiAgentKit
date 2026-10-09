import { describe, expect, it } from 'vitest';
import { compileDiscoveryPlan, normalizeDiscoveryQuery } from '@bangumi-agent-kit/discovery';
import {
  A01_EXPECTED_QUERY_ARGUMENTS,
  expectedA01AnswerLines,
  verifyA01AgentAnswer,
} from '../../scripts/acceptance/a01-agent-answer-check.mjs';

const queryCoverage = {
  state: 'partial',
  requested: 0,
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
  hydrationBudgetExceeded: false,
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
  const resultQuery = {
    ...(query as Record<string, unknown>),
    limit: 8,
    budget: {
      maxPages: 6,
      maxCandidates: 300,
      maxHydrations: 60,
      concurrency: 6,
      maxConceptProbes: 8,
      maxReturnedItems: 8,
    },
  };
  const rowCounts = {
    available: 0,
    partial: 0,
    missing: 0,
    conflict: 0,
    not_computable: 0,
  };
  for (const row of rows) {
    const state = row.metricStates.ratingStandardDeviation as keyof typeof rowCounts;
    rowCounts[state] += 1;
  }
  const cohortQueryCoverage = {
    ...queryCoverage,
    scanned: rows.length,
    matched: rows.length,
    returned: rows.length,
    postFilterCount: rows.length,
    hydrationsAttempted: rows.length,
    hydrationsSucceeded: rows.length,
  };
  return {
    label,
    query: resultQuery,
    querySummary: label,
    subjects: rows,
    coverage: {
      query: {
        state: 'partial',
        coverage: cohortQueryCoverage,
        plan: compileDiscoveryPlan(normalizeDiscoveryQuery(resultQuery)),
      },
      detailHydrationsAttempted: rows.length,
      detailHydrationsSucceeded: rows.length,
      detailHydrationsFailed: 0,
      metrics: {
        ratingStandardDeviation: {
          valid: rowCounts.available,
          partial: rowCounts.partial,
          missing: rowCounts.missing,
          conflicts: rowCounts.conflict,
          notComputable: rowCounts.not_computable,
          state: 'partial',
        },
      },
    },
  };
}

function fixture() {
  const ratingMetric = {
    key: 'ratingStandardDeviation',
    label: '平均评分总体标准差',
    sourceField: 'subject.rating.count[1..10]',
    averages: [undefined, undefined],
    partialAverages: [1.23456, 1.790115],
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
    state: 'partial',
  };
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
      { key: 'score', state: 'partial' },
      { key: 'heat', state: 'partial' },
      { key: 'episodesReported', state: 'partial' },
      ratingMetric,
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
      evidence: { retained: 3, omitted: 0, truncated: false },
      warnings: { truncated: false },
    },
    source: {
      official: {
        class: 'official-v0',
        operations: ['searchSubjects', 'getSubjectById'],
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
    evidence: [
      {
        source: {
          class: 'official_v0',
          provider: 'bangumi',
          version: 'v0',
          operation: 'searchSubjects',
          experimental: true,
        },
        retrievedAt: '2026-10-09T00:00:01.000Z',
      },
      {
        source: {
          class: 'official_v0',
          provider: 'bangumi',
          version: 'v0',
          operation: 'getSubjectById',
        },
        retrievedAt: '2026-10-09T00:00:01.000Z',
      },
      {
        source: {
          class: 'derived',
          provider: 'bangumi-agent-kit',
          operation: 'bangumi.rating.population_sd.v1',
          version: '1',
        },
        retrievedAt: '2026-10-09T00:00:01.000Z',
      },
    ],
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

  it('requires official-v0 provider metadata on preserved evidence descriptors', () => {
    const { result, answer } = fixture();
    result.evidence[0]!.source.provider = 'private-community';
    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.checks.officialProvenance).toBe(false);
  });

  it('rejects added, removed, or changed filters after the runner projection', () => {
    const { result, answer } = fixture();
    Object.assign(result.cohorts[0]!.query, { tags: ['unexpected'] });

    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.checks.queryPlan).toBe(false);
  });

  it('rejects a changed executed request, TV post-filter, hydration plan, or B operation', () => {
    const mutations = [
      (result: ReturnType<typeof fixture>['result']) => {
        const plan = result.cohorts[0]!.coverage.query.plan;
        const step = Reflect.get(plan, 'steps') as unknown[];
        const request = Reflect.get(step[0] as object, 'request') as object;
        const filter = Reflect.get(request, 'filter') as object;
        Reflect.set(filter, 'airDate', ['>=2018-01-01', '<2018-04-01']);
      },
      (result: ReturnType<typeof fixture>['result']) => {
        const filters = Reflect.get(result.cohorts[0]!.coverage.query.plan, 'postFilters') as unknown[];
        filters.splice(0);
      },
      (result: ReturnType<typeof fixture>['result']) => {
        const requirements = Reflect.get(
          result.cohorts[0]!.coverage.query.plan,
          'hydrationRequirements',
        ) as unknown[];
        requirements.pop();
      },
      (result: ReturnType<typeof fixture>['result']) => {
        Reflect.set(result.cohorts[1]!.coverage.query.plan, 'operation', 'browseSubjects');
      },
    ];

    for (const mutate of mutations) {
      const { result, answer } = fixture();
      mutate(result);
      const verified = verifyA01AgentAnswer({
        answer,
        queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
        toolResult: { structuredContent: result },
      });
      expect(verified.checks.queryPlan).toBe(false);
    }
  });

  it('rejects exact or unknown total kinds for either fixed estimated search plan', () => {
    const mutations = [
      (result: ReturnType<typeof fixture>['result']) => {
        result.cohorts[0]!.coverage.query.coverage.totalKind = 'exact';
      },
      (result: ReturnType<typeof fixture>['result']) => {
        result.cohorts[1]!.coverage.query.coverage.totalKind = 'unknown';
      },
    ];
    for (const mutate of mutations) {
      const { result, answer } = fixture();
      mutate(result);
      const verified = verifyA01AgentAnswer({
        answer,
        queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
        toolResult: { structuredContent: result },
      });
      expect(verified.checks.queryPlan).toBe(false);
    }
  });

  it('recomputes query coverage state and queryState from production counters', () => {
    const invalidMutations = [
      (result: ReturnType<typeof fixture>['result']) => {
        const query = result.cohorts[0]!.coverage.query;
        query.coverage.state = 'complete';
        query.coverage.upstreamExhausted = false;
        query.coverage.requested = 0;
        query.coverage.budgetExceeded = false;
        query.state = 'ok';
      },
      (result: ReturnType<typeof fixture>['result']) => {
        const query = result.cohorts[0]!.coverage.query;
        query.coverage.state = 'complete';
        query.coverage.budgetExceeded = true;
      },
      (result: ReturnType<typeof fixture>['result']) => {
        result.cohorts[1]!.coverage.query.state = 'ok';
      },
    ];
    for (const mutate of invalidMutations) {
      const { result, answer } = fixture();
      mutate(result);
      const verified = verifyA01AgentAnswer({
        answer,
        queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
        toolResult: { structuredContent: result },
      });
      expect(verified.checks.queryCoverage).toBe(false);
    }

    const { result, answer } = fixture();
    for (const cohort of result.cohorts) {
      cohort.coverage.query.state = 'ok';
      cohort.coverage.query.coverage.state = 'unknown';
      cohort.coverage.query.coverage.upstreamExhausted = false;
      cohort.coverage.query.coverage.budgetExceeded = false;
      cohort.coverage.query.coverage.requested = 0;
    }
    const unknownCoverage = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(unknownCoverage.checks.queryCoverage).toBe(true);
  });

  it('rejects complete aggregate metrics when query or row coverage is partial', () => {
    const { result, answer } = fixture();
    const ratingMetric = result.metrics.find((metric) => metric.key === 'ratingStandardDeviation')!;
    Object.assign(ratingMetric, {
      averages: [1.23456, 1.790115],
      delta: 0.555555,
      state: 'complete',
    });
    Reflect.deleteProperty(ratingMetric, 'partialAverages');

    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.checks.metricCoverage).toBe(false);
  });

  it('rejects a complete top-level result state with partial queries or metric states', () => {
    const { result, answer } = fixture();
    result.state = 'complete';
    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.checks.comparisonState).toBe(false);
  });

  it('requires detail hydration attempts to cover every returned row', () => {
    const { result, answer } = fixture();
    result.cohorts[1]!.coverage.detailHydrationsAttempted = 1;
    const verified = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });

    expect(verified.checks.hydrationCoverage).toBe(false);
  });

  it('requires every failed detail hydration to have a not-computable SD row', () => {
    const { result, answer } = fixture();
    const cohort = result.cohorts[1]!;
    cohort.coverage.detailHydrationsSucceeded = 1;
    cohort.coverage.detailHydrationsFailed = 1;
    result.coverage.detailHydrationsSucceeded = 2;
    result.coverage.detailHydrationsFailed = 1;
    const noNotComputableRow = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(noNotComputableRow.checks.hydrationCoverage).toBe(false);

    cohort.subjects[1] = subject(200001, '同季样本', undefined, 'not_computable');
    Object.assign(cohort.coverage.metrics.ratingStandardDeviation, {
      valid: 1,
      notComputable: 1,
    });
    const ratingMetric = result.metrics.find((metric) => metric.key === 'ratingStandardDeviation')!;
    Object.assign(ratingMetric, {
      validCounts: [1, 1],
      notComputableCounts: [0, 1],
    });
    const matchingNotComputableRow = verifyA01AgentAnswer({
      answer,
      queryArguments: A01_EXPECTED_QUERY_ARGUMENTS,
      toolResult: { structuredContent: result },
    });
    expect(matchingNotComputableRow.checks.hydrationCoverage).toBe(true);
  });

  it('accepts complete aggregate metrics with complete cohort coverage and a matching delta', () => {
    const { result } = fixture();
    for (const cohort of result.cohorts) {
      cohort.coverage.query.state = 'ok';
      cohort.coverage.query.coverage.state = 'complete';
      cohort.coverage.query.coverage.budgetExceeded = false;
      cohort.coverage.query.coverage.upstreamExhausted = true;
      cohort.coverage.query.coverage.requested = cohort.coverage.query.coverage.scanned;
      cohort.coverage.metrics.ratingStandardDeviation.state = 'complete';
    }
    result.coverage.cohortsComplete = 2;
    result.coverage.cohortsPartial = 0;
    result.coverage.truncated = false;
    const ratingMetric = result.metrics.find((metric) => metric.key === 'ratingStandardDeviation')!;
    Object.assign(ratingMetric, {
      averages: [1.23456, 1.790115],
      delta: 0.555555,
      state: 'complete',
    });
    Reflect.deleteProperty(ratingMetric, 'partialAverages');
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

    expect(verified.passed).toBe(true);
    expect(verified.checks.metricCoverage).toBe(true);
  });

  it('preserves missing and conflict states instead of accepting fabricated zero values', () => {
    const { result } = fixture();
    result.cohorts[1]!.subjects[1] = subject(200001, '同季样本', undefined, 'missing');
    Object.assign(result.cohorts[1]!.coverage.metrics.ratingStandardDeviation, {
      valid: 1,
      missing: 1,
      state: 'partial',
    });
    const ratingMetric = result.metrics.find((metric) => metric.key === 'ratingStandardDeviation')!;
    Object.assign(ratingMetric, {
      averages: [undefined, undefined],
      partialAverages: [1.23456, 1.23456],
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
    Object.assign(result.cohorts[1]!.coverage.metrics.ratingStandardDeviation, {
      missing: 0,
      conflicts: 1,
      state: 'conflict',
    });
    result.state = 'conflict';
    Object.assign(ratingMetric, {
      averages: [undefined, undefined],
      partialAverages: [1.23456, 1.23456],
      missingCounts: [0, 0],
      conflictCounts: [0, 1],
      state: 'conflict',
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
