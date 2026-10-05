import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  G01_QUERY_ARGUMENTS,
  verifyG01AgentAnswer,
} from '../../scripts/acceptance/g01-agent-answer-check.mjs';

const result = {
  state: 'ok',
  items: [
    { id: 1001, displayName: '作品甲', date: '2026-07-01' },
    { id: 1002, displayName: '作品乙', date: '2026-07-18' },
  ],
  plan: { quality: 'exact', operation: 'searchSubjects' },
  coverage: { state: 'complete', returned: 2, totalKind: 'estimated', upstreamExhausted: true },
  warnings: [{ code: 'EXPERIMENTAL_SOURCE' }],
  explanation: {
    mode: 'full',
    summary: 'searchSubjects via official_v0',
    coverageScope: 'Bounded official source result set.',
    detailsOmitted: true,
  },
  projection: { itemsIncluded: 2, omittedItems: 0, itemsComplete: true, omittedWarnings: 0 },
};

const answer = [
  '范围：2026年7月动画，按 Bangumi 的精确“后宫”标签查询；本次返回2部。本次检索仅代表有界返回，官方搜索为实验接口，总数是估算值，不能据此确认全站完整名单。',
  '作品甲｜首播日期：2026-07-01｜Bangumi ID：1001',
  '作品乙｜首播日期：2026-07-18｜Bangumi ID：1002',
].join('\n');

function verify(text = answer, args: unknown = G01_QUERY_ARGUMENTS, source: unknown = result) {
  return verifyG01AgentAnswer(text, args, source);
}

