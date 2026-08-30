import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import type { SubjectCharactersResult } from '../models/character.js';
import type {
  CollectionEntityConsistencyEntity,
  CollectionEntityConsistencyEntityListCoverage,
  CollectionEntityConsistencyConflict,
  CollectionEntityConsistencyMatch,
  CollectionEntityConsistencyOperationEvidence,
  CollectionEntityConsistencyOptions,
  CollectionEntityConsistencyRelationCoverage,
  CollectionEntityConsistencyResult,
  CollectionEntityConsistencyState,
  CollectionEntityConsistencySubject,
  CollectionEntityConsistencySubjectCoverage,
  CollectionEntityConsistencyUnmatched,
} from '../models/collection-entity-consistency.js';
import type { RelationCollection, SubjectStaffMember } from '../models/person.js';
import type {
  UserCollectionItem,
  UserCharacterCollectionItem,
  UserPersonCollectionItem,
} from '../models/user.js';
import { CharacterService } from './character-service.js';
import { PersonService } from './person-service.js';
import { UserService } from './user-service.js';

export const COLLECTION_ENTITY_CONSISTENCY_FORMULA_VERSION =
  'collection-entity-consistency-v1' as const;
export const COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_SUBJECTS = 24;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECTS = 24;
export const COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_SUBJECT_PAGES = 8;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECT_PAGES = 8;
export const COLLECTION_ENTITY_CONSISTENCY_SUBJECT_PAGE_SIZE = 50;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS = 50;
export const COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_RELATIONS_PER_SUBJECT = 80;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_RELATIONS_PER_SUBJECT = 80;
export const COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_OUTPUT_ROWS = 60;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_OUTPUT_ROWS = 60;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES = 1_048_576;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_CONCURRENCY = 4;
export const COLLECTION_ENTITY_CONSISTENCY_MAX_DURATION_MS = 60_000;

const SUBJECT_COLLECTION_OPERATION = 'GET /v0/users/{username}/collections';
const CHARACTER_COLLECTION_OPERATION = 'GET /v0/users/{username}/collections/-/characters';
const PERSON_COLLECTION_OPERATION = 'GET /v0/users/{username}/collections/-/persons';
const SUBJECT_CHARACTER_OPERATION = 'GET /v0/subjects/{subject_id}/characters';
const SUBJECT_PERSON_OPERATION = 'GET /v0/subjects/{subject_id}/persons';
const SOURCE_OPERATIONS = [
  SUBJECT_COLLECTION_OPERATION,
  CHARACTER_COLLECTION_OPERATION,
  PERSON_COLLECTION_OPERATION,
  SUBJECT_CHARACTER_OPERATION,
  SUBJECT_PERSON_OPERATION,
] as const;

interface SubjectRoot {
  subject: CollectionEntityConsistencySubject;
  order: number;
}

interface EntityListObservation {
  items: CollectionEntityConsistencyEntity[];
  coverage: CollectionEntityConsistencyEntityListCoverage;
  failed: boolean;
  conflicts: CollectionEntityConsistencyConflict[];
}

interface SubjectCollectionObservation {
  roots: SubjectRoot[];
  coverage: CollectionEntityConsistencySubjectCoverage;
  failed: boolean;
  conflicts: CollectionEntityConsistencyConflict[];
}

type RelationKind = 'character' | 'person';

interface RelationTask {
  root: SubjectRoot;
  kind: RelationKind;
}

interface RelationTaskResult {
  task: RelationTask;
  attemptedAt: string;
  retrievedAt: string;
  characters?: SubjectCharactersResult;
  persons?: RelationCollection<SubjectStaffMember>;
  errorCode?: string;
}

interface RelationSummary {
  results: RelationTaskResult[];
  coverage: CollectionEntityConsistencyRelationCoverage;
}

interface AggregateDeadline {
  signal: AbortSignal;
  timedOut(): boolean;
  dispose(): void;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function sourceFailureCode(error: unknown): string {
  return toPublicError(error).code;
}

function latestTimestamp(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((latest, value) => (value > latest ? value : latest), values[0]!);
}

function operationOutcome(
  failed: boolean,
  truncated: boolean,
): 'succeeded' | 'partial' | 'unavailable' {
  if (failed) return 'unavailable';
  return truncated ? 'partial' : 'succeeded';
}

function isCollectionStatus(value: unknown): value is UserCollectionItem['status'] {
  return (
    value === 'wish' ||
    value === 'doing' ||
    value === 'done' ||
    value === 'on_hold' ||
    value === 'dropped' ||
    value === 'unknown'
  );
}

function mapSubjectRoot(item: unknown, order: number): SubjectRoot | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const value = item as UserCollectionItem;
  if (
    !positiveInteger(value.subjectId) ||
    !isCollectionStatus(value.status) ||
    (value.subjectName !== undefined && typeof value.subjectName !== 'string') ||
    (value.subjectNameCn !== undefined && typeof value.subjectNameCn !== 'string') ||
    (value.subjectType !== undefined && typeof value.subjectType !== 'string') ||
    (value.statusLabel !== undefined && typeof value.statusLabel !== 'string')
  ) {
    return undefined;
  }
  return {
    order,
    subject: {
      id: value.subjectId,
      ...(value.subjectName ? { name: value.subjectName } : {}),
      ...(value.subjectNameCn ? { nameCn: value.subjectNameCn } : {}),
      ...(value.subjectType ? { type: value.subjectType } : {}),
      status: value.status,
      ...(value.statusLabel ? { statusLabel: value.statusLabel } : {}),
    },
  };
}

