import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { C02_PROFILE_ID, projectC02ComparisonResult, verifyC02Answer } from '../lib/c02-tv-movie-comparison-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(C02_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE?.reportPath ?? 'docs/live-probes/c02-tv-movie-comparison-agent-mcp-run95.json';
const RECEIPT_KIND = 'run95-c02-agent-mcp-runner-receipt-v1';
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
  'acceptanceScope',
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
  'exactSchema',
  'exactSubjectIds',
  'exactSubjectNames',
  'exactMetricsAndStates',
  'exactDeltas',
  'explicitSecondMinusFirstRule',
  'exactLimitations',
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
const RECEIPT_KEYS = ['schemaVersion', 'kind', 'publicKeyBase64', 'publicKeySha256', 'payload', 'signature'];
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
  'acceptanceScope',
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
  typeof value === 'string' && /^(?:[A-Za-z0-9+/]{86}==|[A-Za-z0-9+/]{87}=)$/u.test(value);

function validateProjectedSource(source) {
  if (
    !exactKeys(source, ['state', 'deltaRule', 'subjectIds', 'subjects', 'metrics', 'coverage', 'officialSource', 'warningCount']) ||
    source.state !== 'complete' && source.state !== 'partial' ||
    source.deltaRule !== 'second_minus_first' ||
    canonicalAgentMcpProfileJson(source.subjectIds) !== canonicalAgentMcpProfileJson([1940, 1941]) ||
    !Array.isArray(source.subjects) ||
    source.subjects.length !== 2 ||
    !Array.isArray(source.metrics) ||
    source.metrics.length !== 3 ||
    !isRecord(source.coverage) ||
    source.coverage.requestedSubjects !== 2 ||
    source.coverage.returnedSubjects !== 2 ||
    !isRecord(source.officialSource) ||
    !Array.isArray(source.officialSource.operations) ||
    source.officialSource.operations.length === 0 ||
    !Number.isSafeInteger(source.warningCount) || source.warningCount < 0
  ) return false;
  const ids = [1940, 1941];
  if (!source.subjects.every((subject, index) =>
    (exactKeys(subject, ['subjectId', 'name']) || exactKeys(subject, ['subjectId', 'name', 'nameCn'])) &&
    subject.subjectId === ids[index] &&
    typeof subject.name === 'string' && subject.name.trim() &&
    (subject.nameCn === undefined || typeof subject.nameCn === 'string'),
  )) return false;
  const keys = ['episodesReported', 'score', 'collectionTotal'];
  const metricsValid = source.metrics.every((metric, index) =>
    exactKeys(metric, ['key', 'values', 'delta', 'deltaPrecision', 'state', 'conflictCount']) &&
    metric.key === keys[index] && Array.isArray(metric.values) && metric.values.length === 2 &&
    metric.values.every((value) => value === null || (typeof value === 'number' && Number.isFinite(value))) &&
    (metric.delta === null || (typeof metric.delta === 'number' && Number.isFinite(metric.delta))) &&
    metric.deltaPrecision === (index === 1 ? 1 : 0) && ['complete', 'unknown', 'conflict'].includes(metric.state) &&
    Number.isSafeInteger(metric.conflictCount) && metric.conflictCount >= 0 &&
    (metric.state === 'complete'
      ? metric.values.every((value) => typeof value === 'number') &&
        metric.delta === Math.round(((metric.values[1] - metric.values[0]) * (10 ** metric.deltaPrecision)) + Number.EPSILON) / (10 ** metric.deltaPrecision)
      : metric.delta === null),
  );
  const coverageKeys = [
    'requestedSubjects', 'returnedSubjects', 'subjectsComplete', 'subjectsPartial',
    'subjectsUnavailable', 'subjectsNotFound', 'metricsComplete', 'metricsUnknown', 'metricsConflict', 'limits',
  ];
  const limitKeys = ['maxSubjects', 'maxCast', 'maxStaff', 'maxRelations', 'maxOverlapItems'];
  const sourceKeys = source.officialSource.retrievedAt === undefined
    ? ['operations', 'attemptedAt']
    : ['operations', 'attemptedAt', 'retrievedAt'];
  return metricsValid &&
    exactKeys(source.coverage, coverageKeys) &&
    coverageKeys.slice(0, -1).every((key) => Number.isSafeInteger(source.coverage[key]) && source.coverage[key] >= 0) &&
    exactKeys(source.coverage.limits, limitKeys) &&
    source.coverage.limits.maxSubjects === 2 &&
    source.coverage.limits.maxCast === 1 &&
    source.coverage.limits.maxStaff === 1 &&
    source.coverage.limits.maxRelations === 1 &&
    Number.isSafeInteger(source.coverage.limits.maxOverlapItems) &&
    exactKeys(source.officialSource, sourceKeys) &&
    Array.isArray(source.officialSource.operations) &&
    source.officialSource.operations.length > 0 &&
    source.officialSource.operations.every((operation) => operation === 'GET /v0/subjects/{subject_id}') &&
    typeof source.officialSource.attemptedAt === 'string' &&
    Number.isFinite(Date.parse(source.officialSource.attemptedAt)) &&
    (source.officialSource.retrievedAt === undefined ||
      (typeof source.officialSource.retrievedAt === 'string' && Number.isFinite(Date.parse(source.officialSource.retrievedAt)))) &&
    Number.isSafeInteger(source.warningCount) && source.warningCount >= 0;
}

function buildRunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
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
    acceptanceScope: report.acceptanceScope,
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

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  if (!exactKeys(payload, RECEIPT_PAYLOAD_KEYS) || !publicKeyBase64 || !privateKey) return null;
  const signature = sign(null, Buffer.from(canonicalAgentMcpProfileJson(payload)), privateKey).toString('base64');
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64,
    publicKeySha256: sha256(Buffer.from(publicKeyBase64, 'base64')),
    payload,
    signature,
  };
}

function validateC02ProfileReport(report, claim) {
  if (!PROFILE || !exactKeys(report, REPORT_KEYS)) return { passed: false, reason: 'C02_REPORT_FIELDS_INVALID' };
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
    claim.profileId !== PROFILE.id ||
    claim.frontierId !== PROFILE.frontierId ||
    claim.epochId !== PROFILE.epochId ||
    claim.runNumber !== 95 ||
    claim.toolName !== PROFILE.toolName ||
    claim.argumentProfile !== PROFILE.argumentProfile ||
    report.toolName !== PROFILE.toolName ||
    report.argumentProfile !== PROFILE.argumentProfile ||
    report.acceptanceScope !== PROFILE.acceptanceScope ||
    canonicalAgentMcpProfileJson(report.arguments) !== canonicalAgentMcpProfileJson(expectedArguments) ||
    report.expectedArgumentsSha256 !== claim.expectedArgumentsSha256 ||
    claim.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    report.bundleSha256 !== claim.bundleSha256 ||
    report.registrySha256 !== claim.registrySha256 ||
    claim.registrySha256 !== agentMcpProfileRegistrySha256(PROFILE.id) ||
    typeof report.codexCliVersion !== 'string' ||
    report.resultStatus !== 'SUCCESS' ||
    !isSha256(report.eventStreamSha256) ||
    !isSha256(report.serverSummarySha256) ||
    !validateProjectedSource(report.source)
  ) return { passed: false, reason: 'C02_REPORT_CLAIM_OR_SOURCE_MISMATCH' };

  if (
    !exactKeys(report.answer, ANSWER_KEYS) ||
    !isSha256(report.answer.sha256) ||
    !exactKeys(report.answer.checks, CHECK_KEYS) ||
    Object.values(report.answer.checks).some((value) => value !== true)
  ) return { passed: false, reason: 'C02_ANSWER_CHECKS_INVALID' };

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
    canonicalAgentMcpProfileJson(report.events.mcpServerNames) !== canonicalAgentMcpProfileJson(['bgk_c02_one_tool']) ||
    report.events.allowedCallCount !== 1 ||
    report.events.deniedCallCount !== 0
  ) return { passed: false, reason: 'C02_RUNTIME_EVENTS_INVALID' };

  const expectedPrivacy = {
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
  };
  if (canonicalAgentMcpProfileJson(report.privacy) !== canonicalAgentMcpProfileJson(expectedPrivacy)) {
    return { passed: false, reason: 'C02_PRIVACY_FIELDS_INVALID' };
  }

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
  ) return { passed: false, reason: 'C02_RECEIPT_FIELDS_INVALID' };
  const expectedPayload = buildRunnerReceiptPayload(report, {
    eventStreamSha256: report.eventStreamSha256,
    serverSummarySha256: report.serverSummarySha256,
  });
  if (canonicalAgentMcpProfileJson(receipt.payload) !== canonicalAgentMcpProfileJson(expectedPayload)) {
    return { passed: false, reason: 'C02_RECEIPT_PAYLOAD_MISMATCH' };
  }
  try {
    const publicKey = createPublicKey({ key: Buffer.from(receipt.publicKeyBase64, 'base64'), type: 'spki', format: 'der' });
    if (!verify(null, Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)), publicKey, Buffer.from(receipt.signature, 'base64'))) {
      return { passed: false, reason: 'C02_RECEIPT_SIGNATURE_INVALID' };
    }
  } catch {
    return { passed: false, reason: 'C02_RECEIPT_SIGNATURE_INVALID' };
  }
  return { passed: true, reason: null };
}

