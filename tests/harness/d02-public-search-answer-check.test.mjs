import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkD02PublicSearchAnswer,
  D02_EXPECTED_QUERY_ARGUMENTS,
  d02SanitizedSourceSummary,
  extractD02SearchReadback,
  projectD02SearchResult,
} from '../../scripts/acceptance/d02-public-search-answer-check.mjs';

const sourceResult = {
  status: 'disambiguation',
  query: '末世 旅行',
  total: 12,
  candidates: [
    { id: 218707, name: 'Shoujo Shuumatsu Ryokou', nameCn: '少女终末旅行' },
    { id: 123456, name: 'Example Journey', nameCn: '示例旅途' },
  ],
};

function answer(rows = sourceResult.candidates) {
  const titles = rows.map((row) => `候选 ${row.id} — ${row.nameCn || row.name}`);
  return [
    'Bangumi 关键词检索“末世 旅行”返回的候选：',
    ...titles,
    '范围：本次返回 2 条；这只是 Bangumi 实验性关键词搜索结果，不判断低刺激或官方相似度，不保证完整；未返回不代表不存在。',
  ].join('\n');
}

test('D02 accepts only exact returned keyword candidates and an explicit source boundary', () => {
  const checked = checkD02PublicSearchAnswer({
    answer: answer(),
    sourceResult,
    arguments: D02_EXPECTED_QUERY_ARGUMENTS,
  });
  assert.equal(checked.accepted, true);
  assert.equal(checked.matchedRows, 2);
  assert.equal(checked.scopeLineVerified, true);
});

test('D02 rejects invented or reordered candidates, changed arguments, and missing limits', () => {
  const cases = [
    answer([{ ...sourceResult.candidates[0], nameCn: 'Invented title' }, sourceResult.candidates[1]]),
    answer([...sourceResult.candidates].reverse()),
    answer().replace('实验性关键词搜索结果', '关键词搜索结果'),
  ];
  for (const text of cases) {
    assert.equal(checkD02PublicSearchAnswer({
      answer: text,
      sourceResult,
      arguments: D02_EXPECTED_QUERY_ARGUMENTS,
    }).accepted, false);
  }
  assert.equal(checkD02PublicSearchAnswer({
    answer: answer(),
    sourceResult,
    arguments: { ...D02_EXPECTED_QUERY_ARGUMENTS, limit: 50 },
  }).accepted, false);
});

test('D02 rejects positive stimulation or recommendation claims outside the mandatory scope line', () => {
  const unsafe = answer().replace(
    'Bangumi 关键词检索“末世 旅行”返回的候选：',
    'Bangumi 关键词检索“末世 旅行”返回的低刺激推荐：',
  );
  assert.equal(checkD02PublicSearchAnswer({
    answer: unsafe,
    sourceResult,
    arguments: D02_EXPECTED_QUERY_ARGUMENTS,
  }).accepted, false);
});

test('D02 preserves empty-result semantics without turning it into an absence claim', () => {
  const empty = { status: 'not_found', query: '末世 旅行', total: 0, candidates: [] };
  const emptyAnswer = [
    'Bangumi 关键词检索“末世 旅行”返回的候选：',
    '范围：本次返回 0 条；这只是 Bangumi 实验性关键词搜索结果，不判断低刺激或官方相似度，不保证完整；未返回不代表不存在。',
  ].join('\n');
  assert.equal(checkD02PublicSearchAnswer({
    answer: emptyAnswer,
    sourceResult: empty,
    arguments: D02_EXPECTED_QUERY_ARGUMENTS,
  }).accepted, true);
  assert.equal(d02SanitizedSourceSummary(empty).responseRows, 0);
});

test('sanitized D02 source summary keeps counts but no candidate names or identifiers', () => {
  const summary = d02SanitizedSourceSummary(sourceResult);
  assert.deepEqual(summary, {
    sourceResultValid: true,
    status: 'disambiguation',
    responseRows: 2,
    returnedCandidates: 2,
    reportedTotal: 12,
  });
  assert.doesNotMatch(JSON.stringify(summary), /少女终末旅行|218707|示例旅途/u);
});

test('D02 MCP result projection keeps only bounded candidate identity fields', () => {
  const fullResult = {
    ...sourceResult,
    exact: { id: 99, summary: 'large untrusted subject description' },
    candidates: sourceResult.candidates.map((candidate) => ({
      ...candidate,
      image: 'https://example.invalid/image',
      score: 9.1,
      summary: 'untrusted text',
    })),
  };
  assert.deepEqual(projectD02SearchResult(fullResult), {
    status: 'disambiguation',
    query: '末世 旅行',
    total: 12,
    candidates: [
      { id: 218707, name: 'Shoujo Shuumatsu Ryokou', nameCn: '少女终末旅行' },
      { id: 123456, name: 'Example Journey', nameCn: '示例旅途' },
    ],
  });
  assert.throws(() => projectD02SearchResult({
    ...sourceResult,
    candidates: Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: `Title ${index}` })),
  }), /bounded public-search contract/u);
});

test('D02 accepts structuredContent or a complete unclipped JSON text result', () => {
  assert.equal(extractD02SearchReadback({ structuredContent: sourceResult }).mode, 'structuredContent');
  const jsonText = JSON.stringify(sourceResult, null, 2);
  const textReadback = extractD02SearchReadback({ content: [{ type: 'text', text: jsonText }] });
  assert.equal(textReadback.mode, 'complete-json-text');
  assert.deepEqual(textReadback.value, sourceResult);
  assert.equal(extractD02SearchReadback({ content: [{ type: 'text', text: jsonText }] }, 32), null);
  assert.equal(extractD02SearchReadback({ content: [{ type: 'text', text: 'truncated candidate list' }] }), null);
});
