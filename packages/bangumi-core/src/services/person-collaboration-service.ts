import { GeneratedBangumiOpenApiClient, type components } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { mapPerson } from './person-service.js';
import { mapSubjectType } from './subject-service.js';
import type { SubjectType } from '../models/subject.js';
import {
  PersonCollaborationCollaborator,
  PersonCollaborationExclusion,
  PersonCollaborationExclusionReason,
  PersonCollaborationKind,
  PersonCollaborationRelationKind,
  PersonCollaborationResult,
  PersonCollaborationSharedSubject,
  PersonCollaborationSourceOperation,
  PersonCollaborationState,
  PersonCollaborationOptions,
} from '../models/person-collaboration.js';

export const PERSON_COLLABORATION_FORMULA_VERSION = 'person-collaboration-v1';
export const PERSON_COLLABORATION_FANOUT_CONCURRENCY = 4;
export const PERSON_COLLABORATION_MAX_RELATIONS = 120;
export const PERSON_COLLABORATION_MAX_SUBJECTS = 36;
export const PERSON_COLLABORATION_MAX_COLLABORATORS = 50;
export const PERSON_COLLABORATION_MAX_SHARED_SUBJECTS = 20;

type RelatedPerson = components['schemas']['RelatedPerson'];
type RelatedCharacter = components['schemas']['RelatedCharacter'];

interface TargetCandidate {
  relationKind: PersonCollaborationRelationKind;
  relationId?: number;
  subjectId?: number;
  subjectName: string;
  subjectNameCn: string;
  subjectType: SubjectType;
  subjectTypeCode?: number;
  targetRole?: string;
}

interface SubjectContext {
  id: number;
  name: string;
  nameCn: string;
  type: SubjectType;
  order: number;
  relationKinds: PersonCollaborationRelationKind[];
  targetRoles: string[];
}

interface FanoutTask {
  subjectId: number;
  relationKind: PersonCollaborationRelationKind;
}

interface FanoutResult {
  task: FanoutTask;
  result: SafeResult<unknown[]>;
}

interface MutableSubject {
  context: SubjectContext;
  relationKinds: Set<PersonCollaborationRelationKind>;
  targetRoles: Set<string>;
  collaboratorRoles: Set<string>;
}

interface MutableCollaborator {
  id: number;
  name: string;
  nameCn?: string;
  image?: string;
  career: string[];
  creditRows: number;
  relationKinds: Set<PersonCollaborationRelationKind>;
  roleLabels: Set<string>;
  subjects: Map<number, MutableSubject>;
}

interface DetailFailure {
  code: string;
}

