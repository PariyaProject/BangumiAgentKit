import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectOverlapCastCredit,
  SubjectOverlapCastPerson,
  SubjectOverlapCastRelation,
  SubjectOverlapCastRole,
  SubjectOverlapCoverage,
  SubjectOverlapKind,
  SubjectOverlapPair,
  SubjectOverlapRelationState,
  SubjectOverlapResult,
  SubjectOverlapSideCoverage,
  SubjectOverlapStaffCredit,
  SubjectOverlapStaffPerson,
  SubjectOverlapStaffRelation,
  SubjectOverlapState,
  SubjectOverlapSubject,
  SubjectOverlapRoleFamily,
  SubjectOverviewResult,
  SubjectOverviewSectionState,
} from '@bangumi-agent-kit/bangumi-core';
import {
  getSubjectOverview,
  type SubjectOverviewDependencies,
  type SubjectOverviewLimits,
} from './subject-overview.js';

export interface SubjectOverlapOptions {
  kind?: SubjectOverlapKind;
  castRole?: SubjectOverlapCastRole;
  maxCast?: number;
  maxStaff?: number;
  maxPairs?: number;
  maxPeople?: number;
}

export interface SubjectOverlapDependencies {
  client: SubjectOverviewDependencies['client'];
}

export const SUBJECT_OVERLAP_MAX_SUBJECTS = 8;
export const SUBJECT_OVERLAP_MAX_PAIRS = 28;
export const SUBJECT_OVERLAP_MAX_PEOPLE = 24;
export const SUBJECT_OVERLAP_SUBJECT_CONCURRENCY = 2;
export const SUBJECT_OVERLAP_FORMULA_VERSION = 'subject-overlap-v1' as const;

const DEFAULT_LIMITS = {
  maxCast: 24,
  maxStaff: 48,
  maxPairs: SUBJECT_OVERLAP_MAX_PAIRS,
  maxPeople: SUBJECT_OVERLAP_MAX_PEOPLE,
} as const;

const OVERLAP_DESCRIPTION =
  '对调用方提供的 2–8 个条目，按本次官方 v0 有界角色声优/制作人员关系中的稳定人物 ID 计算交集与观察到的 Jaccard 比例；比例是已观察关系集合的比例，不代表完整演职员表、团队质量或历史连续合作。';

interface CastAccumulator {
  names: Set<string>;
  career: Set<string>;
  credits: Map<
    string,
    {
      subjectId: number;
      characters: Map<
        string,
        {
          characterId?: number;
          name: string;
          relation: string;
          roleFamily: SubjectOverlapRoleFamily;
        }
      >;
    }
  >;
  hasMainRole: boolean;
}

interface StaffAccumulator {
  names: Set<string>;
  career: Set<string>;
  credits: Map<
    string,
    { subjectId: number; rawRelations: Set<string>; relations: Set<string>; eps: Set<string> }
  >;
}

interface CastSideData {
  subjectId: number;
  people: Map<number, CastAccumulator>;
  coverage: SubjectOverlapSideCoverage;
}

interface StaffSideData {
  subjectId: number;
  people: Map<number, StaffAccumulator>;
  coverage: SubjectOverlapSideCoverage;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort(
    compareStrings,
  );
}

function positiveId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function classifyCastRole(rawRelation: string): SubjectOverlapRoleFamily {
  const normalized = rawRelation.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (
    /主角|主役|主要角色|protagonist|lead(?:ing)?(?:\s+role|\s+character)?|main(?:\s+role|\s+character)?/u.test(
      normalized,
    )
  ) {
    return 'main';
  }
  if (/配角|配役|support(?:ing)?(?:\s+role|\s+character)?/u.test(normalized)) {
    return 'support';
  }
  return 'unknown';
}

