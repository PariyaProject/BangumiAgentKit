import { describe, expect, it } from 'vitest';
import { checkL04CollectionIntelligenceAnswer } from '../../scripts/acceptance/l04-collection-intelligence-answer-check.mjs';

describe('L04 synthetic collection-intelligence answer check', () => {
  it('accepts the grounded partial-sample answer without inferring taste', () => {
    const result = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；本次观察了 20 条，源报告共 30 条，所以只覆盖部分收藏。这只是样本频次，不能据此判断你的偏好。',
    );

    expect(result).toEqual({
      accepted: true,
      checks: {
        nonEmpty: true,
        syntheticContextDisclosed: true,
        topObservedTagPresent: true,
        topObservedTagCountPresent: true,
        observedDenominatorPresent: true,
        sourceTotalPresent: true,
        partialCoverageDisclosed: true,
        noPreferenceInference: true,
        noFullCollectionClaim: true,
      },
    });
  });

  it('rejects a guessed preference, missing coverage, or an answer about the full collection', () => {
    const guessed = checkL04CollectionIntelligenceAnswer(
      '航海是你最喜欢的标签；我看了 20 条中的 7 条。',
    );
    const missingCoverage = checkL04CollectionIntelligenceAnswer('合成样例中，航海标签出现 7 次。');
    const overclaim = checkL04CollectionIntelligenceAnswer(
      '合成样例中，你的完整收藏里航海标签出现 7 次，共 20 条，源报告 30 条。不能据此判断你的偏好。',
    );

    expect(guessed.accepted).toBe(false);
    expect(guessed.checks.noPreferenceInference).toBe(false);
    expect(missingCoverage.accepted).toBe(false);
    expect(overclaim.accepted).toBe(false);
    expect(overclaim.checks.noFullCollectionClaim).toBe(false);
    expect(
      checkL04CollectionIntelligenceAnswer(
        '合成样例观察到 20 条、源报告 30 条，只能说明这部分收藏，不能代表完整收藏，也不能据此判断偏好；航海标签出现 7 次。',
      ).checks.noFullCollectionClaim,
    ).toBe(true);
  });
});
