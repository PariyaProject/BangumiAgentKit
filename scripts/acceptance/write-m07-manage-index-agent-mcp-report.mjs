import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  assertM07ManageIndexUnboundProfile,
  M07_MANAGE_INDEX_PROFILE_ID,
  M07_MANAGE_INDEX_REPORT_PATH,
  M07_MANAGE_INDEX_TOOL,
  sameArguments,
} from '../lib/m07-manage-index-unbound-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(ROOT, M07_MANAGE_INDEX_REPORT_PATH);
const SERVER_ID = 'bgk_m07_manage_index_auth_gate';
const AUTH_REQUIRED_TOOL_TEXT =
  'AUTH_REQUIRED: bind a Bangumi account before managing an index. No request was made.';
const REPORT_FIELDS = new Set([
  'schemaVersion',
  'evidenceKind',
  'profile',
  'model',
  'reasoningEffort',
  'codexCliVersion',
  'runNumber',
  'frontierId',
  'epochId',
  'profileId',
  'scenarioId',
  'acceptanceScope',
  'claimId',
  'prNumber',
  'reviewerId',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'registrySha256',
  'selectionEvidenceSha256',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'mcpBundleSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'networkMode',
  'serverId',
  'serverToolNames',
  'serverToolCount',
  'processExitCode',
  'resultStatus',
  'resultCount',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'accountBindingCount',
  'httpRequestCount',
  'writeActionReached',
  'qqPipelineTested',
  'timClientTested',
  'observedAt',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'privacy',
  'scenarios',
  'retryAllowed',
  'reportWritten',
  'runnerReceipt',
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const ANSWER_CHECK_FIELDS = Object.freeze([
  'fixedArguments',
  'singleToolInvocation',
  'authRequiredExplained',
  'noIndexActionClaimed',
  'noAccountActivationClaimed',
  'noOAuthStartedClaimed',
  'noNetworkRequestClaimed',
]);

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...expected].sort().join(','),
  );
}

function answerExplainsGate(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Buffer.byteLength(value, 'utf8') <= 512 &&
    /AUTH_REQUIRED|account|账号/iu.test(value) &&
    (/(?:需要|必须|must|required).{0,24}(?:绑定|bind)/iu.test(value) ||
      /(?:绑定|bind).{0,24}(?:account|账号)/iu.test(value)) &&
    !/已创建目录|目录创建成功|index created/iu.test(value)
  );
}

function validClaim(claim) {
  const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
  if (!profile) return false;
  try {
    assertM07ManageIndexUnboundProfile(profile);
  } catch {
    return false;
  }
  const publicKeyBytes = Buffer.from(claim?.runnerReceiptPublicKey ?? '', 'base64');
  let validPublicKey = false;
  try {
    validPublicKey =
      publicKeyBytes.toString('base64') === claim.runnerReceiptPublicKey &&
      createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' }).asymmetricKeyType ===
        'ed25519';
  } catch {
    validPublicKey = false;
  }
  return Boolean(
    claim &&
    claim.runNumber === 95 &&
    claim.frontierId === 'M07' &&
    claim.epochId === profile.epochId &&
    claim.profileId === profile.id &&
    claim.toolName === M07_MANAGE_INDEX_TOOL &&
    claim.argumentProfile === profile.argumentProfile &&
    claim.retryAllowed === false &&
    typeof claim.claimId === 'string' &&
    typeof claim.prNumber === 'number' &&
    typeof claim.sourceCandidateSha === 'string' &&
    /^[0-9a-f]{40}$/u.test(claim.sourceCandidateSha) &&
    typeof claim.baseSha === 'string' &&
    /^[0-9a-f]{40}$/u.test(claim.baseSha) &&
    claim.ciSha === claim.sourceCandidateSha &&
    claim.ciStatus === 'SUCCESS' &&
    typeof claim.reviewerId === 'string' &&
    new RegExp(`^gpt-6-luna-max-run95-pr${claim.prNumber}-round[1-9]\\d*$`, 'u').test(
      claim.reviewerId,
    ) &&
    typeof claim.bundleSha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(claim.bundleSha256) &&
    validPublicKey &&
    /^[0-9a-f]{64}$/u.test(claim.runnerReceiptPublicKeySha256 ?? '') &&
    sha256(publicKeyBytes) === claim.runnerReceiptPublicKeySha256 &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(profile.id),
  );
}

