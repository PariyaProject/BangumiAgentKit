#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { validateC07RenderComparisonOfflineProfileReport } from './write-c07-render-comparison-offline-agent-mcp-report.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const payload = JSON.parse(input);
  const reportBytes = Buffer.from(payload.reportBytesBase64, 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateC07RenderComparisonOfflineProfileReport(
    report,
    payload.claim,
    reportBytes,
  );
  if (!validation.passed) {
    process.stderr.write(`${validation.reason ?? 'C07_RENDER_COMPARISON_REPORT_INVALID'}\n`);
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
  process.stderr.write('C07_RENDER_COMPARISON_REPORT_INPUT_INVALID\n');
  process.exitCode = 1;
}