describe('G01 Agent answer acceptance', () => {
  it('matches every projected anime by exact title, date, ID, and order', () => {
    expect(verify()).toMatchObject({
      queryArgumentsMatch: true,
      resultReadbackAvailable: true,
      returnedRows: 2,
      rowsMatched: 2,
      missingRows: 0,
      mismatchedRows: 0,
      unmatchedRows: 0,
      duplicateAnswerRows: 0,
      rowOrderPreserved: true,
      sourceOperationVerified: true,
      projectionCountMatchesVisibleRows: true,
      exactTagScopeDisclosurePresent: true,
      monthScopeDisclosurePresent: true,
      animeScopeDisclosurePresent: true,
      explicitCountPatternMatched: true,
      answerRowsAccountForVisibleResultCount: true,
      boundedCoverageDisclosurePresent: true,
      experimentalSourceDisclosurePresent: true,
      estimatedTotalDisclosurePresent: true,
      nonExhaustiveDisclosurePresent: true,
      passed: true,
    });
  });

  it('rejects swapped row identities even when all titles are present', () => {
    const swapped = answer
      .replace(
        '作品甲｜首播日期：2026-07-01｜Bangumi ID：1001',
        '作品甲｜首播日期：2026-07-01｜Bangumi ID：1002',
      )
      .replace(
        '作品乙｜首播日期：2026-07-18｜Bangumi ID：1002',
        '作品乙｜首播日期：2026-07-18｜Bangumi ID：1001',
      );
    expect(verify(swapped)).toMatchObject({
      rowsMatched: 0,
      mismatchedRows: 2,
      passed: false,
    });
  });

  it('rejects missing, duplicate, unknown, and wrong-date rows', () => {
    const missing = answer.replace('\n作品乙｜首播日期：2026-07-18｜Bangumi ID：1002', '');
    const duplicate = `${answer}\n作品甲｜首播日期：2026-07-01｜Bangumi ID：1001`;
    const unknown = answer.replace('Bangumi ID：1002', 'Bangumi ID：9999');
    const wrongDate = answer.replace('2026-07-18', '2026-08-18');

    expect(verify(missing)).toMatchObject({ missingRows: 1, passed: false });
    expect(verify(duplicate)).toMatchObject({ duplicateAnswerRows: 1, passed: false });
    expect(verify(unknown)).toMatchObject({ unmatchedRows: 1, missingRows: 1, passed: false });
    expect(verify(wrongDate)).toMatchObject({ mismatchedRows: 1, passed: false });
  });

  it('requires the exact bounded July anime query arguments', () => {
    expect(verify(answer, { ...G01_QUERY_ARGUMENTS, month: 8 }).queryArgumentsMatch).toBe(false);
    expect(
      verify(answer, { ...G01_QUERY_ARGUMENTS, concepts: ['后宫', '恋爱'] }).queryArgumentsMatch,
    ).toBe(false);
    expect(verify(answer, { ...G01_QUERY_ARGUMENTS, sort: 'heat' }).queryArgumentsMatch).toBe(
      false,
    );
    expect(
      verify(answer, { Arguments: JSON.stringify(G01_QUERY_ARGUMENTS) }).queryArgumentsMatch,
    ).toBe(true);
  });

  it('accepts a complete exact row list without a separate numeric total', () => {
    const noExplicitTotal = answer.replace('本次返回2部', '本次查询结果如下');
    expect(verify(noExplicitTotal)).toMatchObject({
      explicitCountPatternMatched: false,
      explicitCountStatementsConsistent: true,
      answerRowsAccountForVisibleResultCount: true,
      rowsMatched: 2,
      passed: true,
    });
  });

  it('rejects incorrect, prefix-sharing, and conflicting explicit result counts', () => {
    const wrongCount = answer.replace('本次返回2部', '本次返回999部');
    const prefixSharingCount = answer.replace('本次返回2部', '本次返回20部');
    const negatedCount = answer.replace('本次返回2部', '本次不是返回2部；本次返回2部');
    const conflictingCounts = answer.replace('本次返回2部', '本次返回2部，本次查询共计3部');

    expect(verify(wrongCount)).toMatchObject({
      explicitCountPatternMatched: false,
      explicitCountStatementsConsistent: false,
      passed: false,
    });
    expect(verify(prefixSharingCount)).toMatchObject({
      explicitCountPatternMatched: false,
      explicitCountStatementsConsistent: false,
      passed: false,
    });
    expect(verify(negatedCount)).toMatchObject({
      explicitCountPatternMatched: false,
      explicitCountStatementsConsistent: false,
      passed: false,
    });
    expect(verify(conflictingCounts)).toMatchObject({
      explicitCountPatternMatched: false,
      explicitCountStatementsConsistent: false,
      passed: false,
    });
  });

  it('reads the actual compact MCP text projection without requiring stripped fields', () => {
    const compactResult = {
      ...result,
      items: result.items.map(({ id, displayName, date }) => ({ id, displayName, date })),
      plan: { quality: 'exact', operation: 'searchSubjects' },
      projection: { itemsIncluded: 2, omittedItems: 0, itemsComplete: true, omittedWarnings: 0 },
    };
    const toolOutput = JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify(compactResult) }],
    });
    expect(
      verifyG01AgentAnswer(answer, { Arguments: JSON.stringify(G01_QUERY_ARGUMENTS) }, toolOutput),
    ).toMatchObject({
      resultReadbackAvailable: true,
      sourceOperationVerified: true,
      rowsMatched: 2,
      textOmittedItems: 0,
      passed: true,
    });
  });

  it('requires the exact omitted-item count and omission-not-absence wording', () => {
    const partialResult = {
      ...result,
      state: 'partial',
      items: [result.items[0]!],
      coverage: { ...result.coverage, state: 'partial', returned: 1 },
      projection: { itemsIncluded: 1, omittedItems: 1, itemsComplete: false, omittedWarnings: 0 },
    };
    const partialAnswer = [
      '范围：2026年7月动画按精确“后宫”标签查询；本次查询返回1部，属于当前有界结果。工具文本另有1部未展开，未显示不代表不存在。官方搜索为实验接口，总数是估算值，不能据此确认全站完整名单。',
      '作品甲｜首播日期：2026-07-01｜Bangumi ID：1001',
    ].join('\n');
    const wrongCount = partialAnswer.replace('另有1部未展开', '另有2部未展开');
    const suffixCount11 = partialAnswer.replace('另有1部未展开', '另有11部未展开');
    const suffixCount21 = partialAnswer.replace('另有1部未展开', '另有21部未展开');
    const conflictingOmissionCounts = partialAnswer.replace(
      '另有1部未展开',
      '另有1部未展开，此外还省略2部',
    );
    const negatedOmission = partialAnswer.replace(
      '另有1部未展开',
      '并非另有1部未展开；另有1部未展开',
    );
    const noAbsenceCaveat = partialAnswer.replace('，未显示不代表不存在', '');

    expect(verify(partialAnswer, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      textOmittedItems: 1,
      omissionCountDisclosurePresent: true,
      omissionNotAbsenceDisclosurePresent: true,
      passed: true,
    });
    expect(verify(wrongCount, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionCountDisclosurePresent: false,
      passed: false,
    });
    expect(verify(suffixCount11, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionCountDisclosurePresent: false,
      passed: false,
    });
    expect(verify(suffixCount21, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionCountDisclosurePresent: false,
      passed: false,
    });
    expect(verify(conflictingOmissionCounts, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionCountDisclosurePresent: false,
      passed: false,
    });
    expect(verify(negatedOmission, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionCountDisclosurePresent: false,
      passed: false,
    });
    expect(verify(noAbsenceCaveat, G01_QUERY_ARGUMENTS, partialResult)).toMatchObject({
      omissionNotAbsenceDisclosurePresent: false,
      passed: false,
    });
  });

  it('requires estimated coverage and the experimental-source warning', () => {
    expect(
      verify(answer, G01_QUERY_ARGUMENTS, {
        ...result,
        coverage: { ...result.coverage, totalKind: 'exact' },
      }),
    ).toMatchObject({ totalKind: 'exact', passed: false });
    expect(verify(answer, G01_QUERY_ARGUMENTS, { ...result, warnings: [] })).toMatchObject({
      experimentalSourceWarningPresent: false,
      passed: false,
    });
  });

  it('rejects unqualified completeness and absence claims', () => {
    const complete = answer.replace('不能据此确认全站完整名单', '这是全站完整名单');
    const absent = answer.replace('本次返回2部', '本次返回2部，没有其他后宫动画');
    const allHaremWorks = answer.replace(
      '不能据此确认全站完整名单',
      '不能据此确认全站完整名单；这是所有后宫作品',
    );
    const onlyTheseTwo = answer.replace(
      '不能据此确认全站完整名单',
      '不能据此确认全站完整名单；后宫动画只有以上两部',
    );
    const noSuchHaremAnime = answer.replace(
      '不能据此确认全站完整名单',
      '不能据此确认全站完整名单；不存在任何后宫动画',
    );
    expect(verify(complete)).toMatchObject({ unsupportedCompletenessClaim: true, passed: false });
    expect(verify(absent)).toMatchObject({ unsupportedAbsenceClaim: true, passed: false });
    expect(verify(allHaremWorks)).toMatchObject({
      unsupportedCompletenessClaim: true,
      passed: false,
    });
    expect(verify(onlyTheseTwo)).toMatchObject({ unsupportedAbsenceClaim: true, passed: false });
    expect(verify(noSuchHaremAnime)).toMatchObject({
      unsupportedAbsenceClaim: true,
      passed: false,
    });
  });

  it('requires affirmative source, estimate, bounded-coverage, and query-scope statements', () => {
    const deniedExperimentalSource = answer.replace('官方搜索为实验接口', '官方搜索不是实验接口');
    const deniedEstimate = answer.replace('总数是估算值', '总数不是估算值');
    const deniedBoundedCoverage = answer.replace('本次检索仅代表有界返回', '本次检索不是有界返回');
    const deniedExactTag = answer.replace(
      '按 Bangumi 的精确“后宫”标签查询',
      '没有按 Bangumi 的精确“后宫”标签查询',
    );
    const contradictoryExperimentalSource = answer.replace(
      '官方搜索为实验接口',
      '官方搜索不是实验接口；官方搜索为实验接口',
    );

    expect(verify(deniedExperimentalSource)).toMatchObject({
      experimentalSourceDisclosurePresent: false,
      passed: false,
    });
    expect(verify(deniedEstimate)).toMatchObject({
      estimatedTotalDisclosurePresent: false,
      passed: false,
    });
    expect(verify(deniedBoundedCoverage)).toMatchObject({
      boundedCoverageDisclosurePresent: false,
      passed: false,
    });
    expect(verify(deniedExactTag)).toMatchObject({
      exactTagScopeDisclosurePresent: false,
      passed: false,
    });
    expect(verify(contradictoryExperimentalSource)).toMatchObject({
      experimentalSourceDisclosurePresent: false,
      passed: false,
    });
  });

  it('rejects unsupported prose hidden inside scope-prefixed lines', () => {
    const unsupportedScopeProse = answer.replace(
      '本次检索仅代表有界返回',
      '这份结果已经足够说明所有用户都能找到答案',
    );
    const hiddenCompletenessClaim = answer.replace(
      '本次检索仅代表有界返回',
      '本次检索仅代表有界返回，所有后宫动画都在此处',
    );
    const unsupportedCombinedScope = answer.replace(
      '2026年7月动画，按 Bangumi 的精确“后宫”标签查询',
      '2026年7月动画按 Bangumi 的精确“后宫”标签查询但结果排名第一',
    );

    expect(verify(unsupportedScopeProse)).toMatchObject({
      unsupportedScopeClausesCount: 1,
      passed: false,
    });
    expect(verify(hiddenCompletenessClaim)).toMatchObject({
      unsupportedCompletenessClaim: true,
      passed: false,
    });
    expect(verify(unsupportedCombinedScope)).toMatchObject({
      unsupportedScopeClausesCount: 1,
      passed: false,
    });
  });

  it('rejects unsupported prose and Markdown answer rows', () => {
    const hallucinated = `${answer}\n另有一部不在工具返回中的作品`;
    const markdown = answer.replace('作品甲｜', '- 作品甲｜');
    expect(verify(hallucinated)).toMatchObject({ unstructuredAnswerLinesCount: 1, passed: false });
    expect(verify(markdown)).toMatchObject({ markdownFormattingDetected: true, passed: false });
  });

  it('fails closed when the source operation or answer is invalid', () => {
    const wrongOperation = { ...result, plan: { operation: 'browseSubjects' } };
    expect(verify(answer, G01_QUERY_ARGUMENTS, wrongOperation)).toMatchObject({
      sourceOperationVerified: false,
      passed: false,
    });
    expect(
      verifyG01AgentAnswer(null as unknown as string, G01_QUERY_ARGUMENTS, result).passed,
    ).toBe(false);
  });

  it('accepts a qualified non-exhaustiveness caveat without masking it as a positive claim', () => {
    expect(verify().unsupportedCompletenessClaim).toBe(false);
    expect(verify().nonExhaustiveDisclosurePresent).toBe(true);
    const reversedCaveat = answer.replace('不能据此确认全站完整名单', '不能据此确认全站不完整名单');
    expect(verify(reversedCaveat)).toMatchObject({
      nonExhaustiveDisclosurePresent: false,
      passed: false,
    });
  });

  it('exposes the same sanitized checker through its stdin CLI for live probes', () => {
    const processResult = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/acceptance/g01-agent-answer-check.mjs')],
      {
        input: JSON.stringify({
          answer,
          queryArguments: G01_QUERY_ARGUMENTS,
          toolOutput: result,
        }),
        encoding: 'utf8',
      },
    );
    expect(processResult.status).toBe(0);
    expect(JSON.parse(processResult.stdout)).toMatchObject({ rowsMatched: 2, passed: true });
    expect(processResult.stdout).not.toContain('作品甲');
  });

  it('returns only sanitized counts and check states', () => {
    const check = verify();
    const serialized = JSON.stringify(check);
    expect(check).not.toHaveProperty('answer');
    expect(check).not.toHaveProperty('rows');
    expect(serialized).not.toContain('作品甲');
    expect(serialized).not.toContain('1001');
  });
});
