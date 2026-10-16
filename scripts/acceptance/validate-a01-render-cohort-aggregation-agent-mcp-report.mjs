#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateA01RenderCohortAggregationProfileReport } from './write-a01-render-cohort-aggregation-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reportBytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateA01RenderCohortAggregationProfileReport(
    report,
    input?.claim,
    reportBytes,
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
    `${JSON.stringify({ passed: false, reason: 'A01_RENDER_AGGREGATION_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
