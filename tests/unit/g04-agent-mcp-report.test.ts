import { describe, expect, it } from 'vitest';
import { G04_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/g04-person-activity-answer-check.mjs';
import { buildG04AgentMcpReport } from '../../scripts/acceptance/write-g04-agent-mcp-report.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const bundle = 'c'.repeat(64);
const toolName = 'bangumi.get_person_activity';
const epochId = 'run95-g04-person-activity-codex-current-evidence';
const prNumber = 136;
const reviewerId = 'gpt-6-luna-max-run95-pr136-round1';

function fixture() {
  const window = {
    months: 12,
    start: '2025-11-01',
    end: '2026-10-11',
    monthKeys: [
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ],
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  };
  const coverage = {
    relationRowsObserved: 1,
    relationRowsSelected: 1,
    relationRowsDroppedAtLimit: 0,
    subjectIdsObserved: 1,
    subjectIdsSelected: 1,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: 1,
    subjectDetailRequests: 1,
    subjectDetailsSucceeded: 1,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: 1,
    rowsReturned: 1,
    outputTruncated: false,
    uniqueSubjects: 1,
    uniqueCharacters: 1,
    missingSubjectIdRows: 0,
    missingDateRows: 0,
    invalidDateRows: 0,
    outsideWindowRows: 0,
    mediaExcludedRows: 0,
    mediaUnknownRows: 0,
    maxRelations: 48,
    maxSubjectDetails: 16,
    maxRows: 8,
    responseLimitBytes: 1_048_576,
    truncated: false,
  };
  const personActivity = {
    personId: 13684,
    state: 'partial',
    kind: 'voice',
    media: 'tv',
    window,
    rows: [
      {
        subjectId: 3001,
        subjectName: 'Example title',
        subjectNameCn: '验收夹具标题',
        subjectType: 'anime',
        platform: 'TV',
        firstAirDate: '2026-04-01',
        month: '2026-04',
        relationKind: 'voice',
        relationId: 7001,
        characterName: 'Fixture character',
        rawRole: '主役',
        roleFamily: 'unknown',
      },
    ],
    summary: { creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 1 },
    coverage,
    sourceOperations: [
      { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      {
        operation: 'GET /v0/persons/{person_id}/characters',
        attempted: 1,
        succeeded: 1,
        failed: 0,
      },
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
    ],
  };
  const answer = JSON.stringify({
    personId: 13684,
    kind: 'voice',
    media: 'tv',
    window,
    state: 'partial',
    observedUniqueWorks: 1,
    summary: personActivity.summary,
    coverage,
    rows: [
      {
        subjectId: 3001,
        title: '验收夹具标题',
        firstAirDate: '2026-04-01',
        month: '2026-04',
        relationId: 7001,
        characterName: 'Fixture character',
        rawRole: '主役',
        roleFamily: 'unknown',
      },
    ],
    caveat:
      '本次有界观察只反映当前官方响应，不代表全部作品；时间按作品首播日期归入12个日历月，不是滚动365天。未返回作品不等于不存在；不是实际配音时间或工作量；没有历史快照。',
  });
  const sourceOperations = personActivity.sourceOperations;
  const toolResultSummary = {
    toolName,
    resultType: 'object',
    resultState: 'partial',
    resultByteLength: 1000,
    resultSha256: 'd'.repeat(64),
    sourceOperations,
    artifact: { returned: false, persisted: false },
  };
  const review = {
    candidate_sha: candidate,
    reviewed_base_sha: base,
    verdict: 'PASS',
    reviewer_id: reviewerId,
  };
  return {
    run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: prNumber } },
    input: {
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexCliVersion: '1.2.3',
      processExitCode: 0,
      resultStatus: 'SUCCESS',
      eventStreamParsed: true,
      serverToolNames: [toolName],
      serverToolCount: 1,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 3,
      mcpServerNames: ['bgk_g04_one_tool'],
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      allowedCallCount: 1,
      deniedCallCount: 0,
      privacy: {
        authProfile: 'anonymous',
        oauthAttempted: false,
        accountDataRead: false,
        writesAttempted: false,
        qqPipelineTested: false,
        timClientTested: false,
        promptStored: false,
        answerStored: false,
        rawResultStored: false,
        artifactImageBytesStored: false,
        credentialsStored: false,
      },
      toolResultSummary,
      queryArguments: G04_EXPECTED_QUERY_ARGUMENTS,
      answer,
      toolOutput: { structuredContent: personActivity },
      toolCalls: [{ name: toolName, state: 'DONE', arguments: G04_EXPECTED_QUERY_ARGUMENTS }],
      toolTextUtf8Bytes: 2200,
      sourceRevision: candidate,
      baseSha: base,
      bundleSha256: bundle,
      prNumber,
      reviewerId: review.reviewer_id,
    },
    liveStatus: {
      run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: prNumber } },
      epoch: {
        number: prNumber,
        github_state: 'OPEN',
        state: {
          epoch_id: epochId,
          pr_number: prNumber,
          base_sha: base,
          reviewed_base_sha: base,
          candidate_sha: candidate,
          state: 'REVIEW_PASSED',
          ci: { sha: candidate, status: 'SUCCESS' },
          review_pass_sha: candidate,
          review_history: [review],
        },
      },
    },
  };
}

