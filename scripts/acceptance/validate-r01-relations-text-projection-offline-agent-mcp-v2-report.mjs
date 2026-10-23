#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateR01TextProjectionProfileReport } from './write-r01-relations-text-projection-offline-agent-mcp-v2-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateR01TextProjectionProfileReport(
    report,
    input?.claim,
    reportBytes,
    input?.root,
  );
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
    `${JSON.stringify({ passed: false, reason: 'R01_TEXT_PROJECTION_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
