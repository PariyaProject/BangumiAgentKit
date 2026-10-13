import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
  verifyD07CurrentRankAnswer,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function successfulToolCalls() {
  return D07_EXPECTED_YEARS.map((year, index) => {
    const title = `Example anime ${year}`;
    return {
      arguments: D07_QUERY_ARGUMENTS_BY_YEAR[year],
      result: {
        state: 'ok',
        operation: 'browseSubjects',
        retrievedAt: `2026-10-13T12:${String(index).padStart(2, '0')}:00.000Z`,
        totalKind: 'exact',
        coverage: { state: 'complete', requested: 1, scanned: 1, matched: 1, returned: 1 },
        itemCount: 1,
        items: [{ id: 10000 + year, rank: index + 1, titleSha256: sha256(title) }],
      },
    };
  });
}

function successfulAnswer(toolCalls) {
  return JSON.stringify({
    schemaVersion: 1,
    interpretation: 'current_rank_by_source_year',
    rows: toolCalls.map(({ arguments: args, result }) => ({
      year: args.year,
      subjectId: result.items[0].id,
      title: `Example anime ${args.year}`,
      rank: result.items[0].rank,
    })),
    limitations:
      '这些是检索时的当前排名快照，不代表对应年份当时的历史排名；每年只检查一个有界返回项，覆盖范围有限。',
  });
}

test('accepts one source-matching current-rank result for every D07 year with explicit history limits', () => {
  const toolCalls = successfulToolCalls();
  const result = verifyD07CurrentRankAnswer(successfulAnswer(toolCalls), toolCalls);

  assert.equal(result.passed, true);
  assert.equal(result.answerChecks.exactYearSequence, true);
  assert.equal(result.answerChecks.rowsMatchSourceIdsRanksAndTitles, true);
  assert.equal(result.answerChecks.currentSnapshotOnly, true);
  assert.equal(result.answerChecks.historicalRankNotClaimed, true);
  assert.equal(result.answerChecks.coverageLimitDisclosed, true);
  assert.equal(result.resultCounters.yearsWithOneObservedRank, 10);
  assert.equal(Object.hasOwn(result, 'answer'), false);
  assert.equal(Object.hasOwn(result, 'toolCalls'), false);
});

test('rejects a duplicated year even when the response still contains ten rows', () => {
  const toolCalls = successfulToolCalls();
  const answer = JSON.parse(successfulAnswer(toolCalls));
  answer.rows[9].year = answer.rows[8].year;

  const result = verifyD07CurrentRankAnswer(JSON.stringify(answer), toolCalls);

  assert.equal(result.passed, false);
  assert.equal(result.answerChecks.exactYearSequence, false);
});

test('rejects raw-answer fields that are not part of the fixed D07 answer schema', () => {
  const toolCalls = successfulToolCalls();
  const answer = JSON.parse(successfulAnswer(toolCalls));
  answer.rawText = 'must never be retained';

  const result = verifyD07CurrentRankAnswer(JSON.stringify(answer), toolCalls);

  assert.equal(result.passed, false);
  assert.equal(result.answerChecks.answerSchema, false);
});

test('rejects a keyword-search result instead of the documented browse-by-year route', () => {
  const toolCalls = successfulToolCalls();
  toolCalls[0].result.operation = 'searchSubjects';

  const result = verifyD07CurrentRankAnswer(successfulAnswer(toolCalls), toolCalls);

  assert.equal(result.passed, false);
  assert.equal(result.answerChecks.exactTenOrderedSourceCalls, false);
});

test('fails closed without throwing when a source summary omits its item list', () => {
  const toolCalls = successfulToolCalls();
  delete toolCalls[2].result.items;

  const result = verifyD07CurrentRankAnswer(successfulAnswer(successfulToolCalls()), toolCalls);

  assert.equal(result.passed, false);
  assert.equal(result.answerChecks.exactTenOrderedSourceCalls, false);
});
