import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateR05ProfileReport } from './write-r05-shared-person-overlap-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const result = validateR05ProfileReport(report, input.claim, reportBytes, ROOT);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.passed ? 0 : 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'R05_VALIDATOR_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