function relationState(
  left: SubjectOverlapSideCoverage,
  right: SubjectOverlapSideCoverage,
  outputTruncated: boolean,
): SubjectOverlapRelationState {
  if (left.state === 'not_computable' || right.state === 'not_computable') {
    return 'not_computable';
  }
  if (left.state === 'unavailable' || right.state === 'unavailable') return 'unavailable';
  if (
    left.state === 'partial' ||
    right.state === 'partial' ||
    left.missingIdRows > 0 ||
    right.missingIdRows > 0 ||
    (left.unknownRoleRows || 0) > 0 ||
    (right.unknownRoleRows || 0) > 0 ||
    left.truncated ||
    right.truncated ||
    outputTruncated
  ) {
    return 'partial';
  }
  return 'complete';
}

function makeSideCoverage(
  subjectId: number,
  state: SubjectOverviewSectionState,
  rowsObserved: number,
  rowsReturned: number,
  uniqueIdsReturned: number,
  missingIdRows: number,
  truncated: boolean,
  unknownRoleRows?: number,
): SubjectOverlapSideCoverage {
  return {
    subjectId,
    state,
    rowsObserved,
    rowsReturned,
    uniqueIdsReturned,
    missingIdRows,
    ...(unknownRoleRows === undefined ? {} : { unknownRoleRows }),
    truncated: truncated || missingIdRows > 0,
  };
}

function collectCastSide(overview: SubjectOverviewResult, subjectId: number): CastSideData {
  const people = new Map<number, CastAccumulator>();
  let missingIdRows = 0;
  let rowsReturned = 0;
  let unknownRoleRows = 0;

  for (const item of overview.cast.items) {
    const relation = item.relation.trim() || '未知';
    const roleFamily = classifyCastRole(relation);
    for (const actor of item.actors) {
      rowsReturned += 1;
      const personId = positiveId(actor.id);
      if (personId === undefined) {
        missingIdRows += 1;
        continue;
      }
      if (roleFamily === 'unknown') unknownRoleRows += 1;
      const person = people.get(personId) || {
        names: new Set<string>(),
        career: new Set<string>(),
        credits: new Map(),
        hasMainRole: false,
      };
      if (actor.name.trim()) person.names.add(actor.name.trim());
      for (const career of actor.career) {
        if (career.trim()) person.career.add(career.trim());
      }
      if (roleFamily === 'main') person.hasMainRole = true;
      const creditKey = String(subjectId);
      const credit = person.credits.get(creditKey) || {
        subjectId,
        characters: new Map(),
      };
      const characterId = positiveId(item.character.id);
      const characterName = item.character.name.trim() || `角色 ${characterId ?? '未知'}`;
      const characterKey = `${characterId ?? ''}|${characterName}|${relation}`;
      credit.characters.set(characterKey, {
        characterId,
        name: characterName,
        relation,
        roleFamily,
      });
      person.credits.set(creditKey, credit);
      people.set(personId, person);
    }
  }

  return {
    subjectId,
    people,
    coverage: makeSideCoverage(
      subjectId,
      overview.cast.state,
      overview.cast.actorCoverage.observed,
      Math.max(overview.cast.actorCoverage.returned, rowsReturned),
      people.size,
      missingIdRows,
      overview.cast.coverage.truncated || overview.cast.actorCoverage.truncated,
      unknownRoleRows,
    ),
  };
}

function collectStaffSide(overview: SubjectOverviewResult, subjectId: number): StaffSideData {
  const people = new Map<number, StaffAccumulator>();
  let missingIdRows = 0;

  for (const member of overview.staff.items) {
    const personId = positiveId(member.id);
    if (personId === undefined) {
      missingIdRows += 1;
      continue;
    }
    const person = people.get(personId) || {
      names: new Set<string>(),
      career: new Set<string>(),
      credits: new Map(),
    };
    if (member.name.trim()) person.names.add(member.name.trim());
    for (const career of member.career) {
      if (career.trim()) person.career.add(career.trim());
    }
    const creditKey = String(subjectId);
    const credit = person.credits.get(creditKey) || {
      subjectId,
      rawRelations: new Set<string>(),
      relations: new Set<string>(),
      eps: new Set<string>(),
    };
    credit.rawRelations.add(member.rawRelation ?? '');
    credit.relations.add(member.relation.trim() || '未知');
    if (member.eps.trim()) credit.eps.add(member.eps.trim());
    person.credits.set(creditKey, credit);
    people.set(personId, person);
  }

  return {
    subjectId,
    people,
    coverage: makeSideCoverage(
      subjectId,
      overview.staff.state,
      overview.staff.coverage.observed,
      overview.staff.coverage.returned,
      people.size,
      missingIdRows,
      overview.staff.coverage.truncated,
    ),
  };
}