describe('G04 sanitized Agent/MCP report builder', () => {
  it('keeps exact-candidate evidence and counters while omitting answer, rows, names, and raw result', () => {
    const { input, liveStatus } = fixture();
    const output = buildG04AgentMcpReport(input, {
      observedAt: '2026-10-11T05:00:00.000Z',
      liveStatus,
    });

    expect(output.passed).toBe(true);
    expect(output.report).toMatchObject({
      evidenceKind: 'codex_cli_g04_person_activity_agent_mcp',
      sourceRevision: candidate,
      baseSha: base,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId,
      frontierId: 'G04',
      codexErrorItemCount: 3,
      resultSummary: { personId: 13684, state: 'partial', rowCount: 1 },
    });
    const saved = JSON.stringify(output.report);
    expect(saved).not.toMatch(/验收夹具标题|Fixture character|主役|本次有界观察/u);
    expect(saved).not.toMatch(/"answer"|"toolOutput"|"prompt"/u);
    expect(saved).toContain('answerSha256');
  });

  it('rejects a Sol model role and contaminated event counts', () => {
    const { input, liveStatus } = fixture();
    const wrongModel = buildG04AgentMcpReport({ ...input, model: 'gpt-6-sol' }, { liveStatus });
    expect(wrongModel.passed).toBe(false);

    const contaminated = buildG04AgentMcpReport(
      { ...input, nonMcpToolEventCount: 1 },
      { liveStatus },
    );
    expect(contaminated.passed).toBe(false);

    const missingErrorCount = structuredClone(input) as Record<string, unknown>;
    delete missingErrorCount.codexErrorItemCount;
    expect(buildG04AgentMcpReport(missingErrorCount, { liveStatus }).passed).toBe(false);

    const invalidErrorCount = buildG04AgentMcpReport(
      { ...input, codexErrorItemCount: -1 },
      { liveStatus },
    );
    expect(invalidErrorCount.passed).toBe(false);

    const unexpectedOperation = structuredClone(input);
    (
      unexpectedOperation.toolResultSummary as { sourceOperations: unknown[] }
    ).sourceOperations.push({
      operation: 'GET /v0/unexpected',
      attempted: 1,
      succeeded: 1,
      failed: 0,
    });
    expect(buildG04AgentMcpReport(unexpectedOperation, { liveStatus }).passed).toBe(false);

    const oversizedAnswer = structuredClone(input);
    oversizedAnswer.answer = `${oversizedAnswer.answer}${'x'.repeat(16_385)}`;
    expect(buildG04AgentMcpReport(oversizedAnswer, { liveStatus }).passed).toBe(false);
  });

  it('requires the exact latest Harness reviewer identity for the candidate and base', () => {
    const { input, liveStatus } = fixture();
    const mismatchedRound = structuredClone(liveStatus);
    mismatchedRound.epoch.state.review_history[0]!.reviewer_id =
      'gpt-6-luna-max-run95-pr136-round2';
    expect(buildG04AgentMcpReport(input, { liveStatus: mismatchedRound }).passed).toBe(false);

    const currentRound = structuredClone(liveStatus);
    currentRound.epoch.state.review_history[0]!.reviewer_id = 'gpt-6-luna-max-run95-pr136-round2';
    expect(
      buildG04AgentMcpReport(
        { ...input, reviewerId: 'gpt-6-luna-max-run95-pr136-round2' },
        { liveStatus: currentRound },
      ).passed,
    ).toBe(true);

    expect(buildG04AgentMcpReport({ ...input, prNumber: 128 }, { liveStatus }).passed).toBe(false);

    const stalePass = structuredClone(liveStatus);
    stalePass.epoch.state.review_history.push({
      candidate_sha: 'f'.repeat(40),
      reviewed_base_sha: base,
      verdict: 'PASS',
      reviewer_id: 'gpt-6-luna-max-run95-pr136-round2',
    });
    expect(buildG04AgentMcpReport(input, { liveStatus: stalePass }).passed).toBe(false);
  });
});
