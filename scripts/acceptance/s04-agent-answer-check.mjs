export const S04_EXPECTED_QUERY_ARGUMENTS = Object.freeze({ subjectId: 565, limit: 100 });
export const S04_ANSWER_CHECK_METHOD = 's04-subject-cast-multirole-answer-v1';
export const S04_RESPONSE_BYTE_LIMIT = 1_048_576;

const ANSWER_KEYS = ['caveat', 'coverage', 'multiRoleVoiceActors', 'source', 'subjectId'];
const COVERAGE_FIELDS = [
  'observed',
  'selectedRows',
  'omittedRowsByLimit',
  'truncated',
  'schemaDriftRows',
  'invalidActorIdRows',
  'duplicateActorCharacterLinks',
  'sourceStatus',
  'responseBytes',
  'responseByteLimit',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function parseObject(value) {
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
    const parsed = parseObject(item.text);
    if (parsed?.status === 'ok' && Array.isArray(parsed.cast)) return parsed;
  }
  return null;
}

function expectedCoverage(result) {
  return Object.fromEntries(
    COVERAGE_FIELDS.map((field) => [
      field,
      field === 'sourceStatus'
        ? (result?.source?.status ?? null)
        : field === 'responseBytes'
          ? (result?.source?.responseBytes ?? null)
          : field === 'responseByteLimit'
            ? (result?.source?.responseByteLimit ?? null)
            : (result?.[field] ?? null),
    ]),
  );
}

function projectSource(source) {
  return {
    api: source?.api,
    operation: source?.operation,
    retrievedAt: source?.retrievedAt,
    status: source?.status,
    responseBytes: source?.responseBytes,
    responseByteLimit: source?.responseByteLimit,
    paginationAvailable: source?.paginationAvailable,
    totalCountAvailable: source?.totalCountAvailable,
  };
}

function projectGroups(groups) {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    person: {
      id: group?.person?.id,
      name: group?.person?.name,
      career: group?.person?.career,
    },
    distinctCharacterCount: group?.distinctCharacterCount,
    roles: (Array.isArray(group?.roles) ? group.roles : []).map((role) => ({
      characterId: role?.characterId,
      characterName: role?.characterName,
      relation: role?.relation,
    })),
  }));
}

