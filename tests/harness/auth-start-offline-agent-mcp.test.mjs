import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  AUTH_START_EXPECTED_ARGUMENTS,
  AUTH_START_EXPECTED_ANSWER,
  AUTH_START_PROFILE,
  AUTH_START_PROFILE_ID,
  AUTH_START_SERVER_ID,
  AUTH_START_SYNTHETIC_CALLBACK,
  AUTH_START_SYNTHETIC_CLIENT_ID,
  AUTH_START_TOOL_NAME,
  checkAuthStartOfflineAnswer,
  sameAuthStartArguments,
} from '../../scripts/lib/auth-start-offline-agent-mcp-profile.mjs';
import { buildAuthStartCodexExecArgs } from '../../scripts/acceptance/run-auth-start-offline-agent-mcp.mjs';
import {
  buildAuthStartProfileReport,
  validateAuthStartProfileReport,
  validateAuthStartProfileRun,
} from '../../scripts/acceptance/write-auth-start-offline-agent-mcp-report.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const ANSWER = AUTH_START_EXPECTED_ANSWER;
const CANDIDATE = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const BUNDLE = 'c'.repeat(64);

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyBytes = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyBytes.toString('base64');
  const claim = {
    schemaVersion: 1,
    claimId: 'profile-run-95-pr-999-aaaaaaaaaaaa-1792320000000',
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    runNumber: 95,
    frontierId: AUTH_START_PROFILE.frontierId,
    epochId: AUTH_START_PROFILE.epochId,
    profileId: AUTH_START_PROFILE.id,
    prNumber: 999,
    toolName: AUTH_START_PROFILE.toolName,
    argumentProfile: AUTH_START_PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(AUTH_START_PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(AUTH_START_PROFILE_ID),
    sourceCandidateSha: CANDIDATE,
    baseSha: BASE,
    ciSha: CANDIDATE,
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr999-round1',
    bundleSha256: BUNDLE,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyBytes),
  };
  const url = new URL('https://oauth.invalid/authorize');
  url.search = new URLSearchParams({
    client_id: AUTH_START_SYNTHETIC_CLIENT_ID,
    response_type: 'code',
    redirect_uri: AUTH_START_SYNTHETIC_CALLBACK,
    state: 'ab'.repeat(24),
  }).toString();
  const call = {
    name: AUTH_START_TOOL_NAME,
    arguments: AUTH_START_EXPECTED_ARGUMENTS,
    result: {
      isError: false,
      structuredContent: {
        authorizationUrl: url.toString(),
        expiresAt: '2026-10-18T11:40:00.000Z',
      },
    },
  };
  const summary = {
    schemaVersion: 1,
    profileId: AUTH_START_PROFILE_ID,
    networkMode: AUTH_START_PROFILE.networkMode,
    sourceRevision: CANDIDATE,
    bundleSha256: BUNDLE,
    catalogSha256: 'd'.repeat(64),
    toolName: AUTH_START_TOOL_NAME,
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(AUTH_START_PROFILE),
    serverToolNames: [AUTH_START_TOOL_NAME],
    serverToolCount: 1,
    resultStatus: 'SUCCESS',
    authorizationHost: 'oauth.invalid',
    authorizationPath: '/authorize',
    queryParameterNames: ['client_id', 'redirect_uri', 'response_type', 'state'],
    expectedQueryParameterNames: ['client_id', 'redirect_uri', 'response_type', 'state'],
    syntheticClientIdMatched: true,
    callbackMatched: true,
    responseTypeIsCode: true,
    stateOpaqueAndBounded: true,
    providerScopeAbsent: true,
    expiryWithinTenMinuteWindow: true,
    oauthStateCount: 1,
    statePrincipalIsSynthetic: true,
    stateCapabilityTagMatches: true,
    stateExpiryIsTenMinutes: true,
    httpRequestCount: 0,
    accountWriteCount: 0,
    credentialWriteCount: 0,
    bindingWriteCount: 0,
    toolCallCount: 1,
    deniedCallCount: 0,
    argumentsMatched: true,
  };
  const events = {
    eventStreamComplete: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    completedMcpCalls: [call],
    toolCalls: [{ name: AUTH_START_TOOL_NAME, state: 'DONE' }],
  };
  return {
    keyPair: { publicKeyBase64, privateKey },
    claim,
    call,
    summary,
    events,
    input: {
      claim,
      serverSummary: summary,
      events,
      completedMcpCalls: [call],
      answer: ANSWER,
      codexCliVersion: '1.2.14',
      processExitCode: 0,
      executionFailed: false,
      eventStreamParsed: true,
      rawEventStream: '{"type":"synthetic-event"}\n',
      selectionEvidenceSha256: sha256(readFileSync(AUTH_START_PROFILE.selectionEvidencePath)),
    },
  };
}

test('auth_start profile accepts only its fixed capability arguments and bounded no-consent answer', () => {
  assert.equal(sameAuthStartArguments({ capabilities: ['read:collection'] }), true);
  assert.equal(sameAuthStartArguments({ capabilities: ['write:collection'] }), false);
  assert.equal(checkAuthStartOfflineAnswer(ANSWER).passed, true);
  assert.equal(
    checkAuthStartOfflineAnswer(`${ANSWER} https://oauth.invalid/authorize?state=secret`).passed,
    false,
  );
  assert.equal(
    checkAuthStartOfflineAnswer('Bangumi 授权成功，已经读取你的账号数据。').passed,
    false,
  );
});

test('auth_start one-tool Codex run disables unrelated capabilities and uses Luna Max', () => {
  const args = buildAuthStartCodexExecArgs({
    root: '/tmp/project',
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/summary.json',
    candidateSha: CANDIDATE,
    bundleSha256: BUNDLE,
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('gpt-6-luna'));
  assert.ok(args.includes('read-only'));
  assert.ok(
    args.includes(`mcp_servers.${AUTH_START_SERVER_ID}.enabled_tools=["${AUTH_START_TOOL_NAME}"]`),
  );
  assert.ok(args.includes('features.browser_use=false'));
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.multi_agent=false'));
});

test('auth_start report binds the exact one-shot result and stores no URL, state, answer, or identity', () => {
  const value = fixture();
  const validation = validateAuthStartProfileRun(value.input);
  assert.equal(validation.passed, true);
  const built = buildAuthStartProfileReport(value.input, { keyPair: value.keyPair });
  assert.equal(built.passed, true);
  const reportBytes = Buffer.from(`${JSON.stringify(built.report)}\n`);
  const reportSha256 = sha256(reportBytes);
  const reportClaim = {
    ...value.claim,
    state: 'REPORT_WRITTEN',
    reportWritten: true,
    reportSha256,
  };
  const accepted = validateAuthStartProfileReport(built.report, reportClaim, reportBytes);
  assert.equal(accepted.passed, true);
  const serialized = JSON.stringify(built.report);
  for (const secretLike of [
    'https://oauth.invalid/authorize',
    'abababababababababababababababababababababababab',
    AUTH_START_SYNTHETIC_CLIENT_ID,
    'run95-auth-start-synthetic-principal',
    ANSWER,
  ])
    assert.equal(serialized.includes(secretLike), false);

  const tampered = structuredClone(built.report);
  tampered.offlineFixture.httpRequestCount = 1;
  assert.equal(
    validateAuthStartProfileReport(tampered, reportClaim, Buffer.from(JSON.stringify(tampered)))
      .passed,
    false,
  );
});
