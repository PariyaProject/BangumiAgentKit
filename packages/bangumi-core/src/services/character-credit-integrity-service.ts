import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import type { Character } from '@bangumi-agent-kit/bangumi-openapi';
import {
  BangumiError,
  HttpClient,
  toPublicError,
  type BangumiErrorCode,
  type PublicErrorInfo,
} from '@bangumi-agent-kit/bangumi-transport';
import type {
  CharacterCreditIntegrityCoverage,
  CharacterCreditIntegrityDetailCoverage,
  CharacterCreditIntegrityListCoverage,
  CharacterCreditIntegrityOperationEvidence,
  CharacterCreditIntegrityOperationOutcome,
  CharacterCreditIntegrityOptions,
  CharacterCreditPerson,
  CharacterCreditPersonSubject,
  CharacterCreditIntegrityResult,
  CharacterCreditIntegrityRisk,
  CharacterCreditIntegritySourceState,
  CharacterCreditIntegrityState,
  CharacterCreditSubject,
} from '../models/character-credit-integrity.js';
import {
  CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_PERSONS,
  CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_SUBJECTS,
  CHARACTER_CREDIT_INTEGRITY_FORMULA_VERSION,
  CHARACTER_CREDIT_INTEGRITY_MAX_CREDITS_PER_PERSON,
  CHARACTER_CREDIT_INTEGRITY_MAX_PERSONS,
  CHARACTER_CREDIT_INTEGRITY_MAX_RESPONSE_BYTES,
  CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS,
  CHARACTER_CREDIT_INTEGRITY_MAX_RISKS,
  CHARACTER_CREDIT_INTEGRITY_MAX_SUBJECTS,
  CHARACTER_CREDIT_INTEGRITY_OPERATIONS,
} from '../models/character-credit-integrity.js';
import { mapCharacter } from './character-service.js';

type CharacterCreditIntegrityOperation = (typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[number];

interface SourceRead {
  operation: CharacterCreditIntegrityOperation;
  attemptedAt: string;
  retrievedAt?: string;
  outcome: CharacterCreditIntegrityOperationOutcome;
  raw?: unknown;
  error?: PublicErrorInfo;
}

interface SubjectAccumulator {
  id: number;
  type: number;
  name: string;
  nameCn: string;
  staff: string;
  eps: string;
  observedRows: number;
  duplicateRows: number;
  names: Set<string>;
  namesCn: Set<string>;
  staffs: Set<string>;
  epsValues: Set<string>;
  conflictingFields: Set<string>;
}

interface SubjectParse {
  allItems: CharacterCreditSubject[];
  items: CharacterCreditSubject[];
  coverage: CharacterCreditIntegrityListCoverage;
  duplicateIds: number[];
}

interface PersonSubjectAccumulator {
  subjectId: number;
  subjectType: number;
  subjectName: string;
  subjectNameCn: string;
  staff?: string;
  subjectNames: Set<string>;
  subjectNamesCn: Set<string>;
  staffs: Set<string>;
}

interface PersonAccumulator {
  id: number;
  type: number;
  name: string;
  observedRows: number;
  duplicateRows: number;
  duplicateRelationRows: number;
  names: Set<string>;
  types: Set<number>;
  subjects: Map<number, PersonSubjectAccumulator>;
  relationKeys: Set<string>;
  conflictingFields: Set<string>;
}

interface PersonParse {
  allItems: CharacterCreditPerson[];
  items: CharacterCreditPerson[];
  allSubjectCounts: number;
  returnedSubjectCounts: number;
  coverage: CharacterCreditIntegrityListCoverage;
  duplicateIds: number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function subjectType(value: unknown): value is number {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 6;
}

function characterType(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4;
}

function imageMap(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) && Object.values(value).every((item) => typeof item === 'string'))
  );
}

function validCharacter(value: unknown, expectedId: number): boolean {
  if (!isRecord(value)) return false;
  return (
    value.id === expectedId &&
    positiveInteger(value.id) &&
    typeof value.name === 'string' &&
    characterType(value.type) &&
    typeof value.summary === 'string' &&
    imageMap(value.images)
  );
}

function validSubjectRow(value: unknown): value is {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  staff: string;
  eps: string;
} {
  if (!isRecord(value)) return false;
  return (
    positiveInteger(value.id) &&
    subjectType(value.type) &&
    typeof value.name === 'string' &&
    typeof value.name_cn === 'string' &&
    typeof value.staff === 'string' &&
    typeof value.eps === 'string' &&
    (value.image === undefined || typeof value.image === 'string')
  );
}