function mapCharacterEntity(item: unknown): CollectionEntityConsistencyEntity | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const value = item as UserCharacterCollectionItem;
  if (!positiveInteger(value.id) || typeof value.name !== 'string') return undefined;
  if (!Number.isInteger(value.type) || value.type <= 0) return undefined;
  return { id: value.id, name: value.name, type: value.type };
}

function mapPersonEntity(item: unknown): CollectionEntityConsistencyEntity | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const value = item as UserPersonCollectionItem;
  if (
    !positiveInteger(value.id) ||
    typeof value.name !== 'string' ||
    !Number.isInteger(value.type) ||
    value.type <= 0 ||
    !Array.isArray(value.career) ||
    !value.career.every((career) => typeof career === 'string')
  ) {
    return undefined;
  }
  return { id: value.id, name: value.name, type: value.type, career: [...value.career] };
}

function differingFields(left: Record<string, unknown>, right: Record<string, unknown>): string[] {
  return Object.keys(left).filter(
    (field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]),
  );
}

function subjectConflictFields(left: SubjectRoot, right: SubjectRoot): string[] {
  return differingFields(
    {
      name: left.subject.name,
      nameCn: left.subject.nameCn,
      type: left.subject.type,
      status: left.subject.status,
      statusLabel: left.subject.statusLabel,
    },
    {
      name: right.subject.name,
      nameCn: right.subject.nameCn,
      type: right.subject.type,
      status: right.subject.status,
      statusLabel: right.subject.statusLabel,
    },
  );
}

function entityConflictFields(
  left: CollectionEntityConsistencyEntity,
  right: CollectionEntityConsistencyEntity,
): string[] {
  return differingFields(
    { name: left.name, type: left.type, career: left.career },
    { name: right.name, type: right.type, career: right.career },
  );
}

function createAggregateDeadline(parentSignal?: AbortSignal): AggregateDeadline {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, COLLECTION_ENTITY_CONSISTENCY_MAX_DURATION_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}

function deduplicateEntities(
  items: readonly CollectionEntityConsistencyEntity[],
  scope: CollectionEntityConsistencyConflict['scope'],
): {
  items: CollectionEntityConsistencyEntity[];
  duplicates: number;
  conflictRows: number;
  conflicts: CollectionEntityConsistencyConflict[];
} {
  const seen = new Set<number>();
  const firstById = new Map<number, CollectionEntityConsistencyEntity>();
  const conflictsById = new Map<number, CollectionEntityConsistencyConflict>();
  const unique: CollectionEntityConsistencyEntity[] = [];
  let duplicates = 0;
  let conflictRows = 0;
  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates += 1;
      const first = firstById.get(item.id);
      if (first) {
        const fields = entityConflictFields(first, item);
        const existing = conflictsById.get(item.id);
        if (existing) {
          existing.observed += 1;
          existing.fields = [...new Set([...existing.fields, ...fields])];
        } else if (fields.length > 0) {
          conflictsById.set(item.id, { scope, id: item.id, observed: 2, fields });
        }
        if (fields.length > 0) {
          conflictRows += 1;
        }
      }
      continue;
    }
    seen.add(item.id);
    firstById.set(item.id, item);
    unique.push(item);
  }
  return { items: unique, duplicates, conflictRows, conflicts: Array.from(conflictsById.values()) };
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function matchKey(match: CollectionEntityConsistencyMatch): string {
  return [
    match.subject.id,
    match.entity.kind,
    match.entity.id,
    match.evidenceKind,
    match.viaCharacter?.id ?? '',
    match.relation,
  ].join(':');
}

function entityKey(kind: RelationKind, id: number): string {
  return `${kind}:${id}`;
}

function relationLabel(value: string | undefined): string {
  return value?.trim() || '未知';
}

function sortMatches(
  matches: CollectionEntityConsistencyMatch[],
): CollectionEntityConsistencyMatch[] {
  const evidenceOrder: Record<string, number> = {
    'subject-character': 1,
    'subject-person': 2,
    'character-actor': 3,
  };
  return matches.sort(
    (left, right) =>
      left.subject.id - right.subject.id ||
      (left.entity.kind === right.entity.kind ? 0 : left.entity.kind === 'character' ? -1 : 1) ||
      left.entity.id - right.entity.id ||
      (evidenceOrder[left.evidenceKind] ?? 99) - (evidenceOrder[right.evidenceKind] ?? 99) ||
      left.relation.localeCompare(right.relation),
  );
}

function sortUnmatched(
  items: CollectionEntityConsistencyUnmatched[],
): CollectionEntityConsistencyUnmatched[] {
  return items.sort(
    (left, right) =>
      (left.entity.kind === right.entity.kind ? 0 : left.entity.kind === 'character' ? -1 : 1) ||
      left.entity.id - right.entity.id,
  );
}

