import type { KeyObject } from 'node:crypto';
import type { G04AnswerCheckResult } from './g04-person-activity-answer-check.mjs';

export interface G04RunnerReceipt {
  schemaVersion: 1;
  kind: 'g04-runner-acceptance-receipt-v1';
  publicKeyBase64: string;
  publicKeySha256: string;
  payload: Record<string, unknown>;
  signature: string;
}

export function generateG04RunnerReceiptKeyPair(): {
  publicKeyBase64: string;
  privateKey: KeyObject;
};
export function g04RunnerPublicKeySha256(publicKeyBase64: string): string;
export function buildG04RunnerReceiptPayload(
  input: Record<string, unknown>,
  answerResult: G04AnswerCheckResult,
): Record<string, unknown>;
export function createG04RunnerReceipt(
  payload: Record<string, unknown>,
  keyPair: { publicKeyBase64: string; privateKey: KeyObject },
): G04RunnerReceipt;
export function verifyG04RunnerReceipt(
  receipt: unknown,
  expectedPublicKeyBase64: string,
  expectedPayload: Record<string, unknown>,
): boolean;