function deriveMultiRoleVoiceActors(cast) {
  const groups = new Map();
  for (const item of cast) {
    if (!Number.isInteger(item?.character?.id) || item.character.id <= 0) continue;
    for (const actor of Array.isArray(item?.actors) ? item.actors : []) {
      if (!Number.isInteger(actor?.id) || actor.id <= 0) continue;
      const group = groups.get(actor.id) || {
        person: { id: actor.id, name: actor.name, career: [] },
        careers: new Set(),
        roles: new Map(),
      };
      for (const career of Array.isArray(actor.career) ? actor.career : []) {
        if (typeof career === 'string') group.careers.add(career);
      }
      if (!group.roles.has(item.character.id)) {
        group.roles.set(item.character.id, {
          characterId: item.character.id,
          characterName: item.character.name,
          relation: item.relation,
        });
      }
      groups.set(actor.id, group);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.careers.has('seiyu') && group.roles.size >= 2)
    .sort(([left], [right]) => left - right)
    .map(([, group]) => ({
      person: { ...group.person, career: [...group.careers] },
      distinctCharacterCount: group.roles.size,
      roles: [...group.roles.values()],
    }));
}

export function verifyS04SubjectCastAnswer(answer, queryArguments, toolOutput, toolCalls) {
  const parsedAnswer = parseObject(answer);
  const result = readToolResult(toolOutput);
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const source = result?.source;
  const exactSingleToolCall =
    calls.length === 1 &&
    calls[0]?.name === 'bangumi.get_subject_cast' &&
    calls[0]?.state === 'DONE';
  const queryArgumentsMatch = sameJson(queryArguments, S04_EXPECTED_QUERY_ARGUMENTS);
  const sourceOperationValid =
    source?.api === 'official-v0' &&
    source?.operation === 'GET /v0/subjects/{subject_id}/characters' &&
    source?.paginationAvailable === false &&
    source?.totalCountAvailable === false &&
    typeof source?.retrievedAt === 'string' &&
    Number.isFinite(Date.parse(source.retrievedAt));
  const responseLimitValid =
    source?.responseByteLimit === S04_RESPONSE_BYTE_LIMIT &&
    Number.isInteger(source?.responseBytes) &&
    source.responseBytes >= 0 &&
    source.responseBytes <= S04_RESPONSE_BYTE_LIMIT;
  const coverageValid =
    result?.subjectId === S04_EXPECTED_QUERY_ARGUMENTS.subjectId &&
    result?.status === 'ok' &&
    Array.isArray(result?.cast) &&
    result.cast.length === result.selectedRows &&
    result.cast.length === result.returned &&
    result.selectedRows <= S04_EXPECTED_QUERY_ARGUMENTS.limit &&
    Number.isInteger(result.observed) &&
    result.observed >= result.selectedRows &&
    Number.isInteger(result.omittedRowsByLimit) &&
    result.omittedRowsByLimit >= 0 &&
    Number.isInteger(result.schemaDriftRows) &&
    result.schemaDriftRows >= 0 &&
    result.observed === result.selectedRows + result.omittedRowsByLimit + result.schemaDriftRows &&
    Number.isInteger(result.invalidActorIdRows) &&
    result.invalidActorIdRows >= 0 &&
    Number.isInteger(result.duplicateActorCharacterLinks) &&
    result.duplicateActorCharacterLinks >= 0 &&
    typeof result.truncated === 'boolean' &&
    result.truncated === (result.omittedRowsByLimit > 0 || result.schemaDriftRows > 0) &&
    source?.status === (result.truncated ? 'partial' : 'observed');
  const recomputedGroups = result ? deriveMultiRoleVoiceActors(result.cast || []) : [];
  const resultGroupsMatchCast =
    Array.isArray(result?.multiRoleVoiceActors) &&
    sameJson(projectGroups(result.multiRoleVoiceActors), projectGroups(recomputedGroups));
  const answerHasExactKeys =
    isRecord(parsedAnswer) && sameJson(Object.keys(parsedAnswer).sort(), ANSWER_KEYS);
  const answerGroupsMatch =
    Array.isArray(parsedAnswer?.multiRoleVoiceActors) &&
    sameJson(
      projectGroups(parsedAnswer.multiRoleVoiceActors),
      projectGroups(result?.multiRoleVoiceActors),
    );
  const answerCoverageMatches = sameJson(parsedAnswer?.coverage, expectedCoverage(result));
  const answerSourceMatches = sameJson(projectSource(parsedAnswer?.source), projectSource(source));
  const caveat = typeof parsedAnswer?.caveat === 'string' ? parsedAnswer.caveat : '';
  const boundedScopeCaveatPresent =
    caveat.includes('本次选取的合法角色行') &&
    caveat.includes('接口没有分页或总数') &&
    caveat.includes('不作主角或主役分类') &&
    caveat.includes('不表示完整作品角色表中不存在');
  const zeroGroupCaveatPresent =
    (result?.multiRoleVoiceActors?.length ?? -1) !== 0 ||
    caveat.includes('本次范围未建立多角色声优组');
  const noMarkdown =
    typeof answer === 'string' && !/^\s*```/u.test(answer) && !/^\s*#/mu.test(answer);

  const answerChecks = {
    queryArgumentsMatch,
    exactSingleToolCall,
    structuredResultReadbackAvailable: Boolean(result),
    sourceOperationValid,
    responseLimitValid,
    coverageValid,
    resultGroupsMatchCast: resultGroupsMatchCast,
    answerHasExactKeys,
    answerSubjectIdMatches: parsedAnswer?.subjectId === S04_EXPECTED_QUERY_ARGUMENTS.subjectId,
    answerGroupsMatch,
    answerCoverageMatches,
    answerSourceMatches,
    boundedScopeCaveatPresent,
    zeroGroupCaveatPresent,
    noMarkdown,
  };
  const passed = Object.values(answerChecks).every(Boolean);
  const resultCounters = {
    observedRows: Number.isInteger(result?.observed) ? result.observed : 0,
    selectedRows: Number.isInteger(result?.selectedRows) ? result.selectedRows : 0,
    omittedRowsByLimit: Number.isInteger(result?.omittedRowsByLimit)
      ? result.omittedRowsByLimit
      : 0,
    truncated: result?.truncated === true,
    schemaDriftRows: Number.isInteger(result?.schemaDriftRows) ? result.schemaDriftRows : 0,
    invalidActorIdRows: Number.isInteger(result?.invalidActorIdRows)
      ? result.invalidActorIdRows
      : 0,
    multiRoleVoiceActorGroups: Array.isArray(result?.multiRoleVoiceActors)
      ? result.multiRoleVoiceActors.length
      : 0,
    distinctCharactersByGroup: Array.isArray(result?.multiRoleVoiceActors)
      ? result.multiRoleVoiceActors.map((group) => group.distinctCharacterCount)
      : [],
    responseBytes: Number.isInteger(source?.responseBytes) ? source.responseBytes : null,
    sourceStatus: source?.status || 'unknown',
    duplicateActorCharacterLinks: Number.isInteger(result?.duplicateActorCharacterLinks)
      ? result.duplicateActorCharacterLinks
      : 0,
  };

  return {
    passed,
    answerChecks,
    resultCounters,
    resultSummary: result
      ? {
          subjectId: result.subjectId,
          status: result.status,
          sourceStatus: source?.status,
          observed: result.observed,
          selectedRows: result.selectedRows,
          omittedRowsByLimit: result.omittedRowsByLimit,
          truncated: result.truncated,
          schemaDriftRows: result.schemaDriftRows,
          invalidActorIdRows: result.invalidActorIdRows,
          duplicateActorCharacterLinks: result.duplicateActorCharacterLinks,
          responseBytes: source?.responseBytes ?? null,
          groupCount: resultCounters.multiRoleVoiceActorGroups,
        }
      : null,
  };
}
