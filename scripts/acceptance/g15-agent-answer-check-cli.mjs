import { readFileSync } from 'node:fs';
import { createSanitizedG15CanaryReport, verifyG15AgentAnswer } from './g15-agent-answer-check.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input?.mode === 'report') {
    const report = createSanitizedG15CanaryReport(input);
    process.stdout.write(JSON.stringify(report));
    if (!report.passed) process.exitCode = 1;
  } else {
    const check = verifyG15AgentAnswer(
      input?.answer,
      input?.toolName,
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
