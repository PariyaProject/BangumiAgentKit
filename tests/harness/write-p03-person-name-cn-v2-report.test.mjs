import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  validateP03V2ProfileReport,
  validateP03V2SanitizedReportFile,
  writeP03V2PersonNameCnReport,
} from '../../scripts/acceptance/write-p03-person-name-cn-v2-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P03_CANONICAL_COVERAGE_NOTE,
  P03_V2_PROFILE_ID,
  summarizeP03PersonProfileToolResult,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';

const profile = getAgentMcpProfileById(P03_V2_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function makeFixture(root) {
  const result = {
    state: 'partial',
    person: { id: 19306, name: 'Public Person', nameCn: '公开人物' },
    coverage: {
      state: 'partial',
      subjects: { observed: 9, returned: 3, truncated: true, sourceCompleteness: 'undocumented' },
    },
    credits: {
      subjects: [
        { id: 21, name: 'Original A', nameCnSource: '作品甲' },
        { id: 22, name: 'Original B', nameCnSource: '作品乙' },
        { id: 23, name: 'Empty', nameCnSource: '   ' },
      ],
    },
  };
  const resultSummary = summarizeP03PersonProfileToolResult(
    result,
    profile.calls[0].arguments,
    profile.id,
  );
  const compactText = JSON.stringify({
    state: resultSummary.state,
    person: { id: resultSummary.personId, name: resultSummary.personName },
    coverage: {
      state: resultSummary.coverage.state,
      subjects: {
        observed: resultSummary.coverage.subjectsObserved,
        returned: resultSummary.coverage.subjectsReturned,
        truncated: resultSummary.coverage.subjectsTruncated,
        sourceCompleteness: resultSummary.coverage.sourceCompleteness,
        nameCnSourceSemantics:
          'nameCnSource 去除首尾空白后非空表示官方 name_cn 已提供；空字符串或纯空白字符串归为 empty，缺失或非字符串值归为 unavailable，不能据此断言字段未返回或作品没有中文名。',
        creditRowsIncluded: true,
        nameCnSourceCounts: resultSummary.nameCnSourceCounts,
      },
    },
    sourceNameCnRows: resultSummary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    returnedCreditRowsObserved: resultSummary.returnedCreditRowsObserved,
    returnedCreditRowsWithNameCnSource: resultSummary.positiveNameCnRowsObserved,
    nameCnRowsOmittedFromText: resultSummary.nameCnRowsOmittedFromText,
    scopeNote: '仅本次收到的作品关系行；上游关系完整性未声明，文本省略也不代表作品不存在。',
  });
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
    claimId: 'profile-run-95-pr-260-aaaaaaaaaaaa-123',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'P03',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 260,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'c'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr260-round1',
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
    registrySha256: claim.registrySha256,
    argumentProfile: profile.argumentProfile,
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
    structuredContentReadbackAvailable: false,
    mcpServerNames: ['bgk_p03_name_cn'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return {
    root,
    keyPair,
    claim,
    serverSummary,
    result,
    resultSummary,
    compactText,
    answer,
    events,
  };
}

test('P03 v2 writes a matrix-only signed report without person or title text', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v2-report-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root);
  try {
    const written = writeP03V2PersonNameCnReport(
      {
        ...fixture,
        completedMcpCalls: [
          {
            tool: profile.toolName,
            arguments: profile.calls[0].arguments,
            result: { content: [{ type: 'text', text: fixture.compactText }] },
          },
        ],
        codexCliVersion: '1.2.3',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: fixture.keyPair.privateKey },
    );
    assert.equal(written.passed, true, written.reason);
    const validation = validateP03V2SanitizedReportFile(fixture.claim, root);
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.reportSha256, written.reportSha256);
    assert.equal(validation.report.acceptanceScope, 'agent-mcp-matrix-only');
    assert.equal(validation.report.scenarioId, null);
    assert.equal(validation.report.structuredContentReadbackAvailable, false);
    assert.deepEqual(validation.report.resultCounters, {
      subjectsObserved: 9,
      subjectsReturned: 3,
      subjectsTruncated: true,
      returnedCreditRowsObserved: 3,
      positiveNameCnRowsObserved: 2,
      emptyNameCnRowsObserved: 1,
      unavailableNameCnRowsObserved: 0,
      nameCnRowsOmittedFromText: 0,
    });
    const serialized = JSON.stringify(validation.report);
    for (const sensitiveValue of ['公开人物', 'Public Person', '作品甲', '作品乙', 'Original A']) {
      assert.equal(serialized.includes(sensitiveValue), false, `report contains ${sensitiveValue}`);
    }
    assert.equal(Object.hasOwn(validation.report, 'resultSummary'), false);
    assert.equal(Object.hasOwn(validation.report, 'answer'), false);
    const tampered = structuredClone(validation.report);
    tampered.resultCounters.subjectsObserved += 1;
    assert.equal(validateP03V2ProfileReport(tampered, fixture.claim).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P03 v2 rejects unexpected structuredContent instead of relying on it', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v2-structured-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root);
  try {
    const result = writeP03V2PersonNameCnReport(
      {
        ...fixture,
        completedMcpCalls: [
          {
            tool: profile.toolName,
            arguments: profile.calls[0].arguments,
            result: {
              structuredContent: fixture.result,
              content: [{ type: 'text', text: fixture.compactText }],
            },
          },
        ],
        codexCliVersion: '1.2.3',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: fixture.keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'P03_V2_RUNNER_GATE_INVALID');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P03 v2 removes only a partial report file created by a failed write', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v2-write-failure-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root);
  const reportPath = path.join(root, profile.reportPath);
  const fileOperations = {
    openSync,
    writeFileSync() {
      throw new Error('injected report write failure');
    },
    closeSync,
    unlinkSync,
  };
  const input = {
    ...fixture,
    completedMcpCalls: [
      {
        tool: profile.toolName,
        arguments: profile.calls[0].arguments,
        result: { content: [{ type: 'text', text: fixture.compactText }] },
      },
    ],
    codexCliVersion: '1.2.3',
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
  };
  try {
    const failedWrite = writeP03V2PersonNameCnReport(input, {
      privateKey: fixture.keyPair.privateKey,
      fileOperations,
    });
    assert.equal(failedWrite.passed, false);
    assert.equal(failedWrite.reason, 'P03_V2_REPORT_ALREADY_EXISTS_OR_UNWRITABLE');
    assert.equal(existsSync(reportPath), false);

    writeFileSync(reportPath, 'pre-existing report sentinel');
    const createOnlyRefusal = writeP03V2PersonNameCnReport(input, {
      privateKey: fixture.keyPair.privateKey,
    });
    assert.equal(createOnlyRefusal.passed, false);
    assert.equal(existsSync(reportPath), true);
    assert.equal(readFileSync(reportPath, 'utf8'), 'pre-existing report sentinel');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
