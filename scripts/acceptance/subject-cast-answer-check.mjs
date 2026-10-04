import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUBJECT_CAST_ANSWER_CHECK_METHOD = 'row-separated-exact-character-actor-pairs-v1';
const ANSWER_ROW_SEPARATOR = '｜';
const ACTOR_SEPARATOR = '、';
const OMITTED_ACTORS_SEPARATOR = '；';
const NO_ACTOR_RETURNED = /^(?:本次)?未返回(?:演员|声优)$/u;
const OMITTED_ACTORS_NOTE = /^另有\s*(\d+)\s*位(?:演员|声优)未显示$/u;
const COMPLETENESS_CLAIM =
  /(?:完整(?:角色)?(?:名单|列表|表)|全部(?:主要)?角色|所有(?:主要)?角色|所有(?:演员|声优)|全部(?:演员|声优)|没有遗漏|完整无遗漏)/gu;
const ABSENCE_CLAIM =
  /(?:没有其他(?:角色|演员|声优)|不存在其他(?:角色|演员|声优)|没有更多(?:角色|演员|声优)|其他(?:角色|演员|声优).{0,8}(?:没有|不存在))/gu;
const CLAIM_NEGATION =
  /(?:不是|并不是|并非|不代表|不能(?:说|证明|确认|推断)?|无法(?:证明|确认|判断|称为)?|未能|尚不|不确定|不足以|不构成|不属于|未返回|未显示)\s*$/u;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)/u;
const SCOPE_LINE = /^(?:范围|覆盖|说明)[:：]/u;

export function validateSubjectCastAnswer(answer, rows) {
  if (typeof answer !== 'string' || !Array.isArray(rows)) {
    return emptyCheck();
  }

  const normalized = normalizeRows(rows);
  const { rows: answerRows, unstructuredAnswerLinesCount } = parseAnswerRows(answer);
  const rowMatches = new Map();
  let unmatchedAnswerRowsCount = 0;
  let mismatchedCastRowsCount = 0;

  for (const answerRow of answerRows) {
    const key = rowKey(answerRow.relation, answerRow.characterName);
    const expected = normalized.rowsByKey.get(key);
    if (!expected) {
      unmatchedAnswerRowsCount += 1;
      continue;
    }
    const current = rowMatches.get(key) ?? [];
    current.push(answerRow);
    rowMatches.set(key, current);
    if (!matchesActorField(answerRow.actorField, expected)) {
      mismatchedCastRowsCount += 1;
    }
  }

  let castRowsMatchedCount = 0;
  let characterActorPairsMatchedCount = 0;
  let rawRelationLabelsMatchedCount = 0;
  let duplicateAnswerRowsCount = 0;
  let missingCastRowsCount = 0;
  for (const [key, expected] of normalized.rowsByKey) {
    const matches = rowMatches.get(key) ?? [];
    if (matches.length > 1) duplicateAnswerRowsCount += matches.length - 1;
    if (matches.length === 0) {
      missingCastRowsCount += 1;
      continue;
    }
    if (matches.length === 1 && matchesActorField(matches[0].actorField, expected)) {
      castRowsMatchedCount += 1;
      characterActorPairsMatchedCount += expected.actorNames.length;
      rawRelationLabelsMatchedCount += 1;
    }
  }

  const boundedCoverageDisclosurePresent = hasBoundedCoverageDisclosure(answer);
  const omissionNotAbsencePresent = hasOmissionNotAbsenceDisclosure(answer);
  const unsupportedCompletenessClaim = hasUnqualifiedClaim(answer, COMPLETENESS_CLAIM);
  const unsupportedAbsenceClaim = hasUnqualifiedClaim(answer, ABSENCE_CLAIM);
  const markdownFormattingDetected =
    answer.split(/\r?\n/u).some((line) => MARKDOWN_LINE.test(line)) ||
    answer.includes('**') ||
    answer.includes('`');
  const passed =
    normalized.rowsByKey.size > 0 &&
    castRowsMatchedCount === normalized.rowsByKey.size &&
    missingCastRowsCount === 0 &&
    mismatchedCastRowsCount === 0 &&
    unmatchedAnswerRowsCount === 0 &&
    unstructuredAnswerLinesCount === 0 &&
    duplicateAnswerRowsCount === 0 &&
    boundedCoverageDisclosurePresent &&
    omissionNotAbsencePresent &&
    !unsupportedCompletenessClaim &&
    !unsupportedAbsenceClaim &&
    !markdownFormattingDetected;

  return {
    visibleCastRowsCount: normalized.rowsByKey.size,
    clippedCastRowsUnavailableCount: normalized.clippedCastRowsUnavailableCount,
    clippedActorNamesUnavailableCount: normalized.clippedActorNamesUnavailableCount,
    castRowsMatchedCount,
    missingCastRowsCount,
    mismatchedCastRowsCount,
    duplicateAnswerRowsCount,
    unmatchedAnswerRowsCount,
    unstructuredAnswerLinesCount,
    characterActorPairsMatchedCount,
    rawRelationLabelsMatchedCount,
    boundedCoverageDisclosurePresent,
    omissionNotAbsencePresent,
    unsupportedCompletenessClaim,
    unsupportedAbsenceClaim,
    markdownFormattingDetected,
    passed,
  };
}

