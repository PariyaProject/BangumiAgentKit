import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, fsyncSync, openSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  AUTH_START_EXPECTED_QUERY_KEYS,
  AUTH_START_PROFILE,
  AUTH_START_PROFILE_ID,
  AUTH_START_SERVER_ID,
  AUTH_START_SYNTHETIC_CALLBACK,
  AUTH_START_SYNTHETIC_CLIENT_ID,
  AUTH_START_TOOL_NAME,
  checkAuthStartOfflineAnswer,
  sameAuthStartArguments,
} from '../lib/auth-start-offline-agent-mcp-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(ROOT, AUTH_START_PROFILE.reportPath);
const RECEIPT_KIND = 'auth-start-offline-agent-mcp-runner-receipt-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sortedKeys = (value) =>
  Object.keys(value ?? {})
    .sort()
    .join(',');

const REPORT_FIELDS = new Set([
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'epochId',
  'profileId',
  'profile',
  'acceptanceScope',
  'model',
  'reasoningEffort',
  'reviewerId',
  'codexCliVersion',
  'observedAt',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'prNumber',
  'claimId',
  'mcpBundleSha256',
  'registrySha256',
  'selectionEvidenceSha256',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'serverToolNames',
  'serverToolCount',
  'networkMode',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerSha256',
  'answerUtf8Bytes',
  'eventStreamSha256',
  'serverSummarySha256',
  'answerChecks',
  'offlineFixture',
  'privacy',
  'retryAllowed',
  'reportWritten',
  'runnerReceipt',
]);
const EXPECTED_ANSWER_CHECK_KEYS = [
  'exactArguments',
  'oneMcpCall',
  'successfulToolResult',
  'urlIsSynthetic',
  'serverSummaryValid',
  'answerSemanticsValid',
  'eventStreamClean',
  'answer',
].sort();
const EXPECTED_ANSWER_DETAIL_KEYS = [
  'boundedChineseText',
  'exactExpectedCopy',
  'identifiesSyntheticOfflineTest',
  'saysLinkWasNotOpened',
  'saysConsentWasNotCompleted',
  'saysAccountDataWasNotAccessed',
  'distinguishesLocalCapabilityTag',
  'omitsUrlAndState',
  'noUnsupportedSuccessClaim',
].sort();
const EXPECTED_PRIVACY = {
  inheritedCredentialEnvironmentRead: false,
  productionDatabaseUsed: false,
  realBangumiRequestSent: false,
  browserOpened: false,
  authorizationUrlPersisted: false,
  oauthStatePersistedInReport: false,
  clientIdPersisted: false,
  principalIdPersisted: false,
  rawPromptOrAnswerPersisted: false,
  accountOrCredentialWritten: false,
};

function validClaim(claim) {
  const profile = getAgentMcpProfileById(AUTH_START_PROFILE_ID);
  if (!profile) return false;
  const publicKeyBytes = Buffer.from(claim?.runnerReceiptPublicKey ?? '', 'base64');
  let publicKeyValid = false;
  try {
    const key = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
    publicKeyValid =
      key.asymmetricKeyType === 'ed25519' &&
      publicKeyBytes.toString('base64') === claim.runnerReceiptPublicKey;
  } catch {
    publicKeyValid = false;
  }
  return Boolean(
    claim &&
    claim.state === 'CLAIMED' &&
    claim.reportWritten === false &&
    claim.retryAllowed === false &&
    claim.runNumber === 95 &&
    claim.frontierId === profile.frontierId &&
    claim.epochId === profile.epochId &&
    claim.profileId === profile.id &&
    claim.toolName === profile.toolName &&
    claim.argumentProfile === profile.argumentProfile &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
    typeof claim.claimId === 'string' &&
    typeof claim.prNumber === 'number' &&
    /^[0-9a-f]{40}$/u.test(claim.sourceCandidateSha ?? '') &&
    /^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') &&
    claim.ciSha === claim.sourceCandidateSha &&
    claim.ciStatus === 'SUCCESS' &&
    typeof claim.reviewerId === 'string' &&
    new RegExp(`^gpt-6-luna-max-run95-pr${claim.prNumber}-round[1-9]\\d*$`, 'u').test(
      claim.reviewerId,
    ) &&
    /^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '') &&
    publicKeyValid &&
    /^[0-9a-f]{64}$/u.test(claim.runnerReceiptPublicKeySha256 ?? '') &&
    sha256(publicKeyBytes) === claim.runnerReceiptPublicKeySha256,
  );
}

