export const L04_SYNTHETIC_COLLECTION_INPUT = { maxItems: 20 };

export const L04_SYNTHETIC_COLLECTION_FACTS = {
  topTag: '航海',
  topTagCount: 7,
  observedRows: 20,
  sourceTotal: 30,
  state: 'partial',
};

const NON_INFERENCE_TERM =
  '(?:偏好|口味|喜欢|喜好|爱好|兴趣|倾向|品味|推荐|建议|适合|适宜)';
const NON_INFERENCE_CAVEAT = new RegExp(
  `(?:不能|不足以|不代表|不能直接|不可据此|无法|不推荐|不应推荐)[^。！？!?;；,，\\n]{0,36}?${NON_INFERENCE_TERM}(?:(?:或|和|与|及|以及|、|/)\\s*${NON_INFERENCE_TERM})*`,
  'u',
);
const NON_INFERENCE_CAVEATS = new RegExp(NON_INFERENCE_CAVEAT.source, 'gu');
const UNSUPPORTED_USER_INFERENCE =
  /(?:偏好|口味|喜欢|喜好|偏爱|爱好|兴趣|倾向|品味|嗜好|推荐|建议|适合|适宜|值得(?:一看|推荐)?|安利)/u;
const FULL_SCOPE_CLAIM = /(?<!不)(?:全量|完整)(?:的)?(?:收藏|条目)|(?:所有|全部)(?:收藏|条目)(?:都)?/gu;
const CLAIM_CLAUSE_BREAK = /(?:但是|然而|不过|可是|反而|相反|而是|只是|同时|另外|却|但)|[。！？!?;；,，\n]/u;
const NEGATED_FULL_SCOPE_PREFIX = /(?:不代表|不意味着|不能|无法|并非|不是|不属于|未覆盖|未包含|不包括|不等于|非)[^。！？!?;；,，\n]{0,14}$/u;
const TOP_TAG_RANKING = /(?:最常见|最多|频次最高|出现最多|数量最多|最高频|排名第一|第一位|top|most)/iu;
const TAG_CLAIM_NEGATION = /(?:并非|不是|并不是|不|未|不能|无法|非|绝非)/u;
const TAG_COUNT_CUE = /(?:出现(?:了)?|频次|次数|计数|数量|统计|共|合计|总计|累计|为|有)/u;
const TAG_COUNT_ASSOCIATION_FILLER =
  /^(?:(?:标签|出现(?:了)?|频次|次数|计数|数量|统计|共|合计|总计|累计|为|有|是|最多|最常见|频次最高|数量最多|最高频|排名第一|第一位|的|次|个|条|项|tag|top|most)|[^\p{L}\p{N}])*$/iu;
const COUNT_ONLY_CONTEXT =
  /^(?:(?:出现(?:了)?|频次|次数|计数|数量|统计|共|合计|总计|累计|为|有|次|个|条|项|count|times|items?)|[^\p{L}\p{N}])*$/iu;
const TOP_RANKING_CONTINUATION =
  /^(?:(?:它|该标签|这个标签)(?:也)?是|是|且是|而且是)?(?:本次|本|当前)?(?:出现)?(?:最多|最常见|频次最高|数量最多|最高频|排名第一|第一位)(?:的)?(?:标签|tag)?/iu;
const NUMBER_CHARACTERS = '\\p{N}零〇一二三四五六七八九十百千万两';
const SYNTHETIC_DISCLOSURE = /(?:合成(?:的)?(?:测试)?(?:样例|样本|数据|账户|集合)|测试(?:样例|样本|数据)|模拟(?:的)?(?:样例|样本|数据|账户|集合)|虚构(?:的)?(?:样例|样本|数据|账户|集合)|synthetic)/iu;
const NEGATED_SYNTHETIC_DISCLOSURE = /(?:不(?:是|算)|并非|并不是|非|不属于|not|never)[^。！？!?;；,，\n]{0,10}(?:合成|测试|模拟|虚构|synthetic)/iu;
const NEGATED_REAL_USER_PROVENANCE = /(?:不(?:是|属于|来自)|并非|不是|并不是|非)[^。！？!?;；,，\n]{0,12}(?:你的|用户的|当前用户|真实用户|真实(?:收藏|账号|账户|数据))/gu;
const REAL_USER_PROVENANCE = /(?:你的|用户的|当前用户的)[^。！？!?;；,，\n]{0,8}(?:真实|实际)(?:的)?(?:收藏|账号|账户|数据)|(?:真实用户|真实账号|真实账户|真实收藏)(?:的)?|(?:来自|属于|源于|实际上是|实际上来自|基于)[^。！？!?;；,，\n]{0,8}(?:你(?:的)?|用户(?:的)?|真实用户|真实账户)/u;

function exactNumberForms(value) {
  if (value === 7) return ['7', '七'];
  if (value === 20) return ['20', '二十'];
  if (value === 30) return ['30', '三十'];
  return [String(value)];
}

function exactNumberSource(value) {
  const forms = exactNumberForms(value).map(escapeRegExp).join('|');
  return `(?<![${NUMBER_CHARACTERS}])(?:${forms})(?![${NUMBER_CHARACTERS}])`;
}

function hasExactNumber(text, value) {
  return new RegExp(exactNumberSource(value), 'u').test(text);
}

