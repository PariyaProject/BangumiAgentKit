import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { C01_PROFILE_ID, verifyC01Answer } from '../lib/c01-rating-count-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(C01_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE.reportPath;
const RECEIPT_KIND = 'c01-rating-count-runner-receipt-v1';
const REPORT_KEYS = [
  'schemaVersion',
  'evidenceKind',
  'profileId',
  'runNumber',
  'frontierId',
  'epochId',
  'prNumber',
  'claimId',
  'candidateSha',
  'baseSha',
  'ciSha',
  'ciStatus',
  'reviewerId',
  'toolName',
  'argumentProfile',
  'arguments',
  'expectedArgumentsSha256',
  'bundleSha256',
  'registrySha256',
  'codexCliVersion',
  'resultStatus',
  'source',
  'answer',
  'events',
  'privacy',
  'eventStreamSha256',
  'serverSummarySha256',
  'runnerReceipt',
];
const ANSWER_KEYS = ['sha256', 'checks'];
const CHECK_KEYS = [
  'exactSubjectIdsAndNames',
  'exactRatingTotals',
  'exactSignedDelta',
  'thresholdNotInvented',
  'statisticalSignificanceNotClaimed',
  'currentComparisonState',
];
const EVENT_KEYS = [
  'processExitCode',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'mcpServerNames',
  'allowedCallCount',
  'deniedCallCount',
];
const PRIVACY_KEYS = [
  'authProfile',
  'oauthAttempted',
  'accountDataRead',
  'writesAttempted',
  'communityRead',
  'qqPipelineTested',
  'timClientTested',
  'rawAnswerStored',
  'rawResultStored',
  'credentialsStored',
];
const RECEIPT_KEYS = [
  'schemaVersion',
  'kind',
  'publicKeyBase64',
  'publicKeySha256',
  'payload',
  'signature',
];
const RECEIPT_PAYLOAD_KEYS = [
  'schemaVersion',
  'kind',
  'claimId',
  'profileId',
  'runNumber',
  'frontierId',
  'epochId',
  'prNumber',
  'sourceCandidateSha',
  'baseSha',
  'ciSha',
  'ciStatus',
  'reviewerId',
  'bundleSha256',
  'registrySha256',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'answerSha256',
  'sourceSha256',
  'answerChecksSha256',
  'eventStreamSha256',
  'serverSummarySha256',
  'codexCliVersion',
  'processExitCode',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) =>
  isRecord(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const isBase64Signature = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9+/]{86}==$|^[A-Za-z0-9+/]{87}=$/u.test(value);

function projectionFromSource(source) {
  if (!isRecord(source) || !Array.isArray(source.subjects) || source.subjects.length !== 2)
    return null;
  const expectedIds = PROFILE.calls[0].arguments.subjectIds;
  const subjects = source.subjects;
  if (
    subjects.some(
      (row, index) =>
        !exactKeys(row, ['subjectId', 'name', 'ratingTotal']) ||
        row.subjectId !== expectedIds[index] ||
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        !Number.isSafeInteger(row.ratingTotal) ||
        row.ratingTotal < 0,
    )
  )
    return null;
  const values = subjects.map((row) => row.ratingTotal);
  const sourceEvidence = source.sourceEvidence;
  if (
    (source.state !== 'complete' && source.state !== 'partial') ||
    !exactKeys(source, [
      'state',
      'subjectIds',
      'subjects',
      'ratingTotal',
      'sourceEvidence',
      'coverage',
    ]) ||
    JSON.stringify(source.subjectIds) !== JSON.stringify(expectedIds) ||
    !exactKeys(source.ratingTotal, ['state', 'values', 'delta']) ||
    source.ratingTotal.state !== 'complete' ||
    JSON.stringify(source.ratingTotal.values) !== JSON.stringify(values) ||
    source.ratingTotal.delta !== values[1] - values[0] ||
    !exactKeys(sourceEvidence, [
      'officialOperations',
      'officialAttemptedAt',
      'officialRetrievedAt',
      'derivedOperations',
      'derivedFormulaVersion',
      'derivedRetrievedAt',
    ]) ||
    !Array.isArray(sourceEvidence.officialOperations) ||
    sourceEvidence.officialOperations.length === 0 ||
    sourceEvidence.officialOperations.some(
      (operation) => typeof operation !== 'string' || !operation.trim(),
    ) ||
    typeof sourceEvidence.officialAttemptedAt !== 'string' ||
    typeof sourceEvidence.officialRetrievedAt !== 'string' ||
    !Array.isArray(sourceEvidence.derivedOperations) ||
    !sourceEvidence.derivedOperations.includes('subject-comparison') ||
    sourceEvidence.derivedFormulaVersion !== 'subject-comparison-v2' ||
    (sourceEvidence.derivedRetrievedAt !== null &&
      typeof sourceEvidence.derivedRetrievedAt !== 'string') ||
    !exactKeys(source.coverage, [
      'requestedSubjects',
      'returnedSubjects',
      'subjectsComplete',
      'subjectsPartial',
      'limits',
    ]) ||
    source.coverage.requestedSubjects !== 2 ||
    source.coverage.returnedSubjects !== 2 ||
    !exactKeys(source.coverage.limits, ['maxCast', 'maxStaff', 'maxRelations']) ||
    source.coverage.limits.maxCast !== 1 ||
    source.coverage.limits.maxStaff !== 1 ||
    source.coverage.limits.maxRelations !== 1
  )
    return null;
  return source;
}

