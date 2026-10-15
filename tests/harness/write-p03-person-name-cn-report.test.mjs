import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  writeP03PersonNameCnReport,
  validateP03SanitizedReportFile,
} from '../../scripts/acceptance/write-p03-person-name-cn-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P03_CANONICAL_COVERAGE_NOTE,
  summarizeP03PersonProfileToolResult,
  validateP03McpTextProjection,
  P03_PROFILE_ID,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';

const profile = getAgentMcpProfileById(P03_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function compactTextFor(summary) {
  return JSON.stringify({
    state: summary.state,
    person: { id: summary.personId, nameCn: summary.personName },
    coverage: {
      state: summary.coverage.state,
      subjects: {
        observed: summary.coverage.subjectsObserved,
        returned: summary.coverage.subjectsReturned,
        truncated: summary.coverage.subjectsTruncated,
        sourceCompleteness: summary.coverage.sourceCompleteness,
        nameCnSourceSemantics:
          'nameCnSource 去除首尾空白后非空表示官方 name_cn 已提供；空字符串或纯空白字符串归为 empty，缺失或非字符串值归为 unavailable，不能据此断言字段未返回或作品没有中文名。',
        creditRowsIncluded: true,
        nameCnSourceCounts: summary.nameCnSourceCounts,
      },
    },
    sourceNameCnRows: summary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    returnedCreditRowsObserved: summary.returnedCreditRowsObserved,
    returnedCreditRowsWithNameCnSource: summary.positiveNameCnRowsObserved,
    nameCnRowsOmittedFromText: summary.nameCnRowsOmittedFromText,
    scopeNote: '仅本次收到的作品关系行；上游关系完整性未声明，文本省略也不代表作品不存在。',
  });
}

function fixture() {
  const structuredContent = {
    state: 'partial',
    person: { id: 4765, name: 'Inori Minase', nameCn: '水濑祈' },
    coverage: {
      state: 'partial',
      subjects: { observed: 3, returned: 3, truncated: false, sourceCompleteness: 'undocumented' },
    },
    credits: {
      subjects: [
        { id: 1, name: 'Original A', nameCnSource: '作品甲' },
        { id: 2, name: 'Original B', nameCnSource: '作品乙' },
        { id: 3, name: 'Original C', nameCnSource: '   ' },
      ],
    },
  };
  const resultSummary = summarizeP03PersonProfileToolResult(
    structuredContent,
    profile.calls[0].arguments,
  );
  const compactText = compactTextFor(resultSummary);
  const answer = JSON.stringify({
    personId: resultSummary.personId,
    personName: resultSummary.personName,
    sourceNameCnRows: resultSummary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    subjectsObserved: resultSummary.coverage.subjectsObserved,
    subjectsReturned: resultSummary.coverage.subjectsReturned,
    subjectsTruncated: resultSummary.coverage.subjectsTruncated,
    sourceCompleteness: resultSummary.coverage.sourceCompleteness,
    returnedCreditRowsObserved: resultSummary.returnedCreditRowsObserved,
    nameCnSourceCounts: resultSummary.nameCnSourceCounts,
    nameCnRowsOmittedFromText: resultSummary.nameCnRowsOmittedFromText,
    coverageNote: P03_CANONICAL_COVERAGE_NOTE,
  });
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const claim = {
    claimId: 'profile-run-95-pr-166-aaaaaaaaaaaa-123',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'P03',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 166,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'c'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr166-round1',
    bundleSha256: 'b'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    retryAllowed: false,
  };
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const serverSummary = {
    profileId: profile.id,
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    toolName: profile.toolName,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpTextProjectionValid: true,
    mcpServerNames: ['bgk_p03_name_cn'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return {
    keyPair,
    claim,
    serverSummary,
    structuredContent,
    resultSummary,
    compactText,
    answer,
    events,
  };
}

test('P03 report is sanitized, signed, exact-claim-bound, and validates from its file', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-report-test-'));
  const {
    keyPair,
    claim,
    serverSummary,
    structuredContent,
    resultSummary,
    compactText,
    answer,
    events,
  } = fixture();
  assert.equal(validateP03McpTextProjection(compactText, resultSummary).passed, true);
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const result = writeP03PersonNameCnReport(
      {
        root,
        claim,
        serverSummary,
        completedMcpCalls: [
          {
            tool: profile.toolName,
            arguments: profile.calls[0].arguments,
            result: { structuredContent, content: [{ type: 'text', text: compactText }] },
          },
        ],
        answer,
        codexCliVersion: '1.2.3',
        events,
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, true, result.reason);
    const validation = validateP03SanitizedReportFile(claim, root);
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.reportSha256, result.reportSha256);
    assert.deepEqual(validation.report.resultSummary.nameCnSourceCounts, {
      present: 2,
      empty: 1,
      unavailable: 0,
    });
    assert.equal(validation.report.resultSummary.sourceNameCnRows.length, 2);
    assert.equal(Object.hasOwn(validation.report, 'answer'), false);
    assert.equal(Object.hasOwn(validation.report, 'rawResult'), false);

    const reportBytes = readFileSync(result.absoluteReportPath);
    const tampered = JSON.parse(reportBytes.toString('utf8'));
    tampered.resultSummary.sourceNameCnRows[0].nameCnSource = '伪造标题';
    writeFileSync(result.absoluteReportPath, `${JSON.stringify(tampered, null, 2)}\n`);
    assert.equal(validateP03SanitizedReportFile(claim, root).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P03 report writer refuses an answer that makes a completeness or absence claim', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-report-invalid-'));
  const { keyPair, claim, serverSummary, structuredContent, compactText, answer, events } =
    fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const invalidAnswer = JSON.parse(answer);
  invalidAnswer.coverageNote = '完整生涯都没有中文名。';
  try {
    const result = writeP03PersonNameCnReport(
      {
        root,
        claim,
        serverSummary,
        completedMcpCalls: [
          {
            tool: profile.toolName,
            arguments: profile.calls[0].arguments,
            result: { structuredContent, content: [{ type: 'text', text: compactText }] },
          },
        ],
        answer: JSON.stringify(invalidAnswer),
        codexCliVersion: '1.2.3',
        events,
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'P03_ANSWER_CHECKS_FAILED');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
