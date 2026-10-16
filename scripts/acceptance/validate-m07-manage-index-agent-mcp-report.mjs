#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateM07ProfileReport } from './write-m07-manage-index-agent-mcp-report.mjs';

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(payload?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateM07ProfileReport(report, payload?.claim, reportBytes);
  process.stdout.write(
    `${JSON.stringify({
      ...validation,
      ...(validation.passed
        ? { reportSha256: createHash('sha256').update(reportBytes).digest('hex') }
        : {}),
    })}\n`,
  );
  if (!validation.passed) process.exitCode = 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'M07_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