function validPersonRow(value: unknown): value is {
  id: number;
  type: number;
  name: string;
  subject_id: number;
  subject_type: number;
  subject_name: string;
  subject_name_cn: string;
  staff?: string;
} {
  if (!isRecord(value)) return false;
  return (
    positiveInteger(value.id) &&
    characterType(value.type) &&
    typeof value.name === 'string' &&
    positiveInteger(value.subject_id) &&
    subjectType(value.subject_type) &&
    typeof value.subject_name === 'string' &&
    typeof value.subject_name_cn === 'string' &&
    (value.staff === undefined || typeof value.staff === 'string')
  );
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter((value) => value.length > 0)));
}

function normalizedName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function sourceState(
  outcome: CharacterCreditIntegrityOperationOutcome,
): CharacterCreditIntegritySourceState {
  return outcome === 'succeeded' ? 'complete' : outcome;
}

function earliestTimestamp(values: readonly string[]): string {
  return values.reduce((earliest, value) => (value < earliest ? value : earliest), values[0]!);
}

function latestTimestamp(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((latest, value) => (value > latest ? value : latest), values[0]!);
}

function errorForCode(code: BangumiErrorCode, message: string): PublicErrorInfo {
  return toPublicError(new BangumiError(code, message, false));
}

function listCoverageBase(
  operation: CharacterCreditIntegrityOperation,
  maxRows: number,
): CharacterCreditIntegrityListCoverage {
  return {
    operation,
    state: 'unavailable',
    maxRows,
    observedRows: 0,
    validRows: 0,
    uniqueIdsObserved: 0,
    returnedRows: 0,
    malformedRows: 0,
    duplicateRows: 0,
    duplicateIds: [],
    conflictRows: 0,
    conflictingIds: [],
    truncated: false,
  };
}

function subjectItem(accumulator: SubjectAccumulator): CharacterCreditSubject {
  const names = uniqueStrings(accumulator.names);
  const namesCn = uniqueStrings(accumulator.namesCn);
  const staffs = uniqueStrings(accumulator.staffs);
  const epsValues = uniqueStrings(accumulator.epsValues);
  return {
    id: accumulator.id,
    type: accumulator.type,
    name: accumulator.name,
    nameCn: accumulator.nameCn,
    staff: accumulator.staff,
    eps: accumulator.eps,
    observedRows: accumulator.observedRows,
    duplicateRows: accumulator.duplicateRows,
    ...(names.length > 1 ? { nameVariants: names } : {}),
    ...(namesCn.length > 1 ? { nameCnVariants: namesCn } : {}),
    ...(staffs.length > 1 ? { staffVariants: staffs } : {}),
    ...(epsValues.length > 1 ? { epsVariants: epsValues } : {}),
    conflictingFields: Array.from(accumulator.conflictingFields).sort(),
  };
}

