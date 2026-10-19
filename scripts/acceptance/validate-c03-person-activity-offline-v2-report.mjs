import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateC03PersonActivityOfflineV2Report } from './write-c03-person-activity-offline-v2-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const root = typeof input.root === 'string' ? input.root : ROOT;
  const validation = validateC03PersonActivityOfflineV2Report(
    report,
    input.claim,
    reportBytes,
    root,
  );
  process.stdout.write(JSON.stringify({
    ...validation,
    reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
  }));
}

try {
  main();
} catch {
  process.stdout.write(JSON.stringify({ passed: false, reason: 'C03_ACTIVITY_V2_VALIDATION_FAILED' }));
  process.exitCode = 1;
}
