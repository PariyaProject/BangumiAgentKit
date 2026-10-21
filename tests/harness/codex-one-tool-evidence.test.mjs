import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  authorizeToolCall,
  authorizeToolCallSequence,
  canonicalJson,
  claimProfileSequenceCall,
  claimSingleToolCall,
  checkRendererAnswer,
  checkStatsAnswer,
  createProfileCallQueue,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
  statsTypedAnswerMatches,
  statsTypedAnswerMismatches,
  summarizeSubjectStatsFacts,
  summarizeToolResult,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { buildG06PrivacySummary, G06_PRIVACY } from '../../scripts/lib/g06-privacy-summary.mjs';
import { g06ServerPrivacyMatches } from '../../scripts/acceptance/write-g06-agent-mcp-report.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const target = 'bangumi.get_subject_stats_intelligence';
const expectedArguments = { subjectId: 218707 };

test('canonicalJson sorts object keys recursively and preserves array order', () => {
  assert.equal(canonicalJson({ b: 2, a: { y: 1, x: 0 } }), '{"a":{"x":0,"y":1},"b":2}');
  assert.equal(canonicalJson([2, 1]), '[2,1]');
});

test('one-tool profile only exposes the exact anonymous read tool', () => {
  const tools = [
    { name: target, auth: 'none', risk: 'read' },
    { name: 'bangumi.auth_status', auth: 'none', risk: 'read' },
    { name: 'bangumi.update_collection', auth: 'required', risk: 'write' },
  ];
  assert.deepEqual(filterAllowedTools(tools, target), [tools[0]]);
  assert.throws(() => filterAllowedTools(tools, 'bangumi.update_collection'), /auth=none, risk=read/);
  assert.throws(() => filterAllowedTools([...tools, { ...tools[0] }], target), /exactly one/);
});

test('shared one-tool guards continue to reject optional-auth tools', () => {
  const render = { name: 'bangumi.render_subject_card', auth: 'optional', risk: 'read' };
  assert.throws(() => filterAllowedTools([render], render.name), /auth=none, risk=read/u);
  assert.throws(() => publicReadOnlyToolAnnotations(render), /anonymous read-only/u);
});

test('multi-tool profile exposes only its exact anonymous read tool set', () => {
  const compare = { name: 'bangumi.compare_subject_cohorts', auth: 'none', risk: 'read' };
  const render = { name: 'bangumi.render_subject_cohort_comparison', auth: 'none', risk: 'read' };
  const auth = { name: 'bangumi.auth_status', auth: 'none', risk: 'read' };
  const write = { name: 'bangumi.update_collection', auth: 'required', risk: 'write' };
  assert.deepEqual(filterAllowedTools([compare, render, auth, write], [compare.name, render.name]), [
    compare,
    render,
  ]);
  assert.throws(
    () => filterAllowedTools([compare, render, auth, write], [compare.name, write.name]),
    /auth=none, risk=read/u,
  );
  assert.throws(
    () => filterAllowedTools([compare, render, render], [compare.name, render.name]),
    /once/u,
  );
});

test('the G06 server emits the exact privacy summary required by its report validator', () => {
  const summary = { privacy: buildG06PrivacySummary() };
  assert.deepEqual(summary.privacy, G06_PRIVACY);
  assert.equal(g06ServerPrivacyMatches(summary), true);
});

test('only an anonymous read tool receives non-destructive idempotent MCP annotations', () => {
  assert.deepEqual(publicReadOnlyToolAnnotations({ auth: 'none', risk: 'read' }), {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  });
  assert.throws(
    () => publicReadOnlyToolAnnotations({ auth: 'required', risk: 'read' }),
    /anonymous read-only/u,
  );
  assert.throws(
    () => publicReadOnlyToolAnnotations({ auth: 'none', risk: 'write' }),
    /anonymous read-only/u,
  );
});

