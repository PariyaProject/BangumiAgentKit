import { createHash } from 'node:crypto';

export const D07_EXPECTED_YEARS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => 2016 + index),
);

export const D07_QUERY_ARGUMENTS_BY_YEAR = Object.freeze(
  Object.fromEntries(
    D07_EXPECTED_YEARS.map((year) => [
      year,
      Object.freeze({
        media: 'anime',
        year,
        sort: 'rank',
        resultMode: 'top',
        limit: 1,
        explain: 'compact',
      }),
    ]),
  ),
);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function exactKeys(value, expected) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort())
  );
}

function sourceCallIsValid(call, year) {
  const expectedArguments = D07_QUERY_ARGUMENTS_BY_YEAR[year];
  const result = call?.result;
  const coverage = result?.coverage;
  const item = Array.isArray(result?.items) ? result.items[0] : null;
  return (
    canonicalJson(call?.arguments) === canonicalJson(expectedArguments) &&
    result?.state === 'ok' &&
    result?.operation === 'browseSubjects' &&
    result?.totalKind === 'exact' &&
    typeof result?.retrievedAt === 'string' &&
    Number.isFinite(Date.parse(result.retrievedAt)) &&
    coverage?.state === 'complete' &&
    coverage?.requested === 1 &&
    coverage?.scanned === 1 &&
    coverage?.matched === 1 &&
    coverage?.returned === 1 &&
    result.itemCount === 1 &&
    Array.isArray(result.items) &&
    result.items.length === 1 &&
    Number.isSafeInteger(item?.id) &&
    item.id > 0 &&
    Number.isSafeInteger(item?.rank) &&
    item.rank > 0 &&
    /^[0-9a-f]{64}$/u.test(item?.titleSha256 ?? '')
  );
}

function currentSnapshotLimitation(text) {
  return /当前/u.test(text);
}

function historicalRankLimitation(text) {
  return /历史/u.test(text) && /(不代表|不能|无法|并非|并不是|不等于)/u.test(text);
}

function coverageLimitation(text) {
  return /覆盖/u.test(text) && /(有限|部分|不完整|未证明)/u.test(text);
}

/**
 * Verify a bounded D07 answer against ten exact, ordered, current-source calls.
 * The returned result is report-safe: it contains no raw answer or title text.
 */
export function verifyD07CurrentRankAnswer(answerText, toolCalls) {
  const answerBytes = Buffer.byteLength(String(answerText ?? ''), 'utf8');
  let answer;
  try {
    if (answerBytes === 0 || answerBytes > 3600) throw new Error('answer_size');
    answer = JSON.parse(answerText);
  } catch {
    return {
      passed: false,
      method: 'd07-current-rank-by-source-year-v1',
      answerChecks: { validJsonAndBoundedSize: false },
      resultCounters: {
        expectedYears: D07_EXPECTED_YEARS.length,
        observedCalls: Array.isArray(toolCalls) ? toolCalls.length : 0,
      },
    };
  }

  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const answerShape =
    exactKeys(answer, ['schemaVersion', 'interpretation', 'rows', 'limitations']) &&
    answer?.schemaVersion === 1 &&
    answer?.interpretation === 'current_rank_by_source_year' &&
    Array.isArray(answer?.rows) &&
    answer.rows.length === D07_EXPECTED_YEARS.length &&
    typeof answer?.limitations === 'string' &&
    answer.limitations.length > 0 &&
    answer.limitations.length <= 500;
  const exactCalls =
    calls.length === D07_EXPECTED_YEARS.length &&
    D07_EXPECTED_YEARS.every((year, index) => sourceCallIsValid(calls[index], year));
  const exactRows =
    answerShape &&
    D07_EXPECTED_YEARS.every((year, index) => {
      const row = answer.rows[index];
      const sourceItem = calls[index]?.result?.items?.[0];
      return (
        exactKeys(row, ['year', 'subjectId', 'title', 'rank']) &&
        row.year === year &&
        row.subjectId === sourceItem?.id &&
        Number.isSafeInteger(row.rank) &&
        row.rank === sourceItem?.rank &&
        typeof row.title === 'string' &&
        row.title.trim().length > 0 &&
        sha256(row.title) === sourceItem?.titleSha256
      );
    });
  const limitations = answerShape ? answer.limitations : '';
  const checks = {
    validJsonAndBoundedSize: true,
    answerSchema: answerShape,
    exactTenOrderedSourceCalls: exactCalls,
    exactYearSequence:
      answerShape && D07_EXPECTED_YEARS.every((year, index) => answer.rows[index]?.year === year),
    rowsMatchSourceIdsRanksAndTitles: exactRows,
    currentSnapshotOnly: currentSnapshotLimitation(limitations),
    historicalRankNotClaimed: historicalRankLimitation(limitations),
    coverageLimitDisclosed: coverageLimitation(limitations),
  };
  const passed = Object.values(checks).every(Boolean);
  const sourceRows = exactCalls
    ? calls.map((call, index) => ({ year: D07_EXPECTED_YEARS[index], ...call.result.items[0] }))
    : [];
  const resultCounters = {
    expectedYears: D07_EXPECTED_YEARS.length,
    observedCalls: calls.length,
    yearsWithOneObservedRank: exactCalls ? sourceRows.length : 0,
    rankMinimum: sourceRows.length > 0 ? Math.min(...sourceRows.map((row) => row.rank)) : null,
    rankMaximum: sourceRows.length > 0 ? Math.max(...sourceRows.map((row) => row.rank)) : null,
  };
  return {
    passed,
    method: 'd07-current-rank-by-source-year-v1',
    answerChecks: checks,
    resultCounters,
    ...(exactCalls
      ? {
          resultSummaries: sourceRows.map(({ year, id, rank, titleSha256 }) => ({
            year,
            subjectId: id,
            rank,
            titleSha256,
          })),
          retrievedAt: {
            first: calls[0].result.retrievedAt,
            last: calls.at(-1).result.retrievedAt,
          },
        }
      : {}),
  };
}
