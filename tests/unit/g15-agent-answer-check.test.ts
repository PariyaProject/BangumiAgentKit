import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createSanitizedG15CanaryReport,
  G15_AGENT_ANSWER_CHECK_METHOD,
  verifyG15AgentAnswer,
} from '../../scripts/acceptance/g15-agent-answer-check.mjs';

const argumentsValue = { subjectIds: [400602, 420628] };
const formula = {
  id: 'bangumi.subject.completion.v1',
  version: 1,
  evidenceStatus: 'empirically_verified',
  description: 'collect / (wish + collect + doing + on_hold + dropped)',
};
const result = {
  subjectIds: [400602, 420628],
  state: 'partial',
  subjects: [
    {
      subjectId: 400602,
      state: 'complete',
      subject: { id: 400602, name: '葬送のフリーレン', nameCn: '葬送的芙莉莲' },
      statistics: {
        state: 'complete',
        collection: {
          completionState: 'complete',
          completionRate: 0.42,
          formulas: { completion: formula },
        },
      },
    },
    {
      subjectId: 420628,
      state: 'complete',
      subject: { id: 420628, name: '薬屋のひとりごと', nameCn: '药屋少女的呢喃' },
      statistics: {
        state: 'complete',
        collection: {
          completionState: 'complete',
          completionRate: 0.31,
          formulas: { completion: formula },
        },
      },
    },
  ],
  metrics: [
    { key: 'score', values: [8.6, 7.5], delta: -1.1, deltaPrecision: 1, state: 'complete' },
    {
      key: 'episodesReported',
      values: [28, 24],
      delta: -4,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'totalEpisodesReported',
      values: [28, 26],
      delta: -2,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'collectionCompletionRate',
      values: [0.42, 0.31],
      delta: -0.11,
      deltaPrecision: 3,
      state: 'complete',
    },
  ],
  source: {
    official: {
      class: 'official-v0',
      operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/stats'],
      attemptedAt: '2026-10-05T00:00:00.000Z',
    },
  },
  overlaps: {
    cast: { items: [], state: 'partial' },
    staff: { items: [], state: 'partial' },
  },
  collectionCompletionFormula: formula,
  coverage: { requestedSubjects: 2, returnedSubjects: 2 },
  mcpTextProjection: { overlapItemsOmittedFromText: 48, maxUtf8Bytes: 3600 },
};
const validAnswer = [
  '条目｜400602｜名称：葬送的芙莉莲',
  '条目｜420628｜名称：药屋少女的呢喃',
  '指标｜score｜A=8.6｜B=7.5｜B-A=-1.1｜state=complete',
  '指标｜episodesReported｜A=28｜B=24｜B-A=-4｜state=complete',
  '指标｜totalEpisodesReported｜A=28｜B=26｜B-A=-2｜state=complete',
  '指标｜collectionCompletionRate｜A=42%｜B=31%｜B-A=-11个百分点｜state=complete',
  '说明｜差值方向统一为第二个条目减第一个条目（B-A）。',
  '说明｜完成率按 collect / (wish + collect + doing + on_hold + dropped) 计算；该公式仅为样本验证，并非官方 API 契约。',
  '说明｜完成率是当前收藏状态的观察值，不代表用户个人观看进度。',
  '说明｜数据来自当前 Bangumi 官方 v0 快照，不代表历史趋势。',
  '说明｜演员和职员重合是有界结果；未显示的重合不代表不存在。',
].join('\n');

function check(
  answer: unknown = validAnswer,
  args: unknown = argumentsValue,
  output: unknown = result,
  tool = 'bangumi.get_subject_comparison',
) {
  return verifyG15AgentAnswer(answer, tool, args, output);
}

