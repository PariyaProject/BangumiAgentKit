import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { presentMcpToolResult } from '../../apps/mcp/src/result-presenter.js';
import { verifyG20DirectRelationsAnswer } from '../../scripts/acceptance/g20-direct-relations-answer-check.mjs';

const subjectId = 227245;
const queryArguments = { subjectId, includeEvidence: true };
const toolCalls = [
  { name: 'bangumi.get_subject_relations', state: 'DONE', arguments: queryArguments },
];

function makeResult(options: { many?: boolean; schemaDriftRows?: number } = {}) {
  const count = options.many ? 60 : 2;
  const schemaDriftRows = options.schemaDriftRows ?? 0;
  const items = Array.from({ length: count }, (_, index) => ({
    id: 5001 + index,
    type: 'anime',
    name: `Source title ${index}${options.many ? ` ${'Title'.repeat(80)}` : ''}`,
    nameCn: `来源作品${index}${options.many ? ` ${'作品'.repeat(80)}` : ''}`,
    relation: `${index === 0 ? '前传' : '续集'}${options.many ? ` ${'relation'.repeat(40)}` : ''}`,
    images: { small: `https://images.example.test/${index}.jpg` },
  }));
  return {
    state: schemaDriftRows > 0 ? ('partial' as const) : ('observed' as const),
    subjectId,
    source: {
      api: 'Bangumi official v0',
      operation: 'GET /v0/subjects/{subject_id}/subjects',
      direction: 'source_subject_to_returned_target',
      scope: 'visible_direct_rows_returned_for_source_subject',
      retrievedAt: '2026-10-07T09:00:00.000Z',
    },
    coverage: {
      responseRowsObserved: count + schemaDriftRows,
      rowsReturned: count,
      schemaDriftRows,
      truncated: schemaDriftRows > 0,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    },
    items,
    limitations: [
      '仅表示本次响应中指定来源条目指向目标条目的直接关系，不含反向或传递关系。',
      '官方 v0 此操作没有分页、总数或系列完整性字段；未返回关系不等于不存在。',
      'relation 是来源记录的原始标签；接口行顺序不表示官方观看顺序。',
      '匿名可见性可能不包含敏感条目。',
    ],
  };
}

function makeToolOutput(result = makeResult()) {
  const presentation = presentMcpToolResult(
    'bangumi.get_subject_relations',
    result as unknown as Record<string, unknown>,
  );
  return {
    content: [{ type: 'text', text: presentation.text }],
    ...(presentation.structuredContent
      ? { structuredContent: presentation.structuredContent }
      : {}),
  };
}

function makeAnswer(result = makeResult()) {
  const rows = result.items.map((item) => `${item.id}｜${item.nameCn}｜${item.relation}`);
  const returnedCount = result.coverage.responseRowsObserved;
  return [
    ...rows,
    `范围：本次官方 v0 响应对来源条目 ${subjectId} 观察 ${returnedCount} 行，返回 ${result.coverage.rowsReturned} 条直接关系；此操作无分页、无总数，不能据此认定全系列完整；未返回关系不等于不存在，也不含反向或传递关系。关系接口顺序不是官方观看顺序。${
      result.coverage.schemaDriftRows > 0 ? `解析遗漏 ${result.coverage.schemaDriftRows} 条。` : ''
    }`,
  ].join('\n');
}