interface SafeResult<T> {
  value?: T;
  failure?: DetailFailure;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesLiteral(value: string | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  return Boolean(value && normalized(value).includes(normalized(filter)));
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function uniqueNumbers(values: Iterable<number | undefined>): number[] {
  return Array.from(
    new Set(
      Array.from(values).filter((value): value is number => positiveInteger(value) !== undefined),
    ),
  );
}

function selectEvenly<T>(values: readonly T[], limit: number): T[] {
  if (values.length <= limit) return [...values];
  if (limit === 1) return [values[0]!];
  const selected: T[] = [];
  let previousIndex = -1;
  for (let position = 0; position < limit; position += 1) {
    const idealIndex = Math.round((position * (values.length - 1)) / (limit - 1));
    const minimumIndex = previousIndex + 1;
    const maximumIndex = values.length - (limit - position);
    const index = Math.min(maximumIndex, Math.max(minimumIndex, idealIndex));
    selected.push(values[index]!);
    previousIndex = index;
  }
  return selected;
}

function sourceOperation(
  operations: PersonCollaborationSourceOperation[],
  operation: string,
  attempted: number,
  succeeded: number,
  failed: number,
): void {
  operations.push({ operation, attempted, succeeded, failed });
}

function sourceFailureCode(error: unknown): string {
  return toPublicError(error).code;
}

function addExclusion(
  exclusions: Map<
    PersonCollaborationExclusionReason,
    { count: number; sampleSubjectIds: Set<number> }
  >,
  reason: PersonCollaborationExclusionReason,
  subjectId?: number,
  count = 1,
): void {
  const existing = exclusions.get(reason) || { count: 0, sampleSubjectIds: new Set<number>() };
  existing.count += count;
  if (subjectId !== undefined && existing.sampleSubjectIds.size < 5) {
    existing.sampleSubjectIds.add(subjectId);
  }
  exclusions.set(reason, existing);
}

function exclusionList(
  exclusions: Map<
    PersonCollaborationExclusionReason,
    { count: number; sampleSubjectIds: Set<number> }
  >,
): PersonCollaborationExclusion[] {
  return Array.from(exclusions.entries())
    .map(([reason, value]) => ({
      reason,
      count: value.count,
      sampleSubjectIds: Array.from(value.sampleSubjectIds),
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function operationUnavailable(
  operations: readonly PersonCollaborationSourceOperation[],
  names: readonly string[],
): boolean {
  return names.every((name) => {
    const operation = operations.find((item) => item.operation === name);
    return Boolean(
      operation && operation.attempted > 0 && operation.failed === operation.attempted,
    );
  });
}

function relationKindsForKind(kind: PersonCollaborationKind): PersonCollaborationRelationKind[] {
  if (kind === 'voice') return ['voice'];
  if (kind === 'staff') return ['staff'];
  return ['voice', 'staff'];
}

function personImage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const images = value as Record<string, unknown>;
  return text(images.medium) || text(images.small) || text(images.grid) || text(images.large);
}

function personCareer(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === 'string'))
    : [];
}

function mapSubjectTarget(raw: unknown): TargetCandidate {
  const value = (raw || {}) as Record<string, unknown>;
  const subjectTypeCode = positiveInteger(value.type);
  return {
    relationKind: 'staff',
    relationId: positiveInteger(value.id),
    subjectId: positiveInteger(value.id),
    subjectName: text(value.name) || '',
    subjectNameCn: text(value.name_cn) || '',
    subjectType: mapSubjectType(subjectTypeCode),
    subjectTypeCode,
    targetRole: text(value.staff),
  };
}

function mapCharacterTarget(raw: unknown): TargetCandidate {
  const value = (raw || {}) as Record<string, unknown>;
  const subjectTypeCode = positiveInteger(value.subject_type);
  return {
    relationKind: 'voice',
    relationId: positiveInteger(value.id),
    subjectId: positiveInteger(value.subject_id),
    subjectName: text(value.subject_name) || '',
    subjectNameCn: text(value.subject_name_cn) || '',
    subjectType: mapSubjectType(subjectTypeCode),
    subjectTypeCode,
    targetRole: text(value.staff),
  };
}

function addString(set: Set<string>, value: string | undefined): void {
  if (value) set.add(value);
}

export class PersonCollaborationService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.api =
      client instanceof GeneratedBangumiOpenApiClient
        ? client
        : new GeneratedBangumiOpenApiClient(client);
  }

  async getPersonCollaboration(
    personId: number,
    options: PersonCollaborationOptions = {},
  ): Promise<PersonCollaborationResult> {
    const kind = options.kind ?? 'voice';
    const media = options.media ?? 'anime';
    const targetRole = options.targetRole?.trim() || undefined;
    const collaboratorRole = options.collaboratorRole?.trim() || undefined;
    const maxRelations = bounded(options.maxRelations, 80, PERSON_COLLABORATION_MAX_RELATIONS);
    const maxSubjects = bounded(options.maxSubjects, 24, PERSON_COLLABORATION_MAX_SUBJECTS);
    const maxCollaborators = bounded(
      options.maxCollaborators,
      20,
      PERSON_COLLABORATION_MAX_COLLABORATORS,
    );
    const maxSharedSubjects = bounded(
      options.maxSharedSubjects,
      12,
      PERSON_COLLABORATION_MAX_SHARED_SUBJECTS,
    );
    const sourceOperations: PersonCollaborationSourceOperation[] = [];
    const exclusions = new Map<
      PersonCollaborationExclusionReason,
      { count: number; sampleSubjectIds: Set<number> }
    >();

    const personResult = await this.safeRequest(() => this.api.getPersonById(personId));
    sourceOperation(
      sourceOperations,
      'GET /v0/persons/{person_id}',
      1,
      personResult.value ? 1 : 0,
      personResult.value ? 0 : 1,
    );

    const subjectPromise =
      kind === 'voice'
        ? Promise.resolve<SafeResult<RelatedPerson[]>>({ value: undefined })
        : this.safeRequest(() => this.api.getRelatedSubjectsByPersonId(personId));
    const characterPromise =
      kind === 'staff'
        ? Promise.resolve<SafeResult<RelatedCharacter[]>>({ value: undefined })
        : this.safeRequest(() => this.api.getRelatedCharactersByPersonId(personId));
    const [subjectResult, characterResult] = await Promise.all([subjectPromise, characterPromise]);

    const rawCandidates: TargetCandidate[] = [
      ...(kind === 'voice' || kind === 'all'
        ? (characterResult.value || []).map(mapCharacterTarget)
        : []),
      ...(kind === 'staff' || kind === 'all'
        ? (subjectResult.value || []).map(mapSubjectTarget)
        : []),
    ];

    const relationSourceNames = [
      ...(kind === 'staff' || kind === 'all' ? ['GET /v0/persons/{person_id}/subjects'] : []),
      ...(kind === 'voice' || kind === 'all' ? ['GET /v0/persons/{person_id}/characters'] : []),
    ];
    if (kind === 'staff' || kind === 'all') {
      sourceOperation(
        sourceOperations,
        'GET /v0/persons/{person_id}/subjects',
        1,
        subjectResult.value ? 1 : 0,
        subjectResult.value ? 0 : 1,
      );
    }
    if (kind === 'voice' || kind === 'all') {
      sourceOperation(
        sourceOperations,
        'GET /v0/persons/{person_id}/characters',
        1,
        characterResult.value ? 1 : 0,
        characterResult.value ? 0 : 1,
      );
    }

    let missingSubjectIdRows = 0;
    let targetRoleExcludedRows = 0;
    let mediaExcludedRows = 0;
    let mediaUnknownRows = 0;
    const matchingCandidates: TargetCandidate[] = [];
    for (const candidate of rawCandidates) {
      if (candidate.subjectId === undefined) {
        missingSubjectIdRows += 1;
        addExclusion(exclusions, 'missing_subject_id');
        continue;
      }
      if (!matchesLiteral(candidate.targetRole, targetRole)) {
        targetRoleExcludedRows += 1;
        addExclusion(exclusions, 'target_role_excluded', candidate.subjectId);
        continue;
      }
      if (media === 'anime') {
        if (candidate.subjectTypeCode === undefined) {
          mediaUnknownRows += 1;
          addExclusion(exclusions, 'media_unknown', candidate.subjectId);
          continue;
        }
        if (candidate.subjectTypeCode !== 2) {
          mediaExcludedRows += 1;
          addExclusion(exclusions, 'media_excluded', candidate.subjectId);
          continue;
        }
      }
      matchingCandidates.push(candidate);
    }

    const selectedCandidates = selectEvenly(matchingCandidates, maxRelations);
    const relationRowsDroppedAtLimit = matchingCandidates.length - selectedCandidates.length;
    const matchingSubjectIds = uniqueNumbers(
      matchingCandidates.map((candidate) => candidate.subjectId),
    );
    const relationSelectedSubjectIds = uniqueNumbers(
      selectedCandidates.map((candidate) => candidate.subjectId),
    );
    const subjectIdsDroppedAtRelationLimit = matchingSubjectIds.filter(
      (subjectId) => !relationSelectedSubjectIds.includes(subjectId),
    ).length;
    const selectedSubjectIds = selectEvenly(relationSelectedSubjectIds, maxSubjects);
    const subjectIdsDroppedAtSubjectLimit =
      relationSelectedSubjectIds.length - selectedSubjectIds.length;
    const selectedSubjectSet = new Set(selectedSubjectIds);
    for (const candidate of selectedCandidates) {
      if (candidate.subjectId !== undefined && !selectedSubjectSet.has(candidate.subjectId)) {
        addExclusion(exclusions, 'subject_cap', candidate.subjectId);
      }
    }

    const subjectContexts = new Map<number, SubjectContext>();
    for (const candidate of selectedCandidates) {
      if (candidate.subjectId === undefined || !selectedSubjectSet.has(candidate.subjectId))
        continue;
      const existing = subjectContexts.get(candidate.subjectId);
      if (existing) {
        if (!existing.relationKinds.includes(candidate.relationKind)) {
          existing.relationKinds.push(candidate.relationKind);
        }
        if (candidate.targetRole && !existing.targetRoles.includes(candidate.targetRole)) {
          existing.targetRoles.push(candidate.targetRole);
        }
        continue;
      }
      subjectContexts.set(candidate.subjectId, {
        id: candidate.subjectId,
        name: candidate.subjectName || candidate.subjectNameCn || `条目 ${candidate.subjectId}`,
        nameCn: candidate.subjectNameCn || candidate.subjectName || `条目 ${candidate.subjectId}`,
        type: candidate.subjectType,
        order: subjectContexts.size,
        relationKinds: [candidate.relationKind],
        targetRoles: candidate.targetRole ? [candidate.targetRole] : [],
      });
    }

    const requestedRelationKinds = relationKindsForKind(kind);
    const skippedRoleFilterTasks =
      collaboratorRole && requestedRelationKinds.includes('voice')
        ? selectedSubjectIds.filter((subjectId) => {
            const context = subjectContexts.get(subjectId);
            return Boolean(context?.relationKinds.includes('voice'));
          }).length
        : 0;
    if (skippedRoleFilterTasks > 0) {
      addExclusion(
        exclusions,
        'collaborator_role_unavailable',
        selectedSubjectIds[0],
        skippedRoleFilterTasks,
      );
    }

    const tasks: FanoutTask[] = selectedSubjectIds.flatMap((subjectId) =>
      requestedRelationKinds
        .filter((relationKind) => !(collaboratorRole && relationKind === 'voice'))
        .map((relationKind) => ({ subjectId, relationKind })),
    );
    const fanoutResults: FanoutResult[] = [];
    for (let index = 0; index < tasks.length; index += PERSON_COLLABORATION_FANOUT_CONCURRENCY) {
      const batch = tasks.slice(index, index + PERSON_COLLABORATION_FANOUT_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (task) => ({
          task,
          result: await this.safeRequest(async (): Promise<unknown[]> => {
            if (task.relationKind === 'voice') {
              return await this.api.getRelatedCharactersBySubjectId(task.subjectId);
            }
            return await this.api.getRelatedPersonsBySubjectId(task.subjectId);
          }),
        })),
      );
      fanoutResults.push(...results);
    }

    const sourceOperationNames = new Map<PersonCollaborationRelationKind, string>([
      ['voice', 'GET /v0/subjects/{subject_id}/characters'],
      ['staff', 'GET /v0/subjects/{subject_id}/persons'],
    ]);
    for (const relationKind of requestedRelationKinds) {
      const relevant = fanoutResults.filter((item) => item.task.relationKind === relationKind);
      sourceOperation(
        sourceOperations,
        sourceOperationNames.get(relationKind)!,
        relevant.length,
        relevant.filter((item) => item.result.value !== undefined).length,
        relevant.filter((item) => item.result.value === undefined).length,
      );
    }

    const collaborators = new Map<number, MutableCollaborator>();
    let participantRowsObserved = 0;
    let participantRowsReturned = 0;
    let malformedParticipantRows = 0;
    let selfRowsExcluded = 0;
    let collaboratorRoleExcludedRows = 0;
    let collaboratorRoleUnavailableRows = 0;
    let fanoutFailures = 0;

    const addCollaborator = (
      task: FanoutTask,
      person: { id: number; name?: string; nameCn?: string; image?: string; career?: string[] },
      collaboratorRole?: string,
    ): void => {
      const context = subjectContexts.get(task.subjectId);
      if (!context) return;
      const existing = collaborators.get(person.id) || {
        id: person.id,
        name: person.name || person.nameCn || `人物 ${person.id}`,
        nameCn: person.nameCn,
        image: person.image,
        career: person.career || [],
        creditRows: 0,
        relationKinds: new Set<PersonCollaborationRelationKind>(),
        roleLabels: new Set<string>(),
        subjects: new Map<number, MutableSubject>(),
      };
      if (!existing.nameCn && person.nameCn) existing.nameCn = person.nameCn;
      if (!existing.image && person.image) existing.image = person.image;
      existing.career = uniqueStrings([...existing.career, ...(person.career || [])]);
      existing.creditRows += 1;
      existing.relationKinds.add(task.relationKind);
      addString(existing.roleLabels, collaboratorRole);
      const sharedSubject = existing.subjects.get(task.subjectId) || {
        context,
        relationKinds: new Set<PersonCollaborationRelationKind>(),
        targetRoles: new Set<string>(),
        collaboratorRoles: new Set<string>(),
      };
      sharedSubject.relationKinds.add(task.relationKind);
      for (const role of context.targetRoles) sharedSubject.targetRoles.add(role);
      addString(sharedSubject.collaboratorRoles, collaboratorRole);
      existing.subjects.set(task.subjectId, sharedSubject);
      collaborators.set(person.id, existing);
      participantRowsReturned += 1;
    };

    for (const item of fanoutResults) {
      if (!item.result.value) {
        fanoutFailures += 1;
        addExclusion(exclusions, 'fanout_unavailable', item.task.subjectId);
        continue;
      }
      if (item.task.relationKind === 'staff') {
        for (const raw of item.result.value) {
          participantRowsObserved += 1;
          const value = (raw || {}) as Record<string, unknown>;
          const id = positiveInteger(value.id);
          if (id === undefined) {
            malformedParticipantRows += 1;
            addExclusion(exclusions, 'malformed_participant', item.task.subjectId);
            continue;
          }
          if (id === personId) {
            selfRowsExcluded += 1;
            addExclusion(exclusions, 'self_collaboration', item.task.subjectId);
            continue;
          }
          const role = text(value.relation);
          if (collaboratorRole && !matchesLiteral(role, collaboratorRole)) {
            collaboratorRoleExcludedRows += 1;
            addExclusion(exclusions, 'collaborator_role_excluded', item.task.subjectId);
            continue;
          }
          addCollaborator(
            item.task,
            {
              id,
              name: text(value.name),
              image: personImage(value.images),
              career: personCareer(value.career),
            },
            role,
          );
        }
        continue;
      }

      for (const raw of item.result.value) {
        const value = (raw || {}) as Record<string, unknown>;
        if (!Array.isArray(value.actors)) {
          malformedParticipantRows += 1;
          addExclusion(exclusions, 'malformed_participant', item.task.subjectId);
          continue;
        }
        for (const actor of value.actors) {
          participantRowsObserved += 1;
          const actorValue = (actor || {}) as Record<string, unknown>;
          const id = positiveInteger(actorValue.id);
          if (id === undefined) {
            malformedParticipantRows += 1;
            addExclusion(exclusions, 'malformed_participant', item.task.subjectId);
            continue;
          }
          if (id === personId) {
            selfRowsExcluded += 1;
            addExclusion(exclusions, 'self_collaboration', item.task.subjectId);
            continue;
          }
          if (collaboratorRole) {
            collaboratorRoleUnavailableRows += 1;
            addExclusion(exclusions, 'collaborator_role_unavailable', item.task.subjectId);
            continue;
          }
          addCollaborator(item.task, {
            id,
            name: text(actorValue.name),
            image: personImage(actorValue.images),
            career: personCareer(actorValue.career),
          });
        }
      }
    }

    const allCollaborators = Array.from(collaborators.values())
      .map((collaborator): PersonCollaborationCollaborator => {
        const sharedSubjects = Array.from(collaborator.subjects.values())
          .sort(
            (left, right) =>
              left.context.order - right.context.order || left.context.id - right.context.id,
          )
          .map((subject): PersonCollaborationSharedSubject => ({
            id: subject.context.id,
            name: subject.context.name,
            nameCn: subject.context.nameCn,
            type: subject.context.type,
            relationKinds: Array.from(subject.relationKinds),
            targetRoles: Array.from(subject.targetRoles),
            collaboratorRoles: Array.from(subject.collaboratorRoles),
          }));
        return {
          id: collaborator.id,
          name: collaborator.name,
          nameCn: collaborator.nameCn,
          image: collaborator.image,
          career: collaborator.career,
          uniqueSubjects: sharedSubjects.length,
          creditRows: collaborator.creditRows,
          relationKinds: Array.from(collaborator.relationKinds),
          roleLabels: Array.from(collaborator.roleLabels),
          sharedSubjects,
          sharedSubjectsOmitted: 0,
        };
      })
      .sort(
        (left, right) =>
          right.uniqueSubjects - left.uniqueSubjects ||
          right.creditRows - left.creditRows ||
          (left.nameCn || left.name).localeCompare(right.nameCn || right.name) ||
          left.id - right.id,
      );

    const selectedCollaborators = allCollaborators
      .slice(0, maxCollaborators)
      .map((collaborator) => {
        const sharedSubjects = collaborator.sharedSubjects.slice(0, maxSharedSubjects);
        const omitted = collaborator.sharedSubjects.length - sharedSubjects.length;
        if (omitted > 0) {
          addExclusion(exclusions, 'shared_subject_output_cap', sharedSubjects[0]?.id, omitted);
        }
        return { ...collaborator, sharedSubjects, sharedSubjectsOmitted: omitted };
      });
    const collaboratorIdsDroppedAtLimit = allCollaborators.length - selectedCollaborators.length;
    if (collaboratorIdsDroppedAtLimit > 0) {
      addExclusion(
        exclusions,
        'collaborator_output_cap',
        allCollaborators[maxCollaborators]?.sharedSubjects[0]?.id,
        collaboratorIdsDroppedAtLimit,
      );
    }

    const sharedSubjectRowsObserved = allCollaborators.reduce(
      (total, collaborator) => total + collaborator.sharedSubjects.length,
      0,
    );
    const sharedSubjectRowsReturned = selectedCollaborators.reduce(
      (total, collaborator) => total + collaborator.sharedSubjects.length,
      0,
    );
    const sharedSubjectRowsOmittedAtLimit = sharedSubjectRowsObserved - sharedSubjectRowsReturned;
    const outputTruncated = collaboratorIdsDroppedAtLimit > 0;
    const subjectCap = subjectIdsDroppedAtSubjectLimit > 0;
    const relationCap = relationRowsDroppedAtLimit > 0;
    const fanoutSkippedForRoleFilter = skippedRoleFilterTasks > 0;
    const relationSourceUnavailable = operationUnavailable(sourceOperations, relationSourceNames);
    const personNotFound = personResult.failure?.code === 'NOT_FOUND';
    const personUnavailable = !personResult.value;
    const roleFilterNotComputable = Boolean(collaboratorRole && kind === 'voice');
    const incomplete =
      relationCap ||
      subjectCap ||
      outputTruncated ||
      fanoutFailures > 0 ||
      malformedParticipantRows > 0 ||
      personUnavailable ||
      fanoutSkippedForRoleFilter ||
      collaboratorRoleUnavailableRows > 0;

    let state: PersonCollaborationState = 'complete';
    if (relationSourceUnavailable) state = 'unavailable';
    else if (personNotFound && !personResult.value) state = 'not_found';
    else if (roleFilterNotComputable) state = 'not_computable';
    else if (incomplete) state = 'partial';

    const warnings: PersonCollaborationResult['warnings'] = [];
    if (personUnavailable && state !== 'not_found') {
      warnings.push({
        code: 'PERSON_DETAIL_UNAVAILABLE',
        state: 'partial',
        message: '人物详情暂时不可用；合作关系仍按可获取的官方关系源返回。',
      });
    }
    if (relationRowsDroppedAtLimit > 0) {
      warnings.push({
        code: 'RELATION_LIMIT_REACHED',
        state: 'partial',
        message: `官方目标关系共 ${matchingCandidates.length} 行，本次按来源顺序等距选取 ${selectedCandidates.length} 行；未读取的关系没有进入合作 fan-out。`,
      });
    }
    if (subjectIdsDroppedAtSubjectLimit > 0) {
      warnings.push({
        code: 'SUBJECT_LIMIT_REACHED',
        state: 'partial',
        message: `目标关系涉及 ${relationSelectedSubjectIds.length} 个作品，本次只对 ${selectedSubjectIds.length} 个作品请求合作关系。`,
      });
    }
    if (fanoutFailures > 0) {
      warnings.push({
        code: 'COLLABORATION_FANOUT_PARTIAL',
        state: 'partial',
        message: `${fanoutFailures} 个官方作品合作关系请求失败；结果没有用猜测补全。`,
      });
    }
    if (fanoutSkippedForRoleFilter) {
      warnings.push({
        code: 'COLLABORATOR_ROLE_UNAVAILABLE_FOR_VOICE',
        state: roleFilterNotComputable ? 'not_computable' : 'partial',
        message:
          '官方声优演员关系没有为合作演员提供职位/角色标签；请求 collaboratorRole 时跳过声优 fan-out，只保留可按原始职位筛选的制作人员关系。',
      });
    }
    if (collaboratorRoleUnavailableRows > 0 && !fanoutSkippedForRoleFilter) {
      warnings.push({
        code: 'COLLABORATOR_ROLE_UNAVAILABLE_FOR_VOICE',
        state: 'not_computable',
        message: `${collaboratorRoleUnavailableRows} 行声优合作关系没有可用的合作方职位标签，未将演员 career 字段冒充为职位筛选结果。`,
      });
    }
    if (malformedParticipantRows > 0) {
      warnings.push({
        code: 'MALFORMED_PARTICIPANT_ROWS',
        state: 'partial',
        message: `${malformedParticipantRows} 行官方合作参与者缺少稳定人物 ID 或演员列表，已明确排除。`,
      });
    }
    if (collaboratorIdsDroppedAtLimit > 0) {
      warnings.push({
        code: 'COLLABORATOR_OUTPUT_LIMIT_REACHED',
        state: 'partial',
        message: `观察到 ${allCollaborators.length} 位合作人物，输出上限只返回 ${selectedCollaborators.length} 位；排序使用去重作品数、关系行数、名称和 ID。`,
      });
    }
    if (selectedCollaborators.some((collaborator) => collaborator.sharedSubjectsOmitted > 0)) {
      warnings.push({
        code: 'SHARED_SUBJECT_OUTPUT_LIMIT_REACHED',
        state: 'partial',
        message: `部分合作人物的共同作品超过每人 ${maxSharedSubjects} 部的证据显示上限；coverage 保留省略数量。`,
      });
    }
    if (selectedCollaborators.length === 0 && state === 'complete') {
      warnings.push({
        code: 'NO_COLLABORATORS',
        state: 'complete',
        message: '当前官方关系源中没有满足所选目标关系、媒介和合作方职位筛选的共同作品。',
      });
    }

    const retrievedAt = new Date().toISOString();
    const evidence: PersonCollaborationResult['evidence'] = [
      {
        source: 'official-v0',
        operation: 'GET /v0/persons/{person_id}',
        retrievedAt,
      },
      ...(kind === 'staff' || kind === 'all'
        ? [
            {
              source: 'official-v0' as const,
              operation: 'GET /v0/persons/{person_id}/subjects',
              retrievedAt,
            },
          ]
        : []),
      ...(kind === 'voice' || kind === 'all'
        ? [
            {
              source: 'official-v0' as const,
              operation: 'GET /v0/persons/{person_id}/characters',
              retrievedAt,
            },
          ]
        : []),
      ...(tasks.some((task) => task.relationKind === 'staff')
        ? [
            {
              source: 'official-v0' as const,
              operation: 'GET /v0/subjects/{subject_id}/persons (bounded fan-out)',
              retrievedAt,
            },
          ]
        : []),
      ...(tasks.some((task) => task.relationKind === 'voice')
        ? [
            {
              source: 'official-v0' as const,
              operation: 'GET /v0/subjects/{subject_id}/characters (bounded fan-out)',
              retrievedAt,
            },
          ]
        : []),
      {
        source: 'derived-s7',
        operation: 'person-collaboration-composition',
        formulaVersion: PERSON_COLLABORATION_FORMULA_VERSION,
        description:
          '按稳定人物 ID 和作品 ID 去重；合作次数以观察到的共同官方 v0 作品数排名，保留原始职位/目标角色标签；关系、作品、合作人物和共同作品输出均受显式边界约束，不将演员 career 或返回顺序推断为合作方职位或完整图谱。',
        retrievedAt,
      },
    ];

    return {
      personId,
      state,
      person: personResult.value ? mapPerson(personResult.value) : undefined,
      kind,
      media,
      ...(targetRole ? { targetRole } : {}),
      ...(collaboratorRole ? { collaboratorRole } : {}),
      collaborators: selectedCollaborators,
      coverage: {
        relationRowsObserved: rawCandidates.length,
        relationRowsMatchingFilters: matchingCandidates.length,
        relationRowsSelected: selectedCandidates.length,
        relationRowsDroppedAtLimit,
        relationSelectionStrategy:
          relationRowsDroppedAtLimit > 0 ? 'deterministic_even_spread' : 'all',
        sampled: relationCap || subjectCap,
        subjectIdsObserved: matchingSubjectIds.length,
        subjectIdsSelected: selectedSubjectIds.length,
        subjectIdsDroppedAtRelationLimit,
        subjectIdsDroppedAtSubjectLimit,
        participantRequests: tasks.length,
        participantRequestsSucceeded: fanoutResults.filter(
          (item) => item.result.value !== undefined,
        ).length,
        participantRequestsFailed: fanoutFailures,
        participantRequestsSkippedForRoleFilter: skippedRoleFilterTasks,
        participantRowsObserved,
        participantRowsReturned,
        malformedParticipantRows,
        selfRowsExcluded,
        collaboratorRoleExcludedRows,
        collaboratorRoleUnavailableRows,
        collaboratorsObserved: allCollaborators.length,
        collaboratorsReturned: selectedCollaborators.length,
        collaboratorIdsDroppedAtLimit,
        sharedSubjectRowsObserved,
        sharedSubjectRowsReturned,
        sharedSubjectRowsOmittedAtLimit,
        maxRelations,
        maxSubjects,
        maxCollaborators,
        maxSharedSubjects,
        fanoutConcurrency: PERSON_COLLABORATION_FANOUT_CONCURRENCY,
        mediaExcludedRows,
        mediaUnknownRows,
        targetRoleExcludedRows,
        missingSubjectIdRows,
        truncated:
          relationCap ||
          subjectCap ||
          outputTruncated ||
          selectedCollaborators.some((collaborator) => collaborator.sharedSubjectsOmitted > 0),
        retrievedAt,
      },
      exclusions: exclusionList(exclusions),
      sourceOperations,
      evidence,
      limitations: [
        '合作频次只表示在本次观察到的官方 v0 共同作品中，按稳定人物 ID 和作品 ID 去重后的共同作品数；不等同于现实合作关系、亲密度或完整行业网络。',
        '制作人员合作方职位筛选只做 collaboratorRole 对官方 relation 原文的字面、不区分大小写匹配；不建立隐含的职位分类。',
        '声优演员关系没有合作方职位字段；请求 collaboratorRole 时不把演员 career 字段冒充职位，并将该限制单独标记。',
        '关系、作品、合作人物和共同作品都有上限；超过上限时保留观察/选取/省略数量，并在达到关系预算时按来源返回顺序做确定性等距抽样。',
        '结果没有历史快照，不计算连续合作趋势、工作量、时长、收入、热度或推荐。',
      ],
      warnings,
    };
  }

  private async safeRequest<T>(request: () => Promise<T>): Promise<SafeResult<T>> {
    try {
      return { value: await request() };
    } catch (error) {
      return { failure: { code: sourceFailureCode(error) } };
    }
  }
}
