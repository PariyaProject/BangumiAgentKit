import assert from 'node:assert/strict';
import test from 'node:test';
import {
  P03_CANONICAL_COVERAGE_NOTE,
  P03_PROFILE_ID,
  P03_V2_PROFILE_ID,
  summarizeP03PersonProfileToolResult,
  validateP03McpTextProjection,
  validateP03ResultSummary,
  verifyP03Answer,
} from '../../scripts/lib/p03-person-name-cn-evidence.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const profile = getAgentMcpProfileById(P03_PROFILE_ID);
const v2Profile = getAgentMcpProfileById(P03_V2_PROFILE_ID);

function resultFixture() {
  return {
    state: 'partial',
    person: { id: 4765, name: 'Inori Minase', nameCn: '水濑祈' },
    coverage: {
      state: 'partial',
      subjects: { observed: 12, returned: 10, truncated: true, sourceCompleteness: 'undocumented' },
    },
    credits: {
      subjects: [
        ...Array.from({ length: 7 }, (_, index) => ({
          id: index + 1,
          name: `Original ${index + 1}`,
          nameCnSource: `译名${index + 1}`,
        })),
        { id: 8, name: 'Empty', nameCnSource: '   ' },
        { id: 9, name: 'Missing', nameCnSource: null },
        { id: 10, name: 'Invalid', nameCnSource: 42 },
      ],
    },
  };
}

function compactTextFor(summary) {
  return JSON.stringify({
    state: summary.state,
    person: { id: summary.personId, nameCn: summary.personName },
    coverage: {
      state: summary.coverage.state,
      subjects: {
        observed: summary.coverage.subjectsObserved,
        returned: summary.coverage.subjectsReturned,
        truncated: summary.coverage.subjectsTruncated,
        sourceCompleteness: summary.coverage.sourceCompleteness,
        nameCnSourceSemantics:
          'nameCnSource 去除首尾空白后非空表示官方 name_cn 已提供；空字符串或纯空白字符串归为 empty，缺失或非字符串值归为 unavailable，不能据此断言字段未返回或作品没有中文名。',
        creditRowsIncluded: true,
        nameCnSourceCounts: summary.nameCnSourceCounts,
      },
    },
    sourceNameCnRows: summary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    returnedCreditRowsObserved: summary.returnedCreditRowsObserved,
    returnedCreditRowsWithNameCnSource: summary.positiveNameCnRowsObserved,
    nameCnRowsOmittedFromText: summary.nameCnRowsOmittedFromText,
    scopeNote: '仅本次收到的作品关系行；上游关系完整性未声明，文本省略也不代表作品不存在。',
  });
}

function answerFor(summary) {
  return JSON.stringify({
    personId: summary.personId,
    personName: summary.personName,
    sourceNameCnRows: summary.sourceNameCnRows.map(({ subjectId, nameCnSource }) => ({
      id: subjectId,
      nameCnSource,
    })),
    subjectsObserved: summary.coverage.subjectsObserved,
    subjectsReturned: summary.coverage.subjectsReturned,
    subjectsTruncated: summary.coverage.subjectsTruncated,
    sourceCompleteness: summary.coverage.sourceCompleteness,
    returnedCreditRowsObserved: summary.returnedCreditRowsObserved,
    nameCnSourceCounts: summary.nameCnSourceCounts,
    nameCnRowsOmittedFromText: summary.nameCnRowsOmittedFromText,
    coverageNote: P03_CANONICAL_COVERAGE_NOTE,
  });
}

test('P03 profile fixes one anonymous current person-profile call', () => {
  assert.ok(profile);
  assert.equal(profile.frontierId, 'P03');
  assert.equal(profile.calls.length, 1);
  assert.equal(profile.toolName, 'bangumi.get_person_profile');
  assert.equal(profile.calls[0].arguments.personId, 4765);
  assert.equal(profile.calls[0].arguments.includeCredits, true);
  assert.equal(profile.calls[0].arguments.maxSubjects, 500);
  assert.equal(profile.calls[0].arguments.maxCharacters, 1);
  assert.equal(profile.model, 'gpt-6-luna');
  assert.equal(profile.reasoningEffort, 'max');
});

