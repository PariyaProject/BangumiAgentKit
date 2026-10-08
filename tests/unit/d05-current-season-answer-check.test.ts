import { describe, expect, it } from 'vitest';
import {
  D05_EXPECTED_QUERY_ARGUMENTS,
  verifyD05CurrentSeasonAnswer,
} from '../../scripts/acceptance/d05-current-season-answer-check.mjs';

function makeResult() {
  const items = [
    {
      id: 26001,
      name: 'Autumn Campus Romance A',
      nameCn: '秋季校园恋爱甲',
      displayName: '秋季校园恋爱甲',
      media: 'anime',
      collectionTotal: 1200,
      tags: ['校园', '恋爱'],
    },
    {
      id: 26002,
      name: 'Autumn Campus Romance B',
      nameCn: '秋季校园恋爱乙',
      displayName: '秋季校园恋爱乙',
      media: 'anime',
      collectionTotal: 800,
      tags: ['恋爱', '校园'],
    },
  ];
  return {
    state: 'partial',
    items,
    plan: {
      source: 'official_v0',
      operation: 'searchSubjects',
      season: '2026-autumn',
      sort: 'heat',
      order: 'desc',
      totalKind: 'estimated',
      limitations: [
        'Enumeration is bounded by maxPages and maxCandidates.',
        'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.',
        'heat means upstream 收藏人数 and is not a recent-trend metric.',
      ],
      steps: [
        {
          kind: 'search',
          request: {
            sort: 'heat',
            filter: {
              type: [2],
              tag: ['校园', '恋爱'],
              airDate: ['>=2026-10-01', '<2027-01-01'],
            },
          },
        },
      ],
    },
    coverage: {
      state: 'partial',
      totalKind: 'estimated',
      scanned: 20,
      matched: 2,
      returned: 2,
    },
    warnings: [{ code: 'EXPERIMENTAL_SOURCE', message: 'Official search is experimental.' }],
  };
}

function makeAnswer(result = makeResult()) {
  return JSON.stringify({
    season: '2026-autumn',
    dateRange: { from: '2026-10-01', to: '2027-01-01' },
    tags: ['校园', '恋爱'],
    heatMeaning: '当前收藏人数降序；不是讨论趋势或历史热度',
    items: result.items.map((item) => ({
      id: item.id,
      title: item.displayName,
      collectionTotal: item.collectionTotal,
    })),
    coverage: {
      state: 'partial',
      scanned: 20,
      matched: 2,
      returned: 2,
      totalKind: 'estimated',
    },
    caveat:
      '官方搜索仍处于实验阶段，总数为估算。本次是有界观察，不代表全站完整；未返回的作品不据此视为不存在。',
  });
}

function makeToolOutput(result = makeResult()) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: false,
  };
}

function makeCompactTextOutput(result = makeResult()) {
  const compact = {
    state: result.state,
    plan: {
      source: 'official_v0',
      operation: 'searchSubjects',
      season: '2026-autumn',
      sort: 'heat',
      order: 'desc',
      totalKind: 'estimated',
      heatMeaning: '当前收藏人数；不是讨论趋势或历史热度',
      filter: {
        type: [2],
        tag: ['校园', '恋爱'],
        airDate: ['>=2026-10-01', '<2027-01-01'],
      },
    },
    coverage: result.coverage,
    warnings: result.warnings,
    limitations: ['Official Bangumi subject search is experimental; totals are estimated.'],
    items: result.items,
    textProjection: {
      rowsIncluded: result.items.length,
      rowsOmitted: 0,
      displayNamesClipped: 0,
    },
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(compact) }],
    isError: false,
  };
}

function makeToolCalls(argumentsValue: unknown = D05_EXPECTED_QUERY_ARGUMENTS) {
  return [
    {
      name: 'bangumi.query_subjects',
      arguments: argumentsValue,
      state: 'DONE',
    },
  ];
}

function verify({
  answer = makeAnswer(),
  argumentsValue = D05_EXPECTED_QUERY_ARGUMENTS,
  toolOutput = makeToolOutput(),
  toolCalls = makeToolCalls(argumentsValue),
  textBytes = 1400,
}: {
  answer?: string;
  argumentsValue?: unknown;
  toolOutput?: unknown;
  toolCalls?: unknown;
  textBytes?: number | null;
} = {}) {
  return verifyD05CurrentSeasonAnswer(answer, argumentsValue, toolOutput, toolCalls, textBytes);
}

describe('D05 current-season multi-tag heat answer checker', () => {
  it('accepts only exact returned rows and reports sanitized counters', () => {
    const result = verify();

    expect(result).toMatchObject({
      method: 'd05-current-season-multitag-heat-v1',
      passed: true,
      resultCounters: {
        season: '2026-autumn',
        scanned: 20,
        matched: 2,
        returned: 2,
        sourceRowsValid: 2,
      },
      privacy: {
        rawAnswerPersisted: false,
        rawToolResultPersisted: false,
        oauthAttempted: false,
        accountDataRead: false,
        communityRead: false,
        qqTested: false,
        timTested: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('秋季校园恋爱甲');
  });

  it('validates the compact MCP text projection when structuredContent is absent', () => {
    const result = makeResult();
    const toolOutput = makeCompactTextOutput(result);

    expect(
      verify({
        answer: makeAnswer(result),
        toolOutput,
        textBytes: Buffer.byteLength(toolOutput.content[0]?.text ?? '', 'utf8'),
      }).passed,
    ).toBe(true);
  });

  it('rejects changed arguments, source filters, ordering, and unsupported completeness', () => {
    const wrongArguments = { ...D05_EXPECTED_QUERY_ARGUMENTS, tags: ['校园'] };
    expect(verify({ argumentsValue: wrongArguments }).passed).toBe(false);

    const wrongFilterResult = makeResult();
    wrongFilterResult.plan.steps[0]!.request.filter.airDate = ['>=2026-07-01', '<2026-10-01'];
    expect(verify({ toolOutput: makeToolOutput(wrongFilterResult) }).passed).toBe(false);

    const reversed = makeResult();
    reversed.items.reverse();
    expect(verify({ toolOutput: makeToolOutput(reversed), answer: makeAnswer() }).passed).toBe(
      false,
    );

    const unsupportedClaim = JSON.parse(makeAnswer()) as Record<string, unknown>;
    unsupportedClaim.caveat = '本季全部作品均已完整列出。官方搜索仍处于实验阶段，总数为估算。';
    expect(verify({ answer: JSON.stringify(unsupportedClaim) }).passed).toBe(false);
  });

  it('rejects incomplete text-only readback, wrong coverage counters, and clipped text', () => {
    const result = makeResult();
    const textOnly = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ...result,
            textProjection: {
              rowsIncluded: 1,
              rowsOmitted: 1,
              displayNamesClipped: 0,
            },
            items: [result.items[0]],
            coverage: { ...result.coverage, returned: 2 },
          }),
        },
      ],
      isError: false,
    };
    const answer = JSON.parse(makeAnswer()) as Record<string, any>;
    answer.coverage.returned = 1;
    const incomplete = verify({
      answer: JSON.stringify(answer),
      toolOutput: textOnly as unknown,
      textBytes: 1200,
    });
    expect(incomplete.passed).toBe(false);
    expect(incomplete.answerChecks.rowsReadbackComplete).toBe(false);

    expect(verify({ textBytes: 3601 }).passed).toBe(false);
    expect(verify({ textBytes: null }).passed).toBe(false);
  });
});