function castPeopleForRole(side: CastSideData, castRole: SubjectOverlapCastRole): Set<number> {
  if (castRole === 'all') return new Set(side.people.keys());
  return new Set(
    [...side.people.entries()]
      .filter(([, person]) => person.hasMainRole)
      .map(([personId]) => personId),
  );
}

function overlapCoverage(
  left: SubjectOverlapSideCoverage,
  right: SubjectOverlapSideCoverage,
  commonIds: number[],
  maxPeople: number,
): SubjectOverlapCoverage {
  const outputTruncated = commonIds.length > maxPeople;
  const state = relationState(left, right, outputTruncated);
  const available = state !== 'unavailable' && state !== 'not_computable';
  const returned = Math.min(maxPeople, commonIds.length);
  const result: SubjectOverlapCoverage = {
    state,
    left,
    right,
    ...(available ? { matchedIds: commonIds.length } : {}),
    returned,
    omitted: commonIds.length - returned,
    truncated: left.truncated || right.truncated || outputTruncated,
  };
  return result;
}

function castPerson(
  personId: number,
  left: CastAccumulator,
  right: CastAccumulator,
  leftSubjectId: number,
  rightSubjectId: number,
  castRole: SubjectOverlapCastRole,
): SubjectOverlapCastPerson {
  const names = sortedStrings([...left.names, ...right.names]);
  const credits: SubjectOverlapCastCredit[] = [
    [leftSubjectId, left],
    [rightSubjectId, right],
  ].map(([subjectId, person]) => ({
    subjectId: subjectId as number,
    characters: [...(person as CastAccumulator).credits.values()]
      .flatMap((credit) => [...credit.characters.values()])
      .sort(
        (a, b) =>
          (a.characterId ?? Number.MAX_SAFE_INTEGER) - (b.characterId ?? Number.MAX_SAFE_INTEGER) ||
          compareStrings(a.name, b.name) ||
          compareStrings(a.relation, b.relation),
      ),
  }));
  return {
    personId,
    name: names[0] || `人物 ${personId}`,
    ...(names.length > 1 ? { nameVariants: names } : {}),
    career: sortedStrings([...left.career, ...right.career]),
    matchBasis: castRole === 'main' ? 'recognized_main_role' : 'all_cast_credits',
    credits,
  };
}

function staffPerson(
  personId: number,
  left: StaffAccumulator,
  right: StaffAccumulator,
  leftSubjectId: number,
  rightSubjectId: number,
): SubjectOverlapStaffPerson {
  const names = sortedStrings([...left.names, ...right.names]);
  const credits: SubjectOverlapStaffCredit[] = [
    [leftSubjectId, left],
    [rightSubjectId, right],
  ].map(([subjectId, person]) => {
    const value = [...(person as StaffAccumulator).credits.values()][0];
    return {
      subjectId: subjectId as number,
      rawRelations: sortedStrings(value?.rawRelations || []),
      relations: sortedStrings(value?.relations || []),
      eps: sortedStrings(value?.eps || []),
    };
  });
  return {
    personId,
    name: names[0] || `人物 ${personId}`,
    ...(names.length > 1 ? { nameVariants: names } : {}),
    career: sortedStrings([...left.career, ...right.career]),
    credits,
  };
}

