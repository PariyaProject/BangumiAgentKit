import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createD04CodexAcceptanceReport,
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
      reportedEpisodeCount: 12,
      tags: ['科幻'],
      metaTags: [],
      evidence: {
        reportedEpisodeCount: [{ source: { class: 'official_v0' }, fieldPath: 'items[101].eps' }],
      },
    },
    {
      id: 102,
      name: 'Official title B',
      nameCn: '公开条目乙',
      displayName: '公开条目乙',
      media: 'anime',
      ratingCount: 3500,
      reportedEpisodeCount: 8,
      tags: ['科幻', '冒险'],
      metaTags: [],
      evidence: {
        reportedEpisodeCount: [{ source: { class: 'official_v0' }, fieldPath: 'items[102].eps' }],
      },
    },
  ];
  const plan = {
    source: 'official_v0',
    operation: 'searchSubjects',
    budget: { maxPages: 10, maxCandidates: 500, maxHydrations: 120, maxReturnedItems: 100 },
    steps: [
      {
        kind: 'search',
        operation: 'searchSubjects',
        request: { filter: { type: [2], tag: ['科幻'], ratingCount: ['>=3001'] } },
      },
    ],
    pushdown: [
      { field: 'media', classification: 'PUSHDOWN', value: ['anime'] },
      { field: 'tags', classification: 'PUSHDOWN', value: ['科幻'] },
      { field: 'ratingCount', classification: 'PUSHDOWN', value: { min: 3001 } },
    ],
    postFilters: [
      { field: 'reportedEpisodeCount', classification: 'POST_FILTER', value: { max: 12 } },
    ],
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
    pagesRequested: 1,
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
    evidence: [
      { source: { class: 'official_v0', operation: 'searchSubjects', experimental: true } },
    ],
    warnings: [],
    limitations: ['A bounded observation only.'],
  };
  const textView = {
    state: 'ok',
    plan,
    coverage,
    items,
    textProjection: {
      rowsIncluded: items.length,
      rowsOmitted: 0,
      fullStructuredContentAvailable: true,
      textViewScope: 'Only included rows are shown; omitted rows are not evidence of absence.',
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
    '条件｜动画媒体=anime(type=2)｜精确标签=科幻｜评分人数下限=3001｜报告话数(subject.eps)上限=12',
    '条目｜101｜名称=公开条目甲｜评分人数=3001｜报告话数=12',
    '条目｜102｜名称=公开条目乙｜评分人数=3500｜报告话数=8',
    '范围｜state=complete｜scanned=2｜matched=2｜returned=2｜totalKind=estimated',
    '说明｜本次有限检索使用实验性官方搜索，总数为估算；不构成全库完整清单，遗漏不代表不存在。',
    '口径｜subject.eps 是 Bangumi 报告话数，不是 total_episodes 章节数、已播集数或观看进度。',
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
  assert.equal(result.checks.reportedEpisodeEvidenceVisible, true);
  assert.equal(result.checks.nonExhaustiveBoundaryDisclosed, true);
});

test('D04 answer checker accepts full pretty-JSON readback when the result fits the text limit', () => {
  const { full } = resultFixture();
  const fullTextOutput = { content: [{ type: 'text', text: JSON.stringify(full, null, 2) }] };
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    fullTextOutput,
  );
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.counts.visibleRows, 2);
});

test('D04 answer checker requires source rows in the MCP text when structured content is available', () => {
  const { full } = resultFixture();
  const structuredOnly = { structuredContent: full };
  const hiddenRowsWithoutProjection = {
    structuredContent: full,
    content: [{ type: 'text', text: JSON.stringify({ ...full, items: [] }) }],
  };

  for (const toolOutput of [structuredOnly, hiddenRowsWithoutProjection]) {
    const result = verifyD04DiscoveryAnswer(
      answerFixture(),
      [{ name: 'bangumi.query_subjects', state: 'DONE' }],
      D04_DISCOVERY_ARGUMENTS,
      toolOutput,
    );
    assert.equal(result.passed, false);
    assert.equal(result.checks.resultReadbackAvailable, false);
    assert.equal(result.checks.mcpTextProjectionPreservesFullStructuredResult, false);
  }
});

