import { describe, expect, it } from 'vitest';
import { verifyG26ExactTagAnswer } from '../../scripts/acceptance/g26-exact-tag-answer-check.mjs';

const targetTool = 'bangumi.query_subjects';
const queryArguments = {
  media: 'anime',
  from: '2019-01-01',
  to: '2025-01-01',
  ratingCount: { min: 10001 },
  tags: ['女性向'],
  categories: 'tv',
  resultMode: 'all',
  limit: 100,
  explain: 'full',
};

function makeRow(id: number, options: Record<string, unknown> = {}) {
  return {
    id,
    name: `Title ${id}`,
    nameCn: `作品${id}`,
    displayName: `作品${id} (Title ${id})`,
    media: 'anime',
    category: 'tv',
    date: id === 26001 ? '2019-01-01' : '2024-12-31',
    ratingCount: id === 26001 ? 10001 : 13000,
    tags: ['女性向', '恋爱'],
    metaTags: [],
    ...options,
  };
}

function makeResult(rows = [makeRow(26001), makeRow(26002)]) {
  return {
    state: 'ok',
    items: rows,
    plan: {
      source: 'official_v0',
      operation: 'searchSubjects',
      totalKind: 'estimated',
      quality: 'bounded_exact',
      resultMode: 'all',
      steps: [
        {
          kind: 'search',
          operation: 'searchSubjects',
          request: {
            limit: 50,
            filter: {
              type: [2],
              airDate: ['>=2019-01-01', '<2025-01-01'],
              ratingCount: ['>=10001'],
              tag: ['女性向'],
            },
          },
        },
      ],
      postFilters: [{ field: 'categories', classification: 'POST_FILTER', value: ['tv'] }],
      budget: { maxPages: 10, maxCandidates: 500, maxHydrations: 120, maxReturnedItems: 100 },
      limitations: ['The official search is experimental and totals are estimated.'],
    },
    coverage: {
      state: 'complete',
      requested: 2,
      scanned: 2,
      matched: 2,
      returned: rows.length,
      pagesRequested: 1,
      pagesScanned: 1,
      upstreamExhausted: true,
      budgetExceeded: false,
      totalKind: 'estimated',
      hydrationsAttempted: 0,
      hydrationsSucceeded: 0,
      hydrationsFailed: 0,
      hydrationsUnresolved: 0,
      hydrationBudgetExceeded: false,
    },
    warnings: [
      { code: 'EXPERIMENTAL_SOURCE', state: 'warning', message: 'The search may change.' },
    ],
    explanation: {
      coverageScope: 'Only this bounded observed search result set is covered.',
      limitations: ['An estimated total does not establish database-wide completeness.'],
    },
  };
}

function makeAnswer(result = makeResult()) {
  const count = result.coverage.returned;
  const answerRows = result.items
    .map((item: ReturnType<typeof makeRow>) =>
      [item.id, item.nameCn, item.date, item.ratingCount].join('｜'),
    )
    .join('\n');
  return [
    `范围：本次按 Bangumi 精确 tag=女性向 作为操作定义，限定 2019-01-01 至 2025-01-01（不含）的 TV、ratingCount≥10001；这不代表全部女性受众作品。官方搜索为实验性，总数为估算。扫描 ${result.coverage.scanned} 项，匹配 ${result.coverage.matched} 项，返回 ${count} 项；本次有限覆盖不等于完整目录。`,
    answerRows,
  ].join('\n');
}

function makeToolCalls(args: unknown = queryArguments) {
  return [{ name: targetTool, state: 'DONE', arguments: args }];
}

function makeToolOutput(result: unknown = makeResult(), textResult: unknown = result) {
  return {
    structuredContent: result,
    content: [{ type: 'text', text: JSON.stringify(textResult) }],
  };
}

function verify(options: {
  answer?: string;
  args?: unknown;
  result?: ReturnType<typeof makeResult>;
  textResult?: unknown;
  toolCalls?: unknown;
  includeStructured?: boolean;
}) {
  const result = options.result ?? makeResult();
  const output =
    options.includeStructured === false
      ? { content: [{ type: 'text', text: JSON.stringify(options.textResult ?? result) }] }
      : makeToolOutput(result, options.textResult ?? result);
  const outputText = output.content[0]?.text ?? '';
  return verifyG26ExactTagAnswer(
    options.answer ?? makeAnswer(result),
    options.args ?? queryArguments,
    output,
    options.toolCalls ?? makeToolCalls(options.args ?? queryArguments),
    Buffer.byteLength(outputText, 'utf8'),
  );
}

