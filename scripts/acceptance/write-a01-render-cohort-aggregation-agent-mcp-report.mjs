import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS,
  A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
  A01_RENDER_COHORT_AGGREGATION_TOOL,
  assertA01RenderCohortAggregationOfflineProfile,
} from '../lib/a01-render-cohort-aggregation-offline-fixture.mjs';
import { buildG06PrivacySummary } from '../lib/g06-privacy-summary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(A01_RENDER_COHORT_AGGREGATION_PROFILE_ID);
if (!PROFILE) throw new Error('A01 render aggregation profile is not registered.');
assertA01RenderCohortAggregationOfflineProfile(PROFILE);
const REPORT_PATH = path.join(ROOT, PROFILE.reportPath);
const SERVER_ID = 'bgk_a01_render_cohort_aggregation_offline';
const ANSWER_CHECK_FIELDS = Object.freeze([
  'fixedArguments',
  'singleToolInvocation',
  'structuredResultReadback',
  'artifactMetadataMatched',
  'pngDecodedAndBounded',
  'offlineFixtureBounded',
]);
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
  'externalNetworkRequestCount',
  'writeActionReached',
  'qqPipelineTested',
  'timClientTested',
  'offlineFixture',
  'artifact',
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
const canonical = (value) => canonicalAgentMcpProfileJson(value);

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...expected].sort().join(','),
  );
}

function validClaim(claim) {
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
    claim.frontierId === PROFILE.frontierId &&
    claim.epochId === PROFILE.epochId &&
    claim.profileId === PROFILE.id &&
    claim.toolName === A01_RENDER_COHORT_AGGREGATION_TOOL &&
    claim.argumentProfile === PROFILE.argumentProfile &&
    claim.retryAllowed === false &&
    typeof claim.claimId === 'string' &&
    /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(claim.claimId) &&
    Number.isSafeInteger(claim.prNumber) &&
    /^[0-9a-f]{40}$/u.test(claim.sourceCandidateSha ?? '') &&
    /^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') &&
    claim.ciSha === claim.sourceCandidateSha &&
    claim.ciStatus === 'SUCCESS' &&
    typeof claim.reviewerId === 'string' &&
    new RegExp(`^gpt-6-luna-max-run95-pr${claim.prNumber}-round[1-9]\\d*$`, 'u').test(
      claim.reviewerId,
    ) &&
    /^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '') &&
    validPublicKey &&
    /^[0-9a-f]{64}$/u.test(claim.runnerReceiptPublicKeySha256 ?? '') &&
    sha256(publicKeyBytes) === claim.runnerReceiptPublicKeySha256 &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id),
  );
}

function validArtifactSummary(summary) {
  return Boolean(
    exactKeys(summary, ['resultState', 'artifact']) &&
    summary.resultState === 'artifact_returned' &&
    exactKeys(summary.artifact, [
      'returned',
      'persisted',
      'mimeType',
      'width',
      'height',
      'byteLength',
      'sha256',
      'pngSignatureValid',
      'decoded',
      'dimensionsMatch',
    ]) &&
    summary.artifact.returned === true &&
    summary.artifact.persisted === false &&
    summary.artifact.mimeType === 'image/png' &&
    Number.isSafeInteger(summary.artifact.width) &&
    summary.artifact.width === 720 &&
    Number.isSafeInteger(summary.artifact.height) &&
    summary.artifact.height > 0 &&
    summary.artifact.height <= 5000 &&
    summary.artifact.width * summary.artifact.height <= 10_000_000 &&
    Number.isSafeInteger(summary.artifact.byteLength) &&
    summary.artifact.byteLength > 0 &&
    summary.artifact.byteLength <= 5_000_000 &&
    /^[0-9a-f]{64}$/u.test(summary.artifact.sha256 ?? '') &&
    summary.artifact.pngSignatureValid === true &&
    summary.artifact.decoded === true &&
    summary.artifact.dimensionsMatch === true,
  );
}

function expectedOfflineFixture() {
  return {
    profile: A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
    requestCount: 2,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  };
}

