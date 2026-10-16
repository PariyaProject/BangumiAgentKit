import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateP07ProfileReport } from './write-p07-person-season-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateP07ProfileReport(report, input?.claim, reportBytes);
  const result = {
    ...validation,
    ...(validation.passed
      ? { reportSha256: createHash('sha256').update(reportBytes).digest('hex') }
      : {}),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!validation.passed) process.exitCode = 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'P07_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