function buildCastRelation(
  left: CastSideData,
  right: CastSideData,
  castRole: SubjectOverlapCastRole,
  maxPeople: number,
): SubjectOverlapCastRelation {
  const leftIds = castPeopleForRole(left, castRole);
  const rightIds = castPeopleForRole(right, castRole);
  const commonIds = [...leftIds].filter((personId) => rightIds.has(personId)).sort((a, b) => a - b);
  const unionIds = new Set([...leftIds, ...rightIds]);
  const coverage = overlapCoverage(
    {
      ...left.coverage,
      uniqueIdsReturned: leftIds.size,
      ...(castRole === 'all' ? { unknownRoleRows: 0 } : {}),
    },
    {
      ...right.coverage,
      uniqueIdsReturned: rightIds.size,
      ...(castRole === 'all' ? { unknownRoleRows: 0 } : {}),
    },
    commonIds,
    maxPeople,
  );
  if (coverage.state === 'complete' && unionIds.size > 0) {
    coverage.candidateIds = unionIds.size;
    coverage.unionIds = unionIds.size;
    coverage.overlapRate = commonIds.length / unionIds.size;
  } else if (coverage.state !== 'unavailable' && coverage.state !== 'not_computable') {
    coverage.candidateIds = unionIds.size;
    coverage.unionIds = unionIds.size;
  }
  return {
    state: coverage.state,
    items: commonIds
      .slice(0, maxPeople)
      .map((personId) =>
        castPerson(
          personId,
          left.people.get(personId)!,
          right.people.get(personId)!,
          left.subjectId,
          right.subjectId,
          castRole,
        ),
      ),
    coverage,
  };
}

function buildStaffRelation(
  left: StaffSideData,
  right: StaffSideData,
  maxPeople: number,
): SubjectOverlapStaffRelation {
  const leftIds = new Set(left.people.keys());
  const rightIds = new Set(right.people.keys());
  const commonIds = [...leftIds].filter((personId) => rightIds.has(personId)).sort((a, b) => a - b);
  const unionIds = new Set([...leftIds, ...rightIds]);
  const coverage = overlapCoverage(left.coverage, right.coverage, commonIds, maxPeople);
  if (coverage.state === 'complete' && unionIds.size > 0) {
    coverage.candidateIds = unionIds.size;
    coverage.unionIds = unionIds.size;
    coverage.overlapRate = commonIds.length / unionIds.size;
  } else if (coverage.state !== 'unavailable' && coverage.state !== 'not_computable') {
    coverage.candidateIds = unionIds.size;
    coverage.unionIds = unionIds.size;
  }
  return {
    state: coverage.state,
    items: commonIds
      .slice(0, maxPeople)
      .map((personId) =>
        staffPerson(
          personId,
          left.people.get(personId)!,
          right.people.get(personId)!,
          left.subjectId,
          right.subjectId,
        ),
      ),
    coverage,
  };
}

function subjectState(
  overview: SubjectOverviewResult,
  kind: SubjectOverlapKind,
): SubjectOverlapState {
  if (!overview.subject) return overview.state;
  const states =
    kind === 'cast'
      ? [overview.cast.state]
      : kind === 'staff'
        ? [overview.staff.state]
        : [overview.cast.state, overview.staff.state];
  if (states.every((state) => state === 'unavailable')) return 'unavailable';
  if (states.every((state) => state === 'not_computable')) return 'not_computable';
  if (
    states.some(
      (state) => state === 'unavailable' || state === 'not_computable' || state === 'partial',
    )
  )
    return 'partial';
  return 'complete';
}

