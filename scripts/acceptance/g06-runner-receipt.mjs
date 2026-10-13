import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const G06_RUNNER_RECEIPT_KIND = 'g06-codex-agent-mcp-runtime-receipt-v1';
export const G06_RUNNER_RECEIPT_FIELDS = new Set([
  'schemaVersion',
  'receiptKind',
  'claimId',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'reviewerId',
  'bundleSha256',
  'reportPayloadSha256',
  'signature',
]);

const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function canonicalG06ReceiptJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalG06ReceiptJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalG06ReceiptJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createG06RunnerReceiptKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    receiptPublicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

export function isG06RunnerReceiptPublicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return false;
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value) return false;
    return (
      createPublicKey({ key: decoded, format: 'der', type: 'spki' }).asymmetricKeyType === 'ed25519'
    );
  } catch {
    return false;
  }
}

function reportPayload(report) {
  if (!isRecord(report)) return null;
  const payload = { ...report };
  delete payload.runnerReceipt;
  return payload;
}

function receiptPayload(report) {
  const payload = reportPayload(report);
  if (!payload) return null;
  return {
    schemaVersion: 1,
    receiptKind: G06_RUNNER_RECEIPT_KIND,
    claimId: payload.claimId,
    sourceRevision: payload.sourceRevision,
    baseSha: payload.baseSha,
    ciSha: payload.ciSha,
    reviewerId: payload.reviewerId,
    bundleSha256: payload.bundleSha256,
    reportPayloadSha256: sha256(canonicalG06ReceiptJson(payload)),
  };
}

export function createG06RunnerReceipt(report, privateKey) {
  const payload = receiptPayload(report);
  if (!payload || !privateKey)
    throw new Error('A sanitized G06 report and in-memory signing key are required.');
  const signed = Buffer.from(canonicalG06ReceiptJson(payload), 'utf8');
  return {
    ...payload,
    signature: sign(null, signed, privateKey).toString('base64'),
  };
}

export function verifyG06RunnerReceipt(report, receipt, receiptPublicKey) {
  try {
    if (
      !isRecord(report) ||
      !isRecord(receipt) ||
      !isG06RunnerReceiptPublicKey(receiptPublicKey) ||
      Object.keys(receipt).length !== G06_RUNNER_RECEIPT_FIELDS.size ||
      [...G06_RUNNER_RECEIPT_FIELDS].some((key) => !Object.hasOwn(receipt, key)) ||
      receipt.schemaVersion !== 1 ||
      receipt.receiptKind !== G06_RUNNER_RECEIPT_KIND ||
      typeof receipt.signature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt.signature)
    ) {
      return false;
    }
    const expected = receiptPayload(report);
    if (!expected || Object.keys(expected).some((key) => receipt[key] !== expected[key]))
      return false;
    const signature = Buffer.from(receipt.signature, 'base64');
    if (signature.toString('base64') !== receipt.signature) return false;
    const key = createPublicKey({
      key: Buffer.from(receiptPublicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(canonicalG06ReceiptJson(expected), 'utf8'), key, signature);
  } catch {
    return false;
  }
}
