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
        noRealUserProvenanceClaim: true,
        nonInferenceCaveatPresent: true,
        noUnsupportedPreferenceClaim: true,
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
    expect(guessed.checks.noUnsupportedPreferenceClaim).toBe(false);
    expect(missingCoverage.accepted).toBe(false);
    expect(overclaim.accepted).toBe(false);
    expect(overclaim.checks.noFullCollectionClaim).toBe(false);
    expect(
      checkL04CollectionIntelligenceAnswer(
        '合成样例观察到 20 条、源报告 30 条，只能说明这部分收藏，不能代表完整收藏，也不能据此判断偏好；航海标签出现 7 次。',
      ).checks.noFullCollectionClaim,
    ).toBe(true);
  });

  it('rejects a tag count embedded in a different larger number', () => {
    const wrongCount = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 17 次；本次观察了 20 条，源报告共 30 条，所以只覆盖部分收藏。这只是样本频次，不能据此判断你的偏好。',
    );

    expect(wrongCount.accepted).toBe(false);
    expect(wrongCount.checks.topObservedTagCountPresent).toBe(false);
  });

  it('does not attach another tag’s count to the named top tag', () => {
    const wrongAttribution = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海并非最多的标签，科幻出现 7 次；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );
    const wrongPositiveAttribution = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海是最多的标签，科幻出现 7 次；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );
    const unrankedCount = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(wrongAttribution.accepted).toBe(false);
    expect(wrongAttribution.checks.topObservedTagCountPresent).toBe(false);
    expect(wrongPositiveAttribution.accepted).toBe(false);
    expect(wrongPositiveAttribution.checks.topObservedTagCountPresent).toBe(false);
    expect(unrankedCount.accepted).toBe(false);
    expect(unrankedCount.checks.topObservedTagCountPresent).toBe(false);
  });

  it('requires exact whole-number coverage denominators', () => {
    const wrongDenominators = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次；本次观察 120 条，源报告 300 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(wrongDenominators.accepted).toBe(false);
    expect(wrongDenominators.checks.observedDenominatorPresent).toBe(false);
    expect(wrongDenominators.checks.sourceTotalPresent).toBe(false);
  });

  it('accepts the exact count in Chinese numerals without matching a larger number', () => {
    const exactChineseCount = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现七次，是本次出现最多的标签；本次观察了 20 条，源报告共 30 条，所以只覆盖部分收藏。这只是样本频次，不能据此判断你的偏好。',
    );
    const largerChineseCount = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现十七次；本次观察了 20 条，源报告共 30 条，所以只覆盖部分收藏。这只是样本频次，不能据此判断你的偏好。',
    );

    expect(exactChineseCount.checks.topObservedTagCountPresent).toBe(true);
    expect(largerChineseCount.checks.topObservedTagCountPresent).toBe(false);
  });

  it('associates a bare exact count with the top tag within the same sentence', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '合成样例中，出现最多的是航海标签，频次为 7；本次观察了 20 条，源报告共 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(answer.checks.topObservedTagCountPresent).toBe(true);
  });

  it('associates a spaced count unit with a positive top-tag claim', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '合成样例中，出现最多的是航海，7 次；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(answer.checks.topObservedTagCountPresent).toBe(true);
  });

  it('rejects a ranking continuation that names a different top tag', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，最多的标签是科幻；本次观察了 20 条，源报告共 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(answer.accepted).toBe(false);
    expect(answer.checks.topObservedTagCountPresent).toBe(false);
  });

  it('requires positive exact assertions for both coverage denominators', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；本次不是 20 条，源报告也不是 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(answer.accepted).toBe(false);
    expect(answer.checks.observedDenominatorPresent).toBe(false);
    expect(answer.checks.sourceTotalPresent).toBe(false);
  });

  it('does not find a positive denominator by matching after a negated prefix', () => {
    const negatedObserved = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；本次未观察到 20 条记录，源报告共 30 条，覆盖部分收藏，不能据此判断偏好。',
    );
    const negatedSourceTotal = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；本次观察到 20 条记录，源报告未报告总数为 30 条记录，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(negatedObserved.accepted).toBe(false);
    expect(negatedObserved.checks.observedDenominatorPresent).toBe(false);
    expect(negatedSourceTotal.accepted).toBe(false);
    expect(negatedSourceTotal.checks.sourceTotalPresent).toBe(false);
  });

  it('rejects enthusiasm claims that infer a user preference', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；你肯定会爱上航海，但不能据此判断偏好。本次观察了 20 条，源报告共 30 条，覆盖部分收藏。',
    );

    expect(answer.accepted).toBe(false);
    expect(answer.checks.noPreferenceInference).toBe(false);
    expect(answer.checks.noUnsupportedPreferenceClaim).toBe(false);
  });

  it('rejects a direct preference claim even when a later clause adds a disclaimer', () => {
    const inferred = checkL04CollectionIntelligenceAnswer(
      '合成样例中，你喜欢航海；这不能说明偏好。本次观察了 20 条，源报告共 30 条，覆盖部分收藏，航海标签出现 7 次。',
    );

    expect(inferred.accepted).toBe(false);
    expect(inferred.checks.noPreferenceInference).toBe(false);
    expect(inferred.checks.nonInferenceCaveatPresent).toBe(true);
    expect(inferred.checks.noUnsupportedPreferenceClaim).toBe(false);
  });

  it('does not let a same-clause caveat erase a direct preference claim', () => {
    const inferred = checkL04CollectionIntelligenceAnswer(
      '合成样例中，你喜欢航海且不能据此判断偏好；本次观察了 20 条，源报告共 30 条，覆盖部分收藏，航海标签出现 7 次。',
    );

    expect(inferred.accepted).toBe(false);
    expect(inferred.checks.noPreferenceInference).toBe(false);
  });

  it('rejects possessive and uncertain preference wording followed by a caveat', () => {
    const inferred = checkL04CollectionIntelligenceAnswer(
      '合成样例中，你的偏好可能是航海；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(inferred.accepted).toBe(false);
    expect(inferred.checks.noPreferenceInference).toBe(false);
  });

  it('rejects personalized recommendations even when followed by a preference disclaimer', () => {
    const recommendation = checkL04CollectionIntelligenceAnswer(
      '合成样例中，建议你看航海类作品；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(recommendation.accepted).toBe(false);
    expect(recommendation.checks.noPreferenceInference).toBe(false);
  });

  it('does not let an unrelated sample qualifier negate a later full-collection claim', () => {
    const overclaim = checkL04CollectionIntelligenceAnswer(
      '合成样例中，我们只观察了 20 条，但你的完整收藏中航海标签出现 7 次，源报告共 30 条，覆盖部分收藏；不能据此判断你的偏好。',
    );

    expect(overclaim.accepted).toBe(false);
    expect(overclaim.checks.noFullCollectionClaim).toBe(false);
  });

  it('does not let “incomplete sample” negate a full-collection claim after a contrast', () => {
    const overclaim = checkL04CollectionIntelligenceAnswer(
      '合成样例中，样本不完整却显示你的完整收藏里航海标签出现 7 次；本次观察 20 条，源报告 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(overclaim.accepted).toBe(false);
    expect(overclaim.checks.noFullCollectionClaim).toBe(false);
  });

  it('does not let an uncovered-sample phrase negate a later full-collection claim after 而', () => {
    const overclaim = checkL04CollectionIntelligenceAnswer(
      '合成样例中，航海标签出现 7 次，是本次出现最多的标签；样本未覆盖全量而你的完整收藏中航海标签出现 7 次；本次观察了 20 条，源报告共 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(overclaim.accepted).toBe(false);
    expect(overclaim.checks.noFullCollectionClaim).toBe(false);
  });

  it('rejects a negated synthetic disclosure and real-user provenance claims', () => {
    const negatedSynthetic = checkL04CollectionIntelligenceAnswer(
      '合成样例中，这不是合成样例，而是你的真实收藏：航海标签出现 7 次；观察 20 条，源报告 30 条，结果部分，不能据此判断偏好。',
    );
    const realProvenance = checkL04CollectionIntelligenceAnswer(
      '合成样例的答案实际来自你的真实收藏：航海标签出现 7 次；观察 20 条，源报告 30 条，结果部分，不能据此判断偏好。',
    );

    expect(negatedSynthetic.accepted).toBe(false);
    expect(negatedSynthetic.checks.syntheticContextDisclosed).toBe(false);
    expect(realProvenance.accepted).toBe(false);
    expect(realProvenance.checks.syntheticContextDisclosed).toBe(true);
    expect(realProvenance.checks.noRealUserProvenanceClaim).toBe(false);
  });

  it('rejects a synthetic disclosure explicitly denied with 不能算作', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '这个输出不能算作合成样例；航海标签出现 7 次，是本次出现最多的标签；本次观察了 20 条，源报告共 30 条，覆盖部分收藏，不能据此判断偏好。',
    );

    expect(answer.accepted).toBe(false);
    expect(answer.checks.syntheticContextDisclosed).toBe(false);
  });

  it('accepts an explicit caveat that the synthetic sample is not the real user collection', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '这是合成测试样本，不代表你的真实收藏。航海标签出现 7 次，是本次出现最多的标签；本次观察 20 条，源报告总数为 30 条，覆盖部分收藏；这些频次不能说明你的个人偏好。',
    );

    expect(answer.accepted).toBe(true);
    expect(answer.checks.noRealUserProvenanceClaim).toBe(true);
  });

  it('accepts clear synthetic-sample and non-inference wording variants', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '这是合成测试样本：航海标签出现 7 次，是本次出现最多的标签；本次观察 20 条，源报告 30 条，覆盖部分收藏。这些标签频次不足以说明你的个人喜好或偏好。',
    );

    expect(answer.accepted).toBe(true);
    expect(answer.checks.syntheticContextDisclosed).toBe(true);
    expect(answer.checks.nonInferenceCaveatPresent).toBe(true);
    expect(answer.checks.noPreferenceInference).toBe(true);
  });

  it('checks the actual randomized fixture facts rather than only the default fixture', () => {
    const facts = {
      topTag: '历史',
      topTagCount: 8,
      observedRows: 16,
      sourceTotal: 39,
      state: 'partial',
    };
    const answer = checkL04CollectionIntelligenceAnswer(
      '这是合成测试样本。历史标签出现 8 次，是本次出现最多的标签；本次观察 16 条，上游报告总量 39 条，覆盖部分收藏；这些标签频次不足以说明你的个人偏好。',
      facts,
    );

    expect(answer.accepted).toBe(true);
    expect(answer.checks.topObservedTagPresent).toBe(true);
    expect(answer.checks.topObservedTagCountPresent).toBe(true);
    expect(answer.checks.observedDenominatorPresent).toBe(true);
    expect(answer.checks.sourceTotalPresent).toBe(true);
  });

  it('allows “your collection” wording when the answer clearly identifies a synthetic sample', () => {
    const answer = checkL04CollectionIntelligenceAnswer(
      '这是合成测试样本。你的收藏中航海标签出现 7 次，是本次出现最多的标签；观察 20 条，源报告 30 条，覆盖部分收藏；这些标签频次不足以说明你的个人喜好或偏好。',
    );

    expect(answer.accepted).toBe(true);
    expect(answer.checks.noRealUserProvenanceClaim).toBe(true);
  });
});
