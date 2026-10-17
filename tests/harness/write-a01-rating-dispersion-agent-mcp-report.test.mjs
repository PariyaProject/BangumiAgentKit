import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildA01RatingDispersionProfileReport,
  validateA01RatingDispersionProfileReport,
  validateA01RatingDispersionServerSummary,
} from '../../scripts/acceptance/write-a01-rating-dispersion-agent-mcp-report.mjs';

test('A01 report validation rejects a report without its durable Harness claim', () => {
  assert.deepEqual(validateA01RatingDispersionProfileReport({}, null), {
    passed: false,
    reason: 'A01_RATING_REPORT_CLAIM_INVALID',
  });
});

test('A01 report builder fails closed before signing when the result or server summary is missing', () => {
  const result = buildA01RatingDispersionProfileReport({
    claim: null,
    serverSummary: null,
    events: null,
    answer: '',
    rawResult: null,
    codexCliVersion: '0.0.0',
    eventStreamSha256: 'a'.repeat(64),
    serverSummarySha256: 'b'.repeat(64),
  });
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'A01_RATING_RUNNER_GATE_INVALID');
  assert.equal(
    validateA01RatingDispersionServerSummary(null, 'a'.repeat(40), 'b'.repeat(64)),
    false,
  );
});