function normalizeRows(rows) {
  const rowsByKey = new Map();
  const duplicateKeys = new Set();
  let clippedCastRowsUnavailableCount = 0;
  let clippedActorNamesUnavailableCount = 0;

  for (const row of rows) {
    const character = row?.character;
    if (
      !character ||
      typeof character.name !== 'string' ||
      !character.name.trim() ||
      character.displayNameTextTruncated === true ||
      typeof row.relation !== 'string' ||
      !row.relation.trim() ||
      row.relationTextTruncated === true
    ) {
      clippedCastRowsUnavailableCount += 1;
      continue;
    }

    const actors = Array.isArray(row.actors) ? row.actors : [];
    const visibleActors = actors.filter(
      (actor) =>
        actor &&
        typeof actor.name === 'string' &&
        actor.name.trim() &&
        actor.displayNameTextTruncated !== true,
    );
    const clippedActors = actors.length - visibleActors.length;
    clippedActorNamesUnavailableCount += clippedActors;
    const sourceOmittedActors = Number.isInteger(row.actorsOmittedFromText)
      ? Math.max(0, row.actorsOmittedFromText)
      : 0;
    const actorCount = Number.isInteger(row.actorCount) ? row.actorCount : actors.length;
    const actorNames = visibleActors.map((actor) => actor.name.trim());
    const unavailableActorCount = sourceOmittedActors + clippedActors;
    if (actorCount !== actorNames.length + unavailableActorCount) {
      clippedCastRowsUnavailableCount += 1;
      continue;
    }

    const key = rowKey(row.relation.trim(), character.name.trim());
    if (duplicateKeys.has(key)) {
      clippedCastRowsUnavailableCount += 1;
      continue;
    }
    if (rowsByKey.has(key)) {
      clippedCastRowsUnavailableCount += 1;
      rowsByKey.delete(key);
      duplicateKeys.add(key);
      continue;
    }
    rowsByKey.set(key, {
      relation: row.relation.trim(),
      characterName: character.name.trim(),
      actorNames,
      unavailableActorCount,
    });
  }

  return {
    rowsByKey,
    clippedCastRowsUnavailableCount,
    clippedActorNamesUnavailableCount,
  };
}

function parseAnswerRows(answer) {
  const parsed = [];
  let unstructuredAnswerLinesCount = 0;
  for (const rawLine of answer.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.includes(ANSWER_ROW_SEPARATOR)) {
      if (!SCOPE_LINE.test(line)) unstructuredAnswerLinesCount += 1;
      continue;
    }
    const columns = line.split(ANSWER_ROW_SEPARATOR).map((column) => column.trim());
    if (columns.length !== 3 || columns.some((column) => !column)) {
      parsed.push({ relation: '', characterName: '', actorField: '' });
      continue;
    }
    parsed.push({ relation: columns[0], characterName: columns[1], actorField: columns[2] });
  }
  return { rows: parsed, unstructuredAnswerLinesCount };
}

function matchesActorField(actorField, expected) {
  if (expected.actorNames.length === 0 && expected.unavailableActorCount === 0) {
    return NO_ACTOR_RETURNED.test(actorField);
  }

  const parts = actorField.split(OMITTED_ACTORS_SEPARATOR).map((part) => part.trim());
  if (parts.length > 2) return false;
  const names = parts[0]
    .split(ACTOR_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);
  if (
    names.length !== expected.actorNames.length ||
    names.some((name, index) => name !== expected.actorNames[index])
  ) {
    return false;
  }
  if (expected.unavailableActorCount === 0) return parts.length === 1;
  if (parts.length !== 2) return false;
  const omission = OMITTED_ACTORS_NOTE.exec(parts[1]);
  return omission?.[1] === String(expected.unavailableActorCount);
}

function hasBoundedCoverageDisclosure(answer) {
  return /(?:本次|当前样本|有限结果|有界结果).{0,24}(?:返回|显示|观察|样本|范围|覆盖|有限|有界)/u.test(
    answer,
  );
}

function hasOmissionNotAbsenceDisclosure(answer) {
  return /(?:未显示|未返回|未列出|遗漏).{0,16}(?:不代表|不能说明|并不意味着|不足以说明).{0,16}(?:不存在|没有|未参与)/u.test(
    answer,
  );
}

function hasUnqualifiedClaim(answer, pattern) {
  for (const sentence of answer.split(/(?<=[。！？\n])/u)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 24), match.index).trimEnd();
      if (!CLAIM_NEGATION.test(prefix)) return true;
    }
  }
  return false;
}

function rowKey(relation, characterName) {
  return `${relation}\u0000${characterName}`;
}

function emptyCheck() {
  return {
    visibleCastRowsCount: 0,
    clippedCastRowsUnavailableCount: 0,
    clippedActorNamesUnavailableCount: 0,
    castRowsMatchedCount: 0,
    missingCastRowsCount: 0,
    mismatchedCastRowsCount: 0,
    duplicateAnswerRowsCount: 0,
    unmatchedAnswerRowsCount: 0,
    unstructuredAnswerLinesCount: 0,
    characterActorPairsMatchedCount: 0,
    rawRelationLabelsMatchedCount: 0,
    boundedCoverageDisclosurePresent: false,
    omissionNotAbsencePresent: false,
    unsupportedCompletenessClaim: false,
    unsupportedAbsenceClaim: false,
    markdownFormattingDetected: false,
    passed: false,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const check = validateSubjectCastAnswer(input.answer, input.rows);
  process.stdout.write(JSON.stringify(check));
}
