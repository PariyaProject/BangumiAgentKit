import fs from 'node:fs';
import { nativePageSha, validateNativePageReport } from './native-entity-page-report.mjs';

try {
  const chunks = [], limit = 256 * 1024;
  let total = 0, size;
  do {
    const buffer = Buffer.alloc(Math.min(8192, limit + 1 - total));
    size = fs.readSync(0, buffer, 0, buffer.length, null);
    total += size;
    if (total > limit) throw new Error();
    if (size) chunks.push(buffer.subarray(0, size));
  } while (size);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const bytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
  if (bytes.length > 65536 || bytes.toString('base64') !== input.reportBytesBase64) throw new Error();
  const report = JSON.parse(bytes.toString('utf8'));
  const result = validateNativePageReport(report, input.claim);
  process.stdout.write(JSON.stringify({ ...result,
    ...(result.passed ? { reportSha256: nativePageSha(bytes),
      runnerReceiptSha256: nativePageSha(JSON.stringify({ publicKey: input.claim.runnerReceiptPublicKey, signature: report.signature })) } : {}) }) + '\n');
  if (!result.passed) process.exitCode = 1;
} catch {
  process.stdout.write(JSON.stringify({ passed: false, reason: 'NATIVE_PAGE_REPORT_INPUT_INVALID' }) + '\n');
  process.exitCode = 1;
}
