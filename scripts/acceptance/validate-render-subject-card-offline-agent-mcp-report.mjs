#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateRenderSubjectCardOfflineProfileReport } from './write-render-subject-card-offline-agent-mcp-report.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (typeof input?.reportBytesBase64 !== 'string') throw new Error('REPORT_BYTES_REQUIRED');
  const reportBytes = Buffer.from(input.reportBytesBase64, 'base64');
  if (reportBytes.toString('base64') !== input.reportBytesBase64)
    throw new Error('REPORT_BYTES_INVALID');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateRenderSubjectCardOfflineProfileReport(
    report,
    input.claim,
    reportBytes,
  );
  process.stdout.write(`${JSON.stringify({ ...validation, reportSha256: sha256(reportBytes) })}\n`);
  if (!validation.passed) process.exitCode = 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: error instanceof Error ? error.message : 'REPORT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