describe('G26 exact-tag Agent/MCP answer check', () => {
  it('accepts one exact public query and matches every answer row without retaining raw values', () => {
    const result = makeResult();
    const check = verify({ result });

    expect(check).toMatchObject({
      queryArgumentsMatch: true,
      exactSingleToolCall: true,
      resultReadbackAvailable: true,
      resultRowsReadbackAvailable: true,
      structuredContentReadbackAvailable: true,
      textProjectionConsistent: true,
      sourceScopeVerified: true,
      coverageConsistent: true,
      experimentalSourceWarningPresent: true,
      visibleSourceRows: 2,
      answerRowsParsed: 2,
      answerRowsMatched: 2,
      missingRowsCount: 0,
      mismatchedRowsCount: 0,
      unmatchedRowsCount: 0,
      exactTagDisclosurePresent: true,
      demographicLimitDisclosurePresent: true,
      estimatedTotalDisclosurePresent: true,
      passed: true,
    });
    expect(JSON.stringify(check)).not.toContain('作品26001');
    expect(JSON.stringify(check)).not.toContain('Title 26001');
    expect(JSON.stringify(check)).not.toContain('女性向');
  });

  it('rejects a meta-tag substitution, widened arguments, or a second tool call', () => {
    const wrongArgs = { ...queryArguments, tags: undefined, metaTags: ['女性向'] };
    const wrong = verify({ args: wrongArgs });
    expect(wrong.queryArgumentsMatch).toBe(false);
    expect(wrong.passed).toBe(false);

    const extraCall = verify({ toolCalls: [...makeToolCalls(), ...makeToolCalls()] });
    expect(extraCall.exactSingleToolCall).toBe(false);
    expect(extraCall.passed).toBe(false);

    const wrongTool = verify({
      toolCalls: [{ ...makeToolCalls()[0], name: 'bangumi.auth_status' }],
    });
    expect(wrongTool.exactSingleToolCall).toBe(false);
  });

  it('rejects source rows outside the exact tag, date, category, or rating threshold', () => {
    for (const badRow of [
      makeRow(26001, { tags: ['乙女向'] }),
      makeRow(26001, { date: '2025-01-01' }),
      makeRow(26001, { category: 'movie' }),
      makeRow(26001, { ratingCount: 10000 }),
      makeRow(26001, { media: 'book' }),
    ]) {
      const result = makeResult([badRow]);
      result.coverage.matched = 1;
      result.coverage.returned = 1;
      const answer = `范围：本次按 Bangumi 精确 tag=女性向 作为操作定义，限定 2019-01-01 至 2025-01-01（不含）的 TV、ratingCount≥10001；这不代表全部女性受众作品。官方搜索为实验性，总数为估算。扫描 1 项，匹配 1 项，返回 1 项；本次有限覆盖不等于完整目录。\n${badRow.id}｜${badRow.nameCn}｜${badRow.date}｜${badRow.ratingCount}`;
      const check = verify({ result, answer });
      expect(check.passed).toBe(false);
      expect(check.invalidSourceRowsCount).toBe(1);
    }
  });

  it('rejects row values that do not match the returned source row', () => {
    const answer = makeAnswer().replace(
      '作品26001｜2019-01-01｜10001',
      'wrong title｜2019-01-01｜10001',
    );
    const check = verify({ answer });
    expect(check.mismatchedRowsCount).toBeGreaterThan(0);
    expect(check.passed).toBe(false);
  });

  it('requires exact scope, experimental, estimated-total, and bounded-coverage disclosures', () => {
    const answer = makeAnswer().replace('官方搜索为实验性，总数为估算。', '查询结果如下。');
    const check = verify({ answer });
    expect(check.experimentalSearchDisclosurePresent).toBe(false);
    expect(check.estimatedTotalDisclosurePresent).toBe(false);
    expect(check.passed).toBe(false);

    const overclaim = makeAnswer().replace('这不代表全部女性受众作品。', '这是全部女性受众作品。');
    expect(verify({ answer: overclaim }).unsupportedCompletenessClaim).toBe(true);
  });

  it('accepts only visible text-projection rows when omitted rows are disclosed', () => {
    const full = makeResult();
    const textResult = {
      ...full,
      items: [full.items[0]],
      textProjection: {
        rowsIncluded: 1,
        rowsOmitted: 1,
        displayNamesClipped: 0,
        fullStructuredContentAvailable: true,
      },
    };
    const scope = makeAnswer(full).split('\n')[0];
    const answer = [
      `${scope} 文本省略1项，省略不代表没有其他符合条件的作品。`,
      '26001｜作品26001｜2019-01-01｜10001',
    ].join('\n');
    const check = verify({ result: full, textResult, answer });
    expect(check.textProjectionConsistent).toBe(true);
    expect(check.answerUsesTextProjectionRows).toBe(true);
    expect(check.textOmissionDisclosurePresent).toBe(true);
    expect(check.passed).toBe(true);
  });

  it('rejects omitted text rows when full structuredContent is unavailable', () => {
    const full = makeResult();
    const textResult = {
      ...full,
      items: [full.items[0]],
      textProjection: {
        rowsIncluded: 1,
        rowsOmitted: 1,
        fullStructuredContentAvailable: true,
      },
    };
    const check = verify({
      result: full,
      textResult,
      includeStructured: false,
      answer: [
        `${makeAnswer(full).split('\n')[0]} 文本省略1项，省略不代表没有其他符合条件的作品。`,
        '26001｜作品26001｜2019-01-01｜10001',
      ].join('\n'),
    });
    expect(check.resultRowsReadbackAvailable).toBe(false);
    expect(check.passed).toBe(false);
  });
});