function subjectView(
  overview: SubjectOverviewResult,
  kind: SubjectOverlapKind,
): SubjectOverlapSubject {
  const subject = overview.subject;
  return {
    subjectId: overview.subjectId,
    state: subjectState(overview, kind),
    ...(subject
      ? {
          subject: {
            id: subject.id,
            name: subject.name,
            ...(subject.nameCn ? { nameCn: subject.nameCn } : {}),
            type: subject.type,
            ...(subject.date ? { date: subject.date } : {}),
            ...(subject.platform ? { platform: subject.platform } : {}),
          },
        }
      : {}),
    sections: { cast: overview.cast.state, staff: overview.staff.state },
    coverage: {
      sourceRequestsAttempted: overview.coverage.sourceRequestsAttempted,
      sourceRequestsSucceeded: overview.coverage.sourceRequestsSucceeded,
      cast: {
        observed: overview.cast.coverage.observed,
        returned: overview.cast.coverage.returned,
        truncated: overview.cast.coverage.truncated || overview.cast.actorCoverage.truncated,
      },
      staff: {
        observed: overview.staff.coverage.observed,
        returned: overview.staff.coverage.returned,
        truncated: overview.staff.coverage.truncated,
      },
    },
  };
}

function earliestTimestamp(values: Array<string | undefined>): string {
  return (
    values.filter((value): value is string => Boolean(value)).sort(compareStrings)[0] ||
    new Date().toISOString()
  );
}

function latestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort(compareStrings)
    .at(-1);
}

function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function pairScore(pair: SubjectOverlapPair, kind: SubjectOverlapKind): number | null {
  const cast = pair.cast?.coverage.matchedIds;
  const staff = pair.staff?.coverage.matchedIds;
  if (kind === 'cast') return cast ?? null;
  if (kind === 'staff') return staff ?? null;
  return cast === undefined || staff === undefined ? null : cast + staff;
}

function resultState(
  subjects: SubjectOverlapSubject[],
  pairs: SubjectOverlapPair[],
  kind: SubjectOverlapKind,
  outputTruncated: boolean,
): SubjectOverlapState {
  const returned = subjects.filter((subject) => subject.subject).length;
  if (returned === 0) {
    return subjects.every((subject) => subject.state === 'not_found') ? 'not_found' : 'unavailable';
  }
  const relevantStates = pairs.flatMap((pair) =>
    kind === 'cast'
      ? [pair.cast?.state]
      : kind === 'staff'
        ? [pair.staff?.state]
        : [pair.cast?.state, pair.staff?.state],
  );
  if (relevantStates.length > 0 && relevantStates.every((state) => state === 'unavailable')) {
    return 'unavailable';
  }
  if (relevantStates.length > 0 && relevantStates.every((state) => state === 'not_computable')) {
    return 'partial';
  }
  if (
    outputTruncated ||
    subjects.some((subject) => subject.state !== 'complete') ||
    relevantStates.some((state) => state !== 'complete')
  ) {
    return 'partial';
  }
  return 'complete';
}

