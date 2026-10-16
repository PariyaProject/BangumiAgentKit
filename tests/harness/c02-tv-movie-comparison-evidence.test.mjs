import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  C02_PROFILE_ID,
  projectC02ComparisonResult,
  verifyC02Answer,
} from '../../scripts/lib/c02-tv-movie-comparison-evidence.mjs';
import { C02_ANSWER, C02_COMPARISON_RESULT } from './c02-tv-movie-fixtures.mjs';

const clone = (value) => structuredClone(value);

test('C02 profile is a unique fixed anonymous subject-comparison pair', () => {
  const profile = getAgentMcpProfileById(C02_PROFILE_ID);
  assert.equal(profile.frontierId, 'C02');
  assert.equal(profile.toolName, 'bangumi.get_subject_comparison');
  assert.equal(profile.calls.length, 1);
  assert.deepEqual(profile.calls[0].arguments, {
    subjectIds: [1940, 1941],
    maxCast: 1,
    maxStaff: 1,
    maxRelations: 1,
  });
});

test('C02 projection keeps only ordered public metrics, coverage, source time, and warning count', () => {
  const projected = projectC02ComparisonResult(C02_COMPARISON_RESULT);
  assert.equal(projected.state, 'complete');
  assert.equal(projected.deltaRule, 'second_minus_first');
  assert.deepEqual(projected.subjectIds, [1940, 1941]);
  assert.deepEqual(projected.metrics.map(({ key, values, delta }) => ({ key, values, delta })), [
    { key: 'episodesReported', values: [70, 1], delta: -69 },
    { key: 'score', values: [7.2, 7.5], delta: 0.3 },
    { key: 'collectionTotal', values: [10000, 2000], delta: -8000 },
  ]);
  assert.equal(projected.warningCount, 0);
  assert.equal(Object.hasOwn(projected, 'subjectsRaw'), false);
});

test('C02 projection rejects wrong pair order and a metric delta that does not match its source values', () => {
  const reversed = clone(C02_COMPARISON_RESULT);
  reversed.subjectIds.reverse();
  assert.equal(projectC02ComparisonResult(reversed), null);

  const wrongDelta = clone(C02_COMPARISON_RESULT);
  wrongDelta.metrics[0].delta = 69;
  assert.equal(projectC02ComparisonResult(wrongDelta), null);
});

test('C02 answer accepts exact names, metric values, states, delta direction, and fixed limitations', () => {
  const source = projectC02ComparisonResult(C02_COMPARISON_RESULT);
  const verified = verifyC02Answer(C02_ANSWER, source);
  assert.equal(verified.accepted, true);
  assert.ok(Object.values(verified.checks).every(Boolean));
});

test('C02 answer rejects invented values, reversed deltas, extra claims, and omitted limits', () => {
  const source = projectC02ComparisonResult(C02_COMPARISON_RESULT);
  const reversedDelta = JSON.parse(C02_ANSWER);
  reversedDelta.metrics[0].delta = 69;
  assert.equal(verifyC02Answer(JSON.stringify(reversedDelta), source).accepted, false);

  const extraClaim = JSON.parse(C02_ANSWER);
  extraClaim.recommendation = 'The movie is better';
  assert.equal(verifyC02Answer(JSON.stringify(extraClaim), source).accepted, false);

  const missingLimit = JSON.parse(C02_ANSWER);
  missingLimit.limitations.pop();
  assert.equal(verifyC02Answer(JSON.stringify(missingLimit), source).accepted, false);

  const invented = JSON.parse(C02_ANSWER);
  invented.metrics[1].values[1] = 8.5;
  assert.equal(verifyC02Answer(JSON.stringify(invented), source).accepted, false);
});

test('C02 answer preserves unknown/conflict state instead of replacing it with a number', () => {
  const result = clone(C02_COMPARISON_RESULT);
  result.metrics[1] = {
    key: 'score', values: [null, null], delta: null, deltaPrecision: 1, state: 'unknown',
  };
  const source = projectC02ComparisonResult(result);
  const answer = JSON.parse(C02_ANSWER);
  answer.metrics[1] = { key: 'score', values: [null, null], delta: null, state: 'unknown' };
  assert.equal(verifyC02Answer(JSON.stringify(answer), source).accepted, true);

  answer.metrics[1] = { key: 'score', values: [7.2, 7.5], delta: 0.3, state: 'complete' };
  assert.equal(verifyC02Answer(JSON.stringify(answer), source).accepted, false);
});
