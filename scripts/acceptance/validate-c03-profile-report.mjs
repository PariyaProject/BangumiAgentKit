import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { validateC03ProfileReport } from './write-c03-profile-report.mjs';
const input = JSON.parse(readFileSync(0, 'utf8'));
const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
let report;
try {
  report = JSON.parse(reportBytes.toString('utf8'));
} catch {
  report = null;
}
const result = validateC03ProfileReport(report, input?.claim, reportBytes);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (!result.passed) process.exitCode = 1;