function parseSubjects(source: SourceRead, maxSubjects: number): SubjectParse {
  const coverage = listCoverageBase(source.operation, maxSubjects);
  coverage.state = sourceState(source.outcome);
  coverage.errorCode = source.error?.code;
  if (source.raw === undefined) {
    if (source.outcome === 'succeeded') {
      coverage.state = 'partial';
      coverage.observedRows = 1;
      coverage.malformedRows = 1;
      coverage.errorCode = 'PARSER_ERROR';
    }
    return { allItems: [], items: [], coverage, duplicateIds: [] };
  }

  const rows = Array.isArray(source.raw) ? source.raw : [];
  coverage.observedRows = Array.isArray(source.raw) ? rows.length : 1;
  const validRows = rows.filter(validSubjectRow);
  coverage.validRows = validRows.length;
  coverage.malformedRows = coverage.observedRows - validRows.length;
  if (coverage.malformedRows > 0) coverage.errorCode = 'SCHEMA_DRIFT';

  const groups = new Map<number, SubjectAccumulator>();
  const duplicateIds: number[] = [];
  const duplicateIdSet = new Set<number>();
  let conflictRows = 0;
  const conflictingIds = new Set<number>();

  for (const row of validRows) {
    const existing = groups.get(row.id);
    if (!existing) {
      groups.set(row.id, {
        id: row.id,
        type: row.type,
        name: row.name,
        nameCn: row.name_cn,
        staff: row.staff,
        eps: row.eps,
        observedRows: 1,
        duplicateRows: 0,
        names: new Set([row.name]),
        namesCn: new Set([row.name_cn]),
        staffs: new Set([row.staff]),
        epsValues: new Set([row.eps]),
        conflictingFields: new Set(),
      });
      continue;
    }

    existing.observedRows += 1;
    existing.duplicateRows += 1;
    coverage.duplicateRows += 1;
    if (!duplicateIdSet.has(row.id)) {
      duplicateIdSet.add(row.id);
      duplicateIds.push(row.id);
    }
    existing.names.add(row.name);
    existing.namesCn.add(row.name_cn);
    existing.staffs.add(row.staff);
    existing.epsValues.add(row.eps);
    const fields: Array<[string, boolean]> = [
      ['type', row.type !== existing.type],
      ['name', row.name !== existing.name],
      ['name_cn', row.name_cn !== existing.nameCn],
      ['staff', row.staff !== existing.staff],
      ['eps', row.eps !== existing.eps],
    ];
    const conflictingFields = fields.filter(([, differs]) => differs).map(([field]) => field);
    if (conflictingFields.length > 0) {
      conflictRows += 1;
      conflictingIds.add(row.id);
      for (const field of conflictingFields) existing.conflictingFields.add(field);
    }
  }

  const allItems = Array.from(groups.values()).map(subjectItem);
  const items = allItems.slice(0, maxSubjects);
  coverage.uniqueIdsObserved = allItems.length;
  coverage.returnedRows = items.length;
  coverage.conflictRows = conflictRows;
  coverage.conflictingIds = Array.from(conflictingIds);
  coverage.duplicateIds = duplicateIds;
  coverage.truncated = coverage.malformedRows > 0 || allItems.length > items.length;
  coverage.state =
    source.outcome !== 'succeeded'
      ? sourceState(source.outcome)
      : coverage.malformedRows > 0 ||
          coverage.duplicateRows > 0 ||
          coverage.conflictRows > 0 ||
          coverage.truncated
        ? 'partial'
        : 'complete';
  return { allItems, items, coverage, duplicateIds };
}

function personSubjectItem(accumulator: PersonSubjectAccumulator): CharacterCreditPersonSubject {
  const subjectNames = uniqueStrings(accumulator.subjectNames);
  const subjectNamesCn = uniqueStrings(accumulator.subjectNamesCn);
  const staffs = uniqueStrings(accumulator.staffs);
  return {
    subjectId: accumulator.subjectId,
    subjectType: accumulator.subjectType,
    subjectName: accumulator.subjectName,
    subjectNameCn: accumulator.subjectNameCn,
    ...(accumulator.staff !== undefined ? { staff: accumulator.staff } : {}),
    ...(subjectNames.length > 1 ? { subjectNameVariants: subjectNames } : {}),
    ...(subjectNamesCn.length > 1 ? { subjectNameCnVariants: subjectNamesCn } : {}),
    ...(staffs.length > 1 ? { staffVariants: staffs } : {}),
  };
}

function personItem(accumulator: PersonAccumulator): CharacterCreditPerson {
  const subjects = Array.from(accumulator.subjects.values())
    .map(personSubjectItem)
    .slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_CREDITS_PER_PERSON);
  const names = uniqueStrings(accumulator.names);
  return {
    id: accumulator.id,
    type: accumulator.type,
    name: accumulator.name,
    observedRows: accumulator.observedRows,
    duplicateRows: accumulator.duplicateRows,
    duplicateRelationRows: accumulator.duplicateRelationRows,
    subjects,
    subjectsOmitted: Math.max(
      0,
      accumulator.subjects.size - CHARACTER_CREDIT_INTEGRITY_MAX_CREDITS_PER_PERSON,
    ),
    ...(names.length > 1 ? { nameVariants: names } : {}),
    conflictingFields: Array.from(accumulator.conflictingFields).sort(),
  };
}

