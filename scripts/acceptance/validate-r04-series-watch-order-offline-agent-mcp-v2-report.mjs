#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { validateR04ProfileReport } from './write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const value = JSON.parse(input);
  const reportBytes = Buffer.from(value.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const result = validateR04ProfileReport(report, value.claim, reportBytes);
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
    '{"passed":false,"reason":"R04_REPORT_INPUT_INVALID","reportSha256":null}\n',
  );
  process.exitCode = 1;
}