function hasRealUserProvenanceClaim(text) {
  NEGATED_REAL_USER_PROVENANCE.lastIndex = 0;
  return REAL_USER_PROVENANCE.test(text.replace(NEGATED_REAL_USER_PROVENANCE, ' '));
}

function hasSyntheticDisclosure(text) {
  const clauses = text.split(CLAIM_CLAUSE_BREAK);
  return (
    clauses.some(
      (clause) => SYNTHETIC_DISCLOSURE.test(clause) && !NEGATED_SYNTHETIC_DISCLOSURE.test(clause),
    ) && !clauses.some((clause) => NEGATED_SYNTHETIC_DISCLOSURE.test(clause))
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function hasExactTagCount(text) {
  const tag = escapeRegExp(L04_SYNTHETIC_COLLECTION_FACTS.topTag);
  const exactCount = new RegExp(exactNumberSource(L04_SYNTHETIC_COLLECTION_FACTS.topTagCount), 'gu');
  const countTokens = (segment) => [...segment.matchAll(exactCount)];
  const tagIndexes = (segment) => [...segment.matchAll(new RegExp(tag, 'gu'))].map((match) => match.index ?? 0);
  const hasCountEvidence = (segment) =>
    countTokens(segment).some((match) => {
      const index = match.index ?? 0;
      const before = segment.slice(Math.max(0, index - 12), index);
      const after = segment.slice(index + match[0].length, index + match[0].length + 8);
      return TAG_COUNT_CUE.test(before) || /^(?:\s*(?:次|个|条|项))/u.test(after);
    });
  const hasTagCountInSegment = (segment) => {
    const indexes = tagIndexes(segment);
    const counts = countTokens(segment);
    return indexes.some((tagIndex) =>
      counts.some((countMatch) => {
        if (!hasCountEvidence(segment)) return false;
        const countIndex = countMatch.index ?? 0;
        const countEnd = countIndex + countMatch[0].length;
        const tagEnd = tagIndex + L04_SYNTHETIC_COLLECTION_FACTS.topTag.length;
        if (Math.abs(countIndex - tagIndex) > 24) return false;
        const between = countIndex >= tagEnd
          ? segment.slice(tagEnd, countIndex)
          : segment.slice(countEnd, tagIndex);
        return TAG_COUNT_ASSOCIATION_FILLER.test(between);
      }),
    );
  };
  const hasBareCount = (segment) =>
    countTokens(segment).some((match) => {
      const index = match.index ?? 0;
      const remaining = segment.slice(0, index) + segment.slice(index + match[0].length);
      return hasCountEvidence(segment) && COUNT_ONLY_CONTEXT.test(remaining);
    });
  const hasPositiveTopTagClaim = (segment) =>
    tagIndexes(segment).some((index) => {
      const nearby = segment.slice(Math.max(0, index - 16), index + L04_SYNTHETIC_COLLECTION_FACTS.topTag.length + 16);
      return TOP_TAG_RANKING.test(nearby) && !TAG_CLAIM_NEGATION.test(nearby);
    });

  for (const sentence of text.split(/(?:但是|然而|不过|可是|反而|相反|却|而是|只是|但)|[。！？!?;；\n]/u)) {
    const commaParts = sentence.split(/[,，]/u);
    for (const segment of commaParts) {
      if (hasPositiveTopTagClaim(segment) && hasTagCountInSegment(segment)) return true;
    }
    for (let index = 0; index < commaParts.length - 1; index += 1) {
      if (
        (hasPositiveTopTagClaim(commaParts[index]) && hasBareCount(commaParts[index + 1])) ||
        (hasTagCountInSegment(commaParts[index]) && TOP_RANKING_CONTINUATION.test(commaParts[index + 1].trim()))
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasPositivePreferenceClaim(text) {
  return text.split(CLAIM_CLAUSE_BREAK).some((clause) => {
    NON_INFERENCE_CAVEATS.lastIndex = 0;
    const withoutCaveats = clause.replace(NON_INFERENCE_CAVEATS, ' ').trim();
    return UNSUPPORTED_USER_INFERENCE.test(withoutCaveats);
  });
}

function hasNonInferenceCaveat(text) {
  return NON_INFERENCE_CAVEAT.test(text);
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
  const nonInferenceCaveatPresent = hasNonInferenceCaveat(text);
  const noUnsupportedPreferenceClaim = !hasPositivePreferenceClaim(text);
  const checks = {
    nonEmpty: text.length > 0,
    syntheticContextDisclosed: hasSyntheticDisclosure(text),
    noRealUserProvenanceClaim: !hasRealUserProvenanceClaim(text),
    nonInferenceCaveatPresent,
    noUnsupportedPreferenceClaim,
    topObservedTagPresent: text.includes(L04_SYNTHETIC_COLLECTION_FACTS.topTag),
    topObservedTagCountPresent: hasExactTagCount(text),
    observedDenominatorPresent: hasExactNumber(text, L04_SYNTHETIC_COLLECTION_FACTS.observedRows),
    sourceTotalPresent: hasExactNumber(text, L04_SYNTHETIC_COLLECTION_FACTS.sourceTotal),
    partialCoverageDisclosed: /(?:部分|未完整|不完整|partial)/iu.test(text),
    noPreferenceInference: nonInferenceCaveatPresent && noUnsupportedPreferenceClaim,
    noFullCollectionClaim: !hasPositiveFullScopeClaim(text),
  };
  return { accepted: Object.values(checks).every(Boolean), checks };
}
