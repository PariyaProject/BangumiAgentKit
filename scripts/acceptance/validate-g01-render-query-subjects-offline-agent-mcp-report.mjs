#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { validateG01RenderQueryOfflineProfileReport } from './write-g01-render-query-subjects-offline-agent-mcp-report.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const payload = JSON.parse(input);
  const reportBytes = Buffer.from(payload.reportBytesBase64, 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateG01RenderQueryOfflineProfileReport(report, payload.claim, reportBytes);
  if (!validation.passed) {
    process.stderr.write(`${validation.reason ?? 'G01_RENDER_QUERY_REPORT_INVALID'}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({
        passed: true,
        reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
      })}\n`,
    );
  }
} catch {
  process.stderr.write('G01_RENDER_QUERY_REPORT_INPUT_INVALID\n');
  process.exitCode = 1;
}