test('fixed query gate allows one exact read and rejects wrong tool, arguments, and repeats', () => {
  const base = { expectedTool: target, expectedArguments, completedCalls: 0 };
  assert.deepEqual(authorizeToolCall({ ...base, name: target, args: { subjectId: 218609 } }), {
    allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_FIXED_QUERY',
  });
  assert.deepEqual(authorizeToolCall({ ...base, name: 'bangumi.auth_status', args: {} }), {
    allowed: false, code: 'TOOL_NOT_ALLOWLISTED',
  });
  assert.deepEqual(authorizeToolCall({ ...base, name: target, args: expectedArguments }), {
    allowed: true, code: 'ALLOWLISTED_FIXED_PUBLIC_QUERY',
  });
  assert.deepEqual(authorizeToolCall({ ...base, completedCalls: 1, name: target, args: expectedArguments }), {
    allowed: false, code: 'CALL_LIMIT_REACHED',
  });
});

test('profile sequence gate permits only the next exact argument object for its one tool', () => {
  const profile = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
  const expectedArgumentSequence = profile.calls.map((call) => call.arguments);
  const base = { expectedTool: 'bangumi.get_person_activity', expectedArgumentSequence };
  assert.deepEqual(authorizeToolCallSequence({
    ...base, name: 'bangumi.auth_status', args: {}, completedCalls: 0,
  }), { allowed: false, code: 'TOOL_NOT_ALLOWLISTED' });
  assert.deepEqual(authorizeToolCallSequence({
    ...base, name: 'bangumi.get_person_activity', args: expectedArgumentSequence[1], completedCalls: 0,
  }), { allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_PROFILE_SEQUENCE' });
  assert.deepEqual(authorizeToolCallSequence({
    ...base, name: 'bangumi.get_person_activity', args: expectedArgumentSequence[0], completedCalls: 0,
  }), { allowed: true, code: 'ALLOWLISTED_PROFILE_QUERY', sequenceIndex: 0 });
  assert.deepEqual(authorizeToolCallSequence({
    ...base, name: 'bangumi.get_person_activity', args: expectedArgumentSequence[1], completedCalls: 1,
  }), { allowed: true, code: 'ALLOWLISTED_PROFILE_QUERY', sequenceIndex: 1 });
  assert.deepEqual(authorizeToolCallSequence({
    ...base, name: 'bangumi.get_person_activity', args: expectedArgumentSequence[1], completedCalls: 2,
  }), { allowed: false, code: 'CALL_LIMIT_REACHED' });
});

test('multi-tool profile sequence requires the exact next tool and its fixed arguments', () => {
  const profile = getAgentMcpProfileById('c04-cohort-comparison-agent-mcp-matrix-v1');
  const expectedToolSequence = profile.calls.map((call) => call.toolName);
  const expectedArgumentSequence = profile.calls.map((call) => call.arguments);
  const base = { expectedToolSequence, expectedArgumentSequence };
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: expectedToolSequence[1],
    args: expectedArgumentSequence[1],
    completedCalls: 0,
  }), { allowed: false, code: 'TOOL_NOT_ALLOWLISTED' });
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: expectedToolSequence[0],
    args: expectedArgumentSequence[0],
    completedCalls: 0,
  }), { allowed: true, code: 'ALLOWLISTED_PROFILE_QUERY', sequenceIndex: 0 });
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: expectedToolSequence[1],
    args: { ...expectedArgumentSequence[1], maxSubjects: 2 },
    completedCalls: 1,
  }), { allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_PROFILE_SEQUENCE' });
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: expectedToolSequence[1],
    args: expectedArgumentSequence[1],
    completedCalls: 1,
  }), { allowed: true, code: 'ALLOWLISTED_PROFILE_QUERY', sequenceIndex: 1 });
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: expectedToolSequence[1],
    args: expectedArgumentSequence[1],
    completedCalls: 2,
  }), { allowed: false, code: 'CALL_LIMIT_REACHED' });
  assert.deepEqual(authorizeToolCallSequence({
    ...base,
    name: 'bangumi.auth_status',
    args: {},
    completedCalls: 2,
  }), { allowed: false, code: 'TOOL_NOT_ALLOWLISTED' });
});

