import { readFileSync } from 'node:fs';
import { verifyG06RunnerReceipt } from './g06-runner-receipt.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const passed = verifyG06RunnerReceipt(
    input?.report,
    input?.report?.runnerReceipt,
    input?.receiptPublicKey,
  );
  process.stdout.write(`${JSON.stringify({ passed })}\n`);
  if (!passed) process.exitCode = 1;
} catch {
  process.stdout.write('{"passed":false}\n');
  process.exitCode = 1;
}
