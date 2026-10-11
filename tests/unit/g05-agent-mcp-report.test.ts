import { describe, expect, it } from 'vitest';
import { buildG05SanitizedReport } from '../../scripts/acceptance/write-g05-person-activity-comparison-report.mjs';

function answerResult() {
  return {
    passed: true,
    answerChecks: { exactSingleToolCall: true, boundedCoverageConsistent: true },
    answerCounters: { sourceRows: 1, answerRows: 1, rowsMatched: 1, missingRows: 0, extraRows: 0 },
    resultSummary: {
      personId: 13684,
      kind: 'voice',
      media: 'tv',
      state: 'partial',
      comparisonState: 'partial',
      window: { months: 6, start: '2026-05-01', end: '2026-10-11', monthKeys: ['2026-05'], asOfSemantics: 'calendar_months_ending_on_as_of_date' },
      recent: { state: 'partial', window: { start: '2026-05-01', end: '2026-10-11' }, summary: { creditRows: 1 }, coverage: { rowsEligible: 1 } },
      previous: { state: 'partial', window: { start: '2025-11-01', end: '2026-04-30' }, summary: { creditRows: 2 }, coverage: { rowsEligible: 2 } },
      delta: { state: 'partial', creditRows: -1 },
      peak: { metric: 'uniqueSubjects', state: 'partial', months: [{ period: 'previous', month: '2026-04', uniqueSubjects: 2 }] },
      rowCount: 1,
      rowDigest: 'a'.repeat(64),
      sourceOperations: {
        recent: { 'GET /v0/persons/{person_id}': { attempted: 1, succeeded: 1, failed: 0 } },
        previous: { 'GET /v0/persons/{person_id}': { attempted: 1, succeeded: 1, failed: 0 } },
      },
    },
    resultByteLength: 2048,
    resultSha256: 'b'.repeat(64),
    answerUtf8Bytes: 1024,
    answerSha256: 'c'.repeat(64),
  };
}

function input() {
  return {
    reviewerId: 'gpt-6-luna-max-run95-pr130-round1',
    codexCliVersion: '0.162.0',
    sourceRevision: 'd'.repeat(40),
    baseSha: 'e'.repeat(40),
    prNumber: 130,
    bundleSha256: 'f'.repeat(64),
    toolTextUtf8Bytes: 3218,
  };
}

const hashes = {
  catalogSha256: '1'.repeat(64),
  toolDescriptionSha256: '2'.repeat(64),
  inputSchemaSha256: '3'.repeat(64),
};

describe('G05 sanitized Agent/MCP report', () => {
  it('records the exact candidate and bounded comparison without persisting payloads', () => {
    const report = buildG05SanitizedReport(input(), answerResult(), hashes, '2026-10-11T08:00:00.000Z');
    expect(report).toMatchObject({
      evidenceKind: 'codex_cli_g05_person_activity_comparison_agent_mcp',
      runNumber: 95,
      frontierId: 'G05',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      sourceRevision: 'd'.repeat(40),
      baseSha: 'e'.repeat(40),
      prNumber: 130,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
    });
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('toolOutput');
    expect(report).not.toHaveProperty('prompt');
    expect(JSON.stringify(report)).not.toContain('测试动画');
    expect((report.privacy as Record<string, unknown>).communityRead).toBe(false);
  });

  it('rejects summaries containing raw rows and any failed answer check', () => {
    const raw = answerResult();
    (raw.resultSummary as Record<string, unknown>).rows = [{ subjectId: 123, title: '测试动画' }];
    expect(() => buildG05SanitizedReport(input(), raw, hashes, '2026-10-11T08:00:00.000Z'))
      .toThrow(/passing checks and exact reviewed Candidate metadata/u);

    const failed = answerResult();
    failed.answerChecks.exactSingleToolCall = false;
    expect(() => buildG05SanitizedReport(input(), failed, hashes, '2026-10-11T08:00:00.000Z'))
      .toThrow(/passing checks and exact reviewed Candidate metadata/u);
  });
});
