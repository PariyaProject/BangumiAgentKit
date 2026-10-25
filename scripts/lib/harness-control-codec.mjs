import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const CONTROL_ARCHIVE_SCHEMA = 'bangumi-harness-control/gzip-v1';
export const CONTROL_COMPRESSION_THRESHOLD = 32 * 1024;
export const MAX_CONTROL_STATE_BYTES = 4 * 1024 * 1024;
export const MAX_CONTROL_ARCHIVE_BYTES = 65_536;

export class ControlCodecError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const invalid = () => {
  throw new ControlCodecError('CONTROL_ARCHIVE_INVALID');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function encodeControlState(state, marker) {
  const json = JSON.stringify(state);
  const bytes = Buffer.from(json);
  if (bytes.length > MAX_CONTROL_STATE_BYTES) {
    throw new ControlCodecError('CONTROL_STATE_TOO_LARGE');
  }
  if (bytes.length < CONTROL_COMPRESSION_THRESHOLD) return json;
  const encoded = JSON.stringify({
    schema: CONTROL_ARCHIVE_SCHEMA,
    codec: 'gzip+base64',
    marker,
    bytes: bytes.length,
    sha256: digest(bytes),
    data: gzipSync(bytes).toString('base64'),
  });
  // Incompressible evidence still reaches the existing visible body-size guard.
  return Buffer.byteLength(encoded) < bytes.length &&
    Buffer.byteLength(encoded) <= MAX_CONTROL_ARCHIVE_BYTES
    ? encoded
    : json;
}

export function decodeControlState(json, marker) {
  if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_CONTROL_STATE_BYTES) {
    throw new ControlCodecError('CONTROL_STATE_TOO_LARGE');
  }
  const state = JSON.parse(json);
  if (state?.schema !== CONTROL_ARCHIVE_SCHEMA) return state;
  if (
    Buffer.byteLength(json) > MAX_CONTROL_ARCHIVE_BYTES ||
    Object.keys(state).sort().join(',') !== 'bytes,codec,data,marker,schema,sha256' ||
    state.codec !== 'gzip+base64' ||
    state.marker !== marker ||
    !Number.isSafeInteger(state.bytes) ||
    state.bytes < 1 ||
    state.bytes > MAX_CONTROL_STATE_BYTES ||
    typeof state.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(state.sha256) ||
    typeof state.data !== 'string' ||
    !state.data ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(state.data)
  ) {
    invalid();
  }
  const compressed = Buffer.from(state.data, 'base64');
  if (compressed.toString('base64') !== state.data) invalid();
  let bytes;
  try {
    bytes = gunzipSync(compressed, { maxOutputLength: MAX_CONTROL_STATE_BYTES });
  } catch {
    invalid();
  }
  if (bytes.length !== state.bytes || digest(bytes) !== state.sha256) invalid();
  let decoded;
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    invalid();
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) ||
      decoded.schema === CONTROL_ARCHIVE_SCHEMA) invalid();
  return decoded;
}