export function validateM07ProfileRun(input) {
  const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
  if (!profile || !validClaim(input?.claim)) {
    return { passed: false, reason: 'M07_CLAIM_INVALID', answerChecks: null };
  }
  const claim = input.claim;
  const summary = input.serverSummary;
  const events = input.events;
  const call = input.completedMcpCalls?.[0];
  const expectedAnswerChecks = {
    fixedArguments: sameArguments(call?.arguments),
    singleToolInvocation:
      events?.codexMcpToolEventCount === 1 &&
      events?.completedMcpCalls?.length === 1 &&
      events?.toolCalls?.length === 1 &&
      events?.toolCalls?.[0]?.name === M07_MANAGE_INDEX_TOOL &&
      events?.toolCalls?.[0]?.state === 'DONE',
    authRequiredExplained: answerExplainsGate(input?.answer),
    noIndexActionClaimed:
      typeof input?.answer === 'string' &&
      /(?:未|没有|未曾).{0,8}(?:执行|进行).{0,8}索引操作/iu.test(input.answer) &&
      !/已创建目录|创建成功|已编辑目录|已添加条目|已移除条目|index created/iu.test(input.answer),
    noAccountActivationClaimed:
      typeof input?.answer === 'string' &&
      /(?:未|没有|未曾).{0,8}(?:绑定|登录)/iu.test(input.answer) &&
      !/正在授权|开始 OAuth|完成绑定|登录成功|authoriz(?:e|ation) (?:now|started)/iu.test(
        input.answer,
      ),
    noOAuthStartedClaimed:
      typeof input?.answer === 'string' &&
      /(?:未|没有|未曾).{0,8}(?:发起|开始|启动).{0,8}OAuth/iu.test(input.answer) &&
      !/已(?:发起|开始|启动).{0,8}OAuth|OAuth (?:started|completed|succeeded)/iu.test(input.answer),
    noNetworkRequestClaimed:
      typeof input?.answer === 'string' &&
      /(?:未|没有|未曾).{0,8}(?:发送|发出).{0,8}(?:网络)?请求/iu.test(input.answer) &&
      !/(?:已|成功).{0,8}(?:发送|发出).{0,8}(?:网络)?请求/iu.test(input.answer),
  };
  const expectedPrivacyValue = expectedPrivacy();
  const toolContent = call?.result?.content;
  const exactAuthRequiredContent =
    Array.isArray(toolContent) &&
    toolContent.length === 1 &&
    toolContent[0]?.type === 'text' &&
    toolContent[0]?.text === AUTH_REQUIRED_TOOL_TEXT;
  const summaryValid = Boolean(
    exactKeys(summary, [
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
      'serverResultStatus',
      'allowedCallCount',
      'deniedCallCount',
      'argumentMatch',
      'accountBindingCount',
      'httpRequestCount',
      'authRequiredCount',
      'writeActionReached',
      'privacy',
    ]) &&
    summary.schemaVersion === 1 &&
    summary.profileId === profile.id &&
    summary.networkMode === profile.networkMode &&
    summary.sourceRevision === claim.sourceCandidateSha &&
    summary.bundleSha256 === claim.bundleSha256 &&
    summary.serverToolNames?.length === 1 &&
    summary.serverToolNames[0] === M07_MANAGE_INDEX_TOOL &&
    summary.serverToolCount === 1 &&
    summary.toolName === M07_MANAGE_INDEX_TOOL &&
    summary.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    summary.argumentMatch === true &&
    summary.serverResultStatus === 'AUTH_REQUIRED' &&
    summary.allowedCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    summary.accountBindingCount === 0 &&
    summary.authRequiredCount === 1 &&
    summary.httpRequestCount === 0 &&
    summary.writeActionReached === false &&
    exactKeys(summary.privacy, Object.keys(expectedPrivacyValue)) &&
    canonicalAgentMcpProfileJson(summary.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacyValue),
  );
  const eventValid = Boolean(
    !input.executionFailed &&
    input.processExitCode === 0 &&
    input.eventStreamParsed === true &&
    events?.eventStreamComplete === true &&
    events?.turnCompleted === true &&
    events?.turnFailed === false &&
    events?.unexpectedEventTypes === 0 &&
    events?.codexMcpToolEventCount === 1 &&
    events?.codexErrorItemCount === 0 &&
    events?.nonMcpToolEventCount === 0 &&
    events?.shellToolCallCount === 0 &&
    events?.mcpServerNames?.length === 1 &&
    events.mcpServerNames[0] === input.serverId &&
    call?.tool === M07_MANAGE_INDEX_TOOL &&
    call?.status === 'completed' &&
    call?.result?.isError !== true &&
    exactAuthRequiredContent,
  );
  const checksPass =
    exactKeys(expectedAnswerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(expectedAnswerChecks).every((value) => value === true);
  return {
    passed: eventValid && summaryValid && checksPass,
    reason: eventValid && summaryValid && checksPass ? null : 'M07_AGENT_MCP_ASSERTION_FAILED',
    answerChecks: expectedAnswerChecks,
    summaryValid,
    eventValid,
  };
}

export function buildM07ProfileReport(input, { privateKey }) {
  if (!privateKey || !validateM07ProfileRun(input).passed) {
    return { passed: false, reason: 'M07_REPORT_INPUT_INVALID' };
  }
  const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
  const { claim, serverSummary } = input;
  const answer = input.answer;
  const publicKeyBytes = Buffer.from(claim.runnerReceiptPublicKey, 'base64');
  const sourceProjection = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    profile: 'codex-luna-max-one-tool-v1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: input.codexCliVersion,
    runNumber: 95,
    frontierId: 'M07',
    epochId: profile.epochId,
    profileId: profile.id,
    scenarioId: null,
    acceptanceScope: profile.acceptanceScope,
    claimId: claim.claimId,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    toolName: M07_MANAGE_INDEX_TOOL,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    registrySha256: claim.registrySha256,
    selectionEvidenceSha256: sha256(readFileSync(path.join(ROOT, profile.selectionEvidencePath))),
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    mcpBundleSha256: claim.bundleSha256,
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    networkMode: profile.networkMode,
    serverId: input.serverId,
    serverToolNames: [M07_MANAGE_INDEX_TOOL],
    serverToolCount: 1,
    processExitCode: input.processExitCode,
    resultStatus: 'AUTH_REQUIRED',
    resultCount: 1,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    accountBindingCount: 0,
    httpRequestCount: 0,
    writeActionReached: false,
    qqPipelineTested: false,
    timClientTested: false,
    observedAt: new Date().toISOString(),
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks: validateM07ProfileRun(input).answerChecks,
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
    scenarios: [
      {
        id: M07_MANAGE_INDEX_TOOL,
        passed: true,
        exactArgumentsMatched: true,
        oneToolAllowlistVerified: true,
        resultReadbackVerified: true,
        answerCheckPassed: true,
        answerChecks: validateM07ProfileRun(input).answerChecks,
        toolCalls: [{ name: M07_MANAGE_INDEX_TOOL, state: 'DONE' }],
        result: {
          toolName: M07_MANAGE_INDEX_TOOL,
          resultState: 'AUTH_REQUIRED',
          httpRequestCount: 0,
          writeActionReached: false,
          resultSha256: sha256(
            canonicalAgentMcpProfileJson({
              state: 'AUTH_REQUIRED',
              action: 'create',
              httpRequestCount: 0,
              writeActionReached: false,
            }),
          ),
          resultByteLength: Buffer.byteLength(
            canonicalAgentMcpProfileJson({
              state: 'AUTH_REQUIRED',
              action: 'create',
              httpRequestCount: 0,
              writeActionReached: false,
            }),
            'utf8',
          ),
        },
      },
    ],
    retryAllowed: false,
    reportWritten: true,
  };
  const signature = sign(
    null,
    Buffer.from(canonicalAgentMcpProfileJson(sourceProjection), 'utf8'),
    privateKey,
  ).toString('base64');
  const report = {
    ...sourceProjection,
    runnerReceipt: {
      kind: 'm07-manage-index-agent-mcp-runner-receipt-v1',
      publicKeyBase64: claim.runnerReceiptPublicKey,
      publicKeySha256: claim.runnerReceiptPublicKeySha256,
      signature,
    },
  };
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8');
  return {
    passed: true,
    report,
    reportBytes: bytes,
    reportSha256: sha256(bytes),
    runnerReceiptPublicKey: publicKeyBytes,
  };
}

