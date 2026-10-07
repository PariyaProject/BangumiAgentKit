import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSanitizedD04CanaryReport,
  D04_DISCOVERY_ARGUMENTS,
  verifyD04DiscoveryAnswer,
} from '../../scripts/acceptance/d04-discovery-answer-check.mjs';

function resultFixture() {
  const items = [
    {
      id: 101,
      name: 'Official title A',
      nameCn: '公开条目甲',
      displayName: '公开条目甲',
      media: 'anime',
      ratingCount: 3001,
      episodesReported: 12,
      tags: ['科幻'],
      metaTags: [],
    },
    {
      id: 102,
      name: 'Official title B',
      nameCn: '公开条目乙',
      displayName: '公开条目乙',
      media: 'anime',
      ratingCount: 3500,
      episodesReported: 8,
      tags: ['科幻', '冒险'],
      metaTags: [],
    },
  ];
  const plan = {
    source: 'official_v0',
    operation: 'searchSubjects',
    steps: [{
      kind: 'search',
      operation: 'searchSubjects',
      request: { filter: { type: [2], tag: ['科幻'], ratingCount: ['>=3001'] } },
    }],
    pushdown: [
      { field: 'media', classification: 'PUSHDOWN', value: ['anime'] },
      { field: 'tags', classification: 'PUSHDOWN', value: ['科幻'] },
      { field: 'ratingCount', classification: 'PUSHDOWN', value: { min: 3001 } },
    ],
    postFilters: [{ field: 'episodeCount', classification: 'POST_FILTER', value: { max: 12 } }],
    limitations: [
      'Official subject search is experimental; estimated totals do not establish global completeness.',
      'The local range uses reported subject.eps, not total_episodes or watched progress.',
    ],
  };
  const coverage = {
    state: 'complete',
    requested: 100,
    scanned: 2,
    matched: 2,
    returned: 2,
    pagesScanned: 1,
    totalKind: 'estimated',
    upstreamExhausted: true,
    budgetExceeded: false,
    hydrationsAttempted: 0,
    hydrationsSucceeded: 0,
    hydrationsFailed: 0,
    hydrationsUnresolved: 0,
  };
  const full = {
    state: 'ok',
    items,
    plan,
    coverage,
    evidence: [{ source: { class: 'official_v0', operation: 'searchSubjects', experimental: true } }],
    warnings: [],
    limitations: ['A bounded observation only.'],
  };
  const textView = {
    state: 'ok',
    items,
    itemsOmittedFromText: 0,
    mcpTextProjection: {
      version: 'discovery-results-mcp-text-v1',
      structuredContentHasFullResult: true,
    },
  };
  return {
    items,
    plan,
    coverage,
    full,
    toolOutput: {
      structuredContent: full,
      content: [{ type: 'text', text: JSON.stringify(textView) }],
    },
  };
}

function answerFixture() {
  return [
    '条件｜动画；精确标签科幻；评分人数≥3001；报告集数（subject.eps）≤12。',
    '条目｜101｜名称=公开条目甲｜评分人数=3001｜报告集数=12',
    '条目｜102｜名称=公开条目乙｜评分人数=3500｜报告集数=8',
    '范围｜本次有限检索使用实验性官方搜索，总数为估算；不构成全库完整清单，遗漏不代表不存在。',
    '口径｜subject.eps 是 Bangumi 报告集数，不是 total_episodes 章节数、已播集数或观看进度。',
  ].join('\n');
}

test('D04 answer checker matches visible rows to the exact bounded source and scope', () => {
  const { toolOutput } = resultFixture();
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.counts.sourceRows, 2);
  assert.equal(result.counts.matchedRows, 2);
  assert.equal(result.checks.reportedEpsMeaningDisclosed, true);
  assert.equal(result.checks.nonExhaustiveBoundaryDisclosed, true);
});