export function buildC01RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (!isRecord(report) || !isSha256(eventStreamSha256) || !isSha256(serverSummarySha256)) {
    throw new TypeError('C01 runner receipt requires exact sanitized report inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    claimId: report.claimId,
    profileId: report.profileId,
    runNumber: report.runNumber,
    frontierId: report.frontierId,
    epochId: report.epochId,
    prNumber: report.prNumber,
    sourceCandidateSha: report.candidateSha,
    baseSha: report.baseSha,
    ciSha: report.ciSha,
    ciStatus: report.ciStatus,
    reviewerId: report.reviewerId,
    bundleSha256: report.bundleSha256,
    registrySha256: report.registrySha256,
    toolName: report.toolName,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    answerSha256: report.answer.sha256,
    sourceSha256: sha256(canonicalAgentMcpProfileJson(report.source)),
    answerChecksSha256: sha256(canonicalAgentMcpProfileJson(report.answer.checks)),
    eventStreamSha256,
    serverSummarySha256,
    codexCliVersion: report.codexCliVersion,
    processExitCode: report.events.processExitCode,
    eventStreamParsed: report.events.eventStreamParsed,
    turnCompleted: report.events.turnCompleted,
    codexMcpToolEventCount: report.events.codexMcpToolEventCount,
    codexErrorItemCount: report.events.codexErrorItemCount,
    nonMcpToolEventCount: report.events.nonMcpToolEventCount,
    shellToolCallCount: report.events.shellToolCallCount,
    allowedCallCount: report.events.allowedCallCount,
    deniedCallCount: report.events.deniedCallCount,
  };
}

export function createC01RunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  if (!exactKeys(payload, RECEIPT_PAYLOAD_KEYS)) {
    throw new TypeError('C01 runner receipt payload fields are invalid.');
  }
  if (typeof publicKeyBase64 !== 'string' || publicKeyBase64.length === 0 || !privateKey) {
    throw new TypeError('C01 runner receipt signing key is invalid.');
  }
  const signature = sign(
    null,
    Buffer.from(canonicalAgentMcpProfileJson(payload)),
    privateKey,
  ).toString('base64');
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64,
    publicKeySha256: sha256(Buffer.from(publicKeyBase64, 'base64')),
    payload,
    signature,
  };
}