function validateServerSummary(summary, claim) {
  const expectedKeys = [
    'schemaVersion',
    'profileId',
    'networkMode',
    'sourceRevision',
    'bundleSha256',
    'catalogSha256',
    'toolName',
    'toolDescriptionSha256',
    'inputSchemaSha256',
    'expectedArgumentsSha256',
    'serverToolNames',
    'serverToolCount',
    'resultStatus',
    'authorizationHost',
    'authorizationPath',
    'queryParameterNames',
    'expectedQueryParameterNames',
    'syntheticClientIdMatched',
    'callbackMatched',
    'responseTypeIsCode',
    'stateOpaqueAndBounded',
    'providerScopeAbsent',
    'expiryWithinTenMinuteWindow',
    'oauthStateCount',
    'statePrincipalIsSynthetic',
    'stateCapabilityTagMatches',
    'stateExpiryIsTenMinutes',
    'httpRequestCount',
    'accountWriteCount',
    'credentialWriteCount',
    'bindingWriteCount',
    'toolCallCount',
    'deniedCallCount',
    'argumentsMatched',
  ];
  return Boolean(
    summary &&
    typeof summary === 'object' &&
    !Array.isArray(summary) &&
    sortedKeys(summary) === [...expectedKeys].sort().join(',') &&
    summary.schemaVersion === 1 &&
    summary.profileId === AUTH_START_PROFILE_ID &&
    summary.networkMode === AUTH_START_PROFILE.networkMode &&
    summary.sourceRevision === claim.sourceCandidateSha &&
    summary.bundleSha256 === claim.bundleSha256 &&
    summary.toolName === AUTH_START_TOOL_NAME &&
    summary.serverToolCount === 1 &&
    canonicalJson(summary.serverToolNames) === canonicalJson([AUTH_START_TOOL_NAME]) &&
    summary.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(AUTH_START_PROFILE) &&
    summary.resultStatus === 'SUCCESS' &&
    summary.authorizationHost === 'oauth.invalid' &&
    summary.authorizationPath === '/authorize' &&
    canonicalJson(summary.queryParameterNames) ===
      canonicalJson([...AUTH_START_EXPECTED_QUERY_KEYS].sort()) &&
    canonicalJson(summary.expectedQueryParameterNames) ===
      canonicalJson([...AUTH_START_EXPECTED_QUERY_KEYS].sort()) &&
    summary.syntheticClientIdMatched === true &&
    summary.callbackMatched === true &&
    summary.responseTypeIsCode === true &&
    summary.stateOpaqueAndBounded === true &&
    summary.providerScopeAbsent === true &&
    summary.expiryWithinTenMinuteWindow === true &&
    summary.oauthStateCount === 1 &&
    summary.statePrincipalIsSynthetic === true &&
    summary.stateCapabilityTagMatches === true &&
    summary.stateExpiryIsTenMinutes === true &&
    summary.httpRequestCount === 0 &&
    summary.accountWriteCount === 0 &&
    summary.credentialWriteCount === 0 &&
    summary.bindingWriteCount === 0 &&
    summary.toolCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    summary.argumentsMatched === true,
  );
}