export function verifyM07ProfileReport(report, publicKey) {
  try {
    const receipt = report?.runnerReceipt;
    if (!report || !publicKey || typeof receipt?.signature !== 'string') return false;
    const signature = Buffer.from(receipt.signature, 'base64');
    if (
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt.signature) ||
      signature.toString('base64') !== receipt.signature
    )
      return false;
    const sourceProjection = { ...report };
    delete sourceProjection.runnerReceipt;
    return verify(
      null,
      Buffer.from(canonicalAgentMcpProfileJson(sourceProjection), 'utf8'),
      publicKey,
      signature,
    );
  } catch {
    return false;
  }
}

function expectedPrivacy() {
  return {
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
  };
}

function matchesClaim(report, claim) {
  return Boolean(
    report.claimId === claim.claimId &&
    report.profileId === claim.profileId &&
    report.runNumber === claim.runNumber &&
    report.frontierId === claim.frontierId &&
    report.epochId === claim.epochId &&
    report.prNumber === claim.prNumber &&
    report.sourceRevision === claim.sourceCandidateSha &&
    report.baseSha === claim.baseSha &&
    report.ciSha === claim.ciSha &&
    report.ciStatus === claim.ciStatus &&
    report.reviewerId === claim.reviewerId &&
    report.mcpBundleSha256 === claim.bundleSha256 &&
    report.registrySha256 === claim.registrySha256 &&
    report.toolName === claim.toolName &&
    report.argumentProfile === claim.argumentProfile &&
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    report.runnerReceipt?.publicKeyBase64 === claim.runnerReceiptPublicKey &&
    report.runnerReceipt?.publicKeySha256 === claim.runnerReceiptPublicKeySha256,
  );
}