function validateC01ProfileReport(report, claim) {
  if (!PROFILE || !exactKeys(report, REPORT_KEYS))
    return { passed: false, reason: 'C01_REPORT_FIELDS_INVALID' };
  const expectedArguments = PROFILE.calls.map((call) => call.arguments);
  if (
    report.schemaVersion !== 1 ||
    report.evidenceKind !== PROFILE.evidenceKind ||
    report.profileId !== PROFILE.id ||
    report.runNumber !== 95 ||
    report.frontierId !== PROFILE.frontierId ||
    report.epochId !== PROFILE.epochId ||
    report.prNumber !== claim.prNumber ||
    report.claimId !== claim.claimId ||
    report.candidateSha !== claim.sourceCandidateSha ||
    report.baseSha !== claim.baseSha ||
    report.ciSha !== claim.ciSha ||
    report.ciStatus !== 'SUCCESS' ||
    report.reviewerId !== claim.reviewerId ||
    report.toolName !== PROFILE.toolName ||
    report.argumentProfile !== PROFILE.argumentProfile ||
    canonicalAgentMcpProfileJson(report.arguments) !==
      canonicalAgentMcpProfileJson(expectedArguments) ||
    report.expectedArgumentsSha256 !== claim.expectedArgumentsSha256 ||
    report.bundleSha256 !== claim.bundleSha256 ||
    report.registrySha256 !== claim.registrySha256 ||
    typeof report.codexCliVersion !== 'string' ||
    report.resultStatus !== 'SUCCESS' ||
    !isSha256(report.eventStreamSha256) ||
    !isSha256(report.serverSummarySha256)
  )
    return { passed: false, reason: 'C01_REPORT_CLAIM_MISMATCH' };

  const source = projectionFromSource(report.source);
  if (!source) return { passed: false, reason: 'C01_SOURCE_PROJECTION_INVALID' };
  if (
    !exactKeys(report.answer, ANSWER_KEYS) ||
    !isSha256(report.answer.sha256) ||
    !exactKeys(report.answer.checks, CHECK_KEYS) ||
    report.answer.checks.exactSubjectIdsAndNames !== true ||
    report.answer.checks.exactRatingTotals !== true ||
    report.answer.checks.exactSignedDelta !== true ||
    report.answer.checks.thresholdNotInvented !== true ||
    report.answer.checks.statisticalSignificanceNotClaimed !== true ||
    report.answer.checks.currentComparisonState !== source.state
  )
    return { passed: false, reason: 'C01_ANSWER_CHECKS_INVALID' };

  if (
    !exactKeys(report.events, EVENT_KEYS) ||
    report.events.processExitCode !== 0 ||
    report.events.eventStreamParsed !== true ||
    report.events.turnCompleted !== true ||
    report.events.codexMcpToolEventCount !== 1 ||
    report.events.codexErrorItemCount !== 0 ||
    report.events.nonMcpToolEventCount !== 0 ||
    !Array.isArray(report.events.nonMcpToolTypes) ||
    report.events.nonMcpToolTypes.length !== 0 ||
    report.events.shellToolCallCount !== 0 ||
    JSON.stringify(report.events.mcpServerNames) !== JSON.stringify(['bgk_c01_one_tool']) ||
    report.events.allowedCallCount !== 1 ||
    report.events.deniedCallCount !== 0
  )
    return { passed: false, reason: 'C01_EVENTS_INVALID' };

  if (
    !exactKeys(report.privacy, PRIVACY_KEYS) ||
    report.privacy.authProfile !== 'anonymous_public' ||
    report.privacy.oauthAttempted !== false ||
    report.privacy.accountDataRead !== false ||
    report.privacy.writesAttempted !== false ||
    report.privacy.communityRead !== false ||
    report.privacy.qqPipelineTested !== false ||
    report.privacy.timClientTested !== false ||
    report.privacy.rawAnswerStored !== false ||
    report.privacy.rawResultStored !== false ||
    report.privacy.credentialsStored !== false
  )
    return { passed: false, reason: 'C01_PRIVACY_FIELDS_INVALID' };

  const receipt = report.runnerReceipt;
  if (
    !exactKeys(receipt, RECEIPT_KEYS) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== claim.runnerReceiptPublicKey ||
    receipt.publicKeySha256 !== sha256(Buffer.from(receipt.publicKeyBase64, 'base64')) ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_KEYS) ||
    !isRecord(receipt.payload) ||
    !isBase64Signature(receipt.signature)
  )
    return { passed: false, reason: 'C01_RECEIPT_FIELDS_INVALID' };
  const expectedPayload = buildC01RunnerReceiptPayload(report, {
    eventStreamSha256: report.eventStreamSha256,
    serverSummarySha256: report.serverSummarySha256,
  });
  if (
    canonicalAgentMcpProfileJson(receipt.payload) !== canonicalAgentMcpProfileJson(expectedPayload)
  )
    return { passed: false, reason: 'C01_RECEIPT_PAYLOAD_MISMATCH' };
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(receipt.publicKeyBase64, 'base64'),
      type: 'spki',
      format: 'der',
    });
    if (
      !verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      )
    )
      return { passed: false, reason: 'C01_RECEIPT_SIGNATURE_INVALID' };
  } catch {
    return { passed: false, reason: 'C01_RECEIPT_SIGNATURE_INVALID' };
  }
  return { passed: true, reason: null };
}

