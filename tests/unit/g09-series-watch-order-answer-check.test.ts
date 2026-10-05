import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyG09SeriesWatchOrderAnswer } from '../../scripts/acceptance/g09-series-watch-order-answer-check.mjs';

const queryArguments = { subjectId: 218707, depth: 2, maxNodes: 8, media: 'anime' };
const toolCalls = [{ name: 'bangumi.get_series_watch_order', state: 'DONE' }];

function makeToolOutput() {
  const result = {
    state: 'complete',
    subjectId: 218707,
    root: { id: 218707, type: 'anime', name: 'Shuumatsu no Tabitabi', nameCn: '少女終末旅行' },
    watchOrder: [
      {
        id: 218707,
        position: 1,
        placement: 'root',
        name: 'Shuumatsu no Tabitabi',
        nameCn: '少女終末旅行',
        relationLabels: [],
      },
      {
        id: 227245,
        position: 2,
        placement: 'after_root',
        name: 'Shuumatsu no Jugyou',
        nameCn: '少女周末授课',
        relationLabels: ['衍生'],
      },
    ],
    coverage: {
      depth: 2,
      maxNodes: 8,
      media: 'anime',
      nonAnimeRowsObserved: 8,
      truncated: false,
    },
    mcpTextProjection: {
      maxUtf8Bytes: 3600,
      structuredContentHasFullResult: true,
      watchOrderRowsReturned: 2,
      watchOrderRowsIncluded: 2,
      watchOrderRowsOmittedFromText: 0,
      relatedRowsOmittedFromText: 0,
      edgeRowsOmittedFromText: 0,
      exclusionSamplesOmittedFromText: 0,
      sourceOperationsOmittedFromText: 0,
      displayNamesTruncated: 0,
      relationLabelsTruncated: 0,
    },
  };
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

function makeAnswer() {
  return [
    '1｜218707｜起点｜少女終末旅行',
    '2｜227245｜衍生｜少女周末授课',
    '范围：本次是深度 2、最多 8 个动画节点的有限关系观察；本次观察到 8 条非动画关系并已排除。',
    '说明：这是有界确定性观看建议；Bangumi 没有发布统一的官方观看顺序，未显示关系不代表不存在。',
  ].join('\n');
}

function check(
  answer = makeAnswer(),
  args = queryArguments,
  calls = toolCalls,
  toolOutput = makeToolOutput(),
) {
  return verifyG09SeriesWatchOrderAnswer(
    answer,
    args,
    toolOutput,
    calls,
    Buffer.byteLength(JSON.stringify(JSON.parse(toolOutput.content[0]!.text)), 'utf8'),
  );
}

describe('G09 series watch-order answer checks', () => {
  it('matches every ordered ID, position, raw relation label and title with bounded scope', () => {
    expect(check()).toMatchObject({
      queryArgumentsMatch: true,
      exactSingleToolCall: true,
      resultReadbackAvailable: true,
      exactG09Scope: true,
      rootIsFirst: true,
      textBudgetVerified: true,
      structuredContentContractPresent: true,
      sourceNamesAndLabelsComplete: true,
      sourceReturnedMatchesVisibleRows: true,
      omittedTextRowsCount: 0,
      visibleWatchOrderRows: 2,
      rowsMatched: 2,
      missingRowsCount: 0,
      mismatchedRowsCount: 0,
      unmatchedRowsCount: 0,
      rowOrderPreserved: true,
      boundedCoverageDisclosurePresent: true,
      nonCanonicalOrderDisclosurePresent: true,
      nonAnimeExclusionsDisclosurePresent: true,
      omissionNotAbsenceDisclosurePresent: true,
      passed: true,
    });
  });

  it('rejects swapped rows, altered labels, and titles not present in the result', () => {
    const swapped = makeAnswer().replace(
      '1｜218707｜起点｜少女終末旅行\n2｜227245｜衍生｜少女周末授课',
      '2｜227245｜衍生｜少女周末授课\n1｜218707｜起点｜少女終末旅行',
    );
    const wrongRelation = makeAnswer().replace('227245｜衍生｜', '227245｜续集｜');
    const wrongTitle = makeAnswer().replace('少女周末授课', '其他作品');

    expect(check(swapped).rowOrderPreserved).toBe(false);
    expect(check(swapped).passed).toBe(false);
    expect(check(wrongRelation).mismatchedRowsCount).toBe(1);
    expect(check(wrongRelation).passed).toBe(false);
    expect(check(wrongTitle).mismatchedRowsCount).toBe(1);
    expect(check(wrongTitle).passed).toBe(false);
  });

  it('requires the tool result to match the requested root and place that root first', () => {
    const toolOutput = makeToolOutput();
    const payload = JSON.parse(toolOutput.content[0]!.text);
    payload.root.id = 999;
    const malformedRoot = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    const answer = makeAnswer();
    const result = verifyG09SeriesWatchOrderAnswer(
      answer,
      queryArguments,
      malformedRoot,
      toolCalls,
      Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    );

    expect(result.rootIsFirst).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('requires an omission caveat when compacted relation details are hidden', () => {
    const toolOutput = makeToolOutput();
    const payload = JSON.parse(toolOutput.content[0]!.text);
    payload.mcpTextProjection.edgeRowsOmittedFromText = 2;
    const compacted = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    const noOmissionCaveat = makeAnswer().replace('未显示关系不代表不存在', '只描述工具返回的关系');
    const result = verifyG09SeriesWatchOrderAnswer(
      noOmissionCaveat,
      queryArguments,
      compacted,
      toolCalls,
      Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    );

    expect(result.omittedTextRowsCount).toBe(2);
    expect(result.omissionNotAbsenceDisclosurePresent).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('rejects unsupported completeness or official-order claims and requires the precise query', () => {
    const complete = makeAnswer().replace('有界确定性观看建议', '完整系列的唯一顺序');
    const wrongDepth = { ...queryArguments, depth: 1 };
    const wrongToolBudget = [...toolCalls, ...toolCalls];

    expect(check(complete).unsupportedCompletenessClaim).toBe(true);
    expect(check(complete).unsupportedCanonicalOrderClaim).toBe(true);
    expect(check(complete).passed).toBe(false);
    expect(check(makeAnswer(), wrongDepth).queryArgumentsMatch).toBe(false);
    expect(check(makeAnswer(), queryArguments, wrongToolBudget).exactSingleToolCall).toBe(false);
  });

  it('rejects numeric prefixes that do not exactly match returned coverage', () => {
    const wrongDepth = makeAnswer().replace('深度 2', '深度 20');
    const wrongNodeLimit = makeAnswer().replace('最多 8 个动画节点', '最多 80 个动画节点');
    const wrongExclusionCount = makeAnswer().replace('8 条非动画关系', '18 条非动画关系');

    expect(check(wrongDepth).boundedCoverageDisclosurePresent).toBe(false);
    expect(check(wrongDepth).passed).toBe(false);
    expect(check(wrongNodeLimit).boundedCoverageDisclosurePresent).toBe(false);
    expect(check(wrongNodeLimit).passed).toBe(false);
    expect(check(wrongExclusionCount).nonAnimeExclusionsDisclosurePresent).toBe(false);
    expect(check(wrongExclusionCount).passed).toBe(false);
  });

  it('does not let a publication denial negate a later completeness claim', () => {
    const unsupported = makeAnswer().replace(
      '未显示关系不代表不存在。',
      '未显示关系不代表不存在，但这覆盖所有作品。',
    );
    const result = check(unsupported);

    expect(result.unsupportedCompletenessClaim).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('matches titles against retained source names when the nameCn field is omitted', () => {
    const toolOutput = makeToolOutput();
    const payload = JSON.parse(toolOutput.content[0]!.text);
    for (const row of payload.watchOrder) {
      row.name = row.nameCn;
      delete row.nameCn;
    }
    payload.mcpTextProjection.nameCnFieldsOmittedFromText = payload.watchOrder.length;
    const outputWithOmittedNameCn = {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    };
    const result = check(makeAnswer(), queryArguments, toolCalls, outputWithOmittedNameCn);

    expect(result.sourceNamesAndLabelsComplete).toBe(true);
    expect(result.rowsMatched).toBe(2);
    expect(result.omittedTextRowsCount).toBe(2);
    expect(result.omissionNotAbsenceDisclosurePresent).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('requires the omission caveat when projected name, reason, or date fields are hidden', () => {
    const toolOutput = makeToolOutput();
    const payload = JSON.parse(toolOutput.content[0]!.text);
    payload.mcpTextProjection.nameCnFieldsOmittedFromText = 1;
    payload.mcpTextProjection.placementReasonsOmittedFromText = 1;
    payload.mcpTextProjection.datesOmittedFromText = 1;
    const compactedOutput = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    const answerWithoutCaveat = makeAnswer().replace(
      '未显示关系不代表不存在',
      '只列出当前返回的关系',
    );
    const result = check(answerWithoutCaveat, queryArguments, toolCalls, compactedOutput);

    expect(result.omittedTextRowsCount).toBe(3);
    expect(result.omissionNotAbsenceDisclosurePresent).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('writes only sanitized counters to its stdin interface', () => {
    const answer = makeAnswer();
    const toolOutput = makeToolOutput();
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/acceptance/g09-series-watch-order-answer-check.mjs')],
      {
        encoding: 'utf8',
        input: JSON.stringify({
          answer,
          queryArguments,
          toolOutput,
          toolCalls,
          toolTextUtf8Bytes: Buffer.byteLength(
            JSON.stringify(JSON.parse(toolOutput.content[0]!.text)),
          ),
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ rowsMatched: 2, passed: true });
    expect(result.stdout).not.toContain('少女終末旅行');
    expect(result.stdout).not.toContain('少女周末授课');
    expect(result.stdout).not.toContain(answer);
  });
});