test('C04 profile summaries retain bounded coverage and artifact metadata without source rows', () => {
  const profile = getAgentMcpProfileById('c04-cohort-comparison-agent-mcp-matrix-v1');
  const raw = {
    state: 'partial',
    cohorts: [
      {
        label: 'public season label',
        subjects: [{ id: 123456, name: 'private-to-report title', score: 9.1 }],
        coverage: {
          query: { state: 'ok' },
          detailHydrationsAttempted: 1,
          detailHydrationsSucceeded: 1,
          detailHydrationsFailed: 0,
        },
      },
      {
        label: 'second season label',
        subjects: [],
        coverage: {
          query: { state: 'partial' },
          detailHydrationsAttempted: 0,
          detailHydrationsSucceeded: 0,
          detailHydrationsFailed: 0,
        },
      },
    ],
    metrics: [
      {
        key: 'score', state: 'partial', averages: [9.1, 0],
        validCounts: [1, 0], partialCounts: [0, 0], missingCounts: [0, 0],
        conflictCounts: [0, 0], notComputableCounts: [0, 0],
      },
    ],
    coverage: {
      maxSubjectsPerCohort: 1,
      totalSubjectsReturned: 1,
      cohortsComplete: 0,
      cohortsPartial: 2,
      detailHydrationsAttempted: 1,
      detailHydrationsSucceeded: 1,
      detailHydrationsFailed: 0,
      truncated: false,
    },
  };
  const summary = summarizeProfileToolResult(
    raw,
    profile.calls[0].arguments,
    profile.id,
    null,
    'bangumi.compare_subject_cohorts',
  );
  const encoded = JSON.stringify(summary);
  assert.equal(summary.resultState, 'partial');
  assert.equal(summary.cohortCount, 2);
  assert.equal(summary.coverage.totalSubjectsReturned, 1);
  assert.doesNotMatch(encoded, /private-to-report|123456|9\.1|public season label/u);

  const artifactSummary = summarizeProfileToolResult(
    { artifact: { id: 'do-not-retain' } },
    profile.calls[1].arguments,
    profile.id,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 1200,
      height: 900,
      byteLength: 2048,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
    },
    'bangumi.render_subject_cohort_comparison',
  );
  assert.equal(artifactSummary.resultState, 'artifact_returned');
  assert.equal(artifactSummary.artifact.persisted, false);
  assert.doesNotMatch(JSON.stringify(artifactSummary), /do-not-retain/u);
});