function catalogEvidenceMatches(report) {
  try {
    const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === M07_MANAGE_INDEX_TOOL);
    return (
      tool?.auth === 'required' &&
      tool?.risk === 'write' &&
      report.catalogSha256 === sha256(catalogBytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema))
    );
  } catch {
    return false;
  }
}

function claimStateIsValid(claim, reportBytes) {
  return (
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes))
  );
}

export function validateM07ProfileReport(report, claim, reportBytes = null) {
  const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
  if (
    !profile ||
    !validClaim(claim) ||
    !claimStateIsValid(claim, reportBytes) ||
    claim.profileId !== profile.id ||
    claim.retryAllowed !== false ||
    !exactKeys(report, REPORT_FIELDS) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'M07_REPORT_CLAIM_INVALID' };
  }

  const answerChecks = report.answerChecks;
  const scenario = report.scenarios?.[0];
  const expectedResult = {
    state: 'AUTH_REQUIRED',
    action: 'create',
    httpRequestCount: 0,
    writeActionReached: false,
  };
  const expectedResultSha256 = sha256(canonicalAgentMcpProfileJson(expectedResult));
  const expectedResultByteLength = Buffer.byteLength(
    canonicalAgentMcpProfileJson(expectedResult),
    'utf8',
  );
  const expectedPrivacyValue = expectedPrivacy();
  const checksValid =
    exactKeys(answerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(answerChecks).every((value) => value === true);
  const scenarioValid = Boolean(
    exactKeys(scenario, [
      'id',
      'passed',
      'exactArgumentsMatched',
      'oneToolAllowlistVerified',
      'resultReadbackVerified',
      'answerCheckPassed',
      'answerChecks',
      'toolCalls',
      'result',
    ]) &&
    scenario.id === M07_MANAGE_INDEX_TOOL &&
    scenario.passed === true &&
    scenario.exactArgumentsMatched === true &&
    scenario.oneToolAllowlistVerified === true &&
    scenario.resultReadbackVerified === true &&
    scenario.answerCheckPassed === true &&
    exactKeys(scenario.answerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(scenario.answerChecks).every((value) => value === true) &&
    Array.isArray(scenario.toolCalls) &&
    scenario.toolCalls.length === 1 &&
    canonicalAgentMcpProfileJson(scenario.toolCalls[0]) ===
      canonicalAgentMcpProfileJson({ name: M07_MANAGE_INDEX_TOOL, state: 'DONE' }) &&
    exactKeys(scenario.result, [
      'toolName',
      'resultState',
      'httpRequestCount',
      'writeActionReached',
      'resultSha256',
      'resultByteLength',
    ]) &&
    scenario.result.toolName === M07_MANAGE_INDEX_TOOL &&
    scenario.result.resultState === 'AUTH_REQUIRED' &&
    scenario.result.httpRequestCount === 0 &&
    scenario.result.writeActionReached === false &&
    scenario.result.resultSha256 === expectedResultSha256 &&
    scenario.result.resultByteLength === expectedResultByteLength,
  );
  const publicKeyBytes = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
  let publicKey = null;
  try {
    publicKey = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
  } catch {
    publicKey = null;
  }
  let selectionEvidenceMatches = false;
  try {
    selectionEvidenceMatches =
      report.selectionEvidenceSha256 ===
      sha256(readFileSync(path.join(ROOT, profile.selectionEvidencePath)));
  } catch {
    selectionEvidenceMatches = false;
  }
  const valid = Boolean(
    report.schemaVersion === 1 &&
    report.evidenceKind === profile.evidenceKind &&
    report.profile === 'codex-luna-max-one-tool-v1' &&
    report.model === 'gpt-6-luna' &&
    report.reasoningEffort === 'max' &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
    report.runNumber === 95 &&
    report.frontierId === 'M07' &&
    report.epochId === profile.epochId &&
    report.profileId === profile.id &&
    report.scenarioId === null &&
    report.acceptanceScope === 'agent-mcp-matrix-only' &&
    /^profile-run-95-pr\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? '') &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    new RegExp(`^gpt-6-luna-max-run95-pr${report.prNumber}-round[1-9]\\d*$`, 'u').test(
      report.reviewerId ?? '',
    ) &&
    report.toolName === M07_MANAGE_INDEX_TOOL &&
    report.argumentProfile === profile.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    report.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
    /^[0-9a-f]{64}$/u.test(report.selectionEvidenceSha256 ?? '') &&
    selectionEvidenceMatches &&
    /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    catalogEvidenceMatches(report) &&
    report.networkMode === profile.networkMode &&
    report.serverId === SERVER_ID &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([M07_MANAGE_INDEX_TOOL]) &&
    report.serverToolCount === 1 &&
    report.processExitCode === 0 &&
    report.resultStatus === 'AUTH_REQUIRED' &&
    report.resultCount === 1 &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 1 &&
    report.codexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.accountBindingCount === 0 &&
    report.httpRequestCount === 0 &&
    report.writeActionReached === false &&
    report.qqPipelineTested === false &&
    report.timClientTested === false &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= profile.maxAnswerBytes &&
    checksValid &&
    exactKeys(report.privacy, Object.keys(expectedPrivacyValue)) &&
    canonicalAgentMcpProfileJson(report.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacyValue) &&
    Array.isArray(report.scenarios) &&
    report.scenarios.length === 1 &&
    scenarioValid &&
    report.retryAllowed === false &&
    report.reportWritten === true &&
    exactKeys(report.runnerReceipt, ['kind', 'publicKeyBase64', 'publicKeySha256', 'signature']) &&
    report.runnerReceipt.kind === 'm07-manage-index-agent-mcp-runner-receipt-v1' &&
    report.runnerReceipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
    publicKey?.asymmetricKeyType === 'ed25519' &&
    publicKeyBytes.toString('base64') === claim.runnerReceiptPublicKey &&
    sha256(publicKeyBytes) === report.runnerReceipt.publicKeySha256 &&
    report.runnerReceipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
    verifyM07ProfileReport(report, publicKey),
  );
  if (!valid) return { passed: false, reason: 'M07_REPORT_FIELDS_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'M07_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: M07_MANAGE_INDEX_REPORT_PATH, report };
}

