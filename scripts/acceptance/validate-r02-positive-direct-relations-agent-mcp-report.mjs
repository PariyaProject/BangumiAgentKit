#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { validateR02ProfileReport } from './write-r02-positive-direct-relations-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
  if (reportBytes.toString('base64') !== input.reportBytesBase64) {
    throw new Error('R02 report bytes are not canonical base64.');
  }
  const report = JSON.parse(reportBytes.toString('utf8'));
  const result = validateR02ProfileReport(report, input.claim, reportBytes);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.passed ? 0 : 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: error instanceof Error ? error.message : 'R02_REPORT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
