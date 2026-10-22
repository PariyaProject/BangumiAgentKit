import { Buffer } from 'node:buffer';
import { validateP03V2ProfileReport } from './write-p03-person-name-cn-v2-report.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const payload = JSON.parse(input);
  const claim = payload?.claim;
  const reportBytes = Buffer.from(payload?.reportBytesBase64 ?? '', 'base64');
  const report = JSON.parse(reportBytes.toString('utf8'));
  const validation = validateP03V2ProfileReport(report, claim, reportBytes);
  process.stdout.write(`${JSON.stringify(validation)}\n`);
  process.exitCode = validation.passed ? 0 : 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ passed: false, reason: 'P03_V2_REPORT_INPUT_INVALID' })}\n`,
  );
  process.exitCode = 1;
}