export function buildC02ProfileReport(input, { privateKey } = {}) {
  if (!PROFILE || !isRecord(input) || !isRecord(input.claim) || !privateKey) {
    return { passed: false, reason: 'C02_WRITER_INPUT_INVALID' };
  }
  const source = projectC02ComparisonResult(input.rawResult);
  const verifiedAnswer = verifyC02Answer(input.answer, source);
  if (
    !source ||
    !verifiedAnswer.accepted ||
    canonicalAgentMcpProfileJson(input.source) !== canonicalAgentMcpProfileJson(source)
  ) return { passed: false, reason: 'C02_SOURCE_OR_ANSWER_INVALID', answerChecks: verifiedAnswer.checks };

  const events = input.events;
  if (
    !isSha256(input.eventStreamSha256) ||
    !isSha256(input.serverSummarySha256) ||
    !isRecord(events) ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 1 ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== 1 ||
    events.deniedCallCount !== 0
  ) return { passed: false, reason: 'C02_RUNTIME_EVENTS_INVALID' };

  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profileId: PROFILE.id,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    prNumber: input.claim.prNumber,
    claimId: input.claim.claimId,
    candidateSha: input.claim.sourceCandidateSha,
    baseSha: input.claim.baseSha,
    ciSha: input.claim.ciSha,
    ciStatus: input.claim.ciStatus,
    reviewerId: input.claim.reviewerId,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    acceptanceScope: PROFILE.acceptanceScope,
    arguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: input.claim.expectedArgumentsSha256,
    bundleSha256: input.claim.bundleSha256,
    registrySha256: input.claim.registrySha256,
    codexCliVersion: input.codexCliVersion,
    resultStatus: 'SUCCESS',
    source,
    answer: {
      sha256: sha256(input.answer),
      checks: verifiedAnswer.checks,
    },
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
  const receiptPayload = buildRunnerReceiptPayload(report, {
    eventStreamSha256: input.eventStreamSha256,
    serverSummarySha256: input.serverSummarySha256,
  });
  report.runnerReceipt = createRunnerReceipt(receiptPayload, {
    publicKeyBase64: input.claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateC02ProfileReport(report, input.claim);
  return validation.passed ? { ...validation, report } : validation;
}

export function writeC02ProfileReport(input, { privateKey, root = ROOT } = {}) {
  const resolvedRoot = path.resolve(root);
  const outputPath = path.resolve(resolvedRoot, REPORT_RELATIVE_PATH);
  if (!outputPath.startsWith(resolvedRoot + path.sep)) return { passed: false, reason: 'C02_REPORT_PATH_INVALID' };
  if (existsSync(outputPath)) return { passed: false, reason: 'C02_REPORT_ALREADY_EXISTS' };
  const built = buildC02ProfileReport(input, { privateKey });
  if (!built.passed) return built;
  const bytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
  } catch {
    return { passed: false, reason: 'C02_REPORT_WRITE_FAILED' };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return { passed: true, reason: null, reportPath: REPORT_RELATIVE_PATH, reportSha256: sha256(bytes) };
}

export function validateC02SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const resolvedRoot = path.resolve(root);
  const expectedPath = path.resolve(resolvedRoot, REPORT_RELATIVE_PATH);
  const suppliedPath = path.resolve(reportPath ?? expectedPath);
  if (suppliedPath !== expectedPath || !suppliedPath.startsWith(resolvedRoot + path.sep)) {
    return { passed: false, reason: 'C02_REPORT_PATH_INVALID' };
  }
  try {
    const metadata = lstatSync(suppliedPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return { passed: false, reason: 'C02_REPORT_FILE_TYPE_INVALID' };
    const bytes = readFileSync(suppliedPath);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateC02ProfileReport(report, claim);
    return validation.passed
      ? { ...validation, report, reportPath: REPORT_RELATIVE_PATH, reportSha256: sha256(bytes) }
      : validation;
  } catch {
    return { passed: false, reason: 'C02_REPORT_UNREADABLE_OR_INVALID' };
  }
}
