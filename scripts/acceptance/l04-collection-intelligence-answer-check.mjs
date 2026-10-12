export const L04_SYNTHETIC_COLLECTION_INPUT = { maxItems: 20 };

export const L04_SYNTHETIC_COLLECTION_FACTS = {
  topTag: '航海',
  topTagCount: 7,
  observedRows: 20,
  sourceTotal: 30,
  state: 'partial',
};

const NON_INFERENCE_CAVEAT =
  /(?:不能|不足以|不代表|不能直接|不可据此)[^。！？\n]{0,28}(?:偏好|口味|喜欢|爱好)/u;
const POSITIVE_PREFERENCE_CLAIM =
  /(?:你|用户)(?:目前|最|更)?(?:偏好|喜欢|偏爱|爱好)(?:是|为|就是|在于)/u;
const FULL_SCOPE_CLAIM = /(?:全量|完整)(?:的)?(?:收藏|条目)|(?:所有|全部)(?:收藏|条目)(?:都)?/gu;
const NEGATED_FULL_SCOPE_PREFIX = /(?:不|并非|不能|无法|不是|不代表|不意味着|未|只|仅)/u;

function hasPositiveFullScopeClaim(text) {
  for (const match of text.matchAll(FULL_SCOPE_CLAIM)) {
    const index = match.index ?? 0;
    const sentenceStart = Math.max(
      text.lastIndexOf('。', index),
      text.lastIndexOf('！', index),
      text.lastIndexOf('？', index),
      text.lastIndexOf(';', index),
      text.lastIndexOf('；', index),
      text.lastIndexOf('\n', index),
    );
    const prefix = text.slice(Math.max(sentenceStart + 1, index - 24), index);
    if (!NEGATED_FULL_SCOPE_PREFIX.test(prefix)) return true;
  }
  return false;
}

export function checkL04CollectionIntelligenceAnswer(answer) {
  const text = typeof answer === 'string' ? answer.trim() : '';
  const checks = {
    nonEmpty: text.length > 0,
    syntheticContextDisclosed: /(?:合成|测试|样例)/u.test(text),
    topObservedTagPresent: text.includes(L04_SYNTHETIC_COLLECTION_FACTS.topTag),
    topObservedTagCountPresent: new RegExp(
      `(?:${L04_SYNTHETIC_COLLECTION_FACTS.topTagCount}\\s*(?:次|个|条|项)?|(?:次|个|条|项)?\\s*${L04_SYNTHETIC_COLLECTION_FACTS.topTagCount})`,
      'u',
    ).test(text),
    observedDenominatorPresent: /20/u.test(text),
    sourceTotalPresent: /30/u.test(text),
    partialCoverageDisclosed: /(?:部分|未完整|不完整|partial)/iu.test(text),
    noPreferenceInference: NON_INFERENCE_CAVEAT.test(text) && !POSITIVE_PREFERENCE_CLAIM.test(text),
    noFullCollectionClaim: !hasPositiveFullScopeClaim(text),
  };
  return { accepted: Object.values(checks).every(Boolean), checks };
}