function parsePersons(source: SourceRead, maxPersons: number): PersonParse {
  const coverage = listCoverageBase(source.operation, maxPersons);
  coverage.duplicateRelationRows = 0;
  coverage.state = sourceState(source.outcome);
  coverage.errorCode = source.error?.code;
  if (source.raw === undefined) {
    if (source.outcome === 'succeeded') {
      coverage.state = 'partial';
      coverage.observedRows = 1;
      coverage.malformedRows = 1;
      coverage.errorCode = 'PARSER_ERROR';
    }
    return {
      allItems: [],
      items: [],
      allSubjectCounts: 0,
      returnedSubjectCounts: 0,
      coverage,
      duplicateIds: [],
    };
  }

  const rows = Array.isArray(source.raw) ? source.raw : [];
  coverage.observedRows = Array.isArray(source.raw) ? rows.length : 1;
  const validRows = rows.filter(validPersonRow);
  coverage.validRows = validRows.length;
  coverage.malformedRows = coverage.observedRows - validRows.length;
  if (coverage.malformedRows > 0) coverage.errorCode = 'SCHEMA_DRIFT';

  const groups = new Map<number, PersonAccumulator>();
  const duplicateIds: number[] = [];
  const duplicateIdSet = new Set<number>();
  const conflictingIds = new Set<number>();
  let conflictRows = 0;

  for (const row of validRows) {
    let person = groups.get(row.id);
    if (!person) {
      person = {
        id: row.id,
        type: row.type,
        name: row.name,
        observedRows: 0,
        duplicateRows: 0,
        duplicateRelationRows: 0,
        names: new Set([row.name]),
        types: new Set([row.type]),
        subjects: new Map(),
        relationKeys: new Set(),
        conflictingFields: new Set(),
      };
      groups.set(row.id, person);
    }

    person.observedRows += 1;
    person.names.add(row.name);
    person.types.add(row.type);
    const relationKey = `${row.id}:${row.subject_id}`;
    if (person.observedRows > 1) {
      person.duplicateRows += 1;
      coverage.duplicateRows += 1;
      if (!duplicateIdSet.has(row.id)) {
        duplicateIdSet.add(row.id);
        duplicateIds.push(row.id);
      }
    }
    if (person.relationKeys.has(relationKey)) {
      person.duplicateRelationRows += 1;
      coverage.duplicateRelationRows += 1;
    } else {
      person.relationKeys.add(relationKey);
    }

    const personConflict = row.name !== person.name || row.type !== person.type;
    if (personConflict) {
      conflictRows += 1;
      conflictingIds.add(row.id);
      if (row.name !== person.name) person.conflictingFields.add('name');
      if (row.type !== person.type) person.conflictingFields.add('type');
    }

    const existingSubject = person.subjects.get(row.subject_id);
    if (!existingSubject) {
      person.subjects.set(row.subject_id, {
        subjectId: row.subject_id,
        subjectType: row.subject_type,
        subjectName: row.subject_name,
        subjectNameCn: row.subject_name_cn,
        ...(row.staff !== undefined ? { staff: row.staff } : {}),
        subjectNames: new Set([row.subject_name]),
        subjectNamesCn: new Set([row.subject_name_cn]),
        staffs: new Set(row.staff === undefined ? [] : [row.staff]),
      });
      continue;
    }

    existingSubject.subjectNames.add(row.subject_name);
    existingSubject.subjectNamesCn.add(row.subject_name_cn);
    if (row.staff !== undefined) existingSubject.staffs.add(row.staff);
    const subjectConflict =
      row.subject_type !== existingSubject.subjectType ||
      row.subject_name !== existingSubject.subjectName ||
      row.subject_name_cn !== existingSubject.subjectNameCn ||
      row.staff !== existingSubject.staff;
    if (subjectConflict) {
      conflictRows += 1;
      conflictingIds.add(row.id);
      if (row.subject_type !== existingSubject.subjectType)
        person.conflictingFields.add('subject_type');
      if (row.subject_name !== existingSubject.subjectName)
        person.conflictingFields.add('subject_name');
      if (row.subject_name_cn !== existingSubject.subjectNameCn) {
        person.conflictingFields.add('subject_name_cn');
      }
      if (row.staff !== existingSubject.staff) person.conflictingFields.add('staff');
    }
  }

  const allItems = Array.from(groups.values()).map(personItem);
  const items = allItems.slice(0, maxPersons);
  const allSubjectCounts = Array.from(groups.values()).reduce(
    (total, item) => total + item.subjects.size,
    0,
  );
  const returnedSubjectCounts = items.reduce((total, item) => total + item.subjects.length, 0);
  const nestedTruncated = allSubjectCounts > returnedSubjectCounts;
  coverage.uniqueIdsObserved = allItems.length;
  coverage.returnedRows = items.length;
  coverage.conflictRows = conflictRows;
  coverage.conflictingIds = Array.from(conflictingIds);
  coverage.duplicateIds = duplicateIds;
  coverage.truncated =
    coverage.malformedRows > 0 || allItems.length > items.length || nestedTruncated;
  coverage.state =
    source.outcome !== 'succeeded'
      ? sourceState(source.outcome)
      : coverage.malformedRows > 0 ||
          coverage.duplicateRows > 0 ||
          coverage.conflictRows > 0 ||
          coverage.truncated
        ? 'partial'
        : 'complete';
  return {
    allItems,
    items,
    allSubjectCounts,
    returnedSubjectCounts,
    coverage,
    duplicateIds,
  };
}