function expectedPrivacy() {
  return {
    sourceMode: 'synthetic_offline_fixture',
    accountBound: false,
    oauthAttempted: false,
    accountDataRead: false,
    communityRead: false,
    htmlRead: false,
    privatePathRequested: false,
    writeActionReached: false,
    externalNetworkRequestCount: 0,
    qqPipelineTested: false,
    timClientTested: false,
    rawRowsStored: false,
    artifactBytesStored: false,
    credentialsStored: false,
  };
}

function parseAnswer(answer) {
  if (typeof answer !== 'string' || Buffer.byteLength(answer, 'utf8') > PROFILE.maxAnswerBytes) {
    return null;
  }
  try {
    const parsed = JSON.parse(answer);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateA01RenderCohortAggregationProfileRun(input) {
  if (!validClaim(input?.claim)) {
    return { passed: false, reason: 'A01_RENDER_AGGREGATION_CLAIM_INVALID', answerChecks: null };
  }
  const claim = input.claim;
  const summary = input.serverSummary;
  const events = input.events;
  const call = input.completedMcpCalls?.[0];
  const resultSummary = summary?.results?.[0]?.resultSummary;
  const artifact = resultSummary?.artifact;
  const answer = parseAnswer(input.answer);
  const expectedAnswer = artifact
    ? {
        resultState: 'artifact_returned',
        mimeType: artifact.mimeType,
        width: artifact.width,
        height: artifact.height,
        pngSignatureValid: artifact.pngSignatureValid,
        decoded: artifact.decoded,
        dimensionsMatch: artifact.dimensionsMatch,
      }
    : null;
  const answerChecks = {
    fixedArguments:
      canonical(call?.arguments) === canonical(A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS),
    singleToolInvocation:
      events?.codexMcpToolEventCount === 1 &&
      events?.completedMcpCalls?.length === 1 &&
      events?.toolCalls?.length === 1 &&
      events?.toolCalls?.[0]?.name === A01_RENDER_COHORT_AGGREGATION_TOOL &&
      events?.toolCalls?.[0]?.state === 'DONE' &&
      canonical(events?.mcpServerNames) === canonical([SERVER_ID]),
    structuredResultReadback:
      validArtifactSummary(resultSummary) &&
      canonical(call?.result?.structuredContent) === canonical(resultSummary) &&
      call?.result?.isError !== true,
    artifactMetadataMatched:
      answer !== null &&
      exactKeys(answer, [
        'resultState',
        'mimeType',
        'width',
        'height',
        'pngSignatureValid',
        'decoded',
        'dimensionsMatch',
      ]) &&
      canonical(answer) === canonical(expectedAnswer),
    pngDecodedAndBounded: validArtifactSummary(resultSummary),
    offlineFixtureBounded:
      canonical(summary?.offlineFixture) === canonical(expectedOfflineFixture()),
  };
  const serverSummaryValid = Boolean(
    exactKeys(summary, [
      'schemaVersion',
      'serverProfile',
      'profileId',
      'argumentProfile',
      'expectedCallCount',
      'networkMode',
      'sourceRevision',
      'bundleSha256',
      'catalogSha256',
      'toolName',
      'toolDescriptionSha256',
      'inputSchemaSha256',
      'serverToolNames',
      'serverToolCount',
      'expectedArgumentsSha256',
      'serverResultStatus',
      'allowedCallCount',
      'deniedCallCount',
      'argumentMatch',
      'results',
      'offlineFixture',
      'privacy',
      'serverInstanceId',
    ]) &&
    summary.schemaVersion === 1 &&
    summary.serverProfile === 'closed-profile-sequence-anonymous-offline-v1' &&
    summary.profileId === PROFILE.id &&
    summary.argumentProfile === PROFILE.argumentProfile &&
    summary.expectedCallCount === 1 &&
    summary.networkMode === PROFILE.networkMode &&
    summary.sourceRevision === claim.sourceCandidateSha &&
    summary.bundleSha256 === claim.bundleSha256 &&
    summary.toolName === A01_RENDER_COHORT_AGGREGATION_TOOL &&
    canonical(summary.serverToolNames) === canonical([A01_RENDER_COHORT_AGGREGATION_TOOL]) &&
    summary.serverToolCount === 1 &&
    summary.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    summary.serverResultStatus === 'SUCCESS' &&
    summary.allowedCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    summary.argumentMatch === true &&
    Array.isArray(summary.results) &&
    summary.results.length === 1 &&
    summary.results[0]?.sequenceIndex === 0 &&
    summary.results[0]?.status === 'SUCCESS' &&
    canonical(summary.privacy) === canonical(buildG06PrivacySummary()) &&
    /^[0-9a-f]{64}$/u.test(summary.catalogSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(summary.toolDescriptionSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(summary.inputSchemaSha256 ?? '') &&
    typeof summary.serverInstanceId === 'string' &&
    /^[0-9a-f-]{36}$/u.test(summary.serverInstanceId),
  );
  const eventsValid = Boolean(
    input.executionFailed === false &&
    input.processExitCode === 0 &&
    input.eventStreamParsed === true &&
    events?.eventStreamComplete === true &&
    events?.codexErrorItemCount === 0 &&
    events?.nonMcpToolEventCount === 0 &&
    events?.shellToolCallCount === 0 &&
    events?.completedMcpCalls?.length === 1 &&
    call?.tool === A01_RENDER_COHORT_AGGREGATION_TOOL &&
    call?.status === 'completed' &&
    events?.toolCalls?.length === 1 &&
    events.toolCalls[0]?.state === 'DONE',
  );
  const checksPass = Object.values(answerChecks).every((value) => value === true);
  const candidateMatches =
    claim.sourceCandidateSha === summary?.sourceRevision &&
    claim.bundleSha256 === summary?.bundleSha256;
  return {
    passed: Boolean(serverSummaryValid && eventsValid && checksPass && candidateMatches),
    reason:
      serverSummaryValid && eventsValid && checksPass && candidateMatches
        ? null
        : 'A01_RENDER_AGGREGATION_AGENT_MCP_ASSERTION_FAILED',
    answerChecks,
    serverSummaryValid,
    eventsValid,
  };
}

function catalogEvidenceMatches(report) {
  try {
    const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === A01_RENDER_COHORT_AGGREGATION_TOOL);
    return Boolean(
      tool?.auth === 'none' &&
      tool?.risk === 'read' &&
      report.catalogSha256 === sha256(catalogBytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonical(tool.inputSchema)),
    );
  } catch {
    return false;
  }
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

function claimStateIsValid(claim, reportBytes) {
  return (
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes))
  );
}

export function buildA01RenderCohortAggregationProfileReport(input, { privateKey }) {
  const validation = validateA01RenderCohortAggregationProfileRun(input);
  if (!privateKey || !validation.passed) {
    return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_INPUT_INVALID' };
  }
  const claim = input.claim;
  const summary = input.serverSummary;
  const resultSummary = summary.results[0].resultSummary;
  const artifact = resultSummary.artifact;
  const projection = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profile: 'codex-luna-max-one-tool-v1',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    codexCliVersion: input.codexCliVersion,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    scenarioId: null,
    acceptanceScope: PROFILE.acceptanceScope,
    claimId: claim.claimId,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    toolName: A01_RENDER_COHORT_AGGREGATION_TOOL,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    registrySha256: claim.registrySha256,
    selectionEvidenceSha256: sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath))),
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    mcpBundleSha256: claim.bundleSha256,
    catalogSha256: summary.catalogSha256,
    toolDescriptionSha256: summary.toolDescriptionSha256,
    inputSchemaSha256: summary.inputSchemaSha256,
    networkMode: PROFILE.networkMode,
    serverId: input.serverId,
    serverToolNames: [A01_RENDER_COHORT_AGGREGATION_TOOL],
    serverToolCount: 1,
    processExitCode: input.processExitCode,
    resultStatus: 'SUCCESS',
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
    externalNetworkRequestCount: 0,
    writeActionReached: false,
    qqPipelineTested: false,
    timClientTested: false,
    offlineFixture: expectedOfflineFixture(),
    artifact: {
      returned: true,
      persisted: false,
      mimeType: artifact.mimeType,
      width: artifact.width,
      height: artifact.height,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
    observedAt: new Date().toISOString(),
    answerSha256: sha256(input.answer),
    answerUtf8Bytes: Buffer.byteLength(input.answer, 'utf8'),
    answerChecks: validation.answerChecks,
    privacy: expectedPrivacy(),
    scenarios: [
      {
        id: A01_RENDER_COHORT_AGGREGATION_TOOL,
        passed: true,
        exactArgumentsMatched: true,
        oneToolAllowlistVerified: true,
        resultReadbackVerified: true,
        answerCheckPassed: true,
        answerChecks: validation.answerChecks,
        toolCalls: [{ name: A01_RENDER_COHORT_AGGREGATION_TOOL, state: 'DONE' }],
        resultSummary,
      },
    ],
    retryAllowed: false,
    reportWritten: true,
  };
  const signature = sign(null, Buffer.from(canonical(projection), 'utf8'), privateKey).toString(
    'base64',
  );
  const report = {
    ...projection,
    runnerReceipt: {
      kind: 'a01-render-cohort-aggregation-agent-mcp-runner-receipt-v1',
      publicKeyBase64: claim.runnerReceiptPublicKey,
      publicKeySha256: claim.runnerReceiptPublicKeySha256,
      signature,
    },
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { passed: true, report, reportBytes, reportSha256: sha256(reportBytes) };
}

