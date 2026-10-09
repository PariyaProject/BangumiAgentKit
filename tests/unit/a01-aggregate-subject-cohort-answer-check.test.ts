import { describe, expect, it } from 'vitest';
import {
  A01_AGGREGATE_EXPECTED_ARGUMENTS,
  expectedA01AggregateAnswer,
  summarizeA01AggregateResult,
  verifyA01AggregateAnswer,
} from '../../scripts/acceptance/a01-aggregate-subject-cohort-answer-check.mjs';

const fixedQuery = A01_AGGREGATE_EXPECTED_ARGUMENTS.cohort.query;

function metric(key: string, value: number, state = 'complete') {
  return {
    key,
    label: key,
    sourceField: key,
    averages: [value],
    validCounts: [1],
    partialCounts: [0],
    missingCounts: [0],
    conflictCounts: [0],
    notComputableCounts: [0],
    state,
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
        subjects: [],
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
        },
      },
    ],
    metrics: [
      metric('score', 7.25),
      metric('heat', 123.5, 'partial'),
      metric('episodesReported', 12),
      metric('ratingStandardDeviation', 1.125),
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
});
