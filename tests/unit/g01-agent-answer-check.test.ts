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
    { id: 1001, displayName: '作品甲', media: 'anime', date: '2026-07-01' },
    { id: 1002, displayName: '作品乙', media: 'anime', date: '2026-07-18' },
  ],
  coverage: { state: 'complete', returned: 2, totalKind: 'estimated', upstreamExhausted: true },
  warnings: [{ code: 'EXPERIMENTAL_SOURCE' }],
  conceptResolution: [
    {
      input: '后宫',
      state: 'exact',
      candidates: [{ source: 'tag', value: '后宫', canonical: '后宫' }],
    },
  ],
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
  it('matches every returned anime by exact title, date, ID, and order', () => {
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
      exactTagScopeDisclosurePresent: true,
      monthScopeDisclosurePresent: true,
      animeScopeDisclosurePresent: true,
      countDisclosurePresent: true,
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

  it('reads the result from a nested MCP text projection without retaining its rows', () => {
    const toolOutput = JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify(result) }],
    });
    expect(
      verifyG01AgentAnswer(answer, { Arguments: JSON.stringify(G01_QUERY_ARGUMENTS) }, toolOutput),
    ).toMatchObject({
      resultReadbackAvailable: true,
      conceptResolutionVerified: true,
      rowsMatched: 2,
      passed: true,
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
    expect(verify(complete)).toMatchObject({ unsupportedCompletenessClaim: true, passed: false });
    expect(verify(absent)).toMatchObject({ unsupportedAbsenceClaim: true, passed: false });
  });

  it('rejects unsupported prose and Markdown answer rows', () => {
    const hallucinated = `${answer}\n另有一部不在工具返回中的作品`;
    const markdown = answer.replace('作品甲｜', '- 作品甲｜');
    expect(verify(hallucinated)).toMatchObject({ unstructuredAnswerLinesCount: 1, passed: false });
    expect(verify(markdown)).toMatchObject({ markdownFormattingDetected: true, passed: false });
  });

  it('fails closed for an unavailable or non-exact concept resolution', () => {
    const unknownConcept = {
      ...result,
      conceptResolution: [{ input: '后宫', state: 'ambiguous', candidates: [] }],
    };
    expect(verify(answer, G01_QUERY_ARGUMENTS, unknownConcept)).toMatchObject({
      conceptResolutionVerified: false,
      passed: false,
    });
    expect(
      verifyG01AgentAnswer(null as unknown as string, G01_QUERY_ARGUMENTS, result).passed,
    ).toBe(false);
  });

  it('accepts a qualified non-exhaustiveness caveat without masking it as a positive claim', () => {
    expect(verify().unsupportedCompletenessClaim).toBe(false);
    expect(verify().nonExhaustiveDisclosurePresent).toBe(true);
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