test('D04 answer checker accepts source-exact titles with digits and clipped MCP-visible text', () => {
  const { toolOutput } = resultFixture();
  const structured = toolOutput.structuredContent;
  structured.items[0].nameCn = '公开条目甲 86';
  const textView = JSON.parse(toolOutput.content[0].text);
  textView.items[0].nameCn = '公开条目甲…';
  const clippedOutput = {
    structuredContent: structured,
    content: [{ type: 'text', text: JSON.stringify(textView) }],
  };
  const answer = answerFixture()
    .replace('名称=公开条目甲', '名称=公开条目甲…')
    .replace('名称=公开条目乙', '名称=公开条目乙');
  const result = verifyD04DiscoveryAnswer(
    answer,
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    clippedOutput,
  );

  assert.equal(result.passed, true, JSON.stringify(result));
});

test('D04 answer checker fails closed when the MCP text fallback hides all rows', () => {
  const { toolOutput } = resultFixture();
  const output = {
    structuredContent: toolOutput.structuredContent,
    content: [{
      type: 'text',
      text: JSON.stringify({
        state: 'ok',
        itemsOmittedFromText: 2,
        textViewScope: 'Bounded text omitted details; full result remains in structuredContent.',
      }),
    }],
  };
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    output,
  );

  assert.equal(result.passed, false);
  assert.equal(result.checks.mcpTextProjectionPreservesFullStructuredResult, false);
  assert.equal(result.checks.answerRowsMatchVisibleSourceRows, false);
});

test('D04 answer checker rejects fabricated episode counts, extra tools, and unsupported completeness', () => {
  const { toolOutput } = resultFixture();
  const incorrectAnswer = answerFixture()
    .replace('报告集数=12', '报告集数=13')
    .replace('不构成全库完整清单，遗漏不代表不存在。', '这是全库完整清单。');
  const result = verifyD04DiscoveryAnswer(
    incorrectAnswer,
    [
      { name: 'bangumi.query_subjects', state: 'DONE' },
      { name: 'shell', state: 'DONE' },
    ],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.exactTargetToolCalledOnce, false);
  assert.equal(result.checks.answerRowsMatchVisibleSourceRows, false);
  assert.equal(result.checks.unsupportedCompletenessOrAbsenceClaim, true);
});

test('sanitized D04 report retains only hashes, booleans, and aggregate counters', () => {
  const { toolOutput } = resultFixture();
  const answerCheck = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  const falsePrivacy = {
    authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false,
    writesAttempted: false, qqPipelineTested: false, timClientTested: false,
    promptStored: false, answerStored: false, rawResultStored: false,
    artifactImageBytesStored: false, credentialsStored: false,
  };
  const report = createSanitizedD04CanaryReport({
    queryArguments: D04_DISCOVERY_ARGUMENTS,
    answerCheck,
    serverSummary: {
      serverProfile: 'one-tool-anonymous-public-v1',
      sourceRevision: 'a'.repeat(40),
      catalogSha256: 'b'.repeat(64),
      toolName: 'bangumi.query_subjects',
      toolDescriptionSha256: 'c'.repeat(64),
      inputSchemaSha256: 'd'.repeat(64),
      expectedArgumentsSha256: 'e'.repeat(64),
      serverToolNames: ['bangumi.query_subjects'],
      serverToolCount: 1,
      serverResultStatus: 'SUCCESS',
      allowedCallCount: 1,
      deniedCallCount: 0,
      argumentMatch: true,
      result: {
        d04DiscoveryChecks: {
          operation: 'searchSubjects',
          itemCount: 2,
          sourceClasses: ['official_v0'],
        },
      },
      privacy: falsePrivacy,
    },
  });
  const encoded = JSON.stringify(report);
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.doesNotMatch(encoded, /公开条目|Official title|科幻|3001|3500|episodesReported|名称=/u);
  assert.equal(report.rawAnswerStored, false);
  assert.equal(report.subjectFactsStored, false);
});