describe('G15 Agent answer acceptance', () => {
  it('matches both exact subject identities and the current comparison metric rows', () => {
    expect(check()).toMatchObject({
      method: G15_AGENT_ANSWER_CHECK_METHOD,
      toolNameMatch: true,
      queryArgumentsMatch: true,
      resultReadbackAvailable: true,
      resultSourceContractPassed: true,
      requestedSubjectIdsMatch: true,
      subjectIdentityRowsMatched: 2,
      expectedMetricRows: 4,
      answerMetricRowsParsed: 4,
      metricRowsMatched: 4,
      missingMetricRows: 0,
      mismatchedMetricRows: 0,
      metricStatesPreserved: true,
      currentOfficialV0DisclosurePresent: true,
      currentSnapshotDisclosurePresent: true,
      noHistoricalTrendClaimPresent: true,
      deltaDirectionDisclosurePresent: true,
      completionFormulaDisclosurePresent: true,
      completionFormulaEvidenceDisclosurePresent: true,
      notPersonalWatchProgressDisclosurePresent: true,
      boundedOverlapDisclosurePresent: true,
      omissionNotAbsenceDisclosurePresent: true,
      passed: true,
    });
  });

  it('accepts a small-result full JSON response that has no text-projection metadata', () => {
    const fullJsonResult = JSON.parse(JSON.stringify(result));
    delete fullJsonResult.collectionCompletionFormula;
    delete fullJsonResult.mcpTextProjection;

    expect(check(validAnswer, argumentsValue, fullJsonResult)).toMatchObject({
      resultReadbackAvailable: true,
      resultSourceContractPassed: true,
      passed: true,
    });
  });

  it('rejects swapped identities, wrong names, duplicate rows, and unsupported IDs', () => {
    const swapped = validAnswer
      .replace('条目｜400602｜名称：葬送的芙莉莲', '条目｜420628｜名称：葬送的芙莉莲')
      .replace('条目｜420628｜名称：药屋少女的呢喃', '条目｜400602｜名称：药屋少女的呢喃');
    const wrongName = validAnswer.replace('名称：药屋少女的呢喃', '名称：错误作品');
    const duplicate = `${validAnswer}\n条目｜400602｜名称：葬送的芙莉莲`;
    const unknown = validAnswer.replace('条目｜420628｜', '条目｜999999｜');
    const reversedIdentityOrder = validAnswer.replace(
      '条目｜400602｜名称：葬送的芙莉莲\n条目｜420628｜名称：药屋少女的呢喃',
      '条目｜420628｜名称：药屋少女的呢喃\n条目｜400602｜名称：葬送的芙莉莲',
    );

    expect(check(swapped)).toMatchObject({ subjectIdentityRowsMatched: 0, passed: false });
    expect(check(wrongName)).toMatchObject({ subjectIdentityRowsUnmatched: 1, passed: false });
    expect(check(duplicate)).toMatchObject({ duplicateIdentityRows: 1, passed: false });
    expect(check(unknown)).toMatchObject({ subjectIdentityRowsUnmatched: 1, passed: false });
    expect(check(reversedIdentityOrder)).toMatchObject({
      subjectIdentityRowsMatched: 2,
      identityOrderPreserved: false,
      passed: false,
    });
    const sourceIdentityMismatch = JSON.parse(JSON.stringify(result));
    sourceIdentityMismatch.subjects[0].subject.nameCn = '不是芙莉莲';
    expect(check(validAnswer, argumentsValue, sourceIdentityMismatch)).toMatchObject({
      requestedSubjectIdsMatch: true,
      sourceSubjectIdentitiesMatch: false,
      subjectIdentityRowsMatched: 1,
      resultReadbackAvailable: true,
      passed: false,
    });
  });

  it('rejects reversed or inaccurate deltas and missing or duplicate metrics', () => {
    const reversed = validAnswer.replace('B-A=-1.1', 'B-A=1.1');
    const wrongValue = validAnswer.replace('B=7.5', 'B=7.6');
    const missingRate = validAnswer.replace(
      '指标｜collectionCompletionRate｜A=42%｜B=31%｜B-A=-11个百分点｜state=complete\n',
      '',
    );
    const duplicateMetric = `${validAnswer}\n指标｜score｜A=8.6｜B=7.5｜B-A=-1.1｜state=complete`;

    expect(check(reversed)).toMatchObject({ mismatchedMetricRows: 1, passed: false });
    expect(check(wrongValue)).toMatchObject({ mismatchedMetricRows: 1, passed: false });
    expect(check(missingRate)).toMatchObject({ missingMetricRows: 1, passed: false });
    expect(check(duplicateMetric)).toMatchObject({ duplicateMetricRows: 1, passed: false });
  });

  it('requires unknown and conflict values to remain explicit rather than becoming zero', () => {
    const degraded = JSON.parse(JSON.stringify(result));
    degraded.metrics[0] = {
      key: 'score',
      values: [8.6, 7.5],
      delta: null,
      deltaPrecision: 1,
      state: 'conflict',
    };
    degraded.metrics[3] = {
      key: 'collectionCompletionRate',
      values: [null, 0.31],
      delta: null,
      deltaPrecision: 3,
      state: 'unknown',
    };
    const correct = validAnswer
      .replace(
        '指标｜score｜A=8.6｜B=7.5｜B-A=-1.1｜state=complete',
        '指标｜score｜A=冲突｜B=冲突｜B-A=不可计算｜state=conflict',
      )
      .replace(
        '指标｜collectionCompletionRate｜A=42%｜B=31%｜B-A=-11个百分点｜state=complete',
        '指标｜collectionCompletionRate｜A=未知｜B=31%｜B-A=不可计算｜state=unknown',
      );
    const fabricatedZero = correct.replace('A=未知｜B=31%', 'A=0%｜B=31%');
    const fabricatedConflictValues = correct.replace('A=冲突｜B=冲突', 'A=8.6｜B=7.5');

    expect(check(correct, argumentsValue, degraded)).toMatchObject({
      metricStatesPreserved: true,
      metricRowsMatched: 4,
      passed: true,
    });
    expect(check(fabricatedZero, argumentsValue, degraded).passed).toBe(false);
    expect(check(fabricatedConflictValues, argumentsValue, degraded).passed).toBe(false);
  });

  it('fails closed on unsafe scope claims, weak caveats, and non-exact call scope', () => {
    const falseProgress = validAnswer.replace('不代表用户个人观看进度', '代表用户个人观看进度');
    const qualityClaim = `${validAnswer}\n说明｜整体质量更高。`;
    const personalProgressClaim = `${validAnswer}\n说明｜42%就是用户个人观看进度。`;
    const identityMetricClaim = `${validAnswer}\n说明｜芙莉莲评分为9.9。`;
    const unsupportedQualityClaim = `${validAnswer}\n说明｜芙莉莲比药屋更好看。`;
    const incorrectFormula = validAnswer.replace(
      '完成率按 collect / (wish + collect + doing + on_hold + dropped) 计算',
      '完成率按 wish / (collect + doing + on_hold + dropped) 计算',
    );
    const completenessClaim = `${validAnswer}\n说明｜这是完整比较，覆盖全部动画条目。`;
    const qualifiedBoundary = `${validAnswer}\n说明｜当前样本不代表完整结果。当前样本不代表全量覆盖。`;
    const unsupportedAbsence = `${validAnswer}\n说明｜两部作品没有共同声优。`;
    const noTrendCaveat = validAnswer.replace('不代表历史趋势', '代表历史趋势');
    const extraArgument = check(validAnswer, { ...argumentsValue, maxCast: 4 });
    const wrongTool = check(validAnswer, argumentsValue, result, 'bangumi.get_subject');
    const wrongIds = check(validAnswer, { subjectIds: [420628, 400602] });
    const malformedMetric = check(`${validAnswer}\n指标｜score｜A=8.6｜B=7.5`);
    const incorrectSourceFormula = JSON.parse(JSON.stringify(result));
    incorrectSourceFormula.collectionCompletionFormula.description =
      'wish / (collect + doing + on_hold + dropped)';

    expect(check(falseProgress).notPersonalWatchProgressDisclosurePresent).toBe(false);
    expect(check(qualityClaim).unsupportedClaimPresent).toBe(true);
    expect(check(personalProgressClaim)).toMatchObject({
      scopeLinesMatchAllowlist: false,
      notPersonalWatchProgressDisclosurePresent: true,
      passed: false,
    });
    expect(check(identityMetricClaim)).toMatchObject({
      scopeLinesMatchAllowlist: false,
      passed: false,
    });
    expect(check(unsupportedQualityClaim)).toMatchObject({
      scopeLinesMatchAllowlist: false,
      passed: false,
    });
    expect(check(incorrectFormula)).toMatchObject({
      scopeLinesMatchAllowlist: false,
      completionFormulaDisclosurePresent: false,
      passed: false,
    });
    expect(check(completenessClaim).unsupportedClaimPresent).toBe(true);
    expect(check(qualifiedBoundary).scopeLinesMatchAllowlist).toBe(false);
    expect(check(unsupportedAbsence).unsupportedClaimPresent).toBe(true);
    expect(check(noTrendCaveat).noHistoricalTrendClaimPresent).toBe(false);
    expect(check(validAnswer, argumentsValue, incorrectSourceFormula)).toMatchObject({
      resultSourceContractPassed: false,
      passed: false,
    });
    expect(extraArgument.queryArgumentsMatch).toBe(false);
    expect(wrongTool.toolNameMatch).toBe(false);
    expect(wrongIds.queryArgumentsMatch).toBe(false);
    expect(malformedMetric).toMatchObject({ malformedMetricRows: 1, passed: false });
  });

  it('requires exact integer values and deltas for reported episode metrics', () => {
    const fractionalEpisodes = validAnswer.replace(
      'episodesReported｜A=28｜B=24｜B-A=-4',
      'episodesReported｜A=28.4｜B=24.4｜B-A=-3.6',
    );
    const fractionalTotal = validAnswer.replace(
      'totalEpisodesReported｜A=28｜B=26｜B-A=-2',
      'totalEpisodesReported｜A=28.4｜B=26.4｜B-A=-2',
    );
    const fractionalDelta = validAnswer.replace(
      'episodesReported｜A=28｜B=24｜B-A=-4',
      'episodesReported｜A=28｜B=24｜B-A=-3.6',
    );

    expect(check(fractionalEpisodes)).toMatchObject({ mismatchedMetricRows: 1, passed: false });
    expect(check(fractionalTotal)).toMatchObject({ mismatchedMetricRows: 1, passed: false });
    expect(check(fractionalDelta)).toMatchObject({ mismatchedMetricRows: 1, passed: false });
  });

  it('creates an allowlisted sanitized report without prompt, answer, or metric values', () => {
    const answerCheck = check();
    const report = createSanitizedG15CanaryReport({
      createdOn: '2026-10-05',
      candidate: {
        sha: 'a'.repeat(40),
        baseSha: 'b'.repeat(40),
        catalogSha256: 'c'.repeat(64),
        agentImageRevision: 'a'.repeat(40),
        cliVersion: '1.2.14',
      },
      completedBangumiToolCalls: 1,
      otherCompletedToolEvents: 0,
      textReadbackAvailable: true,
      textProjectionBytes: 3000,
      separateStructuredContentExposed: false,
      preservationRegressionPassed: true,
      probeProcessExitCode: 0,
      resultStatus: 'SUCCESS',
      answerCheck,
    });
    const serialized = JSON.stringify(report);

    expect(report).toMatchObject({
      evidenceKind: 'g15_current_candidate_subject_comparison_agent_canary',
      call: {
        tool: 'bangumi.get_subject_comparison',
        subjectIds: [400602, 420628],
        completedBangumiToolCalls: 1,
        onlyAllowedToolCompleted: true,
      },
      answerCheck: { passed: true, metricRowsMatched: 4 },
      frontierStatus: 'PARTIAL',
      passed: true,
    });
    expect(serialized).not.toContain(validAnswer);
    expect(serialized).not.toContain('8.6');
    expect(serialized).not.toContain('7.5');
    expect(serialized).not.toContain('42%');
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('rawMcpResult');
  });

  it('rejects malformed report metadata, Candidate/image mismatches, and nested checker values', () => {
    const input = {
      createdOn: '2026-10-05',
      candidate: {
        sha: 'a'.repeat(40),
        baseSha: 'b'.repeat(40),
        catalogSha256: 'c'.repeat(64),
        agentImageRevision: 'a'.repeat(40),
        cliVersion: '1.2.14',
      },
      completedBangumiToolCalls: 1,
      otherCompletedToolEvents: 0,
      textReadbackAvailable: true,
      textProjectionBytes: 3000,
      separateStructuredContentExposed: false,
      preservationRegressionPassed: true,
      probeProcessExitCode: 0,
      resultStatus: 'SUCCESS',
      answerCheck: check(),
    };
    const nestedCheckerValue = {
      ...check(),
      passed: { rawAnswer: validAnswer },
    } as unknown as typeof input.answerCheck;
    const unrecognizedCheckerValue = {
      ...check(),
      rawResult: { metricValue: 'private-payload-sentinel' },
    } as typeof input.answerCheck & { rawResult: unknown };

    expect(() => createSanitizedG15CanaryReport({ ...input, textProjectionBytes: -1 })).toThrow();
    expect(() =>
      createSanitizedG15CanaryReport({
        ...input,
        candidate: { ...input.candidate, agentImageRevision: 'f'.repeat(40) },
      }),
    ).toThrow();
    expect(
      createSanitizedG15CanaryReport({ ...input, preservationRegressionPassed: false }).passed,
    ).toBe(false);
    expect(() =>
      createSanitizedG15CanaryReport({ ...input, answerCheck: nestedCheckerValue }),
    ).toThrow();
    expect(() =>
      createSanitizedG15CanaryReport({ ...input, answerCheck: unrecognizedCheckerValue }),
    ).toThrow();
  });

  it('accepts probe input over stdin and emits only the sanitized checker summary', () => {
    const probe = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/acceptance/g15-agent-answer-check-cli.mjs')],
      {
        input: JSON.stringify({
          answer: validAnswer,
          toolName: 'bangumi.get_subject_comparison',
          queryArguments: argumentsValue,
          toolOutput: result,
        }),
        encoding: 'utf8',
      },
    );

    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout)).toMatchObject({ passed: true, metricRowsMatched: 4 });
    expect(probe.stdout).not.toContain('8.6');
    expect(probe.stdout).not.toContain(validAnswer);
  });

  it('accepts sanitized report metadata over stdin without a raw answer payload', () => {
    const probe = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/acceptance/g15-agent-answer-check-cli.mjs')],
      {
        input: JSON.stringify({
          mode: 'report',
          createdOn: '2026-10-05',
          candidate: {
            sha: 'a'.repeat(40),
            baseSha: 'b'.repeat(40),
            catalogSha256: 'c'.repeat(64),
            agentImageRevision: 'a'.repeat(40),
            cliVersion: '1.2.14',
          },
          completedBangumiToolCalls: 1,
          otherCompletedToolEvents: 0,
          textReadbackAvailable: true,
          textProjectionBytes: 3000,
          separateStructuredContentExposed: false,
          preservationRegressionPassed: true,
          probeProcessExitCode: 0,
          resultStatus: 'SUCCESS',
          answerCheck: check(),
        }),
        encoding: 'utf8',
      },
    );
    const report = JSON.parse(probe.stdout);

    expect(probe.status).toBe(0);
    expect(report).toMatchObject({ passed: true, frontierStatus: 'PARTIAL' });
    expect(probe.stdout).not.toContain('8.6');
    expect(probe.stdout).not.toContain(validAnswer);
  });

  it('fails closed on nested report checker values without echoing their contents', () => {
    const sentinel = 'private-report-payload-sentinel';
    const probe = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/acceptance/g15-agent-answer-check-cli.mjs')],
      {
        input: JSON.stringify({
          mode: 'report',
          createdOn: '2026-10-05',
          candidate: {
            sha: 'a'.repeat(40),
            baseSha: 'b'.repeat(40),
            catalogSha256: 'c'.repeat(64),
            agentImageRevision: 'a'.repeat(40),
            cliVersion: '1.2.14',
          },
          completedBangumiToolCalls: 1,
          otherCompletedToolEvents: 0,
          textReadbackAvailable: true,
          textProjectionBytes: 3000,
          separateStructuredContentExposed: false,
          preservationRegressionPassed: true,
          probeProcessExitCode: 0,
          resultStatus: 'SUCCESS',
          answerCheck: { ...check(), rawResult: { sentinel } },
        }),
        encoding: 'utf8',
      },
    );

    expect(probe.status).toBe(2);
    expect(JSON.parse(probe.stdout)).toEqual({
      passed: false,
      failureClass: 'INVALID_PROBE_INPUT',
    });
    expect(probe.stdout).not.toContain(sentinel);
    expect(probe.stdout).not.toContain(validAnswer);
  });
});
