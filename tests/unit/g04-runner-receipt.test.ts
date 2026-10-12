import { describe, expect, it } from 'vitest';
import {
  buildG04RunnerReceiptPayload,
  createG04RunnerReceipt,
  generateG04RunnerReceiptKeyPair,
  g04RunnerPublicKeySha256,
  verifyG04RunnerReceipt,
} from '../../scripts/acceptance/g04-runner-receipt.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const reviewerId = 'gpt-6-luna-max-run95-pr136-round1';

function input() {
  return {
    claimId: 'g04-run-95-pr-136-aaaaaaaaaaaa-123',
    prNumber: 136,
    sourceRevision: candidate,
    baseSha: base,
    bundleSha256: 'c'.repeat(64),
    reviewerId,
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: '1.2.14',
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    serverToolNames: ['bangumi.get_person_activity'],
    serverToolCount: 1,
    mcpServerNames: ['bgk_g04_one_tool'],
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 3,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    runnerEventStreamSha256: 'd'.repeat(64),
    runnerServerSummarySha256: 'e'.repeat(64),
    toolTextUtf8Bytes: 2048,
    queryArguments: {
      personId: 13684,
      kind: 'voice',
      media: 'tv',
      windowMonths: 12,
      maxRelations: 48,
      maxSubjectDetails: 16,
      maxRows: 8,
    },
    candidateGate: {
      candidateSha: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      reviewPassSha: candidate,
      reviewVerdict: 'PASS',
      reviewerId,
    },
  };
}

function answerResult() {
  return {
    passed: true,
    answerChecks: { exactQueryArguments: true, noUnsupportedPositiveClaim: true },
    answerCounters: { rowsMatched: 2 },
    resultSummary: { personId: 13684, state: 'partial', rowCount: 2 },
    resultByteLength: 1024,
    resultSha256: 'f'.repeat(64),
    answerUtf8Bytes: 800,
    answerSha256: '1'.repeat(64),
  };
}

describe('G04 signed one-tool runner receipt', () => {
  it('authenticates exact candidate and sanitized result digests without storing answer data', () => {
    const keyPair = generateG04RunnerReceiptKeyPair();
    const payload = buildG04RunnerReceiptPayload(input(), answerResult());
    const receipt = createG04RunnerReceipt(payload, keyPair);

    expect(g04RunnerPublicKeySha256(keyPair.publicKeyBase64)).toMatch(/^[0-9a-f]{64}$/u);
    expect(verifyG04RunnerReceipt(receipt, keyPair.publicKeyBase64, payload)).toBe(true);
    expect(payload).toMatchObject({
      claimId: 'g04-run-95-pr-136-aaaaaaaaaaaa-123',
      prNumber: 136,
      sourceRevision: candidate,
      baseSha: base,
      reviewerId,
      codexErrorItemCount: 3,
      answerSha256: '1'.repeat(64),
      resultSha256: 'f'.repeat(64),
    });
    expect(JSON.stringify(receipt)).not.toContain('raw answer');
    expect(JSON.stringify(receipt)).not.toContain('raw result');
  });

  it('rejects changed payloads, wrong public keys, and non-success answer checks', () => {
    const keyPair = generateG04RunnerReceiptKeyPair();
    const payload = buildG04RunnerReceiptPayload(input(), answerResult());
    const receipt = createG04RunnerReceipt(payload, keyPair);
    const otherKeyPair = generateG04RunnerReceiptKeyPair();

    expect(verifyG04RunnerReceipt(receipt, otherKeyPair.publicKeyBase64, payload)).toBe(false);
    expect(
      verifyG04RunnerReceipt(receipt, keyPair.publicKeyBase64, { ...payload, prNumber: 128 }),
    ).toBe(false);
    expect(() =>
      buildG04RunnerReceiptPayload(input(), { ...answerResult(), passed: false }),
    ).toThrow(/successful exact-answer check/u);
    expect(() => g04RunnerPublicKeySha256('not-a-key')).toThrow(/canonical base64/u);
  });
});
