import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  G16_ARGUMENT_PROFILE,
  G16_EXPECTED_QUERY_ARGUMENTS,
} from './g16-person-activity-answer-check.mjs';

const RUN_NUMBER = 95;
const FRONTIER_ID = 'G16';
const EPOCH_ID = 'run95-g16-director-person-activity-agent-mcp';
const TOOL_NAME = 'bangumi.get_person_activity';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const RECEIPT_KIND = 'g16-runner-acceptance-receipt-v1';
const RECEIPT_FIELDS = [
  'schemaVersion', 'kind', 'publicKeyBase64', 'publicKeySha256', 'payload', 'signature',
];
const PAYLOAD_FIELDS = [
  'schemaVersion', 'kind', 'claimId', 'runNumber', 'frontierId', 'epochId', 'prNumber',
  'sourceRevision', 'baseSha', 'ciSha', 'ciStatus', 'reviewerId', 'bundleSha256', 'model',
  'reasoningEffort', 'toolName', 'argumentProfile', 'expectedArgumentsSha256', 'codexCliVersion',
  'processExitCode', 'resultStatus', 'eventStreamParsed', 'serverToolNames', 'serverToolCount',
  'mcpServerNames', 'codexMcpToolEventCount', 'codexErrorItemCount', 'nonMcpToolEventCount',
  'nonMcpToolTypes', 'shellToolCallCount', 'allowedCallCount', 'deniedCallCount',
  'eventStreamSha256', 'serverSummarySha256', 'toolArgumentsSha256', 'toolTextUtf8Bytes',
  'resultByteLength', 'resultSha256', 'answerUtf8Bytes', 'answerSha256', 'answerChecksSha256',
  'answerCountersSha256', 'resultSummarySha256',
];

const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalJson(value));

export function generateG16RunnerReceiptKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey,
  };
}

export function g16RunnerPublicKeySha256(publicKeyBase64) {
  if (typeof publicKeyBase64 !== 'string' || !publicKeyBase64) {
    throw new Error('G16 runner receipt requires a public key.');
  }
  const der = Buffer.from(publicKeyBase64, 'base64');
  if (der.toString('base64') !== publicKeyBase64) {
    throw new Error('G16 runner receipt public key is not canonical base64.');
  }
  const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' });
  if (publicKey.asymmetricKeyType !== 'ed25519' ||
      !publicKey.export({ type: 'spki', format: 'der' }).equals(der)) {
    throw new Error('G16 runner receipt public key is not an Ed25519 SPKI key.');
  }
  return sha256(der);
}

function assertCandidateGate(input) {
  const gate = input.candidateGate;
  if (gate?.candidateSha !== input.sourceRevision || gate?.baseSha !== input.baseSha ||
      gate?.ciSha !== input.sourceRevision || gate?.ciStatus !== 'SUCCESS' ||
      gate?.reviewPassSha !== input.sourceRevision || gate?.reviewVerdict !== 'PASS' ||
      gate?.reviewerId !== input.reviewerId) {
    throw new Error('G16 runner receipt Candidate gate is not exact.');
  }
}

export function buildG16RunnerReceiptPayload(input, answerResult) {
  if (answerResult?.passed !== true ||
      canonicalJson(input.queryArguments) !== canonicalJson(G16_EXPECTED_QUERY_ARGUMENTS)) {
    throw new Error('G16 runner receipt requires the passing exact-answer check and fixed query profile.');
  }
  assertCandidateGate(input);
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    claimId: input.claimId,
    runNumber: RUN_NUMBER,
    frontierId: FRONTIER_ID,
    epochId: EPOCH_ID,
    prNumber: input.prNumber,
    sourceRevision: input.sourceRevision,
    baseSha: input.baseSha,
    ciSha: input.candidateGate.ciSha,
    ciStatus: input.candidateGate.ciStatus,
    reviewerId: input.reviewerId,
    bundleSha256: input.bundleSha256,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    toolName: TOOL_NAME,
    argumentProfile: G16_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalSha256(G16_EXPECTED_QUERY_ARGUMENTS),
    codexCliVersion: input.codexCliVersion,
    processExitCode: input.processExitCode,
    resultStatus: input.resultStatus,
    eventStreamParsed: input.eventStreamParsed,
    serverToolNames: input.serverToolNames,
    serverToolCount: input.serverToolCount,
    mcpServerNames: input.mcpServerNames,
    codexMcpToolEventCount: input.codexMcpToolEventCount,
    codexErrorItemCount: input.codexErrorItemCount,
    nonMcpToolEventCount: input.nonMcpToolEventCount,
    nonMcpToolTypes: input.nonMcpToolTypes,
    shellToolCallCount: input.shellToolCallCount,
    allowedCallCount: input.allowedCallCount,
    deniedCallCount: input.deniedCallCount,
    eventStreamSha256: input.runnerEventStreamSha256,
    serverSummarySha256: input.runnerServerSummarySha256,
    toolArgumentsSha256: canonicalSha256(input.queryArguments),
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    answerChecksSha256: canonicalSha256(answerResult.answerChecks),
    answerCountersSha256: canonicalSha256(answerResult.answerCounters),
    resultSummarySha256: canonicalSha256(answerResult.resultSummary),
  };
}