test('P03 v2 is an independent matrix-only profile bound to a fresh public person', () => {
  assert.ok(v2Profile);
  assert.notEqual(v2Profile.id, profile.id);
  assert.notEqual(v2Profile.claimLabelName, profile.claimLabelName);
  assert.notEqual(v2Profile.reportPath, profile.reportPath);
  assert.equal(v2Profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.deepEqual(v2Profile.calls[0].arguments, {
    personId: 19306,
    includeCredits: true,
    maxSubjects: 500,
    maxCharacters: 1,
    includeChronology: false,
  });

  const result = resultFixture();
  result.person.id = 19306;
  const summary = summarizeP03PersonProfileToolResult(
    result,
    v2Profile.calls[0].arguments,
    v2Profile.id,
  );
  assert.equal(summary.personId, 19306);
  assert.equal(validateP03ResultSummary(summary, v2Profile.calls[0].arguments, v2Profile.id), true);
  assert.equal(validateP03ResultSummary(summary), false);
  assert.throws(
    () =>
      summarizeP03PersonProfileToolResult(
        result,
        { ...v2Profile.calls[0].arguments, personId: 4765 },
        v2Profile.id,
      ),
    /exact registered person-profile arguments/u,
  );
});

test('P03 summary counts positive, empty and unavailable source values and bounds listed titles', () => {
  const summary = summarizeP03PersonProfileToolResult(resultFixture(), profile.calls[0].arguments);
  assert.equal(summary.personId, 4765);
  assert.equal(summary.personName, '水濑祈');
  assert.deepEqual(summary.nameCnSourceCounts, { present: 7, empty: 1, unavailable: 2 });
  assert.equal(summary.returnedCreditRowsObserved, 10);
  assert.equal(summary.positiveNameCnRowsObserved, 7);
  assert.equal(summary.sourceNameCnRows.length, 6);
  assert.equal(summary.nameCnRowsOmittedFromText, 1);
  assert.equal(summary.coverage.subjectsObserved, 12);
  assert.equal(summary.coverage.subjectsReturned, 10);
  assert.equal(summary.coverage.subjectsTruncated, true);
  assert.equal(summary.coverage.sourceCompleteness, 'undocumented');
  assert.equal(validateP03ResultSummary(summary), true);
});

test('P03 summary rejects a truncation flag inconsistent with observed and returned counts', () => {
  const summary = summarizeP03PersonProfileToolResult(resultFixture(), profile.calls[0].arguments);
  const inconsistent = {
    ...summary,
    coverage: { ...summary.coverage, subjectsTruncated: false },
  };
  assert.equal(validateP03ResultSummary(inconsistent), false);
});

test('P03 summary marks long source titles that compact MCP text clips', () => {
  const longTitle = '长标题'.repeat(80);
  const result = {
    state: 'partial',
    person: { id: 4765, name: 'Inori Minase', nameCn: '水濑祈' },
    coverage: {
      state: 'partial',
      subjects: { observed: 1, returned: 1, truncated: false, sourceCompleteness: 'undocumented' },
    },
    credits: { subjects: [{ id: 44, name: 'Original', nameCnSource: longTitle }] },
  };
  const summary = summarizeP03PersonProfileToolResult(result, profile.calls[0].arguments);
  assert.equal(summary.sourceNameCnRows[0].titleClipped, true);
  assert.ok(Buffer.byteLength(summary.sourceNameCnRows[0].nameCnSource, 'utf8') <= 160);
  assert.equal(validateP03ResultSummary(summary), true);
});

test('P03 validates the actual compact MCP text projection against structured coverage', () => {
  const summary = summarizeP03PersonProfileToolResult(resultFixture(), profile.calls[0].arguments);
  const checked = validateP03McpTextProjection(compactTextFor(summary), summary);
  assert.equal(checked.passed, true);
  assert.ok(Object.values(checked.checks).every(Boolean));

  const altered = JSON.parse(compactTextFor(summary));
  altered.sourceNameCnRows[0].nameCnSource = '伪造标题';
  assert.equal(validateP03McpTextProjection(JSON.stringify(altered), summary).passed, false);
});

test('P03 answer check requires exact observed positive rows, coverage and limits', () => {
  const summary = summarizeP03PersonProfileToolResult(resultFixture(), profile.calls[0].arguments);
  const checked = verifyP03Answer(answerFor(summary), summary);
  assert.equal(checked.passed, true);
  assert.ok(Object.values(checked.answerChecks).every(Boolean));

  const answer = JSON.parse(answerFor(summary));
  answer.sourceNameCnRows[0].nameCnSource = '未观察到的标题';
  assert.equal(verifyP03Answer(JSON.stringify(answer), summary).passed, false);
});

test('P03 answer check rejects empty-only answers and any absence/completeness claim', () => {
  const summary = summarizeP03PersonProfileToolResult(resultFixture(), profile.calls[0].arguments);
  const answer = JSON.parse(answerFor(summary));
  answer.coverageNote = '没有中文名，列表是完整生涯清单。';
  assert.equal(verifyP03Answer(JSON.stringify(answer), summary).passed, false);

  const contradictory = JSON.parse(answerFor(summary));
  contradictory.coverageNote += ' 其他作品都没有中文名，这就是完整清单。';
  assert.equal(verifyP03Answer(JSON.stringify(contradictory), summary).passed, false);

  const emptyOnly = {
    ...resultFixture(),
    credits: { subjects: [{ id: 11, name: 'No positive source title', nameCnSource: '   ' }] },
    coverage: {
      state: 'partial',
      subjects: { observed: 1, returned: 1, truncated: false, sourceCompleteness: 'undocumented' },
    },
  };
  const emptySummary = summarizeP03PersonProfileToolResult(emptyOnly, profile.calls[0].arguments);
  const noRowsAnswer = JSON.parse(
    answerFor({
      ...emptySummary,
      personId: 4765,
      personName: '水濑祈',
      coverage: {
        ...emptySummary.coverage,
        subjectsObserved: 1,
        subjectsReturned: 1,
        subjectsTruncated: false,
      },
    }),
  );
  assert.equal(verifyP03Answer(JSON.stringify(noRowsAnswer), emptySummary).passed, false);
});

test('P03 summary fails closed when included credit rows are unavailable', () => {
  assert.throws(
    () =>
      summarizeP03PersonProfileToolResult(
        { person: { id: 4765 }, coverage: {} },
        profile.calls[0].arguments,
      ),
    /included person-work credit rows/u,
  );
});
