import type { KeyObject } from 'node:crypto';

export function generateP01RunnerReceiptKeyPair(): {
  publicKeyBase64: string;
  privateKey: KeyObject;
};
export function p01RunnerPublicKeySha256(publicKeyBase64: string): string;
export function buildP01RunnerReceiptPayload(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
): Record<string, unknown>;
export function createP01RunnerReceipt(
  payload: Record<string, unknown>,
  keyPair: { publicKeyBase64: string; privateKey: KeyObject },
): Record<string, unknown>;
export function verifyP01RunnerReceipt(
  receipt: Record<string, unknown>,
  expectedPublicKeyBase64: string,
  expectedPayload: Record<string, unknown>,
): boolean;
