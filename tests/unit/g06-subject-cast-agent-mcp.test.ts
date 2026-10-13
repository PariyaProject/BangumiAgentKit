import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalG06ArgumentsSha256,
  G06_EXPECTED_QUERY_ARGUMENTS,
  G06_REPORT_RELATIVE_PATH,
  G06_TOOL_NAME,
  verifyG06SubjectCastObservation,
} from '../../scripts/acceptance/g06-subject-cast-answer-check.mjs';
import {
  buildG06AgentMcpReport,
  G06_PRIVACY,
  validateG06SanitizedReportFile,
  writeG06AgentMcpReport,
} from '../../scripts/acceptance/write-g06-agent-mcp-report.mjs';
import {
  createG06RunnerReceipt,
  createG06RunnerReceiptKeyPair,
} from '../../scripts/acceptance/g06-runner-receipt.mjs';

const temporaryRoots: string[] = [];
const sourceRevision = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const bundleSha256 = 'c'.repeat(64);
const answer = [
  '主角｜合成角色｜合成声优',
  '范围：来源条目 218707；观察到 1 行，返回 1 条；没有分页参数，也没有总数；本次有限返回不保证完整；未返回或遗漏不代表不存在；不能推断主角、配角或重要性分类。',
].join('\n');
const castRow = {
  character: { id: 1, name: '合成角色' },
  relation: '主角',
  actors: [{ id: 2, name: '合成声优' }],
  actorCount: 1,
  actorsOmittedFromText: 0,
};
const toolOutput = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        status: 'ok',
        subjectId: 218707,
        observed: 1,
        returned: 1,
        truncated: false,
        schemaDriftRows: 0,
        invalidActorIdRows: 0,
        mcpTextProjection: { castRowsOmittedFromText: 0, actorRowsOmittedFromText: 0 },
        cast: [castRow],
      }),
    },
  ],
  structuredContent: {
    status: 'ok',
    subjectId: 218707,
    observed: 1,
    returned: 1,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    mcpTextProjection: { castRowsOmittedFromText: 0, actorRowsOmittedFromText: 0 },
    cast: [castRow],
  },
  isError: false,
};
const toolCalls = [
  {
    name: G06_TOOL_NAME,
    state: 'DONE',
    arguments: G06_EXPECTED_QUERY_ARGUMENTS,
    result: toolOutput,
  },
];

function makeInput(overrides = {}) {
  const serverSummary = {
    sourceRevision,
    bundleSha256,
    catalogSha256: '1'.repeat(64),
    toolDescriptionSha256: '2'.repeat(64),
    inputSchemaSha256: '3'.repeat(64),
    argumentMatch: true,
    expectedArgumentsSha256: canonicalG06ArgumentsSha256(),
    allowedCallCount: 1,
    deniedCallCount: 0,
    serverResultStatus: 'SUCCESS',
    privacy: { ...G06_PRIVACY },
  };
  const input = {
    claimId: 'g06-run-95-pr-170-abcdef123456-1791860000000',
    prNumber: 170,
    sourceRevision,
    baseSha,
    reviewerId: 'gpt-6-luna-max-run95-pr170-round1',
    bundleSha256,
    observedAt: '2026-10-13T03:00:00.000Z',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: 'test-fixture',
    processExitCode: 0,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    mcpServerNames: ['bgk_g06_one_tool'],
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    runtimeCandidateMatches: true,
    serverSummaryMatchesCandidate: true,
    serverPrivacyMatchesCandidate: true,
    serverSummary,
    toolCalls,
    answer,
    toolTextUtf8Bytes: Buffer.byteLength(toolOutput.content[0]!.text!, 'utf8'),
    ...overrides,
  };
  const keyPair = createG06RunnerReceiptKeyPair();
  const built = buildG06AgentMcpReport(input);
  return {
    ...input,
    receiptPublicKey: keyPair.receiptPublicKey,
    runnerReceipt: createG06RunnerReceipt(built.report, keyPair.privateKey),
  };
}

function temporaryRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-g06-agent-mcp-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('G06 subject-cast one-shot report boundary', () => {
  it('accepts exact source rows with the required bounded-coverage disclosures', () => {
    const result = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput,
      toolCalls,
      answer,
      toolTextUtf8Bytes: Buffer.byteLength(toolOutput.content[0]!.text!, 'utf8'),
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      Object.fromEntries(Object.keys(result.checks).map((key) => [key, true])),
    );
    expect(result.counters).toMatchObject({
      sourceRowsObserved: 1,
      sourceRowsReturned: 1,
      rowsUsedForAnswerCheck: 1,
      structuredContentReadbackAvailable: true,
      castRowsMatchedCount: 1,
      rawRelationLabelsMatchedCount: 1,
    });
  });

  it('requires an explicit unknown-truncation disclosure when the source omits that field', () => {
    const projected = JSON.parse(toolOutput.content[0]!.text!) as Record<string, unknown>;
    projected.truncated = null;
    const unknownTruncation = {
      ...toolOutput,
      content: [{ type: 'text' as const, text: JSON.stringify(projected) }],
      structuredContent: { ...toolOutput.structuredContent, truncated: null },
    };
    const withoutDisclosure = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: unknownTruncation,
      toolCalls: [{ ...toolCalls[0]!, result: unknownTruncation }],
      answer,
      toolTextUtf8Bytes: Buffer.byteLength(unknownTruncation.content[0]!.text!, 'utf8'),
    });
    const disclosed = answer.replace('本次有限返回', '截断状态未知；本次有限返回');
    const withDisclosure = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: unknownTruncation,
      toolCalls: [{ ...toolCalls[0]!, result: unknownTruncation }],
      answer: disclosed,
      toolTextUtf8Bytes: Buffer.byteLength(unknownTruncation.content[0]!.text!, 'utf8'),
    });

    expect(withoutDisclosure.passed).toBe(false);
    expect(withoutDisclosure.checks.truncationDisclosure).toBe(false);
    expect(withDisclosure.checks.truncationDisclosure).toBe(true);
  });

  it('rejects stale arguments and an answer that changes a source relation', () => {
    const stale = verifyG06SubjectCastObservation({
      queryArguments: { subjectId: 218707, limit: 99 },
      toolOutput,
      toolCalls,
      answer,
      toolTextUtf8Bytes: 200,
    });
    const mismatched = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput,
      toolCalls,
      answer: answer.replace('主角｜', '配角｜'),
      toolTextUtf8Bytes: 200,
    });

    expect(stale.passed).toBe(false);
    expect(stale.checks.exactArguments).toBe(false);
    expect(mismatched.passed).toBe(false);
    expect(mismatched.counters.unmatchedAnswerRowsCount).toBe(1);
  });

  it('allows only text-visible rows when structured readback is unavailable', () => {
    const textOnly = { ...toolOutput } as {
      content: typeof toolOutput.content;
      structuredContent?: typeof toolOutput.structuredContent;
      isError?: boolean;
    };
    delete textOnly.structuredContent;
    const result = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: textOnly,
      toolCalls: [{ ...toolCalls[0]!, result: textOnly }],
      answer,
      toolTextUtf8Bytes: Buffer.byteLength(textOnly.content[0]!.text!, 'utf8'),
    });

    expect(result.passed).toBe(true);
    expect(result.counters.structuredContentReadbackAvailable).toBe(false);
    expect(result.counters.rowsUsedForAnswerCheck).toBe(1);
  });

  it('requires an exact disclosure when MCP text omits cast rows', () => {
    const projected = {
      status: 'ok',
      subjectId: 218707,
      observed: 2,
      returned: 2,
      truncated: false,
      schemaDriftRows: 0,
      invalidActorIdRows: 0,
      mcpTextProjection: { castRowsOmittedFromText: 1, actorRowsOmittedFromText: 0 },
      cast: [castRow],
    };
    const output = {
      ...toolOutput,
      content: [{ type: 'text', text: JSON.stringify(projected) }],
      structuredContent: {
        ...projected,
        cast: [castRow, { ...castRow, character: { id: 3, name: '未读合成角色' } }],
      },
    };
    const disclosed = answer.replace('范围：', '范围：MCP文本视图省略 1 行；');
    const result = verifyG06SubjectCastObservation({
      queryArguments: G06_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: output,
      toolCalls: [{ ...toolCalls[0]!, result: output }],
      answer: disclosed,
      toolTextUtf8Bytes: Buffer.byteLength(output.content[0]!.text!, 'utf8'),
    });

    expect(result.passed).toBe(false);
    expect(result.checks.textProjectionOmissionDisclosure).toBe(true);
    expect(result.counters.missingCastRowsCount).toBe(1);
  });

  it('writes create-once mode-0600 evidence containing only sanitized hashes and counters', () => {
    const root = temporaryRoot();
    const reportPath = path.join(root, G06_REPORT_RELATIVE_PATH);
    const input = makeInput();
    const built = buildG06AgentMcpReport(input);
    const result = writeG06AgentMcpReport(input, reportPath);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));

    expect(built.passed).toBe(true);
    expect(result.passed).toBe(true);
    expect(statSync(reportPath).mode & 0o777).toBe(0o600);
    expect(bytes.toString('utf8')).not.toContain('合成角色');
    expect(bytes.toString('utf8')).not.toContain('合成声优');
    expect(bytes.toString('utf8')).not.toContain(answer);
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('toolOutput');
    expect(report).not.toHaveProperty('rawRows');
    expect(report).not.toHaveProperty('rawResult');

    const disposition = {
      claimId: report.claimId,
      prNumber: report.prNumber,
      sourceCandidateSha: report.sourceRevision,
      baseSha: report.baseSha,
      ciSha: report.ciSha,
      ciStatus: report.ciStatus,
      reviewerId: report.reviewerId,
      bundleSha256: report.bundleSha256,
      receiptPublicKey: input.receiptPublicKey,
      reportSha256: result.reportSha256,
    };
    expect(validateG06SanitizedReportFile(disposition, root).passed).toBe(true);
    expect(
      validateG06SanitizedReportFile(
        { ...disposition, receiptPublicKey: createG06RunnerReceiptKeyPair().receiptPublicKey },
        root,
      ).passed,
    ).toBe(false);
    expect(() => writeG06AgentMcpReport(makeInput(), reportPath)).toThrow();
  });

  it('rejects a fabricated report without the runner receipt', () => {
    const root = temporaryRoot();
    const reportPath = path.join(root, G06_REPORT_RELATIVE_PATH);
    const input = makeInput();
    const rejected = writeG06AgentMcpReport({ ...input, runnerReceipt: undefined }, reportPath);

    expect(rejected.passed).toBe(false);
    expect(() => readFileSync(reportPath)).toThrow();
  });

  it('does not write a report when any runner or source-boundary check fails', () => {
    const root = temporaryRoot();
    const reportPath = path.join(root, G06_REPORT_RELATIVE_PATH);
    const rejected = writeG06AgentMcpReport(makeInput({ codexErrorItemCount: 1 }), reportPath);

    expect(rejected).toMatchObject({ passed: false });
    expect(() => readFileSync(reportPath)).toThrow();
  });

  it('rejects server privacy flags that do not prove the anonymous no-write profile', () => {
    const built = buildG06AgentMcpReport({
      ...makeInput(),
      serverPrivacyMatchesCandidate: false,
    });

    expect(built.passed).toBe(false);
    expect(built.report.answerChecks.serverPrivacySafe).toBe(false);
  });

  it('rejects answers that exceed the fixed one-shot response byte bound', () => {
    const built = buildG06AgentMcpReport(makeInput({ answer: 'a'.repeat(3601) }));

    expect(built.passed).toBe(false);
    expect(built.report.answerChecks.boundedAnswerBytes).toBe(false);
  });
});