export function g16RunnerReceiptPayloadFromReport(report) {
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    claimId: report.claimId,
    runNumber: report.runNumber,
    frontierId: report.frontierId,
    epochId: report.epochId,
    prNumber: report.prNumber,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    ciSha: report.sourceRevision,
    ciStatus: 'SUCCESS',
    reviewerId: report.reviewerId,
    bundleSha256: report.mcpBundleSha256,
    model: report.model,
    reasoningEffort: report.reasoningEffort,
    toolName: report.toolName,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    codexCliVersion: report.codexCliVersion,
    processExitCode: report.processExitCode,
    resultStatus: report.resultStatus,
    eventStreamParsed: report.eventStreamParsed,
    serverToolNames: report.serverToolNames,
    serverToolCount: report.serverToolCount,
    mcpServerNames: report.mcpServerNames,
    codexMcpToolEventCount: report.codexMcpToolEventCount,
    codexErrorItemCount: report.codexErrorItemCount,
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    nonMcpToolTypes: report.nonMcpToolTypes,
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    eventStreamSha256: report.runnerEventStreamSha256,
    serverSummarySha256: report.runnerServerSummarySha256,
    toolArgumentsSha256: canonicalSha256(G16_EXPECTED_QUERY_ARGUMENTS),
    toolTextUtf8Bytes: report.toolTextUtf8Bytes,
    resultByteLength: report.resultByteLength,
    resultSha256: report.resultSha256,
    answerUtf8Bytes: report.answerUtf8Bytes,
    answerSha256: report.answerSha256,
    answerChecksSha256: canonicalSha256(report.answerChecks),
    answerCountersSha256: canonicalSha256(report.answerCounters),
    resultSummarySha256: canonicalSha256(report.resultSummary),
  };
}

export function createG16RunnerReceipt(payload, keyPair) {
  const publicKeySha256 = g16RunnerPublicKeySha256(keyPair?.publicKeyBase64);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      canonicalJson(Object.keys(payload).sort()) !== canonicalJson([...PAYLOAD_FIELDS].sort())) {
    throw new Error('G16 runner receipt payload schema is invalid.');
  }
  const signature = sign(null, Buffer.from(canonicalJson(payload)), keyPair.privateKey).toString('base64');
  return { schemaVersion: 1, kind: RECEIPT_KIND, publicKeyBase64: keyPair.publicKeyBase64, publicKeySha256, payload, signature };
}

export function verifyG16RunnerReceipt(receipt, expectedPublicKeyBase64, expectedPayload) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
      canonicalJson(Object.keys(receipt).sort()) !== canonicalJson([...RECEIPT_FIELDS].sort()) ||
      receipt.schemaVersion !== 1 || receipt.kind !== RECEIPT_KIND ||
      receipt.publicKeyBase64 !== expectedPublicKeyBase64 ||
      receipt.publicKeySha256 !== g16RunnerPublicKeySha256(expectedPublicKeyBase64) ||
      canonicalJson(Object.keys(receipt.payload ?? {}).sort()) !== canonicalJson([...PAYLOAD_FIELDS].sort()) ||
      canonicalJson(receipt.payload) !== canonicalJson(expectedPayload) || typeof receipt.signature !== 'string') {
    return false;
  }
  const signature = Buffer.from(receipt.signature, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== receipt.signature) return false;
  try {
    const publicKey = createPublicKey({ key: Buffer.from(expectedPublicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(canonicalJson(receipt.payload)), publicKey, signature);
  } catch { return false; }
}