test('D04 answer checker requires partial-state disclosure after unresolved source coverage', () => {
  const { toolOutput } = resultFixture();
  toolOutput.structuredContent.state = 'partial';
  toolOutput.structuredContent.coverage.state = 'partial';
  toolOutput.structuredContent.coverage.hydrationsUnresolved = 1;
  const partialTextView = JSON.parse(toolOutput.content[0].text);
  partialTextView.state = 'partial';
  partialTextView.coverage.state = 'partial';
  partialTextView.coverage.hydrationsUnresolved = 1;
  toolOutput.content[0].text = JSON.stringify(partialTextView);
  const partialAnswer = answerFixture()
    .replace('本次有限检索使用实验性官方搜索', '本次部分结果来自有限的实验性官方搜索')
    .replace('范围｜state=complete', '范围｜state=partial');
  const accepted = verifyD04DiscoveryAnswer(
    partialAnswer,
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(accepted.passed, true, JSON.stringify(accepted));

  const omittedDisclosure = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(omittedDisclosure.passed, false);
  assert.equal(omittedDisclosure.checks.partialCoverageDisclosure, false);
});

test('D04 answer checker rejects contradictory result and coverage states', () => {
  const { toolOutput } = resultFixture();
  toolOutput.structuredContent.coverage.state = 'partial';
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.coverageStateConsistent, false);
});

test('D04 answer checker requires source evidence for every reported episode value', () => {
  const { toolOutput } = resultFixture();
  delete toolOutput.structuredContent.items[1].evidence.reportedEpisodeCount;
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.reportedEpisodeEvidenceVisible, false);
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

test('D04 answer checker rejects a visible title that does not match its structured source row', () => {
  const { toolOutput } = resultFixture();
  const textView = JSON.parse(toolOutput.content[0].text);
  textView.items[0].nameCn = '伪造条目名称';
  textView.items[0].displayName = '伪造条目名称';
  const mismatchedOutput = {
    structuredContent: toolOutput.structuredContent,
    content: [{ type: 'text', text: JSON.stringify(textView) }],
  };
  const answer = answerFixture().replace('名称=公开条目甲', '名称=伪造条目名称');
  const result = verifyD04DiscoveryAnswer(
    answer,
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    mismatchedOutput,
  );

  assert.equal(result.passed, false);
  assert.equal(result.checks.answerRowsMatchVisibleSourceRows, false);
  assert.equal(result.counts.mismatchedRows, 1);
});

test('D04 answer checker fails closed when the MCP text fallback hides all rows', () => {
  const { toolOutput } = resultFixture();
  const full = toolOutput.structuredContent;
  const output = {
    structuredContent: full,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          ...full,
          items: [],
          textProjection: {
            rowsIncluded: 0,
            rowsOmitted: 2,
            fullStructuredContentAvailable: true,
            textViewScope:
              'Bounded text omitted details; full result remains in structuredContent.',
          },
        }),
      },
    ],
  };
  const result = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    output,
  );

  assert.equal(result.passed, false);
  assert.equal(result.checks.mcpTextProjectionPreservesFullStructuredResult, true);
  assert.equal(result.checks.answerRowsMatchVisibleSourceRows, false);
});

