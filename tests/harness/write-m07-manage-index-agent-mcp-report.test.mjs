import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { M07_MANAGE_INDEX_PROFILE_ID } from '../../scripts/lib/m07-manage-index-unbound-profile.mjs';
import {
  buildM07ProfileReport,
  validateM07ProfileRun,
  validateM07ProfileReport,
} from '../../scripts/acceptance/write-m07-manage-index-agent-mcp-report.mjs';

const ROOT = process.cwd();
const SERVER_ID = 'bgk_m07_manage_index_auth_gate';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
  const runnerReceiptPublicKey = publicKeyDer.toString('base64');
  const candidateSha = 'a'.repeat(40);
  const catalogBytes = readFileSync(`${ROOT}/docs/tool-catalog.json`);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const call = {
    tool: profile.toolName,
    status: 'completed',
    arguments: structuredClone(profile.calls[0].arguments),
    result: {
      isError: false,
      content: [
        {
          type: 'text',
          text: 'AUTH_REQUIRED: bind a Bangumi account before managing an index. No request was made.',
        },
      ],
    },
  };
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    runNumber: 95,
    frontierId: 'M07',
    epochId: profile.epochId,
    profileId: profile.id,
    claimId: `profile-run-95-pr123-${candidateSha.slice(0, 12)}-1792155200000`,
    prNumber: 123,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    sourceCandidateSha: candidateSha,
    baseSha: 'b'.repeat(40),
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr123-round1',
    bundleSha256: 'c'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    runnerReceiptPublicKey,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
  };
  const serverSummary = {
    schemaVersion: 1,
    profileId: profile.id,
    networkMode: profile.networkMode,
    sourceRevision: candidateSha,
    bundleSha256: claim.bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    serverResultStatus: 'AUTH_REQUIRED',
    allowedCallCount: 1,
    deniedCallCount: 0,
    accountBindingCount: 0,
    argumentMatch: true,
    httpRequestCount: 0,
    authRequiredCount: 1,
    writeActionReached: false,
    privacy: {
      authProfile: 'unbound',
      accountBound: false,
      oauthAttempted: false,
      accountDataRead: false,
      indexDataRead: false,
      indexDataWriteAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      rawArgumentsStored: false,
      credentialsStored: false,
    },
  };
  const events = {
    eventStreamComplete: true,
    turnCompleted: true,
    turnFailed: false,
    unexpectedEventTypes: 0,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [SERVER_ID],
    completedMcpCalls: [call],
    toolCalls: [{ name: profile.toolName, state: 'DONE' }],
  };
  const input = {
    claim,
    serverSummary,
    events,
    completedMcpCalls: [call],
    answer:
      'AUTH_REQUIRED：管理索引前需要绑定 Bangumi 账号。本次未绑定账号，未发起 OAuth，也未发送网络请求或执行索引操作。',
    codexCliVersion: '0.1.0',
    processExitCode: 0,
    executionFailed: false,
    eventStreamParsed: true,
    serverId: SERVER_ID,
  };
  return { claim, input, privateKey };
}

test('M07 report validator requires the claim-bound AUTH_REQUIRED gate and signed matrix-only evidence', () => {
  const { claim, input, privateKey } = fixture();
  const result = buildM07ProfileReport(input, { privateKey });
  assert.equal(result.passed, true);
  assert.deepEqual(validateM07ProfileReport(result.report, claim, result.reportBytes), {
    passed: true,
    reportPath: 'docs/live-probes/m07-manage-index-agent-mcp-run95.json',
    report: result.report,
  });
  assert.equal(result.report.scenarioId, null);
  assert.equal(result.report.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(result.report.resultStatus, 'AUTH_REQUIRED');
  assert.equal(result.report.accountBindingCount, 0);
  assert.equal(result.report.httpRequestCount, 0);
  assert.equal(result.report.writeActionReached, false);
  assert.equal(result.report.privacy.oauthAttempted, false);
  assert.equal(result.report.privacy.indexDataRead, false);
  assert.equal(result.report.privacy.indexDataWriteAttempted, false);
  assert.equal(JSON.stringify(result.report).includes(input.answer), false);
});

test('rejects changed counters, Codex errors, additional tools, and altered receipts', () => {
  const { claim, input, privateKey } = fixture();
  assert.equal(
    validateM07ProfileRun({
      ...input,
      serverSummary: { ...input.serverSummary, httpRequestCount: 1 },
    }).passed,
    false,
  );
  assert.equal(
    validateM07ProfileRun({
      ...input,
      events: { ...input.events, codexErrorItemCount: 1 },
    }).passed,
    false,
  );
  assert.equal(
    validateM07ProfileRun({
      ...input,
      events: { ...input.events, nonMcpToolEventCount: 1 },
    }).passed,
    false,
  );
  assert.equal(
    validateM07ProfileRun({
      ...input,
      answer: input.answer.replace('未发起 OAuth', '已发起 OAuth'),
    }).passed,
    false,
  );
  assert.equal(
    validateM07ProfileRun({
      ...input,
      answer: input.answer.replace('未发送网络请求', '已发送网络请求'),
    }).passed,
    false,
  );
  assert.equal(
    validateM07ProfileRun({
      ...input,
      completedMcpCalls: [
        {
          ...input.completedMcpCalls[0],
          result: {
            content: [{ type: 'text', text: 'AUTH_REQUIRED: request denied.' }],
          },
        },
      ],
    }).passed,
    false,
  );

  const result = buildM07ProfileReport(input, { privateKey });
  const altered = structuredClone(result.report);
  altered.runnerReceipt.signature = Buffer.from('not a signature').toString('base64');
  assert.equal(validateM07ProfileReport(altered, claim, result.reportBytes).passed, false);
});
