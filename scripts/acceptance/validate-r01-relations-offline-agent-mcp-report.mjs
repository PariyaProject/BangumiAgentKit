#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { validateR01ProfileReport } from './write-r01-relations-offline-agent-mcp-report.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const value = JSON.parse(input);
  const reportBytes = Buffer.from(value.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const result = validateR01ProfileReport(report, value.claim, reportBytes);
  process.stdout.write(
    `${JSON.stringify({
      passed: result.passed === true,
      reason: result.reason ?? null,
      reportSha256: result.passed ? createHash('sha256').update(reportBytes).digest('hex') : null,
    })}\n`,
  );
  if (result.passed !== true) process.exitCode = 1;
} catch {
  process.stdout.write(
    '{"passed":false,"reason":"R01_REPORT_INPUT_INVALID","reportSha256":null}\n',
  );
  process.exitCode = 1;
}
