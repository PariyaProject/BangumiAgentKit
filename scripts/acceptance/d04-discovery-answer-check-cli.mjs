import { readFileSync } from 'node:fs';
import {
  createSanitizedD04CanaryReport,
  verifyD04DiscoveryAnswer,
} from './d04-discovery-answer-check.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input?.mode === 'report') {
    const report = createSanitizedD04CanaryReport(input);
    process.stdout.write(JSON.stringify(report));
    if (!report.passed) process.exitCode = 1;
  } else {
    const check = verifyD04DiscoveryAnswer(
      input?.answer,
      input?.toolCalls,
      input?.queryArguments,
      input?.toolOutput,
    );
    process.stdout.write(JSON.stringify(check));
    if (!check.passed) process.exitCode = 1;
  }
} catch {
  process.stdout.write(JSON.stringify({ passed: false, failureClass: 'INVALID_PROBE_INPUT' }));
  process.exitCode = 2;
}
