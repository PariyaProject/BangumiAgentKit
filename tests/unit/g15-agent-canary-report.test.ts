import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/research/run92-g15-subject-comparison-agent-canary-2026-10-05.json'),
    'utf8',
  ),
);

describe('G15 historical Candidate A Agent/MCP canary report', () => {
  it('binds the historical read to its exact Candidate, Base, catalog, and Agent image', () => {
    expect(report.candidate).toMatchObject({
      sha: '79458fe4801257a284072cb308b1700e6a657522',
      baseSha: 'b769efcc6394fcb703d0cc1f3c98d251c4767a8c',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      agentImageRevision: '79458fe4801257a284072cb308b1700e6a657522',
      cliVersion: '1.2.14',
    });
    expect(report.call).toMatchObject({
      tool: 'bangumi.get_subject_comparison',
      completedBangumiToolCalls: 1,
      onlyAllowedToolCompleted: true,
      argumentsMatchExpectedScope: true,
      subjectIds: [400602, 420628],
    });
  });

  it('records bounded historical readback counters without claiming final answer acceptance', () => {
    expect(report.textProjection).toMatchObject({
      readBackInAgentEventStream: true,
      utf8Bytes: 3476,
      maxUtf8Bytes: 3600,
      sizeWithinBound: true,
    });
    expect(report.answerCheck).toMatchObject({
      sourceSubjectIdentitiesMatch: true,
      subjectIdentityRowsExpected: 2,
      subjectIdentityRowsMatched: 2,
      subjectIdentityRowsUnmatched: 0,
      identityOrderPreserved: true,
      expectedMetricRows: 4,
      metricRowsMatched: 4,
      missingMetricRows: 0,
      mismatchedMetricRows: 0,
      metricStatesPreserved: true,
      currentOfficialV0DisclosurePresent: true,
      currentSnapshotDisclosurePresent: true,
      noHistoricalTrendClaimPresent: true,
      deltaDirectionDisclosurePresent: true,
      completionFormulaDisclosurePresent: true,
      notPersonalWatchProgressDisclosurePresent: true,
      boundedOverlapDisclosurePresent: true,
      omissionNotAbsenceDisclosurePresent: true,
      unsupportedClaimPresent: false,
      passed: true,
    });
    expect(report.frontierStatus).toBe('PARTIAL');
    expect(report.capturedCheckerPassed).toBe(true);
    expect(report.passed).toBe(false);
    expect(report.passBasis).toBe(
      'Historical checker-v1 result only; superseded by review findings and not final answer acceptance.',
    );
    expect(report.reviewDisposition).toMatchObject({
      status: 'SUPERSEDED_BY_REVIEW_FINDINGS',
      capturedCheckerMethod: 'ordered-two-subject-metric-identity-and-caveat-v1',
      findings: ['G15-R2', 'G15-R3'],
      capturedCheckerPassCreditedAsFinalAnswerAcceptance: false,
      rawAnswerOrMcpResultAvailableForReassessment: false,
      freshCorrectedCandidateReadRequired: true,
      freshCorrectedCandidateReadPerformed: false,
    });
  });

  it('states the structuredContent and retention limits and contains no raw canary content', () => {
    expect(report.structuredContentEvidence).toMatchObject({
      separateFieldExposedInAgentEventStream: false,
      preservationRegressionPassed: true,
      liveFullObjectReadback: 'NOT_EXPOSED_BY_ANTIGRAVITY_EVENT_STREAM',
    });
    expect(report.probe).toMatchObject({
      cliProcessExitCode: 0,
      resultStatus: 'SUCCESS',
      isolatedProbePassed: true,
      rawPromptAnswerAndMcpResultPersisted: false,
    });
    const serialized = JSON.stringify(report);
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('rawMcpResult');
    expect(serialized).not.toContain('8.6');
    expect(serialized).not.toContain('7.5');
    expect(serialized).not.toContain('42%');
    expect(serialized).not.toContain('条目｜400602｜名称');
  });
});