export async function getSubjectOverlap(
  subjectIdsInput: readonly number[],
  options: SubjectOverlapOptions = {},
  dependencies: SubjectOverlapDependencies,
): Promise<SubjectOverlapResult> {
  if (
    subjectIdsInput.length < 2 ||
    subjectIdsInput.length > SUBJECT_OVERLAP_MAX_SUBJECTS ||
    subjectIdsInput.some((subjectId) => !Number.isInteger(subjectId) || subjectId <= 0) ||
    new Set(subjectIdsInput).size !== subjectIdsInput.length
  ) {
    throw new BangumiError(
      'VALIDATION_ERROR',
      `subjectIds 必须包含 ${2}–${SUBJECT_OVERLAP_MAX_SUBJECTS} 个不同的正整数条目 ID`,
      false,
      400,
    );
  }

  const subjectIds = [...subjectIdsInput];
  const kind = options.kind ?? 'all';
  const castRole = options.castRole ?? 'all';
  const limits: SubjectOverviewLimits = {
    maxCast: bounded(options.maxCast, DEFAULT_LIMITS.maxCast, 80),
    maxStaff: bounded(options.maxStaff, DEFAULT_LIMITS.maxStaff, 80),
    maxRelations: 1,
  };
  const maxPairs = bounded(options.maxPairs, DEFAULT_LIMITS.maxPairs, SUBJECT_OVERLAP_MAX_PAIRS);
  const maxPeople = bounded(
    options.maxPeople,
    DEFAULT_LIMITS.maxPeople,
    SUBJECT_OVERLAP_MAX_PEOPLE,
  );
  const overviews: SubjectOverviewResult[] = [];
  const attemptedAt = new Date().toISOString();

  for (let index = 0; index < subjectIds.length; index += SUBJECT_OVERLAP_SUBJECT_CONCURRENCY) {
    const batch = subjectIds.slice(index, index + SUBJECT_OVERLAP_SUBJECT_CONCURRENCY);
    const results = await Promise.all(
      batch.map((subjectId) =>
        getSubjectOverview(subjectId, limits, { client: dependencies.client }),
      ),
    );
    overviews.push(...results);
  }

  const pairs: SubjectOverlapPair[] = [];
  for (let leftIndex = 0; leftIndex < subjectIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < subjectIds.length; rightIndex += 1) {
      const leftOverview = overviews[leftIndex]!;
      const rightOverview = overviews[rightIndex]!;
      const leftSubjectId = subjectIds[leftIndex]!;
      const rightSubjectId = subjectIds[rightIndex]!;
      const leftCast = collectCastSide(leftOverview, leftSubjectId);
      const rightCast = collectCastSide(rightOverview, rightSubjectId);
      const leftStaff = collectStaffSide(leftOverview, leftSubjectId);
      const rightStaff = collectStaffSide(rightOverview, rightSubjectId);
      const pair: SubjectOverlapPair = {
        pairId: `${leftSubjectId}:${rightSubjectId}`,
        leftSubjectId,
        rightSubjectId,
        rank: 0,
        rankScore: null,
        rankBasis:
          kind === 'cast'
            ? 'cast_matched_ids'
            : kind === 'staff'
              ? 'staff_matched_ids'
              : 'combined_matched_ids',
        ...(kind === 'cast' || kind === 'all'
          ? { cast: buildCastRelation(leftCast, rightCast, castRole, maxPeople) }
          : {}),
        ...(kind === 'staff' || kind === 'all'
          ? { staff: buildStaffRelation(leftStaff, rightStaff, maxPeople) }
          : {}),
      };
      pair.rankScore = pairScore(pair, kind);
      pairs.push(pair);
    }
  }

  pairs.sort(
    (left, right) =>
      (right.rankScore ?? Number.NEGATIVE_INFINITY) -
        (left.rankScore ?? Number.NEGATIVE_INFINITY) ||
      left.leftSubjectId - right.leftSubjectId ||
      left.rightSubjectId - right.rightSubjectId,
  );
  const selectedPairs = pairs.slice(0, maxPairs);
  selectedPairs.forEach((pair, index) => {
    pair.rank = index + 1;
  });

  const retrievedAt =
    latestTimestamp(
      overviews.flatMap((overview) => overview.evidence.map((item) => item.retrievedAt)),
    ) || new Date().toISOString();
  const officialEvidence = overviews.flatMap((overview, index) =>
    overview.evidence
      .filter((item) => item.source === 'official-v0')
      .map((item) => ({ ...item, subjectIds: [subjectIds[index]!] })),
  );
  const derivedEvidence = {
    source: 'derived-s7' as const,
    operation: 'subject-overlap-composition',
    subjectIds,
    attemptedAt,
    retrievedAt,
    formulaVersion: SUBJECT_OVERLAP_FORMULA_VERSION,
    description: OVERLAP_DESCRIPTION,
  };
  const evidence: SubjectOverlapResult['evidence'] = [...officialEvidence, derivedEvidence];
  const officialOperations = uniqueStrings(officialEvidence.map((item) => item.operation));
  const subjectViews = overviews.map((overview) => subjectView(overview, kind));
  const warnings: SubjectOverlapResult['warnings'] = [];
  const partialSubjects = subjectViews.filter((subject) => subject.state !== 'complete').length;
  if (partialSubjects > 0) {
    warnings.push({
      code: 'SUBJECT_COVERAGE_DEGRADED',
      state: 'partial',
      message: `${partialSubjects}/${subjectViews.length} 个条目不是完整状态；重合只代表可获取区段。`,
    });
  }
  if (pairs.length > selectedPairs.length) {
    warnings.push({
      code: 'PAIR_LIMIT_REACHED',
      state: 'partial',
      message: `候选对共 ${pairs.length} 个，本次只返回排序最高的 ${selectedPairs.length} 个；其余条目对未展开。`,
    });
  }
  if (castRole === 'main') {
    const unknownRoleRows = overviews.reduce(
      (total, overview) =>
        total + collectCastSide(overview, overview.subjectId).coverage.unknownRoleRows!,
      0,
    );
    if (unknownRoleRows > 0) {
      warnings.push({
        code: 'CAST_ROLE_UNKNOWN',
        state: 'partial',
        message: `${unknownRoleRows} 条声优关系的原始角色标签无法保守识别为主角/主役；未知标签不被当作非主角。`,
      });
    }
  }
  for (const pair of selectedPairs) {
    for (const relation of [pair.cast, pair.staff]) {
      if (relation && relation.state !== 'complete') {
        warnings.push({
          code: 'OVERLAP_COVERAGE_DEGRADED',
          state: 'partial',
          message: `${pair.pairId} 的重合受来源不可用、缺失 ID、角色未知或区段/输出截断影响。`,
        });
        break;
      }
    }
  }

  return {
    subjectIds,
    state: resultState(subjectViews, selectedPairs, kind, pairs.length > selectedPairs.length),
    kind,
    castRole,
    subjects: subjectViews,
    pairs: selectedPairs,
    formulaVersion: SUBJECT_OVERLAP_FORMULA_VERSION,
    coverage: {
      requestedSubjects: subjectIds.length,
      returnedSubjects: subjectViews.filter((subject) => subject.subject !== undefined).length,
      requestedPairs: pairs.length,
      returnedPairs: selectedPairs.length,
      omittedPairs: pairs.length - selectedPairs.length,
      limits: {
        maxSubjects: SUBJECT_OVERLAP_MAX_SUBJECTS,
        maxCast: limits.maxCast,
        maxStaff: limits.maxStaff,
        maxPairs,
        maxPeople,
      },
      truncated:
        pairs.length > selectedPairs.length ||
        selectedPairs.some((pair) =>
          [pair.cast, pair.staff].some((relation) => relation?.coverage.truncated),
        ),
    },
    source: {
      official: {
        class: 'official-v0',
        operations: officialOperations,
        attemptedAt: earliestTimestamp(
          officialEvidence.map((item) => item.attemptedAt).concat(attemptedAt),
        ),
        ...(latestTimestamp(officialEvidence.map((item) => item.retrievedAt))
          ? { retrievedAt: latestTimestamp(officialEvidence.map((item) => item.retrievedAt)) }
          : {}),
      },
      derived: {
        class: 'derived-s7',
        operations: ['subject-overlap-composition'],
        attemptedAt,
        retrievedAt,
      },
    },
    evidence,
    warnings,
    limitations: [
      '比较只接受调用方提供的 2–8 个已知条目 ID；不会从整个 Bangumi 目录发现候选作品。',
      OVERLAP_DESCRIPTION,
      castRole === 'main'
        ? '主角/主役筛选只识别明确的原始角色标签；未知标签保留为未知，不代表不是主角。'
        : '角色与职位标签保留官方原文；不从 career、名称或关系图推断职业层级。',
      '重合比例在两侧相关区段完整且并集非空时才计算；部分、不可用或空并集不产生完整比例声明。',
      '结果是本次快照的有界观察，不计算历史连续合作、工作量趋势、完整团队或团队质量。',
    ],
  };
}
