#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateC04ProfileReport } from './write-c04-cohort-comparison-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateC04ProfileReport(report, input?.claim, reportBytes);
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
    `${JSON.stringify({ passed: false, reason: 'C04_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
