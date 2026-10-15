import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash, generateKeyPairSync } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R05_COVERAGE_NOTE,
  R05_PROFILE_ID,
  buildR05McpTextProjection,
  summarizeR05SubjectOverlapToolResult,
} from '../../scripts/lib/r05-shared-person-overlap-evidence.mjs';
import {
  validateR05ProfileReport,
  validateR05SanitizedReportFile,
  writeR05SharedPersonOverlapReport,
} from '../../scripts/acceptance/write-r05-shared-person-overlap-report.mjs';
import { makeR05OverlapToolResult } from './fixtures/r05-overlap-result.mjs';

const PROFILE = getAgentMcpProfileById(R05_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function prepareRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'r05-report-test-'));
  const selectionPath = path.join(root, PROFILE.selectionEvidencePath);
  mkdirSync(path.dirname(selectionPath), { recursive: true });
  copyFileSync(
    'docs/research/run95-r05-k-on-season-shared-person-preflight-2026-10-15.json',
    selectionPath,
  );
  mkdirSync(path.dirname(path.join(root, PROFILE.reportPath)), { recursive: true });
  return root;
}

function createInput(root) {
  const pair = generateKeyPairSync('ed25519');
  const publicKeyDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const claim = {
    claimId: 'profile-run-95-pr-123-abcdef123456-1',
    profileId: PROFILE.id,
    frontierId: 'R05',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 123,
    state: 'CLAIMED',
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr123-round1',
    bundleSha256: 'c'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    retryAllowed: false,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
  };
  const rawResult = makeR05OverlapToolResult();
  const resultSummary = summarizeR05SubjectOverlapToolResult(rawResult, PROFILE.calls[0].arguments);
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    toolName: PROFILE.toolName,
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: 'd'.repeat(64),
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    mcpTextProjectionValid: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_r05_overlap'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  const call = {
    tool: PROFILE.toolName,
    arguments: PROFILE.calls[0].arguments,
    result: {
      structuredContent: rawResult,
      content: [{ type: 'text', text: JSON.stringify(buildR05McpTextProjection(resultSummary)) }],
    },
  };
  const answer = JSON.stringify({
    subjectIds: [1424, 3774],
    sharedPerson: { personId: 3847, creditSubjectIds: [1424, 3774] },
    castState: 'partial',
    coverageNote: R05_COVERAGE_NOTE,
  });
  return {
    claim,
    privateKey: pair.privateKey,
    input: {
      root,
      claim,
      serverSummary,
      completedMcpCalls: [call],
      answer,
      codexCliVersion: '1.2.14',
      events,
      eventStreamSha256: '1'.repeat(64),
      serverSummarySha256: '2'.repeat(64),
    },
  };
}

test('R05 writer emits only sanitized, signed, claim-bound report bytes', () => {
  const root = prepareRoot();
  try {
    const { claim, privateKey, input } = createInput(root);
    const written = writeR05SharedPersonOverlapReport(input, { privateKey });
    assert.equal(written.passed, true, JSON.stringify(written));
    const validation = validateR05SanitizedReportFile(
      claim,
      root,
      path.join(root, PROFILE.reportPath),
    );
    assert.equal(validation.passed, true, JSON.stringify(validation));
    assert.equal(validation.reportSha256, written.reportSha256);
    const reportBytes = readFileSync(path.join(root, PROFILE.reportPath));
    const report = JSON.parse(reportBytes.toString('utf8'));
    assert.equal(report.answerChecks.positiveOnlyOutput, true);
    assert.equal(report.privacy.rawResultStored, false);
    assert.equal(report.privacy.answerStored, false);
    assert.equal(report.resultSummary.pair.cast.sharedPeople[0].personId, 3847);
    for (const omitted of [
      'name not persisted',
      'character not persisted',
      'This fixture message',
      'never persist',
      input.answer,
    ]) {
      assert.equal(reportBytes.toString('utf8').includes(omitted), false);
    }

    report.resultSummary.pair.cast.sharedPeople[0].personId = 9999;
    const tampered = validateR05ProfileReport(
      report,
      claim,
      Buffer.from(JSON.stringify(report)),
      root,
    );
    assert.equal(tampered.passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R05 writer fails closed on wrong text projection or unrelated tool events', () => {
  const root = prepareRoot();
  try {
    const { privateKey, input } = createInput(root);
    input.completedMcpCalls[0].result.content[0].text = '{"scopeNote":"complete graph"}';
    const result = writeR05SharedPersonOverlapReport(input, { privateKey });
    assert.deepEqual(result, { passed: false, reason: 'R05_RUNNER_GATE_INVALID' });

    const second = createInput(root);
    second.input.events.nonMcpToolEventCount = 1;
    const rejected = writeR05SharedPersonOverlapReport(second.input, {
      privateKey: second.privateKey,
    });
    assert.deepEqual(rejected, { passed: false, reason: 'R05_RUNNER_GATE_INVALID' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