function riskNames(item: CharacterCreditSubject | CharacterCreditPerson): string[] {
  if ('subjects' in item) return uniqueStrings([item.name, ...(item.nameVariants || [])]);
  return uniqueStrings([
    item.name,
    item.nameCn,
    ...(item.nameVariants || []),
    ...(item.nameCnVariants || []),
  ]);
}

function riskNameValues(item: CharacterCreditSubject | CharacterCreditPerson): string[] {
  if ('subjects' in item) return uniqueStrings([item.name, ...(item.nameVariants || [])]);
  return uniqueStrings([
    item.name,
    item.nameCn,
    ...(item.nameVariants || []),
    ...(item.nameCnVariants || []),
  ]);
}

function duplicateRisk(
  entity: 'subject' | 'person',
  scope: 'subject_credits' | 'person_credits',
  duplicateIds: readonly number[],
  allItems: readonly (CharacterCreditSubject | CharacterCreditPerson)[],
  duplicateRows: number,
): CharacterCreditIntegrityRisk | undefined {
  if (duplicateIds.length === 0) return undefined;
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const visibleIds = duplicateIds.slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS);
  const visibleNames = uniqueStrings(
    visibleIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? riskNames(item) : [];
    }),
  );
  const allNames = uniqueStrings(
    duplicateIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? riskNames(item) : [];
    }),
  );
  const names = visibleNames.slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS);
  return {
    kind: 'duplicate_stable_id',
    entity,
    scope,
    ids: visibleIds,
    names,
    observedRows: duplicateRows,
    ...(duplicateIds.length > visibleIds.length
      ? { membersOmitted: duplicateIds.length - visibleIds.length }
      : {}),
    ...(allNames.length > names.length ? { namesOmitted: allNames.length - names.length } : {}),
    message:
      entity === 'subject'
        ? '同一官方条目 ID 在角色出演作品响应中重复出现；视图按 ID 去重，但保留重复观测计数。'
        : '同一官方人物 ID 在角色声优响应中重复出现；视图按人物 ID 与作品 ID 去重，但保留重复观测计数。',
  };
}

function sameNameRisks(
  entity: 'subject' | 'person',
  scope: 'subject_credits' | 'person_credits',
  items: readonly (CharacterCreditSubject | CharacterCreditPerson)[],
): CharacterCreditIntegrityRisk[] {
  const byName = new Map<string, { ids: Set<number>; names: Set<string>; observedRows: number }>();
  for (const item of items) {
    const itemKeys = new Set<string>();
    const values = riskNameValues(item);
    for (const value of values) {
      const normalized = normalizedName(value);
      if (!normalized) continue;
      if (itemKeys.has(normalized)) continue;
      itemKeys.add(normalized);
      const group = byName.get(normalized) || {
        ids: new Set<number>(),
        names: new Set<string>(),
        observedRows: 0,
      };
      group.ids.add(item.id);
      group.names.add(value);
      group.observedRows += item.observedRows;
      byName.set(normalized, group);
    }
  }
  return Array.from(byName.entries())
    .filter(([, group]) => group.ids.size > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalized, group]) => {
      const ids = Array.from(group.ids).slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS);
      const names = Array.from(group.names).slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS);
      return {
        kind: 'same_name_distinct_ids' as const,
        entity,
        scope,
        ids,
        names,
        normalizedName: normalized,
        observedRows: group.observedRows,
        ...(group.ids.size > ids.length ? { membersOmitted: group.ids.size - ids.length } : {}),
        ...(group.names.size > names.length
          ? { namesOmitted: group.names.size - names.length }
          : {}),
        message:
          entity === 'subject'
            ? '不同官方条目 ID 共享归一化名称；这是同名碰撞风险，不是条目身份匹配。'
            : '不同官方人物 ID 共享归一化名称；这是同名碰撞风险，不是人物身份匹配。',
      };
    });
}