export function validateAuthStartProfileRun(input) {
  const claim = input?.claim;
  const summary = input?.serverSummary;
  const events = input?.events;
  const call = input?.completedMcpCalls?.[0];
  if (!validClaim(claim)) return { passed: false, reason: 'AUTH_START_CLAIM_INVALID' };

  const answer = checkAuthStartOfflineAnswer(input?.answer);
  const url = (() => {
    try {
      return new URL(call?.result?.structuredContent?.authorizationUrl);
    } catch {
      return null;
    }
  })();
  const queryKeys = url ? [...url.searchParams.keys()].sort() : [];
  const answerChecks = {
    exactArguments: sameAuthStartArguments(call?.arguments),
    oneMcpCall:
      events?.codexMcpToolEventCount === 1 &&
      events?.completedMcpCalls?.length === 1 &&
      events?.toolCalls?.length === 1 &&
      events?.toolCalls?.[0]?.name === AUTH_START_TOOL_NAME &&
      events?.toolCalls?.[0]?.state === 'DONE',
    successfulToolResult: call?.result?.isError !== true,
    urlIsSynthetic:
      url?.protocol === 'https:' &&
      url?.hostname === 'oauth.invalid' &&
      url?.pathname === '/authorize' &&
      canonicalJson(queryKeys) === canonicalJson([...AUTH_START_EXPECTED_QUERY_KEYS].sort()) &&
      url?.searchParams.get('client_id') === AUTH_START_SYNTHETIC_CLIENT_ID &&
      url?.searchParams.get('redirect_uri') === AUTH_START_SYNTHETIC_CALLBACK &&
      url?.searchParams.get('response_type') === 'code' &&
      /^[0-9a-f]{48}$/u.test(url?.searchParams.get('state') ?? '') &&
      !url?.searchParams.has('scope'),
    serverSummaryValid: validateServerSummary(summary, claim),
    answerSemanticsValid: answer.passed,
    eventStreamClean:
      input?.executionFailed !== true &&
      input?.processExitCode === 0 &&
      input?.eventStreamParsed === true &&
      events?.eventStreamComplete === true &&
      events?.codexErrorItemCount === 0 &&
      events?.nonMcpToolEventCount === 0 &&
      events?.shellToolCallCount === 0,
  };
  return {
    passed: Object.values(answerChecks).every(Boolean),
    reason: Object.values(answerChecks).every(Boolean)
      ? null
      : 'AUTH_START_AGENT_MCP_ASSERTION_FAILED',
    answerChecks: { ...answerChecks, answer: answer.checks },
  };
}

export function buildAuthStartProfileReport(input, { keyPair } = {}) {
  const validation = validateAuthStartProfileRun(input);
  if (!validation.passed || !keyPair?.privateKey || !keyPair?.publicKeyBase64) {
    return { passed: false, reason: validation.reason ?? 'AUTH_START_RUNNER_KEY_INVALID' };
  }
  const profile = AUTH_START_PROFILE;
  const report = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    runNumber: 95,
    frontierId: profile.frontierId,
    scenarioId: null,
    epochId: profile.epochId,
    profileId: profile.id,
    profile: 'codex-luna-max-offline-agent-mcp-matrix-v1',
    acceptanceScope: 'agent-mcp-matrix-only',
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    reviewerId: input.claim.reviewerId,
    codexCliVersion: input.codexCliVersion,
    observedAt: new Date().toISOString(),
    sourceRevision: input.claim.sourceCandidateSha,
    baseSha: input.claim.baseSha,
    ciSha: input.claim.ciSha,
    ciStatus: input.claim.ciStatus,
    prNumber: input.claim.prNumber,
    claimId: input.claim.claimId,
    mcpBundleSha256: input.claim.bundleSha256,
    registrySha256: input.claim.registrySha256,
    selectionEvidenceSha256: input.selectionEvidenceSha256,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: input.claim.expectedArgumentsSha256,
    catalogSha256: input.serverSummary.catalogSha256,
    toolDescriptionSha256: input.serverSummary.toolDescriptionSha256,
    inputSchemaSha256: input.serverSummary.inputSchemaSha256,
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    networkMode: profile.networkMode,
    mcpServerNames: [AUTH_START_SERVER_ID],
    processExitCode: input.processExitCode,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: input.events.codexMcpToolEventCount,
    codexErrorItemCount: input.events.codexErrorItemCount,
    nonMcpToolEventCount: input.events.nonMcpToolEventCount,
    shellToolCallCount: input.events.shellToolCallCount,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: profile.answerCheckMethod,
    answerSha256: sha256(Buffer.from(input.answer, 'utf8')),
    answerUtf8Bytes: Buffer.byteLength(input.answer, 'utf8'),
    eventStreamSha256: sha256(Buffer.from(input.rawEventStream, 'utf8')),
    serverSummarySha256: sha256(Buffer.from(canonicalJson(input.serverSummary), 'utf8')),
    answerChecks: validation.answerChecks,
    offlineFixture: {
      authorizationHost: input.serverSummary.authorizationHost,
      authorizationPath: input.serverSummary.authorizationPath,
      queryParameterNames: input.serverSummary.queryParameterNames,
      providerScopeAbsent: input.serverSummary.providerScopeAbsent,
      oauthStateCount: input.serverSummary.oauthStateCount,
      expiresAtWithinTenMinuteWindow: input.serverSummary.expiryWithinTenMinuteWindow,
      httpRequestCount: input.serverSummary.httpRequestCount,
      accountWriteCount: input.serverSummary.accountWriteCount,
      credentialWriteCount: input.serverSummary.credentialWriteCount,
      bindingWriteCount: input.serverSummary.bindingWriteCount,
    },
    privacy: {
      inheritedCredentialEnvironmentRead: false,
      productionDatabaseUsed: false,
      realBangumiRequestSent: false,
      browserOpened: false,
      authorizationUrlPersisted: false,
      oauthStatePersistedInReport: false,
      clientIdPersisted: false,
      principalIdPersisted: false,
      rawPromptOrAnswerPersisted: false,
      accountOrCredentialWritten: false,
    },
    retryAllowed: false,
    reportWritten: true,
  };
  const receipt = {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64: keyPair.publicKeyBase64,
    publicKeySha256: sha256(Buffer.from(keyPair.publicKeyBase64, 'base64')),
    signature: sign(null, Buffer.from(canonicalJson(report)), keyPair.privateKey).toString(
      'base64',
    ),
  };
  report.runnerReceipt = receipt;
  return { passed: true, report };
}