export function validateM07SanitizedReportFile(claim, root = ROOT, reportPath = REPORT_PATH) {
  try {
    const expectedPath = path.join(path.resolve(root), M07_MANAGE_INDEX_REPORT_PATH);
    if (path.resolve(reportPath) !== expectedPath) {
      return { passed: false, reason: 'M07_REPORT_PATH_INVALID' };
    }
    const reportBytes = readFileSync(expectedPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    const validation = validateM07ProfileReport(report, claim, reportBytes);
    return validation.passed
      ? {
          ...validation,
          reportSha256: sha256(reportBytes),
          reportPath: M07_MANAGE_INDEX_REPORT_PATH,
        }
      : validation;
  } catch {
    return { passed: false, reason: 'M07_REPORT_INPUT_INVALID' };
  }
}

export function writeM07ProfileReport(report, { reportPath = REPORT_PATH } = {}) {
  const outputPath = path.resolve(reportPath);
  if (outputPath !== REPORT_PATH || existsSync(outputPath)) {
    throw new Error('M07 report path is fixed and create-once.');
  }
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx', 0o644);
    writeFileSync(descriptor, JSON.stringify(report, null, 2) + '\n', 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve create-new failure. */
      }
    }
    throw new Error('M07 report already exists or cannot be safely written.');
  }
  return sha256(readFileSync(outputPath));
}

export const M07_ANSWER_CHECK_FIELDS = ANSWER_CHECK_FIELDS;
