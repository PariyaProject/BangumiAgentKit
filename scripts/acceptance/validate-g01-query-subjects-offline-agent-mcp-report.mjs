#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { validateG01QuerySubjectsOfflineProfileReport } from './write-g01-query-subjects-offline-agent-mcp-report.mjs';

let input;
try {
  input = JSON.parse(
    await new Promise((resolve, reject) => {
      let value = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        value += chunk;
      });
      process.stdin.on('end', () => resolve(value));
      process.stdin.on('error', reject);
    }),
  );
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}

if (input && typeof input === 'object') {
  try {
    const reportBytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
    const report = JSON.parse(reportBytes.toString('utf8'));
    const result = validateG01QuerySubjectsOfflineProfileReport(report, input.claim, reportBytes);
    const sha256 = await import('node:crypto').then(({ createHash }) =>
      createHash('sha256').update(reportBytes).digest('hex'),
    );
    process.stdout.write(`${JSON.stringify({ ...result, reportSha256: sha256 })}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch {
    process.stdout.write(
      `${JSON.stringify({ passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_INVALID' })}\n`,
    );
    process.exitCode = 1;
  }
}