function stableIdConflictRisks(
  entity: 'subject' | 'person',
  scope: 'subject_credits' | 'person_credits',
  items: readonly (CharacterCreditSubject | CharacterCreditPerson)[],
): CharacterCreditIntegrityRisk[] {
  return items
    .filter((item) => item.conflictingFields.length > 0)
    .map((item) => {
      const allNames = riskNames(item);
      return {
        kind: 'stable_id_name_conflict' as const,
        entity,
        scope,
        ids: [item.id],
        names: allNames.slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS),
        ...(allNames.length > CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS
          ? { namesOmitted: allNames.length - CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS }
          : {}),
        observedRows: item.observedRows,
        message: `官方稳定 ID #${item.id} 的重复观测出现字段冲突（${item.conflictingFields.join('、')}）；未合并为不同实体。`,
      };
    });
}

function makeOperationEvidence(
  source: SourceRead,
  values: {
    observedRows: number;
    returnedRows: number;
    malformedRows: number;
    duplicateRows: number;
    duplicateRelationRows?: number;
    conflictRows: number;
    truncated: boolean;
    errorCode?: string;
  },
): CharacterCreditIntegrityOperationEvidence {
  return {
    source: 'official-v0',
    operation: source.operation,
    attemptedAt: source.attemptedAt,
    ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
    outcome:
      source.outcome === 'succeeded' &&
      (values.malformedRows > 0 ||
        values.duplicateRows > 0 ||
        values.conflictRows > 0 ||
        values.truncated)
        ? 'partial'
        : source.outcome,
    observedRows: values.observedRows,
    returnedRows: values.returnedRows,
    malformedRows: values.malformedRows,
    duplicateRows: values.duplicateRows,
    ...(values.duplicateRelationRows === undefined
      ? {}
      : { duplicateRelationRows: values.duplicateRelationRows }),
    conflictRows: values.conflictRows,
    truncated: values.truncated,
    ...(source.error?.code || values.errorCode
      ? { errorCode: source.error?.code || values.errorCode }
      : {}),
  };
}

