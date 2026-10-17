import { describe, expect, it } from 'vitest';
import {
  S05_ANSWER_CHECK_FIELDS,
  S05_CANONICAL_CAVEAT,
  S05_EXPECTED_ARGUMENTS,
  summarizeS05PersonActivityToolResult,
  validateS05McpTextProjection,
  validateS05PersonActivitySummary,
  verifyS05PersonActivityAnswer,
} from '../../scripts/lib/s05-person-activity-evidence.mjs';

function fixture() {
  return {
    personId: 3474,
    kind: 'voice',
    media: 'anime',
    state: 'partial',
    window: {
      months: 6,
      start: '2026-05-01',
      end: '2026-10-17',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      {
        subjectId: 101,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-06-10',
        platform: 'OVA',
        subjectName: 'private title one',
      },
      {
        subjectId: 101,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-06-10',
        platform: 'OVA',
        subjectName: 'private title one',
      },
      {
        subjectId: 102,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-07-12',
        platform: 'TV',
        subjectName: 'private title two',
      },
      {
        subjectId: 103,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-09-05',
        platform: 'unclassified platform',
        subjectName: 'private title three',
      },
    ],
    coverage: {
      relationRowsObserved: 60,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 12,
      sampled: true,
      subjectDetailRequests: 16,
      subjectDetailsSucceeded: 16,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 4,
      rowsReturned: 4,
      missingDateRows: 1,
      invalidDateRows: 0,
      outputTruncated: false,
      truncated: true,
      retrievedAt: '2026-10-17T05:00:00.000Z',
    },
  };
}

describe('S05 positive non-TV activity evidence', () => {
  it('deduplicates works and returns only bounded counts, dates, and coverage', () => {
    const summary = summarizeS05PersonActivityToolResult(fixture());
    expect(summary).toMatchObject({
      state: 'partial',
      window: {
        months: 6,
        start: '2026-05-01',
        end: '2026-10-17',
      },
      activityRowsReturned: 4,
      uniqueSubjectsObserved: 3,
      platformCounts: { tv: 1, nonTv: 1, unknown: 1 },
      nonTvObservationDates: ['2026-06-10'],
      sourceCompleteness: 'undocumented',
      conclusion: 'positive_non_tv_observation_in_bounded_sample',
      exclusivityConclusion: 'not_established',
      careerCompletenessConclusion: 'not_established',
      caveat: S05_CANONICAL_CAVEAT,
    });
    expect(JSON.stringify(summary)).not.toContain('private title');
    expect(JSON.stringify(summary)).not.toContain('subjectId');
    expect(summary).not.toHaveProperty('personId');
  });

  it('accepts only an exact positive-only answer matching the safe projection', () => {
    const summary = summarizeS05PersonActivityToolResult(fixture());
    if (!summary) throw new Error('Expected the fixed S05 fixture to produce a summary.');
    const verdict = verifyS05PersonActivityAnswer(JSON.stringify(summary), summary);
    expect(verdict.passed).toBe(true);
    expect(Object.keys(verdict.answerChecks).sort()).toEqual([...S05_ANSWER_CHECK_FIELDS].sort());
    expect(
      verifyS05PersonActivityAnswer({ ...summary, exclusivityConclusion: 'only_non_tv' }, summary)
        .passed,
    ).toBe(false);
    expect(verifyS05PersonActivityAnswer({ ...summary, personId: 3474 }, summary).passed).toBe(
      false,
    );
    expect(
      verifyS05PersonActivityAnswer(
        { ...summary, platformCounts: { ...summary.platformCounts, tv: 0 } },
        summary,
      ).passed,
    ).toBe(false);
  });

  it('rejects zero positive evidence rather than turning it into a negative conclusion', () => {
    const noPositive = fixture();
    noPositive.rows = noPositive.rows.filter((row) => row.platform === 'TV');
    noPositive.coverage.rowsEligible = 1;
    noPositive.coverage.rowsReturned = 1;
    expect(summarizeS05PersonActivityToolResult(noPositive)).toBeNull();
  });

  it('treats unknown platform classification as partial and preserves sampling limits', () => {
    const unknown = fixture();
    unknown.rows = [
      ...unknown.rows.filter((row) => row.platform === 'OVA'),
      {
        subjectId: 104,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-09-11',
        platform: '',
        subjectName: 'private fixture title',
      },
    ];
    unknown.coverage.rowsEligible = 3;
    unknown.coverage.rowsReturned = 3;
    const summary = summarizeS05PersonActivityToolResult(unknown);
    expect(summary?.state).toBe('partial');
    expect(summary?.platformCounts.unknown).toBe(1);
    expect(summary?.coverage).toMatchObject({
      sampled: true,
      relationRowsDroppedAtLimit: 12,
      missingDateRows: 1,
    });
  });

  it('fails closed for wrong identity, date window, relation type, platform conflicts, or coverage', () => {
    expect(
      summarizeS05PersonActivityToolResult(fixture(), {
        ...S05_EXPECTED_ARGUMENTS,
        kind: 'staff',
      }),
    ).toBeNull();
    expect(summarizeS05PersonActivityToolResult({ ...fixture(), personId: 100 })).toBeNull();

    const outsideWindow = fixture();
    outsideWindow.rows[0]!.firstAirDate = '2026-04-30';
    expect(summarizeS05PersonActivityToolResult(outsideWindow)).toBeNull();

    const wrongRelation = fixture();
    wrongRelation.rows[0]!.relationKind = 'staff';
    expect(summarizeS05PersonActivityToolResult(wrongRelation)).toBeNull();

    const conflictingSubject = fixture();
    conflictingSubject.rows[1]!.platform = 'TV';
    expect(summarizeS05PersonActivityToolResult(conflictingSubject)).toBeNull();

    const invalidCoverage = fixture();
    invalidCoverage.coverage.relationRowsDroppedAtLimit = -1;
    expect(summarizeS05PersonActivityToolResult(invalidCoverage)).toBeNull();
  });

  it('rejects contradictory complete state, malformed summaries, and altered MCP text', () => {
    const completeWithSampling = fixture();
    completeWithSampling.state = 'complete';
    expect(summarizeS05PersonActivityToolResult(completeWithSampling)).toBeNull();

    const valid = summarizeS05PersonActivityToolResult(fixture());
    if (!valid) throw new Error('Expected the fixed S05 fixture to produce a summary.');
    expect(validateS05PersonActivitySummary(valid)).toBe(true);
    expect(
      validateS05PersonActivitySummary({
        ...valid,
        careerCompletenessConclusion: 'complete',
      }),
    ).toBe(false);
    expect(validateS05McpTextProjection(JSON.stringify(valid), valid).passed).toBe(true);
    expect(
      validateS05McpTextProjection(JSON.stringify({ ...valid, conclusion: 'only_non_tv' }), valid)
        .passed,
    ).toBe(false);
  });
});
