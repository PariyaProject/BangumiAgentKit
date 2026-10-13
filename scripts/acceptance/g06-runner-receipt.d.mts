import type { KeyObject } from 'node:crypto';

export interface G06RunnerReceipt extends Record<string, unknown> {
  schemaVersion: 1;
  receiptKind: 'g06-codex-agent-mcp-runtime-receipt-v1';
  claimId: unknown;
  sourceRevision: unknown;
  baseSha: unknown;
  ciSha: unknown;
  reviewerId: unknown;
  bundleSha256: unknown;
  reportPayloadSha256: string;
  signature: string;
}

export const G06_RUNNER_RECEIPT_KIND: 'g06-codex-agent-mcp-runtime-receipt-v1';
export const G06_RUNNER_RECEIPT_FIELDS: Set<string>;
export function canonicalG06ReceiptJson(value: unknown): string;
export function createG06RunnerReceiptKeyPair(): {
  privateKey: KeyObject;
  receiptPublicKey: string;
};
export function isG06RunnerReceiptPublicKey(value: unknown): value is string;
export function createG06RunnerReceipt(
  report: Record<string, unknown>,
  privateKey: KeyObject,
): G06RunnerReceipt;
export function verifyG06RunnerReceipt(
  report: unknown,
  receipt: unknown,
  receiptPublicKey: unknown,
): boolean;