export function verifyA01RenderCohortAggregationProfileReport(report, publicKey) {
  try {
    const receipt = report?.runnerReceipt;
    if (!report || !publicKey || typeof receipt?.signature !== 'string') return false;
    const signature = Buffer.from(receipt.signature, 'base64');
    if (
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt.signature) ||
      signature.toString('base64') !== receipt.signature
    ) {
      return false;
    }
    const sourceProjection = { ...report };
    delete sourceProjection.runnerReceipt;
    return verify(null, Buffer.from(canonical(sourceProjection), 'utf8'), publicKey, signature);
  } catch {
    return false;
  }
}

export function validateA01RenderCohortAggregationProfileReport(report, claim, reportBytes = null) {
  if (
    !validClaim(claim) ||
    !claimStateIsValid(claim, reportBytes) ||
    claim.profileId !== PROFILE.id ||
    claim.retryAllowed !== false ||
    !exactKeys(report, REPORT_FIELDS) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_CLAIM_INVALID' };
  }
  const scenario = report.scenarios?.[0];
  const expectedPrivacyValue = expectedPrivacy();
  const publicKeyBytes = Buffer.from(claim.runnerReceiptPublicKey, 'base64');
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
      sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath)));
  } catch {
    selectionEvidenceMatches = false;
  }
  const expectedArtifact = report.artifact;
  const artifactValid = Boolean(
    exactKeys(expectedArtifact, [
      'returned',
      'persisted',
      'mimeType',
      'width',
      'height',
      'byteLength',
      'sha256',
      'pngSignatureValid',
      'decoded',
      'dimensionsMatch',
    ]) &&
    expectedArtifact.returned === true &&
    expectedArtifact.persisted === false &&
    expectedArtifact.mimeType === 'image/png' &&
    expectedArtifact.width === 720 &&
    Number.isSafeInteger(expectedArtifact.height) &&
    expectedArtifact.height > 0 &&
    expectedArtifact.height <= 5000 &&
    expectedArtifact.width * expectedArtifact.height <= 10_000_000 &&
    Number.isSafeInteger(expectedArtifact.byteLength) &&
    expectedArtifact.byteLength > 0 &&
    expectedArtifact.byteLength <= 5_000_000 &&
    /^[0-9a-f]{64}$/u.test(expectedArtifact.sha256 ?? '') &&
    expectedArtifact.pngSignatureValid === true &&
    expectedArtifact.decoded === true &&
    expectedArtifact.dimensionsMatch === true,
  );
  const checksValid =
    exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(report.answerChecks).every((value) => value === true);
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
      'resultSummary',
    ]) &&
    scenario.id === A01_RENDER_COHORT_AGGREGATION_TOOL &&
    scenario.passed === true &&
    scenario.exactArgumentsMatched === true &&
    scenario.oneToolAllowlistVerified === true &&
    scenario.resultReadbackVerified === true &&
    scenario.answerCheckPassed === true &&
    canonical(scenario.answerChecks) === canonical(report.answerChecks) &&
    Array.isArray(scenario.toolCalls) &&
    scenario.toolCalls.length === 1 &&
    canonical(scenario.toolCalls[0]) ===
      canonical({ name: A01_RENDER_COHORT_AGGREGATION_TOOL, state: 'DONE' }) &&
    validArtifactSummary(scenario.resultSummary),
  );
  let valid = Boolean(
    report.schemaVersion === 1 &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.profile === 'codex-luna-max-one-tool-v1' &&
    report.model === 'gpt-6-luna' &&
    report.reasoningEffort === 'max' &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
    report.runNumber === 95 &&
    report.frontierId === 'A01' &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.scenarioId === null &&
    report.acceptanceScope === 'agent-mcp-matrix-only' &&
    /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? '') &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    new RegExp(`^gpt-6-luna-max-run95-pr${report.prNumber}-round[1-9]\\d*$`, 'u').test(
      report.reviewerId ?? '',
    ) &&
    report.toolName === A01_RENDER_COHORT_AGGREGATION_TOOL &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    /^[0-9a-f]{64}$/u.test(report.selectionEvidenceSha256 ?? '') &&
    selectionEvidenceMatches &&
    /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    catalogEvidenceMatches(report) &&
    report.networkMode === PROFILE.networkMode &&
    report.serverId === SERVER_ID &&
    canonical(report.serverToolNames) === canonical([A01_RENDER_COHORT_AGGREGATION_TOOL]) &&
    report.serverToolCount === 1 &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
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
    report.externalNetworkRequestCount === 0 &&
    report.writeActionReached === false &&
    report.qqPipelineTested === false &&
    report.timClientTested === false &&
    canonical(report.offlineFixture) === canonical(expectedOfflineFixture()) &&
    artifactValid &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
    checksValid &&
    exactKeys(report.privacy, Object.keys(expectedPrivacyValue)) &&
    canonical(report.privacy) === canonical(expectedPrivacyValue) &&
    Array.isArray(report.scenarios) &&
    report.scenarios.length === 1 &&
    scenarioValid &&
    report.retryAllowed === false &&
    report.reportWritten === true &&
    exactKeys(report.runnerReceipt, ['kind', 'publicKeyBase64', 'publicKeySha256', 'signature']) &&
    report.runnerReceipt.kind === 'a01-render-cohort-aggregation-agent-mcp-runner-receipt-v1' &&
    report.runnerReceipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
    publicKey?.asymmetricKeyType === 'ed25519' &&
    publicKeyBytes.toString('base64') === claim.runnerReceiptPublicKey &&
    sha256(publicKeyBytes) === report.runnerReceipt.publicKeySha256 &&
    report.runnerReceipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
    verifyA01RenderCohortAggregationProfileReport(report, publicKey),
  );
  if (!valid) return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_FIELDS_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: PROFILE.reportPath, report };
}

export function validateA01RenderCohortAggregationSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = REPORT_PATH,
) {
  try {
    const expectedPath = path.join(path.resolve(root), PROFILE.reportPath);
    if (path.resolve(reportPath) !== expectedPath) {
      return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_PATH_INVALID' };
    }
    const reportBytes = readFileSync(expectedPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    const validation = validateA01RenderCohortAggregationProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, reportSha256: sha256(reportBytes), reportPath: PROFILE.reportPath }
      : validation;
  } catch {
    return { passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_INPUT_INVALID' };
  }
}

export function writeA01RenderCohortAggregationProfileReport(
  report,
  { reportPath = REPORT_PATH } = {},
) {
  const outputPath = path.resolve(reportPath);
  if (outputPath !== REPORT_PATH || existsSync(outputPath)) {
    throw new Error('A01 render aggregation report path is fixed and create-once.');
  }
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx', 0o644);
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve create-new failure. */
      }
    }
    throw new Error('A01 render aggregation report already exists or cannot be safely written.');
  }
  return sha256(readFileSync(outputPath));
}

export { ANSWER_CHECK_FIELDS as A01_RENDER_COHORT_AGGREGATION_ANSWER_CHECK_FIELDS };