test('profile call queue serializes overlapping requests and releases after failure', async () => {
  const enqueue = createProfileCallQueue();
  const events = [];
  let releaseFirst;
  const first = enqueue(async () => {
    events.push('first-start');
    await new Promise((resolve) => { releaseFirst = resolve; });
    events.push('first-end');
  });
  const second = enqueue(async () => { events.push('second-start'); });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['first-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);

  const failed = enqueue(async () => { throw new Error('first operation failed'); });
  const afterFailure = enqueue(async () => { events.push('after-failure'); });
  await assert.rejects(failed, /first operation failed/u);
  await afterFailure;
  assert.equal(events.at(-1), 'after-failure');
});

test('shared call claim permits one process-wide call and denies later claims', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-one-tool-lock-test-'));
  const lockPath = path.join(root, 'call-claimed');
  try {
    assert.equal(claimSingleToolCall(lockPath), true);
    assert.equal(claimSingleToolCall(lockPath), false);
    assert.equal(fs.statSync(lockPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('profile sequence claims are create-only per ordered slot and fail closed outside bounds', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-profile-sequence-lock-test-'));
  const lockPath = path.join(root, 'profile');
  try {
    assert.equal(claimProfileSequenceCall(lockPath, 0), true);
    assert.equal(claimProfileSequenceCall(lockPath, 0), false);
    assert.equal(claimProfileSequenceCall(lockPath, 1), true);
    assert.equal(claimProfileSequenceCall(lockPath, 1), false);
    assert.equal(fs.statSync(`${lockPath}.call-1-claimed`).mode & 0o777, 0o600);
    assert.throws(() => claimProfileSequenceCall(lockPath, 8), /bounded zero-based call index/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sanitized result metadata never retains title, stats values, or raw artifact bytes', () => {
  const raw = {
    subjectNameCn: 'public title that must not persist',
    score: 8.8,
    state: 'partial',
    sourceOperations: [{ operation: 'GET /v0/subjects/218707', attempted: 1, succeeded: 1, failed: 0 }],
    artifact: { id: 'art_sensitive_reference', mimeType: 'image/png', width: 720, height: 1200 },
  };
  const summary = summarizeToolResult(target, raw, {
    returned: true, persisted: false, mimeType: 'image/png', width: 720, height: 1200,
    byteLength: 123456, sha256: 'a'.repeat(64), pngSignatureValid: true,
  });
  const encoded = JSON.stringify(summary);
  assert.equal(summary.resultState, 'partial');
  assert.equal(summary.artifact.persisted, false);
  assert.equal(summary.sourceOperations[0].succeeded, 1);
  assert.doesNotMatch(encoded, /public title|8\.8|art_sensitive_reference/);
  assert.doesNotMatch(encoded, /raw|result body/i);
});

test('source operation summaries discard query strings and arbitrary payload text', () => {
  const summary = summarizeToolResult(target, {
    sourceOperations: [
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/subjects/218707?access_token=must-not-survive', attempted: 1, succeeded: 1, failed: 0 },
    ],
  });
  assert.deepEqual(summary.sourceOperations.map((item) => item.operation), [
    'GET /v0/subjects/{subject_id}',
    'unclassified',
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /access_token|must-not-survive/u);
});


test('stats fact projection verifies the 8-9 band against all ten histogram bins without titles', () => {
  const histogram = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9 };
  const facts = summarizeSubjectStatsFacts({
    subjectId: 218707,
    state: 'complete',
    raw: { ratingHistogram: histogram },
    rating: {
      state: 'complete', population: 45, mean: 7.2, standardDeviation: 1.1,
      distribution: Array.from({ length: 10 }, (_, index) => ({
        score: index + 1, count: histogram[index + 1], percentage: (histogram[index + 1] / 45) * 100,
      })),
      scoreBand8To9Share: {
        state: 'complete', count: 15, population: 45, percentage: (15/45) * 100,
        formula: { id: 'bangumi.rating.score_band_8_9_share.v1', version: 1, evidenceStatus: 'official_contract' },
      },
    },
    collection: {
      state: 'complete', total: 100, completionState: 'empirically_verified', completionRate: 0.3,
      distribution: [
        { status: 'wish', count: 10, percentage: 10 },
        { status: 'doing', count: 20, percentage: 20 },
        { status: 'collect', count: 30, percentage: 30 },
        { status: 'on_hold', count: 25, percentage: 25 },
        { status: 'dropped', count: 15, percentage: 15 },
      ],
      formulas: { completion: { id: 'subject-stats-collection-completion-v1', version: 1, evidenceStatus: 'empirically_verified' } },
    },
    coverage: { ratingBucketsExpected: 10, ratingBucketsObserved: 10, collectionBucketsExpected: 5,
                collectionBucketsObserved: 5, sourceRequestsAttempted: 1, sourceRequestsSucceeded: 1 },
    source: { official: { class: 'official-v0' } },
    evidence: [{ source: 'official-v0' }, { source: 'derived-s7' }],
    warnings: [],
    limitations: ['no historical data'],
  });
  assert.deepEqual(facts.rating.histogram, {
    allTenBinsValid: true,
    population: 45,
    scoreBand8To9CountFromBins: 15,
    scoreBand8To9PercentageFromBins: (15/45) * 100,
  });
  assert.equal(facts.rating.scoreBand8To9Share.formulaId, 'bangumi.rating.score_band_8_9_share.v1');
  assert.deepEqual(facts.evidenceSources, ['derived-s7', 'official-v0']);
  assert.equal(facts.rating.mean, 7.2);
  assert.equal(facts.rating.standardDeviation, 1.1);
  assert.equal(facts.collection.completionRate, 0.3);
  assert.deepEqual(facts.rating.distribution[7], { score: 8, count: 7, percentage: (7/45) * 100 });
  assert.deepEqual(facts.collection.distribution, [
    { status: 'wish', count: 10, percentage: 10 },
    { status: 'doing', count: 20, percentage: 20 },
    { status: 'collect', count: 30, percentage: 30 },
    { status: 'on_hold', count: 25, percentage: 25 },
    { status: 'dropped', count: 15, percentage: 15 },
  ]);
  assert.doesNotMatch(JSON.stringify(facts), /subjectName|title/);

  const answer = '条目218707的当前官方 v0 快照中，评分1到10分人数依次为0、1、2、3、4、5、6、7、8、9，8–9分占比33.3%。收藏分布为愿望10人、在看20人、看过30人、搁置25人、抛弃15人，完成率30%，评分和收藏覆盖完整。这只是当前快照，不代表趋势或作品质量，也不能据此判断口碑。';
  const answerCheck = checkStatsAnswer(answer, facts);
  assert.equal(answerCheck.passed, true, JSON.stringify(answerCheck.answerChecks));
  assert.equal(checkStatsAnswer(answer.replace('33.3%', '98.7%'), facts).answerChecks.typedFieldsMatch, false);
  assert.equal(checkStatsAnswer(answer.replace('完成率30%', '完成率99%'), facts).answerChecks.typedFieldsMatch, false);
  const swappedRatingCounts = answer.replace('人数依次为0、1、2', '人数依次为1、0、2');
  assert.equal(checkStatsAnswer(swappedRatingCounts, facts).answerChecks.typedFieldsMatch, false);
  assert.equal(checkStatsAnswer(swappedRatingCounts, facts).answerChecks.ratingDistributionClaimsMatch, false);
  const swappedCollectionCounts = answer.replace(
    '愿望10人、在看20人',
    '愿望20人、在看10人',
  );
  assert.equal(checkStatsAnswer(swappedCollectionCounts, facts).answerChecks.typedFieldsMatch, false);
  assert.equal(checkStatsAnswer(swappedCollectionCounts, facts).answerChecks.collectionDistributionClaimsMatch, false);
  const distributionWithoutCounts = answer.replace(
    '愿望10人、在看20人、看过30人、搁置25人、抛弃15人',
    '愿望、在看、看过、搁置、抛弃',
  );
  assert.equal(checkStatsAnswer(distributionWithoutCounts, facts).answerChecks.typedFieldsMatch, true);
  assert.equal(checkStatsAnswer(answer.replace('这只是当前快照，不代表趋势或作品质量，也不能据此判断口碑。', ''), facts).answerChecks.limitationsMentioned, false);
  assert.equal(checkStatsAnswer(`${answer} 这不代表质量结论。`, facts).answerChecks.noUnsupportedPositiveClaim, true);
  assert.equal(checkStatsAnswer(`${answer} 说明质量很好。`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} 评分呈现双峰分布。`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} 不能据此判断是否双峰。`, facts).answerChecks.noUnsupportedPositiveClaim, true);
  assert.equal(checkStatsAnswer(`${answer} 评分呈现多峰分布。`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} 这不仅说明评分可能是双峰分布。`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} This is a Bimodal distribution.`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} The data does not establish a Bimodal pattern.`, facts).answerChecks.noUnsupportedPositiveClaim, true);
  assert.equal(checkStatsAnswer(`${answer} 仅为当前快照，不能据此推断历史趋势或两极分化。`, facts).answerChecks.noUnsupportedPositiveClaim, true);
  assert.equal(checkStatsAnswer(`${answer} 不可否认评分呈双峰分布。`, facts).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkStatsAnswer(`${answer} 不代表作品质量，但数据显示双峰。`, facts).answerChecks.noUnsupportedPositiveClaim, false);

  const typedAnswer = {
    subjectId: 218707, resultState: 'complete', ratingState: 'complete', ratingPopulation: 45,
    ratingMean: 7.2, ratingStandardDeviation: 1.1,
    scoreBand8To9Share: {
      state: 'complete', count: 15, population: 45, percentage: 33.3,
      formulaId: 'bangumi.rating.score_band_8_9_share.v1', formulaVersion: 1,
      evidenceStatus: 'official_contract',
    },
    ratingDistribution: Array.from({ length: 10 }, (_, index) => ({
      score: index + 1, count: histogram[index + 1],
      percentage: Math.round((histogram[index + 1] / 45) * 1000) / 10,
    })),
    collectionState: 'complete', collectionTotal: 100, completionState: 'empirically_verified',
    completionRatePercentage: 30,
    collectionDistribution: facts.collection.distribution,
    coverage: facts.coverage, officialSourceClass: 'official-v0',
    evidenceSources: ['derived-s7', 'official-v0'], answer,
  };
  assert.equal(statsTypedAnswerMatches(typedAnswer, facts), true);
  assert.equal(checkStatsAnswer(answer, facts, typedAnswer).answerChecks.typedFieldsMatch, true);
  assert.equal(checkStatsAnswer(`${answer} altered`, facts, typedAnswer).answerChecks.typedFieldsMatch, false);
  const unsupportedAnswer = `${answer} 新增指标为99%。`;
  assert.equal(checkStatsAnswer(unsupportedAnswer, facts, { ...typedAnswer, answer: unsupportedAnswer }).answerChecks.typedFieldsMatch, false);
  const wrongScoreBucket = structuredClone(typedAnswer);
  wrongScoreBucket.ratingDistribution[7].count = 8;
  assert.equal(statsTypedAnswerMatches(wrongScoreBucket, facts), false);
  assert.deepEqual(statsTypedAnswerMismatches(wrongScoreBucket, facts), ['ratingDistribution[8].count']);
  const wrongCollectionStatus = structuredClone(typedAnswer);
  wrongCollectionStatus.collectionDistribution[0].status = 'dropped';
  assert.equal(statsTypedAnswerMatches(wrongCollectionStatus, facts), false);
  assert.deepEqual(statsTypedAnswerMismatches(wrongCollectionStatus, facts), ['collectionDistribution[wish].status']);
  const fabricatedCompletion = structuredClone(typedAnswer);
  fabricatedCompletion.completionRatePercentage = 99;
  assert.equal(statsTypedAnswerMatches(fabricatedCompletion, facts), false);
  assert.deepEqual(statsTypedAnswerMismatches(fabricatedCompletion, facts), ['completionRatePercentage']);
});

test('renderer answer checks only the request identity and returned ephemeral Artifact metadata', () => {
  const result = {
    resultState: 'artifact_returned',
    artifact: {
      returned: true, persisted: false, mimeType: 'image/png', width: 720, height: 1200,
      byteLength: 123456, sha256: 'a'.repeat(64), pngSignatureValid: true,
    },
  };
  const answer = '条目218707的当前官方 v0 评分与收藏统计图卡 PNG Artifact 已生成，尺寸720×1200。卡片覆盖评分直方图、8–9分占比、收藏分布和完成率，并说明覆盖状态；我没有从 Artifact 元数据推断图像像素或指标值。';
  assert.equal(checkRendererAnswer(answer, result).passed, true);
  assert.equal(checkRendererAnswer(`${answer} 很可能是优质作品。`, result).answerChecks.noUnsupportedPositiveClaim, false);
  assert.equal(checkRendererAnswer(`${answer} 评分99%。`, result).answerChecks.typedFieldsMatch, false);
});