function detailCoverage(
  source: SourceRead,
  maxResponseBytes: number,
  valid: boolean,
): CharacterCreditIntegrityDetailCoverage {
  return {
    operation: source.operation as (typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[0],
    state:
      source.outcome === 'succeeded'
        ? valid
          ? 'complete'
          : 'partial'
        : sourceState(source.outcome),
    maxResponseBytes,
    ...(source.error?.code
      ? { errorCode: source.error.code }
      : !valid && source.outcome === 'succeeded'
        ? { errorCode: 'PARSER_ERROR' }
        : {}),
  };
}

function listCoverageForResult(
  source: SourceRead,
  coverage: CharacterCreditIntegrityListCoverage,
): CharacterCreditIntegrityListCoverage {
  if (source.error?.code && !coverage.errorCode) coverage.errorCode = source.error.code;
  return coverage;
}

async function readSource(
  operation: CharacterCreditIntegrityOperation,
  reader: (requestOptions: { signal?: AbortSignal; maxResponseBytes: number }) => Promise<unknown>,
  options: { signal?: AbortSignal; maxResponseBytes: number },
): Promise<SourceRead> {
  const attemptedAt = new Date().toISOString();
  try {
    const raw = await reader(options);
    return {
      operation,
      attemptedAt,
      retrievedAt: new Date().toISOString(),
      outcome: 'succeeded',
      raw,
    };
  } catch (error) {
    const publicError = toPublicError(error);
    return {
      operation,
      attemptedAt,
      outcome: publicError.code === 'NOT_FOUND' ? 'not_found' : 'unavailable',
      error: publicError,
    };
  }
}

function overallState(
  detail: CharacterCreditIntegrityDetailCoverage,
  subjects: CharacterCreditIntegrityListCoverage,
  persons: CharacterCreditIntegrityListCoverage,
  risks: readonly CharacterCreditIntegrityRisk[],
): CharacterCreditIntegrityState {
  if (risks.some((risk) => risk.kind === 'stable_id_name_conflict')) return 'conflict';
  const hasPositiveEvidence =
    detail.state === 'complete' || subjects.validRows > 0 || persons.validRows > 0;
  if (!hasPositiveEvidence) {
    if (detail.state === 'not_found') return 'not_found';
    if (detail.state === 'unavailable') return 'unavailable';
  }
  if (
    detail.state !== 'complete' ||
    subjects.state !== 'complete' ||
    persons.state !== 'complete'
  ) {
    return 'partial';
  }
  return 'complete';
}

function warningForRisk(risk: CharacterCreditIntegrityRisk, state: CharacterCreditIntegrityState) {
  return {
    code:
      risk.kind === 'duplicate_stable_id'
        ? 'DUPLICATE_STABLE_ID'
        : risk.kind === 'same_name_distinct_ids'
          ? 'SAME_NAME_DISTINCT_IDS'
          : 'STABLE_ID_NAME_CONFLICT',
    state,
    message: risk.message,
  };
}

function listWarning(
  label: string,
  coverage: CharacterCreditIntegrityListCoverage,
  state: CharacterCreditIntegrityState,
) {
  if (coverage.state === 'complete') return undefined;
  const details = coverage.errorCode ? `（${coverage.errorCode}）` : '';
  return {
    code: `SOURCE_${coverage.state.toUpperCase()}`,
    state,
    message: `${label}来源为 ${coverage.state}，未把空结果解释为没有${label}。${details}`,
  };
}

export class CharacterCreditIntegrityService {
  private readonly api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.api =
      client instanceof GeneratedBangumiOpenApiClient
        ? client
        : new GeneratedBangumiOpenApiClient(client);
  }

  async getCharacterCreditIntegrity(
    characterId: number,
    options: CharacterCreditIntegrityOptions = {},
  ): Promise<CharacterCreditIntegrityResult> {
    const maxSubjects = boundedInteger(
      options.maxSubjects,
      CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_SUBJECTS,
      CHARACTER_CREDIT_INTEGRITY_MAX_SUBJECTS,
    );
    const maxPersons = boundedInteger(
      options.maxPersons,
      CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_PERSONS,
      CHARACTER_CREDIT_INTEGRITY_MAX_PERSONS,
    );
    const maxResponseBytes = boundedInteger(
      options.maxResponseBytes,
      CHARACTER_CREDIT_INTEGRITY_MAX_RESPONSE_BYTES,
      CHARACTER_CREDIT_INTEGRITY_MAX_RESPONSE_BYTES,
    );
    const requestOptions = { signal: options.signal, maxResponseBytes };

    const [detailSource, subjectSource, personSource] = await Promise.all([
      readSource(
        CHARACTER_CREDIT_INTEGRITY_OPERATIONS[0],
        (request) => this.api.getCharacterById(characterId, request),
        requestOptions,
      ),
      readSource(
        CHARACTER_CREDIT_INTEGRITY_OPERATIONS[1],
        (request) => this.api.getRelatedSubjectsByCharacterId(characterId, request),
        requestOptions,
      ),
      readSource(
        CHARACTER_CREDIT_INTEGRITY_OPERATIONS[2],
        (request) => this.api.getRelatedPersonsByCharacterId(characterId, request),
        requestOptions,
      ),
    ]);

    const detailValid =
      detailSource.outcome === 'succeeded' && validCharacter(detailSource.raw, characterId);
    const character = detailValid ? mapCharacter(detailSource.raw as Character) : undefined;
    const detail = detailCoverage(detailSource, maxResponseBytes, detailValid);
    if (!detailValid && detailSource.outcome === 'succeeded') {
      detailSource.error = errorForCode(
        'PARSER_ERROR',
        'Character detail response did not match the official shape.',
      );
    }
    const subjectsParsed = parseSubjects(subjectSource, maxSubjects);
    const personsParsed = parsePersons(personSource, maxPersons);
    const duplicateSubjectRisk = duplicateRisk(
      'subject',
      'subject_credits',
      subjectsParsed.duplicateIds,
      subjectsParsed.allItems,
      subjectsParsed.coverage.duplicateRows,
    );
    const duplicatePersonRisk = duplicateRisk(
      'person',
      'person_credits',
      personsParsed.duplicateIds,
      personsParsed.allItems,
      personsParsed.coverage.duplicateRows,
    );
    const allRisks = [
      ...stableIdConflictRisks('subject', 'subject_credits', subjectsParsed.allItems),
      ...stableIdConflictRisks('person', 'person_credits', personsParsed.allItems),
      ...(duplicateSubjectRisk ? [duplicateSubjectRisk] : []),
      ...(duplicatePersonRisk ? [duplicatePersonRisk] : []),
      ...sameNameRisks('subject', 'subject_credits', subjectsParsed.allItems),
      ...sameNameRisks('person', 'person_credits', personsParsed.allItems),
    ];
    const riskPriority: Record<CharacterCreditIntegrityRisk['kind'], number> = {
      duplicate_stable_id: 0,
      same_name_distinct_ids: 1,
      stable_id_name_conflict: 2,
    };
    const risks = [...allRisks]
      .sort((left, right) => riskPriority[left.kind] - riskPriority[right.kind])
      .slice(0, CHARACTER_CREDIT_INTEGRITY_MAX_RISKS);
    const state = overallState(detail, subjectsParsed.coverage, personsParsed.coverage, allRisks);

    const detailError =
      detailSource.error ||
      (!detailValid && detailSource.outcome === 'succeeded'
        ? errorForCode(
            'PARSER_ERROR',
            'Character detail response did not match the official shape.',
          )
        : undefined);
    const operationEvidence = [
      makeOperationEvidence(detailSource, {
        observedRows: detailValid || detailSource.outcome === 'succeeded' ? 1 : 0,
        returnedRows: detailValid ? 1 : 0,
        malformedRows: detailValid || detailSource.outcome !== 'succeeded' ? 0 : 1,
        duplicateRows: 0,
        conflictRows: 0,
        truncated: false,
        errorCode: detailSource.error?.code,
      }),
      makeOperationEvidence(subjectSource, {
        ...subjectsParsed.coverage,
        errorCode: subjectsParsed.coverage.errorCode,
      }),
      makeOperationEvidence(personSource, {
        ...personsParsed.coverage,
        errorCode: personsParsed.coverage.errorCode,
      }),
    ];
    const attemptedAt = earliestTimestamp(operationEvidence.map((item) => item.attemptedAt));
    const retrievedAt = latestTimestamp(
      operationEvidence.flatMap((item) => (item.retrievedAt ? [item.retrievedAt] : [])),
    );
    const risksOmitted = Math.max(0, allRisks.length - risks.length);
    const outputTruncated =
      subjectsParsed.coverage.truncated ||
      personsParsed.coverage.truncated ||
      risksOmitted > 0 ||
      personsParsed.allSubjectCounts > personsParsed.returnedSubjectCounts;
    const coverage: CharacterCreditIntegrityCoverage = {
      detail,
      subjects: listCoverageForResult(subjectSource, subjectsParsed.coverage),
      persons: listCoverageForResult(personSource, personsParsed.coverage),
      output: {
        maxSubjects,
        maxPersons,
        returnedSubjects: subjectsParsed.items.length,
        returnedPersons: personsParsed.items.length,
        returnedPersonSubjectCredits: personsParsed.returnedSubjectCounts,
        omittedPersonSubjectCredits: Math.max(
          0,
          personsParsed.allSubjectCounts - personsParsed.returnedSubjectCounts,
        ),
        risksReturned: risks.length,
        risksOmitted,
        truncated: outputTruncated,
      },
    };

    const warnings = [
      ...risks.map((risk) => warningForRisk(risk, state)),
      listWarning('作品', subjectsParsed.coverage, state),
      listWarning('人物', personsParsed.coverage, state),
      ...(outputTruncated
        ? [
            {
              code: 'OUTPUT_TRUNCATED',
              state,
              message: '结果达到已声明的行数、嵌套作品或风险记录上限；coverage 保留省略数量。',
            },
          ]
        : []),
    ].filter((warning): warning is NonNullable<typeof warning> => Boolean(warning));

    const limitations = [
      '范围从调用者提供的单个已知角色 ID 开始，只观察 official v0 角色详情、出演作品和相关人物响应。',
      `作品最多返回 ${maxSubjects} 个稳定条目 ID，人物最多返回 ${maxPersons} 个稳定人物 ID；每个人物最多保留 ${CHARACTER_CREDIT_INTEGRITY_MAX_CREDITS_PER_PERSON} 个作品关系。`,
      '不同 ID 的同名只报告为碰撞风险；本结果不做名称合并、全局搜索或完整性推断。',
      `每个上游响应最多读取 ${maxResponseBytes} 字节；来源失败、schema drift 和截断不会被解释为空结果。`,
    ];
    if (risks.some((risk) => risk.kind === 'stable_id_name_conflict')) {
      limitations.push(
        '稳定 ID 的重复观测出现字段冲突；冲突字段保留在风险记录中，未尝试决定哪个实体正确。',
      );
    }

    return {
      formulaVersion: CHARACTER_CREDIT_INTEGRITY_FORMULA_VERSION,
      state,
      ...(character ? { character } : {}),
      subjectCredits: subjectsParsed.items,
      personCredits: personsParsed.items,
      risks,
      coverage,
      source: {
        class: 'official-v0',
        operations: [...CHARACTER_CREDIT_INTEGRITY_OPERATIONS],
        attemptedAt,
        ...(retrievedAt ? { retrievedAt } : {}),
      },
      operationEvidence,
      warnings,
      limitations,
      ...(state === 'unavailable' || state === 'not_found'
        ? { error: detailError || subjectSource.error || personSource.error }
        : {}),
    };
  }
}