test('D04 answer checker rejects fabricated episode counts, extra tools, and unsupported completeness', () => {
  const { toolOutput } = resultFixture();
  const incorrectAnswer = answerFixture()
    .replace('报告话数=12', '报告话数=13')
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

test('D04 answer checker binds coverage counters and non-row numbers to their exact claims', () => {
  const { toolOutput } = resultFixture();
  const wrongCoverage = answerFixture().replace('scanned=2', 'scanned=1');
  const unsupportedNumber = answerFixture().replace(
    '说明｜本次有限检索',
    '说明｜本次观察到101项扫描。有限检索',
  );

  for (const answer of [wrongCoverage, unsupportedNumber]) {
    const result = verifyD04DiscoveryAnswer(
      answer,
      [{ name: 'bangumi.query_subjects', state: 'DONE' }],
      D04_DISCOVERY_ARGUMENTS,
      toolOutput,
    );
    assert.equal(result.passed, false);
    assert.equal(result.checks.numericClaimsMatchObservedSource, false);
  }
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
    authProfile: 'anonymous',
    oauthAttempted: false,
    accountDataRead: false,
    writesAttempted: false,
    qqPipelineTested: false,
    timClientTested: false,
    promptStored: false,
    answerStored: false,
    rawResultStored: false,
    artifactImageBytesStored: false,
    credentialsStored: false,
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
  assert.doesNotMatch(encoded, /公开条目|Official title|科幻|3001|3500|名称=/u);
  assert.equal(report.rawAnswerStored, false);
  assert.equal(report.subjectFactsStored, false);
});

test('D04 Codex evidence uses the strict sanitized one-tool acceptance schema', () => {
  const { toolOutput } = resultFixture();
  const answerCheck = verifyD04DiscoveryAnswer(
    answerFixture(),
    [{ name: 'bangumi.query_subjects', state: 'DONE' }],
    D04_DISCOVERY_ARGUMENTS,
    toolOutput,
  );
  const privacy = {
    authProfile: 'anonymous',
    oauthAttempted: false,
    accountDataRead: false,
    writesAttempted: false,
    qqPipelineTested: false,
    timClientTested: false,
    promptStored: false,
    answerStored: false,
    rawResultStored: false,
    artifactImageBytesStored: false,
    credentialsStored: false,
  };
  const report = createD04CodexAcceptanceReport({
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
        resultState: 'partial',
        resultByteLength: 4096,
        resultSha256: 'f'.repeat(64),
        sourceOperations: [
          { operation: 'POST /v0/search/subjects', attempted: 1, succeeded: 1, failed: 0 },
        ],
        artifact: { returned: false, persisted: false },
        d04DiscoveryChecks: {
          operation: 'searchSubjects',
          resultState: 'partial',
          coverageState: 'partial',
        },
      },
      privacy,
    },
    codexSummary: {
      codexCliVersion: '0.160.1',
      processExitCode: 0,
      eventStreamParsed: true,
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
    },
  });
  const encoded = JSON.stringify(report);

  assert.deepEqual(
    Object.keys(report).sort(),
    [
      'schemaVersion',
      'evidenceKind',
      'sourceRevision',
      'codexCliVersion',
      'catalogSha256',
      'profile',
      'model',
      'reasoningEffort',
      'toolName',
      'toolDescriptionSha256',
      'inputSchemaSha256',
      'argumentProfile',
      'expectedArgumentsSha256',
      'serverToolNames',
      'serverToolCount',
      'processExitCode',
      'resultStatus',
      'resultCount',
      'eventStreamParsed',
      'codexMcpToolEventCount',
      'nonMcpToolEventCount',
      'shellToolCallCount',
      'allowedCallCount',
      'deniedCallCount',
      'qqPipelineTested',
      'timClientTested',
      'privacy',
      'scenarios',
    ].sort(),
  );
  assert.equal(report.scenarios[0].passed, true);
  assert.equal(report.scenarios[0].answerCheckPassed, true);
  assert.equal(report.scenarios[0].result.resultState, 'partial');
  assert.doesNotMatch(encoded, /公开条目|Official title|科幻|3001|subjectId/u);
  assert.equal(Object.hasOwn(report, 'prompt'), false);
  assert.equal(Object.hasOwn(report, 'answer'), false);
});
