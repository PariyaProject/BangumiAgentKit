#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateAuthStartProfileReport } from './write-auth-start-offline-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const bytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(bytes.toString('utf8'));
  const result = validateAuthStartProfileReport(report, input?.claim, bytes);
  process.stdout.write(
    `${JSON.stringify({
      ...result,
      ...(result.passed ? { reportSha256: createHash('sha256').update(bytes).digest('hex') } : {}),
    })}\n`,
  );
  if (!result.passed) process.exitCode = 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'AUTH_START_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
