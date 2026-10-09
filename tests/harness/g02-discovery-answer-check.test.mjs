import assert from 'node:assert/strict';
import test from 'node:test';
import {
  G02_QUERY_ARGUMENTS,
  verifyG02QueryAnswer,
  verifyG02RendererAnswer,
} from '../../scripts/acceptance/g02-discovery-answer-check.mjs';

function queryResult(overrides = {}) {
  return {
    state: 'ok',
    itemCount: 2,
    items: [
      {
        id: 395378,
        name: 'Work One',
        nameCn: '作品一',
        date: '2024-01-04',
        media: 'anime',
        collectionTotal: 41801,
        conceptMatched: true,
      },
      {
        id: 342667,
        name: 'Work Two',
        nameCn: '作品二',
        date: '2024-04-10',
        media: 'anime',
        collectionTotal: 32534,
        conceptMatched: true,
      },
    ],
    warningCodes: ['EXPERIMENTAL_SOURCE'],
    coverage: {
      state: 'unknown',
      requested: 10,
      scanned: 20,
      matched: 20,
      returned: 2,
      pagesRequested: 1,
      pagesScanned: 1,
      upstreamExhausted: false,
      budgetExceeded: false,
      totalKind: 'estimated',
    },
    ...overrides,
  };
}

const queryAnswer = [
  '395378｜作品一｜41801',
  '342667｜作品二｜32534',
  '范围：2024-01-01至2025-01-01（左闭右开），动画，精确概念“异世界”；本次搜索扫描到20个候选，符合条件20个，返回2条。官方 v0 搜索为实验性接口，覆盖未知且总量为估算；本列表不代表全站完整榜单。heat 是当前收藏人数，不代表讨论热度或历史趋势。',
].join('\n');

