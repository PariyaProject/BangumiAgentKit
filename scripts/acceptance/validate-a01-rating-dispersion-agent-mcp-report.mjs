#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateA01RatingDispersionProfileReport } from './write-a01-rating-dispersion-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateA01RatingDispersionProfileReport(report, input?.claim, reportBytes);
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
    `${JSON.stringify({ passed: false, reason: 'A01_RATING_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
