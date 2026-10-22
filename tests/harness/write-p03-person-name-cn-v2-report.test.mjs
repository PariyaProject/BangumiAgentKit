import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
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
  buildP03V2RunnerReceiptPayload,
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
  P03_V3_PROFILE_ID,
  summarizeP03PersonProfileToolResult,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';

const profile = getAgentMcpProfileById(P03_V2_PROFILE_ID);
const v3Profile = getAgentMcpProfileById(P03_V3_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function makeFixture(root, selectedProfile = profile) {
  const isV3 = selectedProfile.id === P03_V3_PROFILE_ID;
  const creditRows = isV3
    ? Array.from({ length: 5 }, (_, index) => ({
        id: 501 + index,
        name: `Original bounded ${index + 1}`,
        nameCnSource: `来源作品${index + 1}`,
      }))
    : [
        { id: 21, name: 'Original A', nameCnSource: '作品甲' },
        { id: 22, name: 'Original B', nameCnSource: '作品乙' },
        { id: 23, name: 'Empty', nameCnSource: '   ' },
      ];
  const result = {
    state: 'partial',
    person: {
      id: selectedProfile.calls[0].arguments.personId,
      name: isV3 ? 'Selected public person' : 'Public Person',
      nameCn: isV3 ? '精选公开人物' : '公开人物',
    },
    coverage: {
      state: 'partial',
      subjects: {
        observed: isV3 ? 35 : 9,
        returned: creditRows.length,
        truncated: true,
        sourceCompleteness: 'undocumented',
      },
    },
    credits: { subjects: creditRows },
  };
  const resultSummary = summarizeP03PersonProfileToolResult(
    result,
    selectedProfile.calls[0].arguments,
    selectedProfile.id,
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
    profileId: selectedProfile.id,
    frontierId: 'P03',
    epochId: selectedProfile.epochId,
    runNumber: 95,
    prNumber: 260,
    toolName: selectedProfile.toolName,
    argumentProfile: selectedProfile.argumentProfile,
    expectedArguments: selectedProfile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(selectedProfile),
    registrySha256: agentMcpProfileRegistrySha256(selectedProfile.id),
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
  const tool = catalog.find((entry) => entry.name === selectedProfile.toolName);
  const serverSummary = {
    profileId: selectedProfile.id,
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    registrySha256: claim.registrySha256,
    argumentProfile: selectedProfile.argumentProfile,
    serverToolNames: [selectedProfile.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    toolName: selectedProfile.toolName,
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
    blockedWebSearchErrorItemCount: 0,
    unexpectedCodexErrorItemCount: 0,
    codexErrorCountsMatch: true,
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

test('P03 v3 writes a signed five-row report under its own profile identity', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v3-report-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root, v3Profile);
  fixture.events = {
    ...fixture.events,
    codexErrorItemCount: 3,
    blockedWebSearchErrorItemCount: 3,
  };
  try {
    const written = writeP03V2PersonNameCnReport(
      {
        ...fixture,
        completedMcpCalls: [
          {
            tool: v3Profile.toolName,
            arguments: v3Profile.calls[0].arguments,
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
    assert.equal(validation.report.profileId, v3Profile.id);
    assert.equal(validation.report.epochId, v3Profile.epochId);
    assert.equal(validation.report.profile, 'codex-luna-max-agent-mcp-matrix-v3');
    assert.equal(validation.report.codexErrorItemCount, 3);
    assert.equal(validation.report.blockedWebSearchErrorItemCount, 3);
    assert.equal(validation.report.unexpectedCodexErrorItemCount, 0);
    assert.equal(
      validation.report.runnerReceipt.kind,
      'p03-person-name-cn-agent-mcp-runner-receipt-v3',
    );
    assert.deepEqual(validation.report.resultCounters, {
      subjectsObserved: 35,
      subjectsReturned: 5,
      subjectsTruncated: true,
      returnedCreditRowsObserved: 5,
      positiveNameCnRowsObserved: 5,
      emptyNameCnRowsObserved: 0,
      unavailableNameCnRowsObserved: 0,
      nameCnRowsOmittedFromText: 0,
    });
    const serialized = JSON.stringify(validation.report);
    for (const sensitiveValue of ['精选公开人物', 'Selected public person', '来源作品1']) {
      assert.equal(serialized.includes(sensitiveValue), false, `report contains ${sensitiveValue}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P03 v2 rejects classified web-search errors in both writer and report validator', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v2-error-report-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root);
  try {
    const commonInput = {
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
    const rejected = writeP03V2PersonNameCnReport(
      {
        ...commonInput,
        events: {
          ...fixture.events,
          codexErrorItemCount: 1,
          blockedWebSearchErrorItemCount: 1,
        },
      },
      { privateKey: fixture.keyPair.privateKey },
    );
    assert.equal(rejected.passed, false);
    assert.equal(rejected.reason, 'P03_V2_RUNNER_GATE_INVALID');
    assert.equal(existsSync(path.join(root, profile.reportPath)), false);

    const written = writeP03V2PersonNameCnReport(
      commonInput,
      { privateKey: fixture.keyPair.privateKey },
    );
    assert.equal(written.passed, true, written.reason);
    const validation = validateP03V2SanitizedReportFile(fixture.claim, root);
    assert.equal(validation.passed, true, validation.reason);
    const forged = structuredClone(validation.report);
    forged.codexErrorItemCount = 1;
    forged.blockedWebSearchErrorItemCount = 1;
    const payload = buildP03V2RunnerReceiptPayload(forged, {
      eventStreamSha256: forged.runnerReceipt.payload.eventStreamSha256,
      serverSummarySha256: forged.runnerReceipt.payload.serverSummarySha256,
    });
    forged.runnerReceipt.payload = payload;
    forged.runnerReceipt.signature = sign(
      null,
      Buffer.from(canonicalAgentMcpProfileJson(payload)),
      fixture.keyPair.privateKey,
    ).toString('base64');
    assert.equal(validateP03V2ProfileReport(forged, fixture.claim).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P03 v3 report rejects unclassified Codex error items', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p03-v3-error-report-test-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const fixture = makeFixture(root, v3Profile);
  fixture.events = {
    ...fixture.events,
    codexErrorItemCount: 1,
    blockedWebSearchErrorItemCount: 0,
    unexpectedCodexErrorItemCount: 1,
  };
  try {
    const result = writeP03V2PersonNameCnReport(
      {
        ...fixture,
        completedMcpCalls: [
          {
            tool: v3Profile.toolName,
            arguments: v3Profile.calls[0].arguments,
            result: { content: [{ type: 'text', text: fixture.compactText }] },
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
    assert.equal(existsSync(path.join(root, v3Profile.reportPath)), false);
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
