import assert from 'node:assert/strict';
import test from 'node:test';
import { createD07QuerySequenceGate } from '../../scripts/lib/d07-query-sequence.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';

test('allows exactly one query_subjects call per D07 year in chronological order', () => {
  const gate = createD07QuerySequenceGate();

  for (const year of D07_EXPECTED_YEARS) {
    const result = gate.authorize('bangumi.query_subjects', D07_QUERY_ARGUMENTS_BY_YEAR[year]);
    assert.deepEqual(result, { allowed: true, year });
  }

  const extra = gate.authorize('bangumi.query_subjects', D07_QUERY_ARGUMENTS_BY_YEAR[2025]);
  assert.deepEqual(extra, { allowed: false, code: 'CALL_LIMIT_REACHED' });
  assert.deepEqual(gate.summary(), {
    allowedCalls: 10,
    deniedCalls: 1,
    nextIndex: 10,
    terminal: true,
  });
});

test('summarizes D07 source output without retaining title text', async () => {
  const { summarizeD07QueryResult } = await import('../../scripts/lib/d07-query-sequence.mjs');
  const summary = summarizeD07QueryResult(2025, {
    state: 'ok',
    retrievedAt: '2026-10-13T12:00:00.000Z',
    plan: { operation: 'browseSubjects' },
    coverage: {
      state: 'unknown',
      requested: 1,
      scanned: 20,
      matched: 7,
      returned: 1,
      totalKind: 'exact',
    },
    items: [{ id: 654321, displayName: '公开作品标题', rank: 21 }],
  });

  assert.deepEqual(summary, {
    year: 2025,
    state: 'ok',
    operation: 'browseSubjects',
    retrievedAt: '2026-10-13T12:00:00.000Z',
    totalKind: 'exact',
    coverage: { state: 'unknown', requested: 1, scanned: 20, matched: 7, returned: 1 },
    itemCount: 1,
    items: [
      {
        id: 654321,
        rank: 21,
        titleSha256: '24a55d459af2efac956c0beb4aaf362ff4ecbca2fbc3145bbc93d2a8ced85ace',
      },
    ],
  });
  assert.equal(JSON.stringify(summary).includes('公开作品标题'), false);
});

test('an out-of-order call permanently locks the sequence before any read is allowed', () => {
  const gate = createD07QuerySequenceGate();

  assert.deepEqual(gate.authorize('bangumi.query_subjects', D07_QUERY_ARGUMENTS_BY_YEAR[2017]), {
    allowed: false,
    code: 'ARGUMENT_MISMATCH',
  });
  assert.deepEqual(gate.authorize('bangumi.query_subjects', D07_QUERY_ARGUMENTS_BY_YEAR[2016]), {
    allowed: false,
    code: 'SEQUENCE_TERMINAL',
  });
  assert.deepEqual(gate.summary(), {
    allowedCalls: 0,
    deniedCalls: 2,
    nextIndex: 0,
    terminal: true,
  });
});
