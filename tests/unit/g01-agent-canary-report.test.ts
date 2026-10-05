import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/research/run92-g01-agent-mcp-canary-2026-10-05.json'),
    'utf8',
  ),
);

describe('G01 historical Candidate A Agent/MCP canary report', () => {
  it('binds the historical public query to its exact Candidate and catalog', () => {
    expect(report.candidate).toMatchObject({
      sha: '8d04647e97b4f66143d90824906ed02f34bc1a31',
      baseSha: '87f1fc6c0a36adfb8d62a831947ee4a707a4c724',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      agentImageRevision: '8d04647e97b4f66143d90824906ed02f34bc1a31',
      cliVersion: '1.2.14',
    });
    expect(report.call).toMatchObject({
      tool: 'bangumi.query_subjects',
      completedBangumiToolCalls: 1,
      onlyAllowedToolCompleted: true,
      argumentsMatchExpectedScope: true,
      queryScope: { media: 'anime', year: 2026, month: 7, exactConcept: '后宫' },
    });
  });

  it('records the historical v2 row counters without crediting final answer acceptance', () => {
    expect(report.textProjection).toMatchObject({
      readBackInAgentEventStream: true,
      utf8Bytes: 3523,
      maxUtf8Bytes: 3600,
      returnedRows: 14,
      omittedFromText: 0,
      totalKind: 'estimated',
      experimentalSourceWarningPresent: true,
    });
    expect(report.answerCheck).toMatchObject({
      method: 'ordered-source-row-identity-and-bounds-v2',
      rowsMatched: 14,
      answerRowsAccountForVisibleResultCount: true,
      explicitCountPatternMatched: false,
      missingRows: 0,
      mismatchedRows: 0,
      unmatchedRows: 0,
      duplicateAnswerRows: 0,
      rowOrderPreserved: true,
      exactTagScopeDisclosurePresent: true,
      monthScopeDisclosurePresent: true,
      animeScopeDisclosurePresent: true,
      boundedCoverageDisclosurePresent: true,
      experimentalSourceDisclosurePresent: true,
      estimatedTotalDisclosurePresent: true,
      nonExhaustiveDisclosurePresent: true,
      unsupportedCompletenessClaim: false,
      unsupportedAbsenceClaim: false,
      passed: true,
    });
  });

  it('supersedes the v2 result after review findings without claiming a second read', () => {
    expect(report.passBasis).toContain('Historical Candidate A checker-v2');
    expect(report.passBasis).toContain('not final G01 answer acceptance');
    expect(report.acceptanceReassessment).toMatchObject({
      initialMethodPassed: false,
      initialFalseCheck: 'separate count phrase matcher',
      reassessmentMethod: 'ordered-source-row-identity-and-bounds-v2',
      reassessedFromSanitizedCountersOnly: true,
      rawAnswerReprocessed: false,
      secondPublicCall: false,
    });
    expect(report.structuredContentEvidence).toMatchObject({
      separateFieldExposedInAgentEventStream: false,
      liveFullObjectReadback: 'NOT_EXPOSED_BY_ANTIGRAVITY_EVENT_STREAM',
    });
    expect(report.correctiveChecker).toMatchObject({
      method: 'ordered-source-row-identity-and-bounds-v4',
      reviewFindingsAddressed: ['R93-01', 'R93-02', 'R93-03', 'R93-04'],
      validationScope: 'synthetic fixtures and regressions only',
      historicalLiveAnswerReprocessed: false,
      secondPublicCall: false,
    });
    expect(report.acceptanceReassessment.limitation).toContain(
      'raw answer/result were not retained',
    );
    expect(report.frontierStatus).toBe('PARTIAL');
    expect(report.capturedCheckerPassed).toBe(true);
    expect(report.passed).toBe(false);
    expect(report.reviewDisposition).toMatchObject({
      status: 'SUPERSEDED_BY_REVIEW_FINDINGS',
      capturedCheckerMethod: 'ordered-source-row-identity-and-bounds-v2',
      findings: ['R93-01', 'R93-02', 'R93-03', 'R93-04'],
      capturedCheckerPassCreditedAsFinalAnswerAcceptance: false,
      rawAnswerOrMcpResultAvailableForReassessment: false,
      currentV4ReadRequired: true,
      currentV4ReadPerformed: false,
    });
  });

  it('contains no answer prose or row identities', () => {
    const serialized = JSON.stringify(report);
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('rows');
    expect(report).not.toHaveProperty('rawMcpResult');
    expect(serialized).not.toContain('作品甲');
    expect(serialized).not.toContain('1001');
  });
});
