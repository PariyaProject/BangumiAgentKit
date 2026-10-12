export interface G16RunnerReceipt extends Record<string, unknown> {
  schemaVersion: 1;
  kind: 'g16-runner-acceptance-receipt-v1';
  publicKeyBase64: string;
  publicKeySha256: string;
  payload: Record<string, unknown>;
  signature: string;
}

export function generateG16RunnerReceiptKeyPair(): {
  publicKeyBase64: string;
  privateKey: object;
};
export function g16RunnerPublicKeySha256(publicKeyBase64: string): string;
export function buildG16RunnerReceiptPayload(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
): Record<string, unknown>;
export function g16RunnerReceiptPayloadFromReport(report: Record<string, unknown>): Record<string, unknown>;
export function createG16RunnerReceipt(
  payload: Record<string, unknown>,
  keyPair: { publicKeyBase64: string; privateKey: object },
): G16RunnerReceipt;
export function verifyG16RunnerReceipt(
  receipt: unknown,
  expectedPublicKeyBase64: string,
  expectedPayload: unknown,
): boolean;
