import { describe, expect, it } from 'vitest';
import {
  P07_ANSWER_CHECK_FIELDS,
  P07_CANONICAL_CAVEAT,
  P07_EXPECTED_ARGUMENTS,
  summarizeP07PersonActivityToolResult,
  validateP07McpTextProjection,
  verifyP07PersonSeasonAnswer,
} from '../../scripts/lib/p07-person-season-evidence.mjs';

function fixture() {
  return {
    personId: 3474,
    kind: 'staff',
    media: 'anime',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-10-01',
      end: '2026-10-15',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      { subjectId: 101, firstAirDate: '2024-01-10', name: 'sensitive title one' },
      { subjectId: 102, firstAirDate: '2024-03-31', name: 'sensitive title two' },
      { subjectId: 103, firstAirDate: '2024-04-01', name: 'sensitive title three' },
    ],
    coverage: {
      relationRowsObserved: 24,
      relationRowsSelected: 24,
      relationRowsDroppedAtLimit: 0,
      sampled: false,
      subjectDetailRequests: 8,
      subjectDetailsSucceeded: 8,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 3,
      rowsReturned: 3,
      missingDateRows: 1,
      invalidDateRows: 1,
      outputTruncated: false,
      truncated: false,
      retrievedAt: '2026-10-16T02:00:00.000Z',
    },
  };
}

describe('P07 observed calendar-quarter activity evidence', () => {
  it('derives quarter counts from valid returned dates and excludes raw rows', () => {
    const summary = summarizeP07PersonActivityToolResult(fixture());
    expect(summary).toMatchObject({
      personId: 3474,
      kind: 'staff',
      media: 'anime',
      state: 'partial',
      datedRowsObserved: 3,
      quarterDistribution: [
        { quarter: '2024-Q1', count: 2 },
        { quarter: '2024-Q2', count: 1 },
      ],
      mostObservedQuarters: ['2024-Q1'],
      maxQuarterCount: 2,
      coverage: { missingDateRows: 1, invalidDateRows: 1, rowsReturned: 3 },
      caveat: P07_CANONICAL_CAVEAT,
    });
    expect(summary).not.toHaveProperty('rows');
    expect(JSON.stringify(summary)).not.toContain('sensitive title');
    expect(JSON.stringify(summary)).not.toContain('subjectId');
  });

  it('accepts only an exact answer copied from the sanitized result summary', () => {
    const summary = summarizeP07PersonActivityToolResult(fixture());
    const verdict = verifyP07PersonSeasonAnswer(JSON.stringify(summary), summary);
    expect(verdict.passed).toBe(true);
    expect(Object.keys(verdict.answerChecks).sort()).toEqual([...P07_ANSWER_CHECK_FIELDS].sort());
  });

  it('rejects extra tag or career-completeness claims', () => {
    const summary = summarizeP07PersonActivityToolResult(fixture());
    const answer = { ...summary, tags: ['fictional'], completeCareer: true };
    const verdict = verifyP07PersonSeasonAnswer(answer, summary);
    expect(verdict.passed).toBe(false);
    expect(verdict.answerChecks.validJsonShape).toBe(false);
  });

  it('rejects incorrect quarter counts, coverage, or caveats', () => {
    const summary = summarizeP07PersonActivityToolResult(fixture());
    if (!summary) throw new Error('Expected the fixed P07 fixture to produce a summary.');
    expect(
      verifyP07PersonSeasonAnswer(
        { ...summary, quarterDistribution: [{ quarter: '2024-Q2', count: 3 }] },
        summary,
      ).passed,
    ).toBe(false);
    expect(
      verifyP07PersonSeasonAnswer(
        { ...summary, coverage: { ...summary.coverage, rowsReturned: 2 } },
        summary,
      ).passed,
    ).toBe(false);
    expect(
      verifyP07PersonSeasonAnswer({ ...summary, caveat: 'complete career' }, summary).passed,
    ).toBe(false);
  });

  it('keeps all tied calendar quarters in the exact source order', () => {
    const tied = fixture();
    tied.rows = [
      { subjectId: 201, firstAirDate: '2024-01-10', name: 'tied fixture one' },
      { subjectId: 202, firstAirDate: '2024-04-10', name: 'tied fixture two' },
      { subjectId: 203, firstAirDate: '2024-07-10', name: 'tied fixture three' },
    ];
    const summary = summarizeP07PersonActivityToolResult(tied);
    expect(summary).toMatchObject({
      datedRowsObserved: 3,
      quarterDistribution: [
        { quarter: '2024-Q1', count: 1 },
        { quarter: '2024-Q2', count: 1 },
        { quarter: '2024-Q3', count: 1 },
      ],
      mostObservedQuarters: ['2024-Q1', '2024-Q2', '2024-Q3'],
      maxQuarterCount: 1,
    });
  });

  it('preserves partial and truncation coverage without implying completeness', () => {
    const sampled = fixture();
    sampled.coverage.relationRowsObserved = 28;
    sampled.coverage.relationRowsSelected = 24;
    sampled.coverage.relationRowsDroppedAtLimit = 4;
    sampled.coverage.rowsEligible = 4;
    sampled.coverage.sampled = true;
    sampled.coverage.outputTruncated = true;
    sampled.coverage.truncated = true;
    const summary = summarizeP07PersonActivityToolResult(sampled);
    expect(summary?.state).toBe('partial');
    expect(summary?.coverage).toMatchObject({
      relationRowsObserved: 28,
      relationRowsSelected: 24,
      relationRowsDroppedAtLimit: 4,
      sampled: true,
      outputTruncated: true,
      truncated: true,
    });
    expect(verifyP07PersonSeasonAnswer(summary, summary).passed).toBe(true);
  });

  it('fails closed for wrong arguments, source identity, or no usable dates', () => {
    expect(
      summarizeP07PersonActivityToolResult(fixture(), { ...P07_EXPECTED_ARGUMENTS, kind: 'voice' }),
    ).toBeNull();
    expect(summarizeP07PersonActivityToolResult({ ...fixture(), personId: 1040 })).toBeNull();
    const noDates = fixture();
    noDates.rows = noDates.rows.map((row) => ({ ...row, firstAirDate: 'invalid' }));
    expect(summarizeP07PersonActivityToolResult(noDates)).toBeNull();
    const outsideWindow = fixture();
    outsideWindow.rows[0]!.firstAirDate = '2023-09-30';
    expect(summarizeP07PersonActivityToolResult(outsideWindow)).toBeNull();
    expect(summarizeP07PersonActivityToolResult({ ...fixture(), state: 'unavailable' })).toBeNull();
  });

  it('validates the sanitized MCP text projection without retaining raw rows', () => {
    const summary = summarizeP07PersonActivityToolResult(fixture());
    expect(validateP07McpTextProjection(JSON.stringify(summary), summary).passed).toBe(true);
    const altered = { ...summary, maxQuarterCount: 9 };
    expect(validateP07McpTextProjection(JSON.stringify(altered), summary).passed).toBe(false);
  });
});