export function buildC01ProfileReport(input, { privateKey } = {}) {
  if (!PROFILE || !isRecord(input) || !isRecord(input.claim) || !privateKey)
    return { passed: false, reason: 'C01_WRITER_INPUT_INVALID' };
  const source = projectionFromSource(input.source);
  const verifiedAnswer = verifyC01Answer(input.answer, input.rawResult);
  if (
    !source ||
    !verifiedAnswer.passed ||
    canonicalAgentMcpProfileJson(source) !== canonicalAgentMcpProfileJson(verifiedAnswer.source)
  )
    return { passed: false, reason: 'C01_ANSWER_OR_SOURCE_INVALID' };
  if (
    !isSha256(input.eventStreamSha256) ||
    !isSha256(input.serverSummarySha256) ||
    !isRecord(input.events) ||
    input.events.processExitCode !== 0 ||
    input.events.eventStreamParsed !== true ||
    input.events.turnCompleted !== true ||
    input.events.codexMcpToolEventCount !== 1 ||
    input.events.codexErrorItemCount !== 0 ||
    input.events.nonMcpToolEventCount !== 0 ||
    input.events.shellToolCallCount !== 0 ||
    input.events.allowedCallCount !== 1 ||
    input.events.deniedCallCount !== 0
  )
    return { passed: false, reason: 'C01_RUNTIME_EVENTS_INVALID' };
  const claim = input.claim;
  const answer = {
    sha256: sha256(input.answer),
    checks: verifiedAnswer.checks,
  };
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profileId: PROFILE.id,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    candidateSha: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    reviewerId: claim.reviewerId,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    arguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    bundleSha256: claim.bundleSha256,
    registrySha256: claim.registrySha256,
    codexCliVersion: input.codexCliVersion,
    resultStatus: 'SUCCESS',
    source,
    answer,
    events: input.events,
    privacy: {
      authProfile: 'anonymous_public',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      rawAnswerStored: false,
      rawResultStored: false,
      credentialsStored: false,
    },
    eventStreamSha256: input.eventStreamSha256,
    serverSummarySha256: input.serverSummarySha256,
  };
  const receiptPayload = buildC01RunnerReceiptPayload(report, {
    eventStreamSha256: input.eventStreamSha256,
    serverSummarySha256: input.serverSummarySha256,
  });
  report.runnerReceipt = createC01RunnerReceipt(receiptPayload, {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateC01ProfileReport(report, claim);
  if (!validation.passed) return validation;
  return { passed: true, reason: null, report };
}

export function writeC01ProfileReport(input, { root = ROOT, ...options } = {}) {
  const outputPath = path.resolve(root, REPORT_RELATIVE_PATH);
  if (!outputPath.startsWith(path.resolve(root) + path.sep))
    return { passed: false, reason: 'C01_REPORT_PATH_INVALID' };
  if (existsSync(outputPath)) return { passed: false, reason: 'C01_REPORT_ALREADY_EXISTS' };
  const built = buildC01ProfileReport(input, options);
  if (!built.passed) return built;
  const bytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
  } catch {
    return { passed: false, reason: 'C01_REPORT_WRITE_FAILED' };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return {
    passed: true,
    reason: null,
    reportPath: REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
  };
}

export function validateC01SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const expectedPath = path.resolve(root, REPORT_RELATIVE_PATH);
  const suppliedPath = path.resolve(reportPath ?? expectedPath);
  if (suppliedPath !== expectedPath || !suppliedPath.startsWith(path.resolve(root) + path.sep))
    return { passed: false, reason: 'C01_REPORT_PATH_INVALID' };
  try {
    const metadata = lstatSync(suppliedPath);
    if (!metadata.isFile() || metadata.isSymbolicLink())
      return { passed: false, reason: 'C01_REPORT_FILE_TYPE_INVALID' };
    const bytes = readFileSync(suppliedPath);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateC01ProfileReport(report, claim);
    return validation.passed
      ? {
          passed: true,
          reason: null,
          report,
          reportPath: REPORT_RELATIVE_PATH,
          reportSha256: sha256(bytes),
        }
      : validation;
  } catch {
    return { passed: false, reason: 'C01_REPORT_UNREADABLE_OR_INVALID' };
  }
}
