export const L04_SYNTHETIC_COLLECTION_INPUT = { maxItems: 20 };

export const L04_SYNTHETIC_COLLECTION_FACTS = {
  topTag: '航海',
  topTagCount: 7,
  observedRows: 20,
  sourceTotal: 30,
  state: 'partial',
};

const NON_INFERENCE_CAVEAT =
  /(?:不能|不足以|不代表|不能直接|不可据此)[^。！？!?;；,，\n]{0,32}?(?:偏好|口味|喜欢|爱好)/u;
const NON_INFERENCE_CAVEATS = new RegExp(NON_INFERENCE_CAVEAT.source, 'gu');
const POSITIVE_PREFERENCE_CLAIMS = [
  /(?:你|用户)(?:目前|最|更)?(?:偏好|喜欢|偏爱|爱好)(?:是|为|就是|在于)?/u,
  /[^。！？!?;；,，\n]{0,12}(?:是你|是用户)(?:目前|最|更)?(?:偏好|喜欢|偏爱|爱好)(?:的)?/u,
];
const FULL_SCOPE_CLAIM = /(?:全量|完整)(?:的)?(?:收藏|条目)|(?:所有|全部)(?:收藏|条目)(?:都)?/gu;
const CLAIM_CLAUSE_BREAK = /(?:但是|然而|不过|可是|但)|[。！？!?;；,，\n]/u;
const NEGATED_FULL_SCOPE_PREFIX = /(?:不代表|不意味着|不能|无法|并非|不是|不|未)[^。！？!?;；,，\n]{0,14}$/u;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function hasExactTagCount(text) {
  const tag = escapeRegExp(L04_SYNTHETIC_COLLECTION_FACTS.topTag);
  const count = L04_SYNTHETIC_COLLECTION_FACTS.topTagCount;
  const countForms = count === 7 ? ['7', '七'] : [String(count)];
  const numberCharacters = '\\p{N}零〇一二三四五六七八九十百千万两';
  const exactNumber = `(?<![${numberCharacters}])(?:${countForms.join('|')})(?![${numberCharacters}])`;
  const optionalUnit = '(?:\\s*(?:次|个|条|项))?';
  const between = '[^。！？!?;；\\n]{0,40}';
  const countAfterTag = new RegExp(`${tag}${between}${exactNumber}${optionalUnit}`, 'u');
  const countBeforeTag = new RegExp(`${exactNumber}${optionalUnit}${between}${tag}`, 'u');
  return countAfterTag.test(text) || countBeforeTag.test(text);
}

function hasPositivePreferenceClaim(text) {
  return text.split(CLAIM_CLAUSE_BREAK).some((clause) => {
    NON_INFERENCE_CAVEATS.lastIndex = 0;
    const withoutCaveats = clause.replace(NON_INFERENCE_CAVEATS, ' ').trim();
    return POSITIVE_PREFERENCE_CLAIMS.some((pattern) => pattern.test(withoutCaveats));
  });
}

function hasPositiveFullScopeClaim(text) {
  for (const clause of text.split(CLAIM_CLAUSE_BREAK)) {
    FULL_SCOPE_CLAIM.lastIndex = 0;
    for (const match of clause.matchAll(FULL_SCOPE_CLAIM)) {
      const prefix = clause.slice(0, match.index ?? 0);
      if (!NEGATED_FULL_SCOPE_PREFIX.test(prefix)) return true;
    }
  }
  return false;
}

export function checkL04CollectionIntelligenceAnswer(answer) {
  const text = typeof answer === 'string' ? answer.trim() : '';
  const checks = {
    nonEmpty: text.length > 0,
    syntheticContextDisclosed: /(?:合成|测试|样例)/u.test(text),
    topObservedTagPresent: text.includes(L04_SYNTHETIC_COLLECTION_FACTS.topTag),
    topObservedTagCountPresent: hasExactTagCount(text),
    observedDenominatorPresent: /20/u.test(text),
    sourceTotalPresent: /30/u.test(text),
    partialCoverageDisclosed: /(?:部分|未完整|不完整|partial)/iu.test(text),
    noPreferenceInference:
      NON_INFERENCE_CAVEAT.test(text) && !hasPositivePreferenceClaim(text),
    noFullCollectionClaim: !hasPositiveFullScopeClaim(text),
  };
  return { accepted: Object.values(checks).every(Boolean), checks };
}