export class CollectionEntityConsistencyService {
  private readonly userService: UserService;
  private readonly characterService: CharacterService;
  private readonly personService: PersonService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.userService = new UserService(client);
    this.characterService = new CharacterService(client);
    this.personService = new PersonService(client);
  }

  async getCollectionEntityConsistency(
    username: string,
    options: CollectionEntityConsistencyOptions = {},
  ): Promise<CollectionEntityConsistencyResult> {
    const deadline = createAggregateDeadline(options.signal);
    try {
      return await this.getCollectionEntityConsistencyWithinDeadline(username, options, deadline);
    } finally {
      deadline.dispose();
    }
  }

  private async getCollectionEntityConsistencyWithinDeadline(
    username: string,
    options: CollectionEntityConsistencyOptions,
    deadline: AggregateDeadline,
  ): Promise<CollectionEntityConsistencyResult> {
    const maxSubjects = boundedInteger(
      options.maxSubjects,
      COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_SUBJECTS,
      COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECTS,
    );
    const maxSubjectPages = boundedInteger(
      options.maxSubjectPages,
      COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_SUBJECT_PAGES,
      COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECT_PAGES,
    );
    const maxRelationsPerSubject = boundedInteger(
      options.maxRelationsPerSubject,
      COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_RELATIONS_PER_SUBJECT,
      COLLECTION_ENTITY_CONSISTENCY_MAX_RELATIONS_PER_SUBJECT,
    );
    const maxOutputRows = boundedInteger(
      options.maxOutputRows,
      COLLECTION_ENTITY_CONSISTENCY_DEFAULT_MAX_OUTPUT_ROWS,
      COLLECTION_ENTITY_CONSISTENCY_MAX_OUTPUT_ROWS,
    );
    const operationEvidence: CollectionEntityConsistencyOperationEvidence[] = [];

    const subjectObservation = await this.collectSubjectRoots(
      username,
      options,
      maxSubjects,
      maxSubjectPages,
      operationEvidence,
      deadline.signal,
    );
    const [characterObservation, personObservation] = await Promise.all([
      this.collectCharacterEntities(username, operationEvidence, deadline.signal),
      this.collectPersonEntities(username, operationEvidence, deadline.signal),
    ]);

    const characterById = new Map(characterObservation.items.map((item) => [item.id, item]));
    const personById = new Map(personObservation.items.map((item) => [item.id, item]));
    const roots = subjectObservation.roots;
    const shouldReadRelations =
      roots.length > 0 &&
      (characterById.size > 0 ||
        personById.size > 0 ||
        characterObservation.failed ||
        personObservation.failed);
    const relationSummary = shouldReadRelations
      ? await this.readRelations(roots, maxRelationsPerSubject, operationEvidence, deadline.signal)
      : ({
          results: [],
          coverage: {
            maxConcurrency: COLLECTION_ENTITY_CONSISTENCY_MAX_CONCURRENCY,
            maxRowsPerSubject: maxRelationsPerSubject,
            maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
            rootsRequested: 0,
            rootsSucceeded: 0,
            rootsFailed: 0,
            sourceRequestsAttempted: 0,
            sourceRequestsSucceeded: 0,
            sourceRequestsFailed: 0,
            rowsObserved: 0,
            rowsReturned: 0,
            rowsDroppedAtLimit: 0,
            schemaDriftRows: 0,
            invalidActorIdRows: 0,
            failedSubjectIds: [],
            skipped: true,
            truncated: false,
          },
        } satisfies RelationSummary);

    const matches: CollectionEntityConsistencyMatch[] = [];
    const matchKeys = new Set<string>();
    const matchedEntityKeys = new Set<string>();
    const relationSuccess = new Map<
      number,
      { character: RelationTaskResult; person: RelationTaskResult }
    >();

    for (const result of relationSummary.results) {
      const existing =
        relationSuccess.get(result.task.root.subject.id) ||
        ({} as { character: RelationTaskResult; person: RelationTaskResult });
      existing[result.task.kind] = result;
      relationSuccess.set(result.task.root.subject.id, existing);
      if (result.errorCode) continue;

      if (result.task.kind === 'character' && result.characters) {
        for (const item of result.characters.items) {
          const character = characterById.get(item.character.id);
          if (character) {
            this.addMatch(matches, matchKeys, {
              subject: result.task.root.subject,
              entity: { ...character, kind: 'character' },
              evidenceKind: 'subject-character',
              relation: relationLabel(item.relation),
              source: {
                class: 'official-v0',
                operation: SUBJECT_CHARACTER_OPERATION,
                subjectId: result.task.root.subject.id,
                retrievedAt: result.retrievedAt,
              },
            });
            matchedEntityKeys.add(entityKey('character', character.id));
          }

          for (const actor of item.actors) {
            const person = personById.get(actor.id);
            if (!person) continue;
            this.addMatch(matches, matchKeys, {
              subject: result.task.root.subject,
              entity: { ...person, kind: 'person' },
              evidenceKind: 'character-actor',
              relation: relationLabel(item.relation),
              viaCharacter: { id: item.character.id, name: item.character.name },
              source: {
                class: 'official-v0',
                operation: SUBJECT_CHARACTER_OPERATION,
                subjectId: result.task.root.subject.id,
                retrievedAt: result.retrievedAt,
              },
            });
            matchedEntityKeys.add(entityKey('person', person.id));
          }
        }
      }

      if (result.task.kind === 'person' && result.persons) {
        for (const item of result.persons.items) {
          const person = personById.get(item.id);
          if (!person) continue;
          this.addMatch(matches, matchKeys, {
            subject: result.task.root.subject,
            entity: { ...person, kind: 'person' },
            evidenceKind: 'subject-person',
            relation: relationLabel(item.relation),
            source: {
              class: 'official-v0',
              operation: SUBJECT_PERSON_OPERATION,
              subjectId: result.task.root.subject.id,
              retrievedAt: result.retrievedAt,
            },
          });
          matchedEntityKeys.add(entityKey('person', person.id));
        }
      }
    }

    const unmatched: CollectionEntityConsistencyUnmatched[] = [];
    const conflictedSubjectIds = new Set(
      subjectObservation.conflicts
        .filter((conflict) => conflict.scope === 'subject-root')
        .map((conflict) => conflict.id),
    );
    if (
      characterObservation.conflicts.length === 0 &&
      characterObservation.coverage.malformedRows === 0 &&
      this.relationKindComplete(roots, relationSuccess, 'character', conflictedSubjectIds)
    ) {
      for (const entity of characterObservation.items) {
        if (!matchedEntityKeys.has(entityKey('character', entity.id))) {
          unmatched.push({
            entity: { ...entity, kind: 'character' },
            scope: 'selected-subject-roots',
          });
        }
      }
    }
    if (
      personObservation.conflicts.length === 0 &&
      personObservation.coverage.malformedRows === 0 &&
      this.relationKindComplete(roots, relationSuccess, 'character', conflictedSubjectIds) &&
      this.relationKindComplete(roots, relationSuccess, 'person', conflictedSubjectIds)
    ) {
      for (const entity of personObservation.items) {
        if (!matchedEntityKeys.has(entityKey('person', entity.id))) {
          unmatched.push({
            entity: { ...entity, kind: 'person' },
            scope: 'selected-subject-roots',
          });
        }
      }
    }

    const orderedMatches = sortMatches(matches);
    const orderedUnmatched = sortUnmatched(unmatched);
    const combinedRows = [
      ...orderedMatches.map((item) => ({ kind: 'match' as const, item })),
      ...orderedUnmatched.map((item) => ({ kind: 'unmatched' as const, item })),
    ];
    const returnedRows = combinedRows.slice(0, maxOutputRows);
    const returnedMatches = returnedRows.flatMap((row) => (row.kind === 'match' ? [row.item] : []));
    const returnedUnmatched = returnedRows.flatMap((row) =>
      row.kind === 'unmatched' ? [row.item] : [],
    );
    const outputTruncated = returnedRows.length < combinedRows.length;

    const state = this.overallState(
      subjectObservation,
      characterObservation,
      personObservation,
      relationSummary.coverage,
      roots,
      matches.length,
      outputTruncated,
      deadline.timedOut(),
    );
    const warnings = this.buildWarnings(
      state,
      subjectObservation.coverage,
      characterObservation.coverage,
      personObservation.coverage,
      relationSummary.coverage,
      outputTruncated,
      deadline.timedOut(),
    );
    const orderedOperationEvidence = [...operationEvidence].sort(
      (left, right) =>
        left.operation.localeCompare(right.operation) ||
        (left.subjectId ?? -1) - (right.subjectId ?? -1) ||
        left.attemptedAt.localeCompare(right.attemptedAt),
    );
    const retrievedAt = latestTimestamp(
      orderedOperationEvidence.flatMap((item) => (item.retrievedAt ? [item.retrievedAt] : [])),
    );

    return {
      state,
      account: { username },
      filters: {
        ...(options.subjectType === undefined ? {} : { subjectType: String(options.subjectType) }),
        ...(options.status === undefined ? {} : { status: String(options.status) }),
      },
      matches: returnedMatches,
      unmatchedInObservedScope: returnedUnmatched,
      conflicts: [
        ...subjectObservation.conflicts,
        ...characterObservation.conflicts,
        ...personObservation.conflicts,
      ].sort((left, right) => left.scope.localeCompare(right.scope) || left.id - right.id),
      coverage: {
        state,
        subjectCollections: subjectObservation.coverage,
        entityCollections: {
          characters: characterObservation.coverage,
          persons: personObservation.coverage,
        },
        relations: relationSummary.coverage,
        output: {
          maxRows: maxOutputRows,
          matchesObserved: orderedMatches.length,
          matchesReturned: returnedMatches.length,
          unmatchedObserved: orderedUnmatched.length,
          unmatchedReturned: returnedUnmatched.length,
          rowsDroppedAtLimit: combinedRows.length - returnedRows.length,
          truncated: outputTruncated,
        },
      },
      formulaVersion: COLLECTION_ENTITY_CONSISTENCY_FORMULA_VERSION,
      source: {
        class: 'official-v0',
        operations: SOURCE_OPERATIONS.filter((operation) =>
          orderedOperationEvidence.some((evidence) => evidence.operation === operation),
        ),
        authScope: 'account',
        ...(retrievedAt ? { retrievedAt } : {}),
      },
      operationEvidence: orderedOperationEvidence,
      warnings,
      limitations: [
        '只读取当前绑定账号；结果是本次官方 v0 观察，不比较其他账号，也不保存或推断收藏历史。',
        '匹配只使用条目、角色和人物的稳定 ID；不使用名称相似度，也不把 character actor 证据改写成直接人物职员关系。',
        '“未匹配”只表示在已观察的收藏条目根和已成功读取的关系范围内未看到链接；未观察到不等于不存在。',
        `收藏条目最多扫描 ${maxSubjectPages} 页并选取 ${maxSubjects} 个根条目；每个根的角色/人物关系最多各返回 ${maxRelationsPerSubject} 行，关系请求并发上限为 ${COLLECTION_ENTITY_CONSISTENCY_MAX_CONCURRENCY}，单响应上限为 ${COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES} 字节。`,
        '默认不返回评论、标签、图片或令牌，不使用 updated_at 推断收藏时间或变化历史。',
      ],
    };
  }

  private async collectSubjectRoots(
    username: string,
    options: CollectionEntityConsistencyOptions,
    maxSubjects: number,
    maxSubjectPages: number,
    operationEvidence: CollectionEntityConsistencyOperationEvidence[],
    signal: AbortSignal,
  ): Promise<SubjectCollectionObservation> {
    const rootsById = new Map<number, SubjectRoot>();
    const observedRootsById = new Map<number, SubjectRoot>();
    const conflictsById = new Map<number, CollectionEntityConsistencyConflict>();
    let pagesAttempted = 0;
    let pagesSucceeded = 0;
    let sourceTotal: number | undefined;
    let rowsObserved = 0;
    let malformedRows = 0;
    let conflictRows = 0;
    let duplicateSubjectIds = 0;
    const observedSubjectIds = new Set<number>();
    let failed = false;
    let stalled = false;
    let sourceExhausted = false;
    let selectionTruncated = false;
    let offset = 0;

    for (let page = 0; page < maxSubjectPages; page += 1) {
      pagesAttempted += 1;
      const attemptedAt = new Date().toISOString();
      try {
        const result = await this.userService.getUserCollections(username, {
          subjectType: options.subjectType,
          type: options.status,
          limit: COLLECTION_ENTITY_CONSISTENCY_SUBJECT_PAGE_SIZE,
          offset,
          signal,
          maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
        });
        const retrievedAt = new Date().toISOString();
        pagesSucceeded += 1;
        sourceTotal ??= result.total;
        const pageMalformedRows = result.invalidRows ?? 0;
        const pageObservedRows = result.items.length + pageMalformedRows;
        rowsObserved += pageObservedRows;
        malformedRows += pageMalformedRows;
        let pageMappedMalformedRows = 0;
        let pageConflictRows = 0;
        for (const item of result.items) {
          const root = mapSubjectRoot(item, rootsById.size);
          if (!root) {
            pageMappedMalformedRows += 1;
            continue;
          }
          const existing = observedRootsById.get(root.subject.id);
          if (existing) {
            duplicateSubjectIds += 1;
            const fields = subjectConflictFields(existing, root);
            if (fields.length > 0) {
              pageConflictRows += 1;
              const conflict = conflictsById.get(root.subject.id);
              if (conflict) {
                conflict.observed += 1;
                conflict.fields = [...new Set([...conflict.fields, ...fields])];
              } else {
                conflictsById.set(root.subject.id, {
                  scope: 'subject-root',
                  id: root.subject.id,
                  observed: 2,
                  fields,
                });
              }
            }
          } else {
            observedRootsById.set(root.subject.id, root);
            observedSubjectIds.add(root.subject.id);
          }
          if (!rootsById.has(root.subject.id) && rootsById.size < maxSubjects) {
            rootsById.set(root.subject.id, { ...root, order: rootsById.size });
          }
        }
        malformedRows += pageMappedMalformedRows;
        conflictRows += pageConflictRows;
        if (observedSubjectIds.size > maxSubjects) selectionTruncated = true;

        const hasMore =
          result.total !== undefined
            ? result.offset + pageObservedRows < result.total
            : pageObservedRows >= result.limit && pageObservedRows > 0;
        operationEvidence.push({
          source: 'official-v0',
          operation: SUBJECT_COLLECTION_OPERATION,
          attemptedAt,
          retrievedAt,
          outcome: hasMore ? 'partial' : 'succeeded',
          observed: pageObservedRows,
          returned: result.items.length,
          truncated: hasMore,
          ...(pageMalformedRows + pageMappedMalformedRows > 0
            ? { malformedRows: pageMalformedRows + pageMappedMalformedRows }
            : {}),
          ...(pageConflictRows > 0 ? { conflictRows: pageConflictRows } : {}),
        });

        if (!hasMore) {
          sourceExhausted = true;
          break;
        }
        if (rootsById.size >= maxSubjects) {
          selectionTruncated = true;
          break;
        }
        const nextOffset = result.offset + pageObservedRows;
        if (nextOffset <= offset) {
          stalled = true;
          break;
        }
        offset = nextOffset;
      } catch (error) {
        failed = true;
        operationEvidence.push({
          source: 'official-v0',
          operation: SUBJECT_COLLECTION_OPERATION,
          attemptedAt,
          outcome: 'unavailable',
          errorCode: sourceFailureCode(error),
        });
        break;
      }
    }

    const pageCapReached = pagesAttempted >= maxSubjectPages && !sourceExhausted;
    const coverage: CollectionEntityConsistencySubjectCoverage = {
      operation: SUBJECT_COLLECTION_OPERATION,
      maxPages: maxSubjectPages,
      maxRoots: maxSubjects,
      pagesAttempted,
      pagesSucceeded,
      ...(sourceTotal === undefined ? {} : { sourceTotal }),
      rowsObserved,
      uniqueRootsObserved: observedSubjectIds.size,
      rootsSelected: rootsById.size,
      malformedRows,
      conflictRows,
      conflictingSubjectIds: Array.from(conflictsById.keys()).sort((left, right) => left - right),
      duplicateSubjectIds,
      truncated:
        failed ||
        stalled ||
        pageCapReached ||
        selectionTruncated ||
        malformedRows > 0 ||
        conflictRows > 0,
      stalled,
      failed,
    };
    return {
      roots: Array.from(rootsById.values()).sort((left, right) => left.order - right.order),
      coverage,
      failed,
      conflicts: Array.from(conflictsById.values()).sort((left, right) => left.id - right.id),
    };
  }

  private async collectCharacterEntities(
    username: string,
    operationEvidence: CollectionEntityConsistencyOperationEvidence[],
    signal: AbortSignal,
  ): Promise<EntityListObservation> {
    const attemptedAt = new Date().toISOString();
    try {
      const result = await this.userService.getUserCharacterCollections(username, {
        maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
        signal,
        maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
      });
      const retrievedAt = new Date().toISOString();
      let malformedRows = result.invalidRows ?? 0;
      const mapped = result.items.flatMap((item) => {
        const entity = mapCharacterEntity(item);
        if (!entity) malformedRows += 1;
        return entity ? [entity] : [];
      });
      const unique = deduplicateEntities(mapped, 'character-collection');
      const state =
        result.truncated || malformedRows > 0 || unique.conflicts.length > 0
          ? ('partial' as const)
          : ('complete' as const);
      operationEvidence.push({
        source: 'official-v0',
        operation: CHARACTER_COLLECTION_OPERATION,
        attemptedAt,
        retrievedAt,
        outcome: operationOutcome(false, state === 'partial'),
        observed: result.observed,
        returned: result.returned,
        truncated: state === 'partial',
        ...(malformedRows > 0 ? { malformedRows } : {}),
        ...(unique.conflictRows > 0 ? { conflictRows: unique.conflictRows } : {}),
      });
      return {
        items: unique.items,
        failed: false,
        conflicts: unique.conflicts,
        coverage: {
          operation: CHARACTER_COLLECTION_OPERATION,
          state,
          maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
          ...(result.total === undefined ? {} : { sourceTotal: result.total }),
          observed: result.observed,
          returned: result.returned,
          malformedRows,
          conflictRows: unique.conflictRows,
          conflictingIds: unique.conflicts.map((conflict) => conflict.id),
          truncated: state === 'partial',
          duplicateIds: unique.duplicates,
        },
      };
    } catch (error) {
      operationEvidence.push({
        source: 'official-v0',
        operation: CHARACTER_COLLECTION_OPERATION,
        attemptedAt,
        outcome: 'unavailable',
        errorCode: sourceFailureCode(error),
      });
      return {
        items: [],
        failed: true,
        coverage: {
          operation: CHARACTER_COLLECTION_OPERATION,
          state: 'unavailable',
          maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
          observed: 0,
          returned: 0,
          malformedRows: 0,
          conflictRows: 0,
          conflictingIds: [],
          truncated: false,
          duplicateIds: 0,
        },
        conflicts: [],
      };
    }
  }

  private async collectPersonEntities(
    username: string,
    operationEvidence: CollectionEntityConsistencyOperationEvidence[],
    signal: AbortSignal,
  ): Promise<EntityListObservation> {
    const attemptedAt = new Date().toISOString();
    try {
      const result = await this.userService.getUserPersonCollections(username, {
        maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
        signal,
        maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
      });
      const retrievedAt = new Date().toISOString();
      let malformedRows = result.invalidRows ?? 0;
      const mapped = result.items.flatMap((item) => {
        const entity = mapPersonEntity(item);
        if (!entity) malformedRows += 1;
        return entity ? [entity] : [];
      });
      const unique = deduplicateEntities(mapped, 'person-collection');
      const state =
        result.truncated || malformedRows > 0 || unique.conflicts.length > 0
          ? ('partial' as const)
          : ('complete' as const);
      operationEvidence.push({
        source: 'official-v0',
        operation: PERSON_COLLECTION_OPERATION,
        attemptedAt,
        retrievedAt,
        outcome: operationOutcome(false, state === 'partial'),
        observed: result.observed,
        returned: result.returned,
        truncated: state === 'partial',
        ...(malformedRows > 0 ? { malformedRows } : {}),
        ...(unique.conflictRows > 0 ? { conflictRows: unique.conflictRows } : {}),
      });
      return {
        items: unique.items,
        failed: false,
        conflicts: unique.conflicts,
        coverage: {
          operation: PERSON_COLLECTION_OPERATION,
          state,
          maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
          ...(result.total === undefined ? {} : { sourceTotal: result.total }),
          observed: result.observed,
          returned: result.returned,
          malformedRows,
          conflictRows: unique.conflictRows,
          conflictingIds: unique.conflicts.map((conflict) => conflict.id),
          truncated: state === 'partial',
          duplicateIds: unique.duplicates,
        },
      };
    } catch (error) {
      operationEvidence.push({
        source: 'official-v0',
        operation: PERSON_COLLECTION_OPERATION,
        attemptedAt,
        outcome: 'unavailable',
        errorCode: sourceFailureCode(error),
      });
      return {
        items: [],
        failed: true,
        coverage: {
          operation: PERSON_COLLECTION_OPERATION,
          state: 'unavailable',
          maxItems: COLLECTION_ENTITY_CONSISTENCY_MAX_ENTITY_ITEMS,
          observed: 0,
          returned: 0,
          malformedRows: 0,
          conflictRows: 0,
          conflictingIds: [],
          truncated: false,
          duplicateIds: 0,
        },
        conflicts: [],
      };
    }
  }

  private async readRelations(
    roots: readonly SubjectRoot[],
    maxRelationsPerSubject: number,
    operationEvidence: CollectionEntityConsistencyOperationEvidence[],
    signal: AbortSignal,
  ): Promise<RelationSummary> {
    const tasks: RelationTask[] = roots.flatMap((root) => [
      { root, kind: 'character' as const },
      { root, kind: 'person' as const },
    ]);
    const results = await mapConcurrent(
      tasks,
      COLLECTION_ENTITY_CONSISTENCY_MAX_CONCURRENCY,
      async (task): Promise<RelationTaskResult> => {
        const attemptedAt = new Date().toISOString();
        try {
          if (task.kind === 'character') {
            const characters = await this.characterService.getSubjectCharactersWithCoverage(
              task.root.subject.id,
              {
                limit: maxRelationsPerSubject,
                maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
                signal,
              },
            );
            const retrievedAt = new Date().toISOString();
            operationEvidence.push({
              source: 'official-v0',
              operation: SUBJECT_CHARACTER_OPERATION,
              subjectId: task.root.subject.id,
              attemptedAt,
              retrievedAt,
              outcome: characters.coverage.truncated ? 'partial' : 'succeeded',
              observed: characters.coverage.observed,
              returned: characters.coverage.returned,
              truncated: characters.coverage.truncated,
            });
            return { task, attemptedAt, retrievedAt, characters };
          }
          const persons = await this.personService.getSubjectStaff(
            task.root.subject.id,
            maxRelationsPerSubject,
            { maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES, signal },
          );
          const retrievedAt = new Date().toISOString();
          operationEvidence.push({
            source: 'official-v0',
            operation: SUBJECT_PERSON_OPERATION,
            subjectId: task.root.subject.id,
            attemptedAt,
            retrievedAt,
            outcome: persons.truncated ? 'partial' : 'succeeded',
            observed: persons.observed,
            returned: persons.returned,
            truncated: persons.truncated,
          });
          return { task, attemptedAt, retrievedAt, persons };
        } catch (error) {
          operationEvidence.push({
            source: 'official-v0',
            operation:
              task.kind === 'character' ? SUBJECT_CHARACTER_OPERATION : SUBJECT_PERSON_OPERATION,
            subjectId: task.root.subject.id,
            attemptedAt,
            outcome: 'unavailable',
            errorCode: sourceFailureCode(error),
          });
          return {
            task,
            attemptedAt,
            retrievedAt: new Date().toISOString(),
            errorCode: sourceFailureCode(error),
          };
        }
      },
    );

    const rootStatus = new Map<number, { character: boolean; person: boolean }>();
    for (const root of roots) rootStatus.set(root.subject.id, { character: false, person: false });
    const failedSubjectIds = new Set<number>();
    let sourceRequestsSucceeded = 0;
    let sourceRequestsFailed = 0;
    let rowsObserved = 0;
    let rowsReturned = 0;
    let rowsDroppedAtLimit = 0;
    let schemaDriftRows = 0;
    let invalidActorIdRows = 0;
    let truncated = false;

    for (const result of results) {
      const status = rootStatus.get(result.task.root.subject.id)!;
      if (result.errorCode) {
        sourceRequestsFailed += 1;
        failedSubjectIds.add(result.task.root.subject.id);
        continue;
      }
      sourceRequestsSucceeded += 1;
      status[result.task.kind] = true;
      if (result.task.kind === 'character' && result.characters) {
        const coverage = result.characters.coverage;
        rowsObserved += coverage.observed;
        rowsReturned += coverage.returned;
        rowsDroppedAtLimit += Math.max(0, coverage.observed - coverage.returned);
        schemaDriftRows += coverage.schemaDriftRows;
        invalidActorIdRows += coverage.invalidActorIdRows;
        truncated ||= coverage.truncated;
      }
      if (result.task.kind === 'person' && result.persons) {
        rowsObserved += result.persons.observed;
        rowsReturned += result.persons.returned;
        rowsDroppedAtLimit += Math.max(0, result.persons.observed - result.persons.returned);
        schemaDriftRows += result.persons.schemaDriftRows ?? 0;
        truncated ||= result.persons.truncated;
      }
    }

    for (const [subjectId, status] of rootStatus) {
      if (status.character && status.person) continue;
      if (sourceRequestsFailed > 0) failedSubjectIds.add(subjectId);
    }
    const rootsFailed = Array.from(rootStatus.values()).filter(
      (status) => !status.character || !status.person,
    ).length;
    const coverage: CollectionEntityConsistencyRelationCoverage = {
      maxConcurrency: COLLECTION_ENTITY_CONSISTENCY_MAX_CONCURRENCY,
      maxRowsPerSubject: maxRelationsPerSubject,
      maxResponseBytes: COLLECTION_ENTITY_CONSISTENCY_MAX_RESPONSE_BYTES,
      rootsRequested: roots.length,
      rootsSucceeded: roots.length - rootsFailed,
      rootsFailed,
      sourceRequestsAttempted: tasks.length,
      sourceRequestsSucceeded,
      sourceRequestsFailed,
      rowsObserved,
      rowsReturned,
      rowsDroppedAtLimit,
      schemaDriftRows,
      invalidActorIdRows,
      failedSubjectIds: Array.from(failedSubjectIds).sort((left, right) => left - right),
      skipped: false,
      truncated: truncated || sourceRequestsFailed > 0 || rowsDroppedAtLimit > 0,
    };
    return { results, coverage };
  }

  private addMatch(
    matches: CollectionEntityConsistencyMatch[],
    keys: Set<string>,
    match: CollectionEntityConsistencyMatch,
  ): void {
    const key = matchKey(match);
    if (keys.has(key)) return;
    keys.add(key);
    matches.push(match);
  }

  private relationKindComplete(
    roots: readonly SubjectRoot[],
    relationSuccess: Map<number, { character: RelationTaskResult; person: RelationTaskResult }>,
    kind: RelationKind,
    conflictedSubjectIds: ReadonlySet<number>,
  ): boolean {
    if (roots.length === 0) return false;
    return roots.every((root) => {
      if (conflictedSubjectIds.has(root.subject.id)) return false;
      const result = relationSuccess.get(root.subject.id)?.[kind];
      if (!result || result.errorCode) return false;
      if (kind === 'character' && result.characters) {
        return (
          !result.characters.coverage.truncated &&
          result.characters.coverage.schemaDriftRows === 0 &&
          result.characters.coverage.invalidActorIdRows === 0
        );
      }
      if (kind === 'person' && result.persons) {
        return !result.persons.truncated && (result.persons.schemaDriftRows ?? 0) === 0;
      }
      return false;
    });
  }

  private overallState(
    subjects: SubjectCollectionObservation,
    characters: EntityListObservation,
    persons: EntityListObservation,
    relations: CollectionEntityConsistencyRelationCoverage,
    roots: readonly SubjectRoot[],
    matchCount: number,
    outputTruncated: boolean,
    deadlineExpired: boolean,
  ): CollectionEntityConsistencyState {
    if (deadlineExpired) {
      const successfulSources =
        subjects.coverage.pagesSucceeded +
        (characters.failed ? 0 : 1) +
        (persons.failed ? 0 : 1) +
        relations.sourceRequestsSucceeded;
      return successfulSources === 0 ? 'unavailable' : 'partial';
    }
    if (subjects.failed && subjects.coverage.pagesSucceeded === 0) return 'unavailable';
    if (
      characters.failed &&
      persons.failed &&
      characters.coverage.state === 'unavailable' &&
      persons.coverage.state === 'unavailable'
    ) {
      return 'unavailable';
    }
    if (
      roots.length > 0 &&
      relations.sourceRequestsAttempted > 0 &&
      relations.sourceRequestsSucceeded === 0 &&
      matchCount === 0
    ) {
      return 'not_computable';
    }
    if (
      subjects.failed ||
      characters.failed ||
      persons.failed ||
      subjects.coverage.truncated ||
      subjects.coverage.malformedRows > 0 ||
      subjects.coverage.conflictRows > 0 ||
      characters.coverage.truncated ||
      characters.coverage.malformedRows > 0 ||
      characters.coverage.conflictRows > 0 ||
      persons.coverage.truncated ||
      persons.coverage.malformedRows > 0 ||
      persons.coverage.conflictRows > 0 ||
      relations.truncated ||
      relations.schemaDriftRows > 0 ||
      relations.invalidActorIdRows > 0 ||
      outputTruncated
    ) {
      return 'partial';
    }
    return 'complete';
  }

  private buildWarnings(
    state: CollectionEntityConsistencyState,
    subjects: CollectionEntityConsistencySubjectCoverage,
    characters: CollectionEntityConsistencyEntityListCoverage,
    persons: CollectionEntityConsistencyEntityListCoverage,
    relations: CollectionEntityConsistencyRelationCoverage,
    outputTruncated: boolean,
    deadlineExpired: boolean,
  ): Array<{ code: string; state: CollectionEntityConsistencyState; message: string }> {
    const warnings: Array<{
      code: string;
      state: CollectionEntityConsistencyState;
      message: string;
    }> = [];
    if (deadlineExpired) {
      warnings.push({
        code: 'COLLECTION_DEADLINE_EXCEEDED',
        state: state === 'unavailable' ? 'unavailable' : 'partial',
        message: `本次一致性观察达到 ${COLLECTION_ENTITY_CONSISTENCY_MAX_DURATION_MS} 毫秒总时限；结果只保留截止前成功读取的证据。`,
      });
    }
    if (subjects.truncated) {
      warnings.push({
        code: 'COLLECTION_SUBJECT_SCOPE_TRUNCATED',
        state: 'partial',
        message: '收藏条目扫描达到页数或根条目上限；未选入的条目不参与本次关系判断。',
      });
    }
    if (characters.truncated || persons.truncated) {
      warnings.push({
        code: 'COLLECTION_ENTITY_SCOPE_TRUNCATED',
        state: 'partial',
        message: '角色或人物收藏列表达到观察上限；未观察到的收藏实体不参与本次判断。',
      });
    }
    if (
      subjects.malformedRows > 0 ||
      subjects.conflictRows > 0 ||
      characters.malformedRows > 0 ||
      characters.conflictRows > 0 ||
      persons.malformedRows > 0 ||
      persons.conflictRows > 0
    ) {
      warnings.push({
        code: 'COLLECTION_SOURCE_SCHEMA_DRIFT',
        state: 'partial',
        message: '官方收藏源包含格式异常或同一稳定 ID 的冲突观察；相关未匹配结论已被抑制。',
      });
    }
    if (subjects.failed || characters.state === 'unavailable' || persons.state === 'unavailable') {
      warnings.push({
        code: 'COLLECTION_SOURCE_UNAVAILABLE',
        state: state === 'unavailable' ? 'unavailable' : 'partial',
        message: '至少一个官方收藏源读取失败；结果保留可确认的正向证据，不补造缺失结果。',
      });
    }
    if (
      relations.sourceRequestsFailed > 0 ||
      relations.truncated ||
      relations.schemaDriftRows > 0 ||
      relations.invalidActorIdRows > 0
    ) {
      warnings.push({
        code: 'COLLECTION_RELATION_COVERAGE_PARTIAL',
        state: state === 'not_computable' ? 'not_computable' : 'partial',
        message: '部分条目关系读取失败或达到行数/响应大小上限；未匹配项不能解释为全局不存在。',
      });
    }
    if (outputTruncated) {
      warnings.push({
        code: 'COLLECTION_OUTPUT_TRUNCATED',
        state: 'partial',
        message: '正向匹配和观察范围内未匹配项达到输出上限；完整观察数量仍见 coverage。',
      });
    }
    if (state !== 'complete' && warnings.length === 0) {
      warnings.push({
        code: 'COLLECTION_CONSISTENCY_DEGRADED',
        state,
        message: '当前结果覆盖不完整；只应把它当作本次观察到的证据。',
      });
    }
    return warnings;
  }
}
