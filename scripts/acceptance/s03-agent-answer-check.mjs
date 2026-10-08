export const S03_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  subjectId: 329906,
  depth: 0,
  maxNodes: 8,
  media: 'anime',
  voiceActorPersonId: 7602,
  maxVoiceCredits: 120,
});

export const S03_ANSWER_CHECK_METHOD = 's03-series-voice-overlap-answer-v1';

const COVERAGE_FIELDS = [
  'relationRowsObserved',
  'eligibleDirectAnimeWorksObserved',
  'eligibleDirectAnimeWorksSelected',
  'eligibleDirectAnimeWorksOmitted',
  'personRowsObserved',
  'personRowsReturned',
  'personRowsOmitted',
  'matchedCreditRows',
  'duplicateRows',
  'schemaDriftRows',
  'maxRelatedAnimeWorks',
  'maxVoiceCredits',
  'maxResponseBytes',
  'truncated',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAnswer(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readToolResult(value) {
  if (!isRecord(value)) return null;
  if (isRecord(value.structuredContent)) return value.structuredContent;
  if (isRecord(value.result)) {
    const nested = readToolResult(value.result);
    if (nested) return nested;
  }
  if (!Array.isArray(value.content)) return null;
  for (const item of value.content) {
    if (item?.type !== 'text' || typeof item.text !== 'string') continue;
    const parsed = parseAnswer(item.text);
    if (parsed && isRecord(parsed.voiceActorPresence)) return parsed;
  }
  return null;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function expectedCoverage(presence) {
  return Object.fromEntries(
    COVERAGE_FIELDS.map((field) => [field, presence.coverage?.[field] ?? null]),
  );
}

function normalizedCredits(work) {
  return (Array.isArray(work?.credits) ? work.credits : []).map((credit) => ({
    characterId: credit.characterId,
    name: credit.characterName,
    ...(credit.staff === undefined ? {} : { staff: credit.staff }),
  }));
}

function hasUnsupportedCompletenessClaim(value) {
  if (typeof value === 'string') {
    const forbiddenPhrases = /(?:完整履历|全部演出|全系列完整|官方唯一顺序)/u;
    const explicitNegation = /(?:不是|不代表|不构成|不能证明|不等于|不意味着|未能证明|没有)/u;
    return value
      .split(/[；。]/u)
      .some((clause) => forbiddenPhrases.test(clause) && !explicitNegation.test(clause));
  }
  if (Array.isArray(value)) return value.some(hasUnsupportedCompletenessClaim);
  if (isRecord(value)) return Object.values(value).some(hasUnsupportedCompletenessClaim);
  return false;
}

export function verifyS03VoiceActorOverlapAnswer(answer, queryArguments, toolOutput, toolCalls) {
  const parsedAnswer = parseAnswer(answer);
  const result = readToolResult(toolOutput);
  const presence = result?.voiceActorPresence;
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const exactSingleToolCall =
    calls.length === 1 &&
    calls[0]?.name === 'bangumi.get_series_watch_order' &&
    calls[0]?.state === 'DONE';
  const queryArgumentsMatch = sameJson(queryArguments, S03_EXPECTED_QUERY_ARGUMENTS);
  const sourceOperationValid =
    result?.subjectId === 329906 &&
    presence?.personId === 7602 &&
    presence?.sourceOperation?.operation === 'GET /v0/persons/{person_id}/characters' &&
    presence.sourceOperation.path === '/v0/persons/7602/characters' &&
    presence.sourceOperation.status === 'succeeded' &&
    Array.isArray(result?.evidence?.sources) &&
    result.evidence.sources.filter((source) => source?.personId === 7602).length === 1 &&
    result.evidence.sources.some(
      (source) =>
        source?.personId === 7602 &&
        source.path === '/v0/persons/7602/characters' &&
        source.status === 'succeeded',
    );
  const works = Array.isArray(presence?.works) ? presence.works : [];
  const subjectIds = works.map((work) => work?.subjectId);
  const observedTargetRelation = works.some(
    (work) =>
      work?.subjectId === 373267 &&
      Array.isArray(work.relationEvidence) &&
      work.relationEvidence.some(
        (relation) =>
          relation?.direction === 'outgoing_direct' &&
          relation.sourceSubjectId === 329906 &&
          relation.targetSubjectId === 373267 &&
          relation.rawRelationLabel === '续集',
      ),
  );
  const twoDistinctWorksMatched =
    presence?.matchStatus === 'multi_work_found' &&
    presence?.distinctWorks >= 2 &&
    new Set(subjectIds).size === subjectIds.length &&
    subjectIds.includes(329906) &&
    subjectIds.includes(373267);
  const boundedCoverageValid =
    presence?.coverage?.maxResponseBytes === 1_048_576 &&
    presence?.coverage?.maxVoiceCredits === 120 &&
    Number.isInteger(presence?.coverage?.personRowsObserved) &&
    Number.isInteger(presence?.coverage?.personRowsReturned) &&
    presence.coverage.personRowsReturned <= 120 &&
    presence.coverage.personRowsReturned <= presence.coverage.personRowsObserved &&
    presence.coverage.eligibleDirectAnimeWorksSelected <= 8 &&
    presence.coverage.eligibleDirectAnimeWorksOmitted >= 0;
  const expectedWorks = works.map((work) => ({
    subjectId: work.subjectId,
    title: work.subjectNameCn || work.subjectName,
    credits: normalizedCredits(work),
  }));
  const expectedAnswerCoverage = expectedCoverage(presence || {});
  const expectedAnswerKeys = [
    'caveat',
    'coverage',
    'distinctWorks',
    'matchStatus',
    'personId',
    'works',
  ];
  const answerRowsMatch =
    isRecord(parsedAnswer) &&
    sameJson(Object.keys(parsedAnswer).sort(), expectedAnswerKeys) &&
    Array.isArray(parsedAnswer?.works) &&
    parsedAnswer.works.length === expectedWorks.length &&
    expectedWorks.every((expected, index) => sameJson(parsedAnswer.works[index], expected));
  const answerChecks = {
    queryArgumentsMatch,
    exactSingleToolCall,
    structuredResultReadbackAvailable: Boolean(result && presence),
    sourceOperationValid,
    answerPersonIdMatches: parsedAnswer?.personId === 7602,
    answerMatchStatusMatches: parsedAnswer?.matchStatus === presence?.matchStatus,
    answerDistinctWorkCountMatches: parsedAnswer?.distinctWorks === presence?.distinctWorks,
    twoDistinctWorksMatched,
    expectedDirectRelationPreserved: observedTargetRelation,
    boundedCoverageValid,
    coverageMatches: sameJson(parsedAnswer?.coverage, expectedAnswerCoverage),
    answerRowsMatch,
    noMatchCaveatPresent:
      typeof parsedAnswer?.caveat === 'string' &&
      parsedAnswer.caveat.includes('未命中不证明没有其他演出'),
    observedScopeCaveatPresent:
      typeof parsedAnswer?.caveat === 'string' &&
      parsedAnswer.caveat.includes('当前匿名可见') &&
      parsedAnswer.caveat.includes('无分页'),
    noUnsupportedCompletenessClaim: !hasUnsupportedCompletenessClaim(parsedAnswer),
    noMarkdownFormatting:
      typeof answer === 'string' && !/^\s*```/u.test(answer) && !/^\s*#/mu.test(answer),
  };
  const passed = Object.values(answerChecks).every(Boolean);
  const resultCounters = {
    distinctWorks: Number.isInteger(presence?.distinctWorks) ? presence.distinctWorks : 0,
    answerWorks: Array.isArray(parsedAnswer?.works) ? parsedAnswer.works.length : 0,
    matchedCreditRows: Number.isInteger(presence?.coverage?.matchedCreditRows)
      ? presence.coverage.matchedCreditRows
      : 0,
    personRowsObserved: Number.isInteger(presence?.coverage?.personRowsObserved)
      ? presence.coverage.personRowsObserved
      : 0,
    personRowsReturned: Number.isInteger(presence?.coverage?.personRowsReturned)
      ? presence.coverage.personRowsReturned
      : 0,
    directAnimeWorksOmitted: Number.isInteger(presence?.coverage?.eligibleDirectAnimeWorksOmitted)
      ? presence.coverage.eligibleDirectAnimeWorksOmitted
      : 0,
    coverageFieldsMatched: COVERAGE_FIELDS.filter(
      (field) => parsedAnswer?.coverage?.[field] === presence?.coverage?.[field],
    ).length,
  };
  const resultSummary =
    result && presence
      ? {
          rootSubjectId: result.subjectId,
          matchStatus: presence.matchStatus,
          distinctWorks: presence.distinctWorks,
          subjectIds: works.map((work) => work.subjectId).filter(Number.isInteger),
          characterIds: works.flatMap((work) =>
            (Array.isArray(work.credits) ? work.credits : [])
              .map((credit) => credit?.characterId)
              .filter(Number.isInteger),
          ),
          state: presence.state,
          coverage: expectedAnswerCoverage,
          sourceOperationStatus: presence.sourceOperation?.status ?? 'unavailable',
        }
      : null;
  return {
    passed,
    method: S03_ANSWER_CHECK_METHOD,
    answerChecks,
    resultCounters,
    resultSummary,
    warningCodes: passed ? [] : ['S03_ANSWER_OR_RESULT_NOT_ESTABLISHED'],
  };
}