export function validateAuthStartProfileReport(report, claim, reportBytes = null) {
  const claimIdentity = claim && { ...claim, state: 'CLAIMED', reportWritten: false };
  let selectionSha256 = null;
  try {
    selectionSha256 = sha256(
      readFileSync(path.join(ROOT, AUTH_START_PROFILE.selectionEvidencePath)),
    );
  } catch {
    return { passed: false, reason: 'AUTH_START_SELECTION_EVIDENCE_MISSING' };
  }
  if (
    !validClaim(claimIdentity) ||
    !report ||
    typeof report !== 'object' ||
    Array.isArray(report) ||
    sortedKeys(report) !== [...REPORT_FIELDS].sort().join(',') ||
    report.evidenceKind !== AUTH_START_PROFILE.evidenceKind ||
    report.runNumber !== 95 ||
    report.frontierId !== AUTH_START_PROFILE.frontierId ||
    report.scenarioId !== null ||
    report.epochId !== AUTH_START_PROFILE.epochId ||
    report.profileId !== AUTH_START_PROFILE.id ||
    report.toolName !== AUTH_START_TOOL_NAME ||
    report.argumentProfile !== AUTH_START_PROFILE.argumentProfile ||
    report.acceptanceScope !== 'agent-mcp-matrix-only' ||
    report.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(AUTH_START_PROFILE) ||
    report.registrySha256 !== agentMcpProfileRegistrySha256(AUTH_START_PROFILE.id) ||
    report.selectionEvidenceSha256 !== selectionSha256 ||
    report.profile !== 'codex-luna-max-offline-agent-mcp-matrix-v1' ||
    report.acceptanceScope !== 'agent-mcp-matrix-only' ||
    report.model !== 'gpt-6-luna' ||
    report.reasoningEffort !== 'max' ||
    report.sourceRevision !== claim.sourceCandidateSha ||
    report.baseSha !== claim.baseSha ||
    report.ciSha !== claim.ciSha ||
    report.ciStatus !== 'SUCCESS' ||
    report.prNumber !== claim.prNumber ||
    report.claimId !== claim.claimId ||
    report.reviewerId !== claim.reviewerId ||
    report.mcpBundleSha256 !== claim.bundleSha256 ||
    report.runnerReceipt?.publicKeyBase64 !== claim.runnerReceiptPublicKey ||
    report.runnerReceipt?.publicKeySha256 !== claim.runnerReceiptPublicKeySha256 ||
    report.networkMode !== AUTH_START_PROFILE.networkMode ||
    report.serverToolNames?.length !== 1 ||
    report.serverToolNames[0] !== AUTH_START_TOOL_NAME ||
    report.serverToolCount !== 1 ||
    report.mcpServerNames?.length !== 1 ||
    report.mcpServerNames[0] !== AUTH_START_SERVER_ID ||
    report.processExitCode !== 0 ||
    report.resultStatus !== 'SUCCESS' ||
    report.eventStreamParsed !== true ||
    report.turnCompleted !== true ||
    report.codexMcpToolEventCount !== 1 ||
    report.codexErrorItemCount !== 0 ||
    report.nonMcpToolEventCount !== 0 ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== 1 ||
    report.deniedCallCount !== 0 ||
    report.answerCheckMethod !== AUTH_START_PROFILE.answerCheckMethod ||
    !/^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.serverSummarySha256 ?? '') ||
    report.eventStreamParsed !== true ||
    report.retryAllowed !== false ||
    report.reportWritten !== true ||
    report.answerUtf8Bytes > AUTH_START_PROFILE.maxAnswerBytes ||
    report.answerChecks?.answerSemanticsValid !== true ||
    sortedKeys(report.answerChecks) !== EXPECTED_ANSWER_CHECK_KEYS.join(',') ||
    sortedKeys(report.answerChecks.answer) !== EXPECTED_ANSWER_DETAIL_KEYS.join(',') ||
    canonicalJson(report.privacy) !== canonicalJson(EXPECTED_PRIVACY) ||
    report.offlineFixture?.authorizationHost !== 'oauth.invalid' ||
    report.offlineFixture?.httpRequestCount !== 0 ||
    report.offlineFixture?.oauthStateCount !== 1 ||
    report.offlineFixture?.providerScopeAbsent !== true ||
    report.privacy?.authorizationUrlPersisted !== false ||
    report.privacy?.oauthStatePersistedInReport !== false ||
    report.privacy?.clientIdPersisted !== false ||
    report.privacy?.principalIdPersisted !== false
  ) {
    return { passed: false, reason: 'AUTH_START_REPORT_FIELDS_INVALID' };
  }
  const bytes = reportBytes ?? Buffer.from(JSON.stringify(report), 'utf8');
  let parsedReport;
  try {
    parsedReport = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { passed: false, reason: 'AUTH_START_REPORT_BYTES_INVALID' };
  }
  if (canonicalJson(parsedReport) !== canonicalJson(report)) {
    return { passed: false, reason: 'AUTH_START_REPORT_BYTES_INVALID' };
  }
  const receipt = report.runnerReceipt;
  if (
    sortedKeys(receipt) !== 'kind,publicKeyBase64,publicKeySha256,schemaVersion,signature' ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND
  ) {
    return { passed: false, reason: 'AUTH_START_REPORT_RECEIPT_INVALID' };
  }
  const body = Object.fromEntries(
    Object.entries(report).filter(([key]) => key !== 'runnerReceipt'),
  );
  const signature = Buffer.from(receipt.signature ?? '', 'base64');
  let signatureValid = false;
  try {
    const publicKeyBytes = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
    signatureValid =
      publicKey.asymmetricKeyType === 'ed25519' &&
      verify(null, Buffer.from(canonicalJson(body)), publicKey, signature);
  } catch {
    signatureValid = false;
  }
  if (
    signature.length !== 64 ||
    signature.toString('base64') !== receipt.signature ||
    !signatureValid ||
    sha256(Buffer.from(receipt.publicKeyBase64, 'base64')) !== receipt.publicKeySha256
  ) {
    return { passed: false, reason: 'AUTH_START_REPORT_SIGNATURE_INVALID' };
  }
  const reportSha256 = sha256(bytes);
  const terminalClaim = claim.state === 'REPORT_WRITTEN' || claim.reportWritten === true;
  if ((terminalClaim && claim.reportSha256 !== reportSha256) || claim.retryAllowed !== false) {
    return { passed: false, reason: 'AUTH_START_REPORT_CLAIM_MISMATCH' };
  }
  return { passed: true, reason: null, reportSha256 };
}

export function validateAuthStartSanitizedReportFile(claim, root, reportPath) {
  try {
    const expectedRoot = path.resolve(ROOT);
    const suppliedRoot = path.resolve(root);
    const expectedPath = path.join(expectedRoot, AUTH_START_PROFILE.reportPath);
    if (suppliedRoot !== expectedRoot || path.resolve(reportPath) !== expectedPath) {
      return { passed: false, reason: 'AUTH_START_REPORT_PATH_INVALID' };
    }
    const bytes = readFileSync(expectedPath);
    if (bytes.length > 64 * 1024) return { passed: false, reason: 'AUTH_START_REPORT_TOO_LARGE' };
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateAuthStartProfileReport(report, claim, bytes);
    return { ...validation, reportPath: AUTH_START_PROFILE.reportPath };
  } catch {
    return { passed: false, reason: 'AUTH_START_REPORT_UNAVAILABLE' };
  }
}

export function writeAuthStartProfileReport(report) {
  let fd;
  try {
    fd = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(fd, `${JSON.stringify(report)}\n`, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    return sha256(readFileSync(REPORT_PATH));
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    throw error;
  }
}
