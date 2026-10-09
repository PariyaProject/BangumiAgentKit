import { describe, expect, it } from 'vitest';
import {
  A01_AGGREGATE_EXPECTED_ARGUMENTS,
  expectedA01AggregateAnswer,
  summarizeA01AggregateResult,
  verifyA01AggregateAnswer,
} from '../../scripts/acceptance/a01-aggregate-subject-cohort-answer-check.mjs';

const fixedQuery = A01_AGGREGATE_EXPECTED_ARGUMENTS.cohort.query;

function metric(key: string, value: number, rowState: 'available' | 'partial') {
  const valid = rowState === 'available' ? 1 : 0;
  const partial = rowState === 'partial' ? 1 : 0;
  return {
    key,
    label: key,
    sourceField: key,
    averages: [null],
    partialAverages: [value],
    validCounts: [valid],
    partialCounts: [partial],
    missingCounts: [0],
    conflictCounts: [0],
    notComputableCounts: [0],
    state: 'partial',
  };
}

function result() {
  return {
    state: 'partial',
    cohorts: [
      {
        label: '2012 anime',
        query: fixedQuery,
        querySummary: 'fixed public sample',
        subjects: [
          {
            id: 1,
            name: 'fixture',
            displayName: 'fixture',
            score: 7.25,
            collectionTotal: 123.5,
            episodesReported: 12,
            ratingStandardDeviation: 1.125,
            metricStates: {
              score: 'available',
              heat: 'available',
              episodesReported: 'available',
              ratingStandardDeviation: 'available',
            },
          },
        ],
        coverage: {
          query: {
            state: 'partial',
            coverage: {
              state: 'partial',
              scanned: 20,
              matched: 1,
              returned: 1,
              totalKind: 'estimated',
              budgetExceeded: false,
              upstreamExhausted: false,
            },
          },
          detailHydrationsAttempted: 1,
          detailHydrationsSucceeded: 1,
          detailHydrationsFailed: 0,
          metrics: {
            score: {
              valid: 1,
              partial: 0,
              missing: 0,
              conflicts: 0,
              notComputable: 0,
              state: 'partial',
            },
            heat: {
              valid: 1,
              partial: 0,
              missing: 0,
              conflicts: 0,
              notComputable: 0,
              state: 'partial',
            },
            episodesReported: {
              valid: 1,
              partial: 0,
              missing: 0,
              conflicts: 0,
              notComputable: 0,
              state: 'partial',
            },
            ratingStandardDeviation: {
              valid: 1,
              partial: 0,
              missing: 0,
              conflicts: 0,
              notComputable: 0,
              state: 'partial',
            },
          },
        },
      },
    ],
    metrics: [
      metric('score', 7.25, 'available'),
      metric('heat', 123.5, 'available'),
      metric('episodesReported', 12, 'available'),
      metric('ratingStandardDeviation', 1.125, 'available'),
    ],
    formulaVersion: 'subject-cohort-comparison-v1',
    coverage: {
      maxSubjectsPerCohort: 1,
      totalSubjectsReturned: 1,
      cohortsComplete: 0,
      cohortsPartial: 1,
      detailHydrationsAttempted: 1,
      detailHydrationsSucceeded: 1,
      detailHydrationsFailed: 0,
      truncated: true,
    },
    source: {
      official: {
        class: 'official-v0',
        operations: ['searchSubjects', 'getSubjectById'],
      },
    },
  };
}

