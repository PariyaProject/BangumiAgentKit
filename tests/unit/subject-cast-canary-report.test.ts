import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const report = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/research/run89-g06-cast-agent-canary-2026-10-05.json'),
    'utf8',
  ),
);

describe('G06 current-candidate cast canary report', () => {
  it('binds the bounded answer check to one exact-candidate public cast call', () => {
    expect(report.candidate).toMatchObject({
      sha: 'fc59f8c05cae0a03f751bc26c221dbe34147d1d3',
      baseSha: '937488cd88623a3aa201a4838bdfe4a4791a557e',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      agentImageRevision: 'fc59f8c05cae0a03f751bc26c221dbe34147d1d3',
      cliVersion: '1.2.14',
    });
    expect(report.call).toEqual({
      tool: 'bangumi.get_subject_cast',
      completedBangumiToolCalls: 1,
      onlyAllowedToolCompleted: true,
      subjectId: 218707,
      limit: 100,
    });
    expect(report.textProjection).toMatchObject({
      readBackInAgentEventStream: true,
      utf8Bytes: 1373,
      maxUtf8Bytes: 3600,
      castRowsReturned: 7,
      castRowsIncluded: 4,
      castRowsOmittedFromText: 3,
      actorRowsReturned: 7,
      actorRowsIncluded: 4,
      actorRowsOmittedFromText: 3,
    });
    expect(report.answerCheck).toMatchObject({
      visibleCastRowsCount: 4,
      castRowsMatchedCount: 4,
      characterActorPairsMatchedCount: 4,
      rawRelationLabelsMatchedCount: 4,
      boundedCoverageDisclosurePresent: true,
      omissionNotAbsencePresent: true,
      unsupportedCompletenessClaim: false,
      unsupportedAbsenceClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
  });

  it('distinguishes text-stream evidence from structured-content preservation evidence', () => {
    expect(report.structuredContentEvidence).toMatchObject({
      separateFieldExposedInAgentEventStream: false,
      preservationRegressionPassed: true,
      liveFullObjectSubsetReadback: 'NOT_EXPOSED_BY_ANTIGRAVITY_EVENT_STREAM',
    });
    expect(report.frontierStatus).toBe('PARTIAL');
  });

  it('contains only sanitized metadata and answer-check counters', () => {
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('rows');
    expect(report).not.toHaveProperty('rawMcpResult');
    expect(report).not.toHaveProperty('characterNames');
    expect(report).not.toHaveProperty('actorNames');
  });
});
