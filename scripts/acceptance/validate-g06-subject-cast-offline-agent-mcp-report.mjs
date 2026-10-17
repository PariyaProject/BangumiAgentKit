import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateG06SubjectCastOfflineReport } from './write-g06-subject-cast-offline-agent-mcp-report.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const bytes = Buffer.from(input?.reportBytesBase64 ?? '', 'base64');
  if (bytes.toString('base64') !== input?.reportBytesBase64) {
    throw new Error('non-canonical report bytes');
  }
  const report = JSON.parse(bytes.toString('utf8'));
  const result = validateG06SubjectCastOfflineReport(report, input?.claim, bytes);
  process.stdout.write(
    JSON.stringify({
      ...result,
      reportSha256: result.passed ? createHash('sha256').update(bytes).digest('hex') : null,
    }),
  );
  if (!result.passed) process.exitCode = 1;
} catch {
  process.stdout.write(
    JSON.stringify({ passed: false, reason: 'G06_CAST_OFFLINE_REPORT_INPUT_INVALID' }),
  );
  process.exitCode = 2;
}