function toolOutput(result) {
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

test('G02 query answer matches every current source row and keeps coverage partial', () => {
  const result = verifyG02QueryAnswer({
    answer: queryAnswer,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(result.passed, true);
  assert.ok(Object.values(result.answerChecks).every(Boolean));
  assert.deepEqual(result.resultCounters, {
    resultState: 'ok',
    coverageState: 'unknown',
    totalKind: 'estimated',
    requested: 10,
    scanned: 20,
    matched: 20,
    returned: 2,
    warningCodes: ['EXPERIMENTAL_SOURCE'],
    sourceRowsValidated: 2,
    answerRowsMatched: 2,
  });
});

test('G02 query answer rejects source-row mismatch, wrong heat order, and global ranking claims', () => {
  const mismatch = verifyG02QueryAnswer({
    answer: queryAnswer.replace('作品一｜41801', '作品一｜1'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(mismatch.answerChecks.sourceRowsMatchAnswer, false);
  assert.equal(mismatch.passed, false);

  const rows = queryResult().items;
  const wrongOrder = verifyG02QueryAnswer({
    answer: queryAnswer,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult({ items: [...rows].reverse() })),
  });
  assert.equal(wrongOrder.answerChecks.currentCollectionHeatOrder, false);

  const overclaim = verifyG02QueryAnswer({
    answer: queryAnswer.replace('不代表全站完整榜单', '这是全站最热门Top 10'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(overclaim.answerChecks.noUnsupportedGlobalTopTenClaim, false);

  const caveatedTopTen = verifyG02QueryAnswer({
    answer: queryAnswer.replace('不代表全站完整榜单', '不代表全站前十或完整榜单'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(caveatedTopTen.answerChecks.noUnsupportedGlobalTopTenClaim, true);
  assert.equal(caveatedTopTen.passed, true);

  const extraUnverifiedLine = verifyG02QueryAnswer({
    answer: `推荐作品：另外一部\n${queryAnswer}`,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(extraUnverifiedLine.answerChecks.sourceRowsMatchAnswer, false);
});

test('G02 query answer rejects missing experimental warnings and complete-coverage claims', () => {
  const base = queryResult();
  const result = verifyG02QueryAnswer({
    answer: queryAnswer,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput({
      ...base,
      warningCodes: [],
      coverage: { ...base.coverage, state: 'complete' },
    }),
  });
  assert.equal(result.answerChecks.coverageIsUnknownOrPartial, false);
  assert.equal(result.passed, false);

  const untrustedWarningText = 'PRIVATE_TITLE_IN_SOURCE_作品一';
  const unsafeWarning = verifyG02QueryAnswer({
    answer: queryAnswer,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(
      queryResult({
        warningCodes: undefined,
        warnings: [
          { code: untrustedWarningText, message: 'Untrusted source field.' },
          { code: 'EXPERIMENTAL_SOURCE', message: 'Expected bounded warning.' },
        ],
      }),
    ),
  });
  assert.equal(unsafeWarning.answerChecks.coverageIsUnknownOrPartial, false);
  assert.equal(unsafeWarning.resultCounters, null);
  assert.equal(JSON.stringify(unsafeWarning.resultCounters).includes(untrustedWarningText), false);

  const oversizedWarnings = verifyG02QueryAnswer({
    answer: queryAnswer,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(
      queryResult({
        warningCodes: Array.from({ length: 21 }, () => 'EXPERIMENTAL_SOURCE'),
      }),
    ),
  });
  assert.equal(oversizedWarnings.answerChecks.coverageIsUnknownOrPartial, false);
  assert.equal(oversizedWarnings.resultCounters, null);
});

test('G02 query answer requires plain text and explicit non-trend scope', () => {
  const markdown = verifyG02QueryAnswer({
    answer: `- ${queryAnswer}`,
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(markdown.answerChecks.plainTextNoMarkdown, false);

  const trend = verifyG02QueryAnswer({
    answer: queryAnswer.replace('不代表讨论热度或历史趋势', '讨论热度一直最高，历史趋势持续上升'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(trend.answerChecks.noUnsupportedTrendClaim, false);
  assert.equal(trend.answerChecks.experimentalSourceDisclosed, false);

  const missingMediaDisclosure = verifyG02QueryAnswer({
    answer: queryAnswer.replace('动画，精确概念', '精确概念'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(missingMediaDisclosure.answerChecks.exactAnimeAndConcept, false);

  const missingHalfOpenDisclosure = verifyG02QueryAnswer({
    answer: queryAnswer.replace('（左闭右开）', ''),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(missingHalfOpenDisclosure.answerChecks.exact2024DateWindow, false);

  const negatedMediaDisclosure = verifyG02QueryAnswer({
    answer: queryAnswer.replace('动画，精确概念', '非动画，精确概念'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(negatedMediaDisclosure.answerChecks.exactAnimeAndConcept, false);

  const negatedHalfOpenDisclosure = verifyG02QueryAnswer({
    answer: queryAnswer.replace('（左闭右开）', '（不是左闭右开）'),
    queryArguments: G02_QUERY_ARGUMENTS,
    toolOutput: toolOutput(queryResult()),
  });
  assert.equal(negatedHalfOpenDisclosure.answerChecks.exact2024DateWindow, false);
});

test('G02 query coverage rejects impossible and over-budget counters without persisting them', () => {
  const baseCoverage = queryResult().coverage;
  const cases = [
    queryResult({ coverage: { ...baseCoverage, scanned: 501, matched: 501 } }),
    queryResult({ coverage: { ...baseCoverage, scanned: 20, matched: 21 } }),
  ];

  for (const result of cases) {
    const checked = verifyG02QueryAnswer({
      answer: queryAnswer,
      queryArguments: G02_QUERY_ARGUMENTS,
      toolOutput: toolOutput(result),
    });
    assert.equal(checked.answerChecks.coverageIsUnknownOrPartial, false);
    assert.equal(checked.resultCounters, null);
  }
});

test('G02 query and renderer scope checks reject qualified negations of scope claims', () => {
  const queryCases = [
    queryAnswer.replace('动画，精确概念', '非动画，精确概念'),
    queryAnswer.replace('动画，精确概念', '不是一部动画，精确概念'),
    queryAnswer.replace('（左闭右开）', '（不是左闭右开）'),
    queryAnswer.replace('（左闭右开）', '（并非一个左闭右开的区间）'),
    queryAnswer.replace('（左闭右开）', '(not a half-open interval)'),
    queryAnswer.replace('动画，精确概念', 'not an anime, 精确概念'),
    queryAnswer.replace('异世界', '不属于异世界'),
    queryAnswer.replace('异世界', 'not isekai (异世界)'),
  ];
  for (const answer of queryCases) {
    const checked = verifyG02QueryAnswer({
      answer,
      queryArguments: G02_QUERY_ARGUMENTS,
      toolOutput: toolOutput(queryResult()),
    });
    assert.equal(checked.passed, false);
  }

  const rendererAnswer =
    '图片卡已生成。\n范围：2024-01-01至2025-01-01（左闭右开），动画异世界结果覆盖未知、总量为估算，来源为实验性接口；heat 是当前收藏人数，不代表全站完整榜单、不代表讨论热度或历史趋势。';
  const rendererCases = [
    rendererAnswer.replace('动画异世界', '非动画异世界'),
    rendererAnswer.replace('动画异世界', '不是一部动画异世界'),
    rendererAnswer.replace('（左闭右开）', '（不是左闭右开）'),
    rendererAnswer.replace('（左闭右开）', '（并非一个左闭右开的区间）'),
    rendererAnswer.replace('（左闭右开）', '(not a half-open interval)'),
    rendererAnswer.replace('动画异世界', 'not an anime 异世界'),
    rendererAnswer.replace('动画异世界', '动画不属于异世界'),
    rendererAnswer.replace('动画异世界', '动画 not isekai (异世界)'),
  ];
  for (const answer of rendererCases) {
    const checked = verifyG02RendererAnswer({
      answer,
      queryArguments: G02_QUERY_ARGUMENTS,
      toolResultSummary: {
        resultState: 'artifact_returned',
        artifact: {
          returned: true,
          persisted: false,
          mimeType: 'image/png',
          width: 720,
          height: 1200,
          byteLength: 34000,
          sha256: 'a'.repeat(64),
          pngSignatureValid: true,
        },
      },
    });
    assert.equal(checked.answerChecks.exactDateAndConceptScopeDisclosed, false);
    assert.equal(checked.passed, false);
  }
});

test('G02 renderer answer accepts only bounded non-persisted PNG metadata', () => {
  const result = verifyG02RendererAnswer({
    answer:
      '图片卡已生成。\n范围：2024-01-01至2025-01-01（左闭右开），动画异世界结果覆盖未知、总量为估算，来源为实验性接口；heat 是当前收藏人数，不代表全站完整榜单、不代表讨论热度或历史趋势。',
    queryArguments: G02_QUERY_ARGUMENTS,
    toolResultSummary: {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1200,
        byteLength: 34000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.artifactSummary, {
    mimeType: 'image/png',
    width: 720,
    height: 1200,
    byteLength: 34000,
    sha256: 'a'.repeat(64),
    pngSignatureValid: true,
  });
  assert.equal(Object.hasOwn(result.artifactSummary, 'bytes'), false);

  const missingMedia = verifyG02RendererAnswer({
    answer:
      '图片卡已生成。\n范围：2024-01-01至2025-01-01（左闭右开），异世界结果覆盖未知、总量为估算，来源为实验性接口；heat 是当前收藏人数，不代表全站完整榜单、不代表讨论热度或历史趋势。',
    queryArguments: G02_QUERY_ARGUMENTS,
    toolResultSummary: {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1200,
        byteLength: 34000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  });
  assert.equal(missingMedia.answerChecks.exactDateAndConceptScopeDisclosed, false);

  const missingHalfOpen = verifyG02RendererAnswer({
    answer:
      '图片卡已生成。\n范围：2024-01-01至2025-01-01，动画异世界结果覆盖未知、总量为估算，来源为实验性接口；heat 是当前收藏人数，不代表全站完整榜单、不代表讨论热度或历史趋势。',
    queryArguments: G02_QUERY_ARGUMENTS,
    toolResultSummary: {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1200,
        byteLength: 34000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  });
  assert.equal(missingHalfOpen.answerChecks.exactDateAndConceptScopeDisclosed, false);
});

test('G02 renderer answer rejects persisted image bytes and missing scope disclosure', () => {
  const result = verifyG02RendererAnswer({
    answer: '图片卡已生成。',
    queryArguments: G02_QUERY_ARGUMENTS,
    toolResultSummary: {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: true,
        mimeType: 'image/png',
        width: 720,
        height: 1200,
        byteLength: 34000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  });
  assert.equal(result.answerChecks.artifactReturnedInMemory, false);
  assert.equal(result.answerChecks.exactDateAndConceptScopeDisclosed, false);
  assert.equal(result.passed, false);

  const nonFinalScope = verifyG02RendererAnswer({
    answer: '范围：2024-01-01 至 2025-01-01\n图片卡已生成。',
    queryArguments: G02_QUERY_ARGUMENTS,
    toolResultSummary: {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1200,
        byteLength: 34000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  });
  assert.equal(nonFinalScope.answerChecks.plainTextNoMarkdown, false);
});
