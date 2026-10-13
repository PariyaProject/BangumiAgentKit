import { readFileSync } from 'node:fs';
import {
  createG06RunnerReceipt,
  createG06RunnerReceiptKeyPair,
} from '../../scripts/acceptance/g06-runner-receipt.mjs';

const report = JSON.parse(readFileSync(0, 'utf8'));
const keyPair = createG06RunnerReceiptKeyPair();
const runnerReceipt = createG06RunnerReceipt(report, keyPair.privateKey);
process.stdout.write(`${JSON.stringify({ receiptPublicKey: keyPair.receiptPublicKey, runnerReceipt })}\n`);
