import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyR01TextProjectionAnswer } from '../../scripts/acceptance/r01-relations-text-projection-answer-check.mjs';
import {
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
  r01RelationsTextProjectionSyntheticRows,
} from '../../scripts/lib/r01-relations-text-projection-offline-profile.mjs';

function makeObservation() {
  const items = r01RelationsTextProjectionSyntheticRows().map(
    ({ id, name, name_cn, relation }) => ({
      id,
      type: 'anime',
      name,
      nameCn: name_cn,
      relation,
    }),
  );
  const source = {
    api: 'Bangumi official v0',
    operation: 'GET /v0/subjects/{subject_id}/subjects',
    direction: 'source_subject_to_returned_target',
    scope: 'visible_direct_rows_returned_for_source_subject',
    retrievedAt: '2026-10-23T00:00:00.000Z',
  };
  const coverage = {
    responseRowsObserved: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
    rowsReturned: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
  };
  const structuredContent = {
    state: 'observed',
    subjectId: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
    source,
    coverage,
    limitations: [
      '仅表示本次响应中指定来源条目指向目标条目的直接关系，不含反向或传递关系。',
      '官方 v0 此操作没有分页、总数或系列完整性字段；未返回关系不等于不存在。',
      'relation 是来源记录的原始标签；接口行顺序不表示官方观看顺序。',
      '匿名可见性可能不包含敏感条目。',
    ],
    items,
  };
  // The production presenter halves 24 rows when compact JSON exceeds its 3600-byte cap.
  const textRowsIncluded = 12;
  const textResult = {
    ...structuredContent,
    items: items.slice(0, textRowsIncluded),
    textProjection: {
      rowsIncluded: textRowsIncluded,
      rowsOmitted: items.length - textRowsIncluded,
      displayNamesClipped: 0,
      relationLabelsClipped: 0,
      limitationsClipped: 0,
      imageFieldsOmitted: 0,
      fullStructuredContentAvailable: true,
    },
  };
  const answer = JSON.stringify({
    sourceRowsObserved: 30,
    sourceRowsReturned: 30,
    sourceTruncated: false,
    textRowsIncluded,
    textRowsOmitted: 18,
    structuredContentAvailable: true,
    firstDisplayedRelation: '改编',
    scope:
      '本次文本投影省略的关系仍在structuredContent；官方端点没有分页或总数，因此不代表完整关系图，也不证明未返回关系不存在。',
  });
  return {
    answer,
    structuredContent,
    toolOutput: {
      content: [{ type: 'text', text: JSON.stringify(textResult) }],
      structuredContent,
    },
    toolCalls: [
      {
        name: 'bangumi.get_subject_relations',
        state: 'DONE',
        arguments: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
      },
    ],
  };
}

test('R01 v2 answer check binds source rows, MCP text omissions, and full structured content', () => {
  const observation = makeObservation();
  const check = verifyR01TextProjectionAnswer(
    observation.answer,
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
    observation.toolOutput,
    observation.toolCalls,
  );
  assert.equal(check.passed, true);
  assert.deepEqual(check.resultSummary, {
    sourceRowsObserved: 30,
    sourceRowsReturned: 30,
    sourceSchemaDriftRows: 0,
    sourceTruncated: false,
    textRowsIncluded: 12,
    textRowsOmitted: 18,
    textUtf8Bytes: Buffer.byteLength(observation.toolOutput.content[0].text, 'utf8'),
    structuredContentAvailable: true,
    textProjectionConsistent: true,
    firstDisplayedRelationMatched: true,
  });
});

test('R01 v2 answer check rejects false omission counts and mismatched displayed rows', () => {
  const observation = makeObservation();
  const wrongCount = JSON.parse(observation.answer);
  wrongCount.textRowsOmitted = 5;
  assert.equal(
    verifyR01TextProjectionAnswer(
      JSON.stringify(wrongCount),
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
      observation.toolOutput,
      observation.toolCalls,
    ).passed,
    false,
  );

  const textResult = JSON.parse(observation.toolOutput.content[0].text);
  textResult.items[0].relation = '非来源关系';
  const tamperedOutput = {
    ...observation.toolOutput,
    content: [{ type: 'text', text: JSON.stringify(textResult) }],
  };
  assert.equal(
    verifyR01TextProjectionAnswer(
      observation.answer,
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
      tamperedOutput,
      observation.toolCalls,
    ).passed,
    false,
  );
});

test('R01 v2 answer check rejects an unqualified completeness claim or extra prose', () => {
  const observation = makeObservation();
  const incompleteClaim = JSON.parse(observation.answer);
  incompleteClaim.scope = '这就是完整关系图。';
  assert.equal(
    verifyR01TextProjectionAnswer(
      JSON.stringify(incompleteClaim),
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
      observation.toolOutput,
      observation.toolCalls,
    ).passed,
    false,
  );
  assert.equal(
    verifyR01TextProjectionAnswer(
      `${observation.answer}\n说明：以上就是全部关系。`,
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
      observation.toolOutput,
      observation.toolCalls,
    ).passed,
    false,
  );
});