describe('A01 aggregate_subject_cohort answer checker', () => {
  it('summarizes one bounded official-v0 cohort and checks all reported states and metrics', () => {
    const toolResult = { structuredContent: result() };
    const summary = summarizeA01AggregateResult(toolResult.structuredContent);
    expect(summary).not.toBeNull();
    const answer = expectedA01AggregateAnswer(summary!);
    const checked = verifyA01AggregateAnswer({
      answer,
      queryArguments: A01_AGGREGATE_EXPECTED_ARGUMENTS,
      toolResult,
    });
    expect(checked.passed).toBe(true);
    expect(checked.checks).toEqual({
      fixedArguments: true,
      structuredResultReadback: true,
      exactAggregateAnswer: true,
      boundedSampleDisclosure: true,
      nonCausalLimitations: true,
      plainTextNoMarkdown: true,
    });
    expect(answer).toContain('平均评分=7.25');
    expect(answer).toContain('平均热度=123.50（partial');
    expect(answer).toContain('scanned=20，matched=1，returned=1');
    expect(answer).toContain('截断=是');
  });

  it('rejects altered metrics, changed query scope, incomplete structured readback, and completeness claims', () => {
    const toolResult = { structuredContent: result() };
    const answer = expectedA01AggregateAnswer(summarizeA01AggregateResult(result())!);
    expect(
      verifyA01AggregateAnswer({
        answer: answer.replace('平均评分=7.25', '平均评分=9.99'),
        queryArguments: A01_AGGREGATE_EXPECTED_ARGUMENTS,
        toolResult,
      }).passed,
    ).toBe(false);
    expect(
      verifyA01AggregateAnswer({
        answer,
        queryArguments: { ...A01_AGGREGATE_EXPECTED_ARGUMENTS, maxSubjects: 2 },
        toolResult,
      }).checks.fixedArguments,
    ).toBe(false);
    expect(
      summarizeA01AggregateResult({
        ...result(),
        coverage: { ...result().coverage, totalSubjectsReturned: 2 },
      }),
    ).toBeNull();
    expect(
      summarizeA01AggregateResult({
        ...result(),
        cohorts: [
          { ...result().cohorts[0], query: { media: 'anime', year: 2013, resultMode: 'all' } },
        ],
      }),
    ).toBeNull();
    expect(
      verifyA01AggregateAnswer({
        answer: answer + ' 全库动画的均值如下。',
        queryArguments: A01_AGGREGATE_EXPECTED_ARGUMENTS,
        toolResult,
      }).checks.exactAggregateAnswer,
    ).toBe(false);
    expect(
      verifyA01AggregateAnswer({
        answer: answer + '\n第二行',
        queryArguments: A01_AGGREGATE_EXPECTED_ARGUMENTS,
        toolResult,
      }).checks.plainTextNoMarkdown,
    ).toBe(false);
  });

  it('rejects a complete claim when budgets or output truncation make coverage partial', () => {
    const aggregate = result() as any;
    const cohort = aggregate.cohorts[0];
    aggregate.state = 'complete';
    cohort.coverage.query.state = 'ok';
    Object.assign(cohort.coverage.query.coverage, {
      state: 'complete',
      scanned: 20,
      matched: 1,
      returned: 1,
      totalKind: 'exact',
      budgetExceeded: false,
      upstreamExhausted: true,
    });
    for (const item of aggregate.metrics) {
      item.state = 'complete';
      item.averages = [item.partialAverages[0]];
      delete item.partialAverages;
    }
    for (const item of Object.values(cohort.coverage.metrics) as Array<any>) {
      item.state = 'complete';
    }
    aggregate.coverage.cohortsComplete = 1;
    aggregate.coverage.cohortsPartial = 0;
    aggregate.coverage.truncated = true;

    const queryCoverage = cohort.coverage.query.coverage;
    queryCoverage.budgetExceeded = true;
    queryCoverage.upstreamExhausted = false;
    queryCoverage.matched = 20;
    expect(summarizeA01AggregateResult(aggregate)).toBeNull();

    queryCoverage.budgetExceeded = false;
    queryCoverage.upstreamExhausted = true;
    queryCoverage.matched = queryCoverage.returned;
    expect(summarizeA01AggregateResult(aggregate)).toBeNull();
  });

  it('rejects inconsistent returned rows, coverage counts, metric states, averages, and overall state', () => {
    const noSubject = result();
    noSubject.cohorts[0]!.subjects = [];
    expect(summarizeA01AggregateResult(noSubject)).toBeNull();

    const notFoundWithSubject = result();
    notFoundWithSubject.state = 'not_found';
    notFoundWithSubject.cohorts[0]!.coverage.query.state = 'not_found';
    expect(summarizeA01AggregateResult(notFoundWithSubject)).toBeNull();

    const wrongQueryCount = result();
    wrongQueryCount.cohorts[0]!.coverage.query.coverage.returned = 0;
    expect(summarizeA01AggregateResult(wrongQueryCount)).toBeNull();

    const wrongMetricCount = result();
    wrongMetricCount.cohorts[0]!.coverage.metrics.score.valid = 0;
    expect(summarizeA01AggregateResult(wrongMetricCount)).toBeNull();

    const wrongMetricAverage = result();
    wrongMetricAverage.metrics[0]!.partialAverages = [9.99];
    expect(summarizeA01AggregateResult(wrongMetricAverage)).toBeNull();

    const wrongOverallState = result();
    wrongOverallState.state = 'complete';
    expect(summarizeA01AggregateResult(wrongOverallState)).toBeNull();
  });
});