function check(
  answer = makeAnswer(),
  args: unknown = queryArguments,
  calls: unknown = toolCalls,
  toolOutput: unknown = makeToolOutput(),
) {
  const text = (toolOutput as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '';
  return verifyG20DirectRelationsAnswer(
    answer,
    args,
    toolOutput,
    calls,
    Buffer.byteLength(text, 'utf8'),
  );
}

describe('G20 direct subject-relation answer checks', () => {
  it('matches every returned target and raw relation label with source and response-only scope', () => {
    const result = makeResult();
    expect(
      check(makeAnswer(result), queryArguments, toolCalls, makeToolOutput(result)),
    ).toMatchObject({
      queryArgumentsMatch: true,
      exactSingleToolCall: true,
      resultReadbackAvailable: true,
      structuredContentReadbackAvailable: true,
      sourceScopeVerified: true,
      coverageConsistent: true,
      textProjectionConsistent: true,
      textBudgetVerified: true,
      visibleSourceRows: 2,
      sourceResponseRowsObserved: 2,
      sourceRowsReturned: 2,
      sourceSchemaDriftRows: 0,
      sourceTruncated: false,
      sourcePaginationAvailable: false,
      sourceTotalCountAvailable: false,
      sourceCompleteness: 'not_provided_by_source',
      mcpTextRowsOmitted: 0,
      rowsMatched: 2,
      missingRowsCount: 0,
      mismatchedRowsCount: 0,
      boundedSourceDisclosurePresent: true,
      responseCountsDisclosurePresent: true,
      omissionNotAbsenceDisclosurePresent: true,
      nonCanonicalOrderDisclosurePresent: true,
      schemaDriftDisclosurePresent: true,
      passed: true,
    });
  });

  it('rejects changed names or labels, omitted rows, duplicates, and unstructured answer text', () => {
    const result = makeResult();
    const answer = makeAnswer(result);
    const swappedLabel = answer.replace('5002｜来源作品1｜续集', '5002｜来源作品1｜前传');
    const wrongName = answer.replace('来源作品0', '其他作品');
    const missingRow = answer.replace('5002｜来源作品1｜续集\n', '');
    const duplicateRow = answer.replace(
      '5002｜来源作品1｜续集\n',
      '5002｜来源作品1｜续集\n5002｜来源作品1｜续集\n',
    );
    const prose = answer.replace('范围：', '这是关系列表。\n范围：');

    expect(check(swappedLabel).mismatchedRowsCount).toBe(1);
    expect(check(swappedLabel).passed).toBe(false);
    expect(check(wrongName).mismatchedRowsCount).toBe(1);
    expect(check(wrongName).passed).toBe(false);
    expect(check(missingRow).missingRowsCount).toBe(1);
    expect(check(missingRow).passed).toBe(false);
    expect(check(duplicateRow).duplicateAnswerRowsCount).toBe(1);
    expect(check(duplicateRow).passed).toBe(false);
    expect(check(prose).unstructuredAnswerLinesCount).toBe(1);
    expect(check(prose).passed).toBe(false);
  });

  it('rejects extra or mismatched query arguments and more than one target tool call', () => {
    const wrongArguments = { ...queryArguments, limit: 20 };
    const legacyDefaultArguments = { subjectId };
    const otherSubject = { subjectId: subjectId + 1, includeEvidence: true };
    const wrongRecordedArguments = [
      {
        ...toolCalls[0],
        arguments: { ...queryArguments, subjectId: subjectId + 1 },
      },
    ];
    const multipleCalls = [...toolCalls, ...toolCalls];

    expect(check(makeAnswer(), wrongArguments).queryArgumentsMatch).toBe(false);
    expect(check(makeAnswer(), legacyDefaultArguments).queryArgumentsMatch).toBe(false);
    expect(check(makeAnswer(), otherSubject).queryArgumentsMatch).toBe(false);
    expect(check(makeAnswer(), queryArguments, wrongRecordedArguments).exactSingleToolCall).toBe(
      false,
    );
    expect(check(makeAnswer(), queryArguments, multipleCalls).exactSingleToolCall).toBe(false);
  });

  it('accepts a complete text readback but rejects omitted rows without the full structured payload', () => {
    const output = makeToolOutput();
    const textOnly = { content: output.content };
    const textBytes = Buffer.byteLength(output.content[0]!.text, 'utf8');
    const completeTextReadback = verifyG20DirectRelationsAnswer(
      makeAnswer(),
      queryArguments,
      textOnly,
      toolCalls,
      textBytes,
    );
    const manyResult = makeResult({ many: true });
    const manyOutput = makeToolOutput(manyResult);
    const omittedTextOnly = { content: manyOutput.content };
    const omittedText = verifyG20DirectRelationsAnswer(
      makeAnswer(manyResult),
      queryArguments,
      omittedTextOnly,
      toolCalls,
      Buffer.byteLength(manyOutput.content[0]!.text, 'utf8'),
    );
    const overBudget = verifyG20DirectRelationsAnswer(
      makeAnswer(),
      queryArguments,
      output,
      toolCalls,
      3601,
    );

    expect(completeTextReadback.structuredContentReadbackAvailable).toBe(false);
    expect(completeTextReadback.resultRowsReadbackAvailable).toBe(true);
    expect(completeTextReadback.passed).toBe(true);
    expect(omittedText.structuredContentReadbackAvailable).toBe(false);
    expect(omittedText.resultRowsReadbackAvailable).toBe(false);
    expect(omittedText.passed).toBe(false);
    expect(overBudget.textBudgetVerified).toBe(false);
    expect(overBudget.passed).toBe(false);
  });

  it('allows a compact text view only when omissions are counted and not described as absence', () => {
    const result = makeResult({ many: true });
    const output = makeToolOutput(result);
    const text = output.content[0]!.text;
    const projection = JSON.parse(text);
    const answer = makeAnswer(result);
    const omitted = projection.textProjection.rowsOmitted > 0;
    const omissionDisclosure = answer.includes('未返回关系不等于不存在');
    const resultCheck = check(answer, queryArguments, toolCalls, output);

    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(3600);
    expect(projection.textProjection.fullStructuredContentAvailable).toBe(true);
    expect(projection.textProjection.rowsOmitted).toBeGreaterThan(0);
    expect(omitted).toBe(true);
    expect(omissionDisclosure).toBe(true);
    expect(resultCheck.textProjectionConsistent).toBe(true);
    expect(resultCheck.mcpTextRowsOmitted).toBeGreaterThan(0);
    expect(resultCheck.omissionNotAbsenceDisclosurePresent).toBe(true);
    expect(resultCheck.passed).toBe(true);
  });

  it('rejects invalid rows that are present in the readback but cannot be safely rendered', () => {
    const result = makeResult();
    result.items.push({
      id: 7001,
      type: 'anime',
      name: 'Invalid row',
      nameCn: 'Invalid row',
      relation: '   ',
    } as (typeof result.items)[number]);
    result.coverage.responseRowsObserved += 1;
    result.coverage.rowsReturned += 1;
    const output = makeToolOutput(result);
    const checkResult = verifyG20DirectRelationsAnswer(
      makeAnswer(result),
      queryArguments,
      output,
      [...toolCalls],
      Buffer.byteLength(output.content[0]!.text, 'utf8'),
    );

    expect(checkResult.invalidSourceRowsCount).toBe(1);
    expect(checkResult.passed).toBe(false);
  });

  it('marks source schema drift as partial and requires its exact skipped-row count', () => {
    const result = makeResult({ schemaDriftRows: 1 });
    const output = makeToolOutput(result);
    const answer = makeAnswer(result);
    const resultCheck = check(answer, queryArguments, toolCalls, output);
    const missingDriftCount = answer.replace('解析遗漏 1 条。', '有一行无法解析。');

    expect(result.state).toBe('partial');
    expect(resultCheck.coverageConsistent).toBe(true);
    expect(resultCheck.schemaDriftDisclosurePresent).toBe(true);
    expect(resultCheck.passed).toBe(true);
    expect(check(missingDriftCount, queryArguments, toolCalls, output).passed).toBe(false);
  });

  it('rejects exhaustive, canonical-order, reverse-edge, and absence claims', () => {
    const base = makeAnswer();
    const unsupported = [
      '说明：这就是完整系列。',
      '说明：这份表是官方唯一观看顺序。',
      '说明：结果包含所有反向关系。',
      '说明：不存在其他作品。',
    ];
    const checks = unsupported.map((line) => check(`${base}\n${line}`));

    expect(checks[0]?.unsupportedCompletenessClaim).toBe(true);
    expect(checks[1]?.unsupportedCanonicalOrderClaim).toBe(true);
    expect(checks[2]?.unsupportedReverseClaim).toBe(true);
    expect(checks[3]?.unsupportedAbsenceClaim).toBe(true);
    expect(checks.every((item) => !item.passed)).toBe(true);
  });

  it('does not treat scope caveats as positive claims', () => {
    const result = check();
    expect(result.unsupportedCompletenessClaim).toBe(false);
    expect(result.unsupportedCanonicalOrderClaim).toBe(false);
    expect(result.unsupportedAbsenceClaim).toBe(false);
    expect(result.unsupportedReverseClaim).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('prints counters only from its command-line verifier', () => {
    const result = makeResult();
    const input = JSON.stringify({
      answer: makeAnswer(result),
      queryArguments,
      toolOutput: makeToolOutput(result),
      toolCalls,
      toolTextUtf8Bytes: Buffer.byteLength(makeToolOutput(result).content[0]!.text, 'utf8'),
    });
    const run = spawnSync(
      process.execPath,
      ['scripts/acceptance/g20-direct-relations-answer-check.mjs'],
      { input, encoding: 'utf8' },
    );

    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toMatchObject({
      passed: true,
      visibleSourceRows: 2,
      rowsMatched: 2,
    });
    expect(run.stdout).not.toContain('来源作品');
    expect(run.stdout).not.toContain('前传');
  });
});
