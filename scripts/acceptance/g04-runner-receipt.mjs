import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { G04_EXPECTED_QUERY_ARGUMENTS } from './g04-person-activity-answer-check.mjs';

const RUN_NUMBER = 95;
const FRONTIER_ID = 'G04';
const EPOCH_ID = 'run95-g04-person-activity-global-one-shot-latch';
const TOOL_NAME = 'bangumi.get_person_activity';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const ARGUMENT_PROFILE = 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1';
const RECEIPT_KIND = 'g04-runner-acceptance-receipt-v1';
const RECEIPT_FIELDS = [
  'schemaVersion',
  'kind',
  'publicKeyBase64',
  'publicKeySha256',
  'payload',
  'signature',
];

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
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function generateG04RunnerReceiptKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return { publicKeyBase64, privateKey };
}

export function g04RunnerPublicKeySha256(publicKeyBase64) {
  if (typeof publicKeyBase64 !== 'string' || !publicKeyBase64) {
    throw new Error('G04 runner receipt requires a public key.');
  }
  const der = Buffer.from(publicKeyBase64, 'base64');
  if (der.toString('base64') !== publicKeyBase64) {
    throw new Error('G04 runner receipt public key is not canonical base64.');
  }
  const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    !publicKey.export({ type: 'spki', format: 'der' }).equals(der)
  ) {
    throw new Error('G04 runner receipt public key is not an Ed25519 SPKI key.');
  }
  return sha256(der);
}

export function buildG04RunnerReceiptPayload(input, answerResult) {
  if (answerResult?.passed !== true) {
    throw new Error('G04 runner receipt requires a successful exact-answer check.');
  }
  if (canonicalJson(input.queryArguments) !== canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)) {
    throw new Error('G04 runner receipt query arguments do not match the fixed profile.');
  }
  const gate = input.candidateGate;
  if (
    gate?.candidateSha !== input.sourceRevision ||
    gate?.baseSha !== input.baseSha ||
    gate?.ciSha !== input.sourceRevision ||
    gate?.ciStatus !== 'SUCCESS' ||
    gate?.reviewPassSha !== input.sourceRevision ||
    gate?.reviewVerdict !== 'PASS' ||
    gate?.reviewerId !== input.reviewerId
  ) {
    throw new Error('G04 runner receipt Candidate gate is not exact.');
  }
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
    ciSha: gate.ciSha,
    ciStatus: gate.ciStatus,
    reviewerId: input.reviewerId,
    bundleSha256: input.bundleSha256,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    toolName: TOOL_NAME,
    argumentProfile: ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)),
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
    toolArgumentsSha256: sha256(canonicalJson(input.queryArguments)),
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    answerChecksSha256: sha256(canonicalJson(answerResult.answerChecks)),
    answerCountersSha256: sha256(canonicalJson(answerResult.answerCounters)),
    resultSummarySha256: sha256(canonicalJson(answerResult.resultSummary)),
  };
}

export function createG04RunnerReceipt(payload, keyPair) {
  const publicKeySha256 = g04RunnerPublicKeySha256(keyPair?.publicKeyBase64);
  const signature = sign(null, Buffer.from(canonicalJson(payload)), keyPair.privateKey).toString(
    'base64',
  );
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64: keyPair.publicKeyBase64,
    publicKeySha256,
    payload,
    signature,
  };
}

export function verifyG04RunnerReceipt(receipt, expectedPublicKeyBase64, expectedPayload) {
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    canonicalJson(Object.keys(receipt).sort()) !== canonicalJson([...RECEIPT_FIELDS].sort()) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== expectedPublicKeyBase64 ||
    receipt.publicKeySha256 !== g04RunnerPublicKeySha256(expectedPublicKeyBase64) ||
    canonicalJson(receipt.payload) !== canonicalJson(expectedPayload) ||
    typeof receipt.signature !== 'string'
  ) {
    return false;
  }
  const signature = Buffer.from(receipt.signature, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== receipt.signature) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(expectedPublicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(canonicalJson(receipt.payload)), publicKey, signature);
  } catch {
    return false;
  }
}
