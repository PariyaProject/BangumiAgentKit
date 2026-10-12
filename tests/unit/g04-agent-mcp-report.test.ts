import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  G04_EXPECTED_QUERY_ARGUMENTS,
  G04_REQUIRED_CAVEAT,
  verifyG04PersonActivityAnswer,
} from '../../scripts/acceptance/g04-person-activity-answer-check.mjs';
import {
  buildG04RunnerReceiptPayload,
  createG04RunnerReceipt,
  generateG04RunnerReceiptKeyPair,
  g04RunnerPublicKeySha256,
} from '../../scripts/acceptance/g04-runner-receipt.mjs';
import { buildG04AgentMcpReport } from '../../scripts/acceptance/write-g04-agent-mcp-report.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const bundle = 'c'.repeat(64);
const toolName = 'bangumi.get_person_activity';
const epochId = 'run95-g04-person-activity-global-one-shot-latch';
const prNumber = 136;
const reviewerId = 'gpt-6-luna-max-run95-pr136-round1';
const receiptKeyPair = generateG04RunnerReceiptKeyPair();
const claimId = 'g04-run-95-pr-136-aaaaaaaaaaaa-123';
const canonicalJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value as Record<string, unknown>)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
          )
          .join(',')}}`
      : JSON.stringify(value);
const expectedArgumentsSha256 = createHash('sha256')
  .update(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS))
  .digest('hex');

type G04ReportInput = Record<string, unknown> & {
  claimId: string;
  runnerReceiptPublicKey: string;
  answer: string;
  queryArguments: typeof G04_EXPECTED_QUERY_ARGUMENTS;
  toolOutput: { structuredContent: Record<string, unknown> };
  toolCalls: Array<{
    name: string;
    state: string;
    arguments: typeof G04_EXPECTED_QUERY_ARGUMENTS;
  }>;
  toolTextUtf8Bytes: number;
  reviewerId: string;
  runnerReceipt?: ReturnType<typeof createG04RunnerReceipt>;
  candidateGate: Record<string, unknown> & { reviewerId: string };
};

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
    caveat: G04_REQUIRED_CAVEAT,
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
  const fixtureValue = {
    run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: prNumber } },
    input: {
      claimId,
      runnerReceiptPublicKey: receiptKeyPair.publicKeyBase64,
      runnerEventStreamSha256: 'e'.repeat(64),
      runnerServerSummarySha256: 'f'.repeat(64),
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
      candidateGate: {
        candidateSha: candidate,
        baseSha: base,
        ciSha: candidate,
        ciStatus: 'SUCCESS',
        reviewPassSha: candidate,
        reviewVerdict: 'PASS',
        reviewerId,
      },
    } as G04ReportInput,
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
          adversarial_preflight: {
            g04_one_shot_disposition: {
              claimId,
              frontierId: 'G04',
              epochId,
              runNumber: 95,
              state: 'CLAIMED',
              sourceCandidateSha: candidate,
              baseSha: base,
              ciSha: candidate,
              ciStatus: 'SUCCESS',
              bundleSha256: bundle,
              prNumber,
              reviewerId,
              model: 'gpt-6-luna',
              reasoningEffort: 'max',
              toolName,
              argumentProfile: 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1',
              expectedArgumentsSha256,
              runnerReceiptPublicKey: receiptKeyPair.publicKeyBase64,
              runnerReceiptPublicKeySha256: g04RunnerPublicKeySha256(
                receiptKeyPair.publicKeyBase64,
              ),
              retryAllowed: false,
            },
          },
        },
      },
    },
  };
  const answerResult = verifyG04PersonActivityAnswer(
    fixtureValue.input.answer,
    fixtureValue.input.queryArguments,
    fixtureValue.input.toolOutput,
    fixtureValue.input.toolCalls,
    fixtureValue.input.toolTextUtf8Bytes,
  );
  fixtureValue.input.runnerReceipt = createG04RunnerReceipt(
    buildG04RunnerReceiptPayload(fixtureValue.input, answerResult),
    receiptKeyPair,
  );
  return fixtureValue;
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
      claimId,
      codexErrorItemCount: 3,
      runnerEventStreamSha256: 'e'.repeat(64),
      runnerServerSummarySha256: 'f'.repeat(64),
      resultSummary: { personId: 13684, state: 'partial', rowCount: 1 },
      runnerReceipt: { kind: 'g04-runner-acceptance-receipt-v1' },
    });
    const saved = JSON.stringify(output.report);
    expect(saved).not.toMatch(/验收夹具标题|Fixture character|主役|本次有界观察/u);
    expect(saved).not.toMatch(/"answer"|"toolOutput"|"prompt"/u);
    expect(saved).toContain('answerSha256');
  });

  it('does not write a complete report with missing-date coverage', () => {
    const { input, liveStatus } = fixture();
    const result = input.toolOutput.structuredContent;
    result.state = 'complete';
    const coverage = result.coverage as Record<string, unknown>;
    coverage.missingDateRows = 1;
    const summaryOrigin = {
      explicitOriginalSubjects: 1,
      notObservedSubjects: 0,
      unknownSubjects: 0,
    };
    coverage.origin = {
      ...summaryOrigin,
      subjectsObserved: 1,
      subjectsWithMetaTags: 1,
      subjectsPartial: 0,
      subjectsUnknown: 0,
      tagsObserved: 2,
      tagsValid: 2,
      tagsReturned: 2,
      tagsOmitted: 0,
      malformedTagValues: 0,
      textTruncatedTags: 0,
      truncatedSubjects: 0,
      truncated: false,
      maxTagsPerSubject: 32,
      maxTagCharacters: 96,
      responseLimitBytes: 1_048_576,
    };
    Object.assign(result.summary as Record<string, unknown>, { origin: summaryOrigin });
    Object.assign(result, { warnings: [] });
    const sourceRow = (result.rows as Array<Record<string, unknown>>)[0];
    if (!sourceRow) throw new Error('Expected the report fixture row.');
    sourceRow.roleFamily = 'main';
    sourceRow.origin = {
      state: 'explicit_original',
      metaTags: ['原创', '奇幻'],
      metaTagsCoverage: {
        state: 'complete',
        observed: 2,
        valid: 2,
        returned: 2,
        omitted: 0,
        malformed: 0,
        textTruncated: 0,
        truncated: false,
        maxItems: 32,
        maxCharacters: 96,
      },
    };

    const answer = JSON.parse(input.answer) as Record<string, unknown>;
    answer.state = 'complete';
    const answerCoverage = answer.coverage as Record<string, unknown>;
    answerCoverage.missingDateRows = 1;
    const answerRow = (answer.rows as Array<Record<string, unknown>>)[0];
    if (!answerRow) throw new Error('Expected the answer fixture row.');
    answerRow.roleFamily = 'main';
    input.answer = JSON.stringify(answer);

    const verification = verifyG04PersonActivityAnswer(
      input.answer,
      input.queryArguments,
      input.toolOutput,
      input.toolCalls,
      input.toolTextUtf8Bytes,
    );
    expect(verification.answerChecks.boundedCoverageConsistent).toBe(false);
    expect(verification.passed).toBe(false);
    expect(buildG04AgentMcpReport(input, { liveStatus }).passed).toBe(false);
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

    const missingReceipt = structuredClone(input) as Record<string, unknown>;
    delete missingReceipt.runnerReceipt;
    expect(buildG04AgentMcpReport(missingReceipt, { liveStatus }).passed).toBe(false);

    const malformedKeyStatus = structuredClone(liveStatus);
    malformedKeyStatus.epoch.state.adversarial_preflight.g04_one_shot_disposition.runnerReceiptPublicKey =
      '%%%';
    const malformedKeyInput = structuredClone(input);
    malformedKeyInput.runnerReceiptPublicKey = '%%%';
    expect(() =>
      buildG04AgentMcpReport(malformedKeyInput, { liveStatus: malformedKeyStatus }),
    ).not.toThrow();
    expect(
      buildG04AgentMcpReport(malformedKeyInput, { liveStatus: malformedKeyStatus }).passed,
    ).toBe(false);

    const callerKey = generateG04RunnerReceiptKeyPair();
    const callerForged = {
      ...input,
      runnerReceiptPublicKey: callerKey.publicKeyBase64,
    };
    const callerAnswerResult = verifyG04PersonActivityAnswer(
      callerForged.answer,
      callerForged.queryArguments,
      callerForged.toolOutput,
      callerForged.toolCalls,
      callerForged.toolTextUtf8Bytes,
    );
    callerForged.runnerReceipt = createG04RunnerReceipt(
      buildG04RunnerReceiptPayload(callerForged, callerAnswerResult),
      callerKey,
    );
    expect(buildG04AgentMcpReport(callerForged, { liveStatus }).passed).toBe(false);

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
    const currentReviewerId = 'gpt-6-luna-max-run95-pr136-round2';
    currentRound.epoch.state.review_history[0]!.reviewer_id = currentReviewerId;
    currentRound.epoch.state.adversarial_preflight.g04_one_shot_disposition.reviewerId =
      currentReviewerId;
    const currentInput = structuredClone(input);
    currentInput.reviewerId = currentReviewerId;
    currentInput.candidateGate.reviewerId = currentReviewerId;
    const answerResult = verifyG04PersonActivityAnswer(
      currentInput.answer,
      currentInput.queryArguments,
      currentInput.toolOutput,
      currentInput.toolCalls,
      currentInput.toolTextUtf8Bytes,
    );
    currentInput.runnerReceipt = createG04RunnerReceipt(
      buildG04RunnerReceiptPayload(currentInput, answerResult),
      receiptKeyPair,
    );
    expect(buildG04AgentMcpReport(currentInput, { liveStatus: currentRound }).passed).toBe(true);

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
