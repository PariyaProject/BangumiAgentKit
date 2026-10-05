import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/research/run92-g01-agent-mcp-canary-2026-10-05.json'),
    'utf8',
  ),
);

describe('G01 current-candidate Agent/MCP canary report', () => {
  it('binds one public query to the exact Candidate and catalog', () => {
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

  it('verifies every visible row and all required scope disclosures', () => {
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

  it('documents the checker revision without claiming a second canary or full-object readback', () => {
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
    expect(report.frontierStatus).toBe('PARTIAL');
    expect(report.passed).toBe(true);
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
