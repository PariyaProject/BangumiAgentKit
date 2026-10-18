#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateQuerySubjectsFreshPublicProfileReport } from './write-query-subjects-fresh-public-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input.reportBytesBase64 ?? '', 'base64');
  if (reportBytes.toString('base64') !== input.reportBytesBase64) {
    throw new Error('Fresh query_subjects report bytes are not canonical base64.');
  }
  const report = JSON.parse(reportBytes.toString('utf8'));
  const passed = validateQuerySubjectsFreshPublicProfileReport(report, input.claim, reportBytes);
  const reportSha256 = createHash('sha256').update(reportBytes).digest('hex');
  const result = passed
    ? { passed: true, reportSha256 }
    : { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_INVALID' };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: error instanceof Error ? error.message : 'REPORT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
