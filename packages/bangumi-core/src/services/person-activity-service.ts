import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import {
  mapPerson,
  mapPersonRelationCharacter,
  mapPersonRelationSubject,
} from './person-service.js';
import type { PersonRelationCharacter, PersonRelationSubject } from '../models/person.js';
import {
  PersonActivityExclusion,
  PersonActivityExclusionReason,
  PersonActivityKind,
  PersonActivityMedia,
  PersonActivityRelationKind,
  PersonActivityResult,
  PersonActivityRoleFamily,
  PersonActivityRow,
  PersonActivitySourceOperation,
  PersonActivityState,
  PersonActivityWindowSummary,
} from '../models/person-activity.js';
import { mapSubject } from './subject-service.js';
import type { DomainSubject } from '../models/subject.js';

export const PERSON_ACTIVITY_FORMULA_VERSION = 'person-activity-window-v1';
export const PERSON_ACTIVITY_DETAIL_CONCURRENCY = 4;
export const PERSON_ACTIVITY_MAX_RELATIONS = 120;
export const PERSON_ACTIVITY_MAX_SUBJECT_DETAILS = 48;
export const PERSON_ACTIVITY_MAX_ROWS = 60;

export interface PersonActivityOptions {
  kind?: PersonActivityKind;
  media?: PersonActivityMedia;
  windowMonths?: number;
  maxRelations?: number;
  maxSubjectDetails?: number;
  maxRows?: number;
  /** Test-only clock seam; not exposed by the public tool schema. */
  asOf?: string;
}

interface ActivityCandidate {
  relationKind: PersonActivityRelationKind;
  relationId?: number;
  subjectId?: number;
  characterName?: string;
  rawRole?: string;
}

interface DetailFailure {
  code: string;
}

interface SafeResult<T> {
  value?: T;
  failure?: DetailFailure;
}

interface ActivityRowWithSets extends PersonActivityRow {
  characterId?: number;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function parseDateOnly(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined;
  return date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function addMonths(date: Date, amount: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + amount);
  return result;
}

function buildWindow(
  windowMonths: number,
  asOfInput?: string,
): {
  asOf: Date;
  start: Date;
  end: Date;
  monthKeys: string[];
} {
  const asOf = parseDateOnly(asOfInput || formatDateOnly(new Date())) || new Date();
  const normalizedAsOf = parseDateOnly(formatDateOnly(asOf)) as Date;
  const start = addMonths(
    new Date(Date.UTC(normalizedAsOf.getUTCFullYear(), normalizedAsOf.getUTCMonth(), 1)),
    -(windowMonths - 1),
  );
  const monthKeys = Array.from({ length: windowMonths }, (_, index) =>
    formatMonth(addMonths(start, index)),
  );
  return { asOf: normalizedAsOf, start, end: normalizedAsOf, monthKeys };
}

function classifyVoiceRole(rawRole?: string): PersonActivityRoleFamily {
  const normalized = rawRole?.trim().toLowerCase() || '';
  if (!normalized) return 'unknown';
  if (
    normalized.includes('主角') ||
    normalized.includes('主役') ||
    normalized.includes('protagonist') ||
    normalized.includes('main')
  ) {
    return 'main';
  }
  if (
    normalized.includes('配角') ||
    normalized.includes('support') ||
    normalized.includes('supporting')
  ) {
    return 'support';
  }
  return 'unknown';
}

function classifyStaffRole(rawRole?: string): PersonActivityRoleFamily {
  return rawRole?.trim() ? 'staff' : 'unknown';
}

function classifyRole(candidate: ActivityCandidate): PersonActivityRoleFamily {
  return candidate.relationKind === 'voice'
    ? classifyVoiceRole(candidate.rawRole)
    : classifyStaffRole(candidate.rawRole);
}

function isTvPlatform(platform?: string): boolean | undefined {
  if (!platform?.trim()) return undefined;
  const normalized = platform.trim().toLowerCase();
  if (/\btv\b|television|电视/u.test(normalized)) return true;
  if (/movie|剧场|ova|web|网络|music|音乐/u.test(normalized)) return false;
  return undefined;
}

function sourceOperation(
  operations: PersonActivitySourceOperation[],
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

function sortCandidates(candidates: ActivityCandidate[]): ActivityCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftId = left.subjectId ?? Number.MAX_SAFE_INTEGER;
    const rightId = right.subjectId ?? Number.MAX_SAFE_INTEGER;
    if (leftId !== rightId) return leftId - rightId;
    if (left.relationKind !== right.relationKind) {
      return left.relationKind === 'voice' ? -1 : 1;
    }
    return (left.relationId ?? 0) - (right.relationId ?? 0);
  });
}

function uniqueNumbers(values: Iterable<number | undefined>): number[] {
  return Array.from(
    new Set(Array.from(values).filter((value): value is number => value !== undefined)),
  );
}

function makeDistribution(
  rows: readonly ActivityRowWithSets[],
  keyOf: (row: ActivityRowWithSets) => string,
): {
  key: string;
  label: string;
  creditRows: number;
  uniqueSubjects: number;
  uniqueCharacters: number;
}[] {
  const buckets = new Map<
    string,
    { rows: number; subjects: Set<number>; characters: Set<number> }
  >();
  for (const row of rows) {
    const key = keyOf(row) || 'unknown';
    const bucket = buckets.get(key) || {
      rows: 0,
      subjects: new Set<number>(),
      characters: new Set<number>(),
    };
    bucket.rows += 1;
    bucket.subjects.add(row.subjectId);
    if (row.characterId !== undefined) bucket.characters.add(row.characterId);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: key === 'unknown' ? '未知' : key,
      creditRows: bucket.rows,
      uniqueSubjects: bucket.subjects.size,
      uniqueCharacters: bucket.characters.size,
    }))
    .sort(
      (left, right) => right.creditRows - left.creditRows || left.label.localeCompare(right.label),
    );
}

function makeSummary(
  rows: readonly ActivityRowWithSets[],
  monthKeys: readonly string[],
): PersonActivityWindowSummary {
  const months = new Map<string, ActivityRowWithSets[]>();
  for (const month of monthKeys) months.set(month, []);
  for (const row of rows) months.get(row.month)?.push(row);
  return {
    creditRows: rows.length,
    uniqueSubjects: new Set(rows.map((row) => row.subjectId)).size,
    uniqueCharacters: new Set(
      rows.map((row) => row.characterId).filter((id): id is number => id !== undefined),
    ).size,
    byRole: makeDistribution(rows, (row) => row.roleFamily),
    byMedia: makeDistribution(rows, (row) => row.subjectType),
    byMonth: monthKeys.map((month) => {
      const bucket = months.get(month) || [];
      return {
        month,
        creditRows: bucket.length,
        uniqueSubjects: new Set(bucket.map((row) => row.subjectId)).size,
        uniqueCharacters: new Set(
          bucket.map((row) => row.characterId).filter((id): id is number => id !== undefined),
        ).size,
      };
    }),
  };
}

function addExclusion(
  exclusions: Map<PersonActivityExclusionReason, { count: number; sampleSubjectIds: Set<number> }>,
  reason: PersonActivityExclusionReason,
  subjectId?: number,
): void {
  const existing = exclusions.get(reason) || { count: 0, sampleSubjectIds: new Set<number>() };
  existing.count += 1;
  if (subjectId !== undefined && existing.sampleSubjectIds.size < 5) {
    existing.sampleSubjectIds.add(subjectId);
  }
  exclusions.set(reason, existing);
}

function exclusionList(
  exclusions: Map<PersonActivityExclusionReason, { count: number; sampleSubjectIds: Set<number> }>,
): PersonActivityExclusion[] {
  return Array.from(exclusions.entries())
    .map(([reason, value]) => ({
      reason,
      count: value.count,
      sampleSubjectIds: Array.from(value.sampleSubjectIds),
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function sourceStatus(
  operations: readonly PersonActivitySourceOperation[],
  operation: string,
): 'complete' | 'partial' | 'unavailable' {
  const status = operations.find((item) => item.operation === operation);
  if (!status || status.attempted === 0 || status.failed === status.attempted) return 'unavailable';
  return status.failed > 0 ? 'partial' : 'complete';
}

export class PersonActivityService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.api =
      client instanceof GeneratedBangumiOpenApiClient
        ? client
        : new GeneratedBangumiOpenApiClient(client);
  }

  async getPersonActivity(
    personId: number,
    options: PersonActivityOptions = {},
  ): Promise<PersonActivityResult> {
    const kind = options.kind ?? 'voice';
    const media = options.media ?? 'tv';
    const windowMonths = bounded(options.windowMonths, 12, 12);
    const maxRelations = bounded(options.maxRelations, 80, PERSON_ACTIVITY_MAX_RELATIONS);
    const maxSubjectDetails = bounded(
      options.maxSubjectDetails,
      32,
      PERSON_ACTIVITY_MAX_SUBJECT_DETAILS,
    );
    const maxRows = bounded(options.maxRows, 40, PERSON_ACTIVITY_MAX_ROWS);
    const window = buildWindow(windowMonths, options.asOf);
    const sourceOperations: PersonActivitySourceOperation[] = [];

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
        ? Promise.resolve<SafeResult<never>>({ value: undefined as never })
        : this.safeRequest(() => this.api.getRelatedSubjectsByPersonId(personId));
    const characterPromise =
      kind === 'staff'
        ? Promise.resolve<SafeResult<never>>({ value: undefined as never })
        : this.safeRequest(() => this.api.getRelatedCharactersByPersonId(personId));
    const [subjectResult, characterResult] = await Promise.all([subjectPromise, characterPromise]);

    const subjectRelations = (subjectResult.value || []).map(mapPersonRelationSubject);
    const characterRelations = (characterResult.value || []).map(mapPersonRelationCharacter);
    if (kind !== 'voice') {
      sourceOperation(
        sourceOperations,
        'GET /v0/persons/{person_id}/subjects',
        1,
        subjectResult.value ? 1 : 0,
        subjectResult.value ? 0 : 1,
      );
    }
    if (kind !== 'staff') {
      sourceOperation(
        sourceOperations,
        'GET /v0/persons/{person_id}/characters',
        1,
        characterResult.value ? 1 : 0,
        characterResult.value ? 0 : 1,
      );
    }

    const candidates = sortCandidates([
      ...(kind === 'voice' || kind === 'all'
        ? characterRelations.map((character: PersonRelationCharacter): ActivityCandidate => ({
            relationKind: 'voice',
            relationId: character.id,
            subjectId: character.subjectId,
            characterName: character.name,
            rawRole: character.staff,
          }))
        : []),
      ...(kind === 'staff' || kind === 'all'
        ? subjectRelations.map((subject: PersonRelationSubject): ActivityCandidate => ({
            relationKind: 'staff',
            relationId: subject.id,
            subjectId: subject.id,
            rawRole: subject.staffRole,
          }))
        : []),
    ]);
    const selectedCandidates = candidates.slice(0, maxRelations);
    const relationRowsDroppedAtLimit = Math.max(0, candidates.length - selectedCandidates.length);
    const subjectIds = uniqueNumbers(selectedCandidates.map((candidate) => candidate.subjectId));
    const detailIds = subjectIds.slice(0, maxSubjectDetails);
    const subjectDetailIdsDroppedAtLimit = Math.max(0, subjectIds.length - detailIds.length);
    const detailMap = new Map<number, DomainSubject>();
    const detailFailures = new Map<number, DetailFailure>();
    for (let index = 0; index < detailIds.length; index += PERSON_ACTIVITY_DETAIL_CONCURRENCY) {
      const batch = detailIds.slice(index, index + PERSON_ACTIVITY_DETAIL_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (subjectId) => ({
          subjectId,
          result: await this.safeRequest(() => this.api.getSubjectById(subjectId)),
        })),
      );
      for (const item of results) {
        if (item.result.value) detailMap.set(item.subjectId, mapSubject(item.result.value));
        else detailFailures.set(item.subjectId, item.result.failure || { code: 'INTERNAL_ERROR' });
      }
    }
    sourceOperation(
      sourceOperations,
      'GET /v0/subjects/{subject_id}',
      detailIds.length,
      detailMap.size,
      detailFailures.size,
    );

    const exclusions = new Map<
      PersonActivityExclusionReason,
      { count: number; sampleSubjectIds: Set<number> }
    >();
    const accepted: ActivityRowWithSets[] = [];
    let missingDateRows = 0;
    let invalidDateRows = 0;
    let outsideWindowRows = 0;
    let mediaExcludedRows = 0;
    let mediaUnknownRows = 0;

    for (const candidate of selectedCandidates) {
      if (candidate.subjectId === undefined) {
        addExclusion(exclusions, 'missing_subject_id');
        continue;
      }
      if (!detailIds.includes(candidate.subjectId)) {
        addExclusion(exclusions, 'subject_detail_cap', candidate.subjectId);
        continue;
      }
      const failure = detailFailures.get(candidate.subjectId);
      if (failure) {
        addExclusion(exclusions, 'subject_detail_unavailable', candidate.subjectId);
        continue;
      }
      const subject = detailMap.get(candidate.subjectId);
      if (!subject) {
        addExclusion(exclusions, 'subject_detail_unavailable', candidate.subjectId);
        continue;
      }

      if (media !== 'all' && subject.type !== 'anime') {
        mediaExcludedRows += 1;
        addExclusion(exclusions, 'media_excluded', candidate.subjectId);
        continue;
      }
      if (media === 'tv') {
        const tv = isTvPlatform(subject.platform);
        if (tv === undefined) {
          mediaUnknownRows += 1;
          addExclusion(exclusions, 'media_unknown', candidate.subjectId);
          continue;
        }
        if (!tv) {
          mediaExcludedRows += 1;
          addExclusion(exclusions, 'media_excluded', candidate.subjectId);
          continue;
        }
      }

      if (!subject.date) {
        missingDateRows += 1;
        addExclusion(exclusions, 'missing_date', candidate.subjectId);
        continue;
      }
      const date = parseDateOnly(subject.date);
      if (!date) {
        invalidDateRows += 1;
        addExclusion(exclusions, 'invalid_date', candidate.subjectId);
        continue;
      }
      if (date < window.start || date > window.end) {
        outsideWindowRows += 1;
        addExclusion(exclusions, 'outside_window', candidate.subjectId);
        continue;
      }

      accepted.push({
        subjectId: subject.id,
        subjectName: subject.name,
        subjectNameCn: subject.nameCn,
        subjectType: subject.type,
        platform: subject.platform,
        firstAirDate: subject.date,
        month: formatMonth(date),
        relationKind: candidate.relationKind,
        relationId: candidate.relationId,
        characterName: candidate.characterName,
        rawRole: candidate.rawRole,
        roleFamily: classifyRole(candidate),
        characterId: candidate.relationKind === 'voice' ? candidate.relationId : undefined,
      });
    }

    accepted.sort(
      (left, right) =>
        right.firstAirDate.localeCompare(left.firstAirDate) ||
        left.subjectId - right.subjectId ||
        left.relationKind.localeCompare(right.relationKind) ||
        (left.relationId ?? 0) - (right.relationId ?? 0),
    );
    const rows = accepted.slice(0, maxRows);
    const outputTruncated = accepted.length > rows.length;
    const summary = makeSummary(accepted, window.monthKeys);
    const exclusionValues = exclusionList(exclusions);
    const relationFailures = sourceOperations
      .filter((operation) =>
        ['GET /v0/persons/{person_id}/subjects', 'GET /v0/persons/{person_id}/characters'].includes(
          operation.operation,
        ),
      )
      .reduce((total, operation) => total + operation.failed, 0);
    const detailPartial =
      detailFailures.size > 0 ||
      subjectDetailIdsDroppedAtLimit > 0 ||
      missingDateRows > 0 ||
      invalidDateRows > 0 ||
      mediaUnknownRows > 0;
    const sourceUnavailable =
      sourceStatus(sourceOperations, 'GET /v0/persons/{person_id}/subjects') === 'unavailable' &&
      sourceStatus(sourceOperations, 'GET /v0/persons/{person_id}/characters') === 'unavailable';
    const personUnavailable = !personResult.value;
    const noComputableRows =
      candidates.length > 0 &&
      accepted.length === 0 &&
      missingDateRows + invalidDateRows === selectedCandidates.length;
    let state: PersonActivityState = 'complete';
    if (sourceUnavailable) state = 'unavailable';
    else if (noComputableRows) state = 'not_computable';
    else if (
      personUnavailable ||
      detailPartial ||
      relationFailures > 0 ||
      relationRowsDroppedAtLimit > 0
    )
      state = 'partial';

    const unknownRoleRows = accepted.filter((row) => row.roleFamily === 'unknown').length;
    const warnings: PersonActivityResult['warnings'] = [];
    if (personUnavailable) {
      warnings.push({
        code: 'PERSON_DETAIL_UNAVAILABLE',
        state: 'partial',
        message: '人物详情暂时不可用；关系与作品结果仍按可获取的官方来源返回。',
      });
    }
    if (relationRowsDroppedAtLimit > 0) {
      warnings.push({
        code: 'RELATION_LIMIT_REACHED',
        state: 'partial',
        message: `关系行达到 ${maxRelations} 条上限，未读取的关系没有进入作品详情预算。`,
      });
    }
    if (subjectDetailIdsDroppedAtLimit > 0 || detailFailures.size > 0) {
      warnings.push({
        code: 'SUBJECT_DETAIL_COVERAGE',
        state: 'partial',
        message: `作品详情成功 ${detailMap.size}/${detailIds.length}，另有 ${subjectDetailIdsDroppedAtLimit} 个作品因详情预算未请求。`,
      });
    }
    if (missingDateRows + invalidDateRows > 0) {
      warnings.push({
        code: 'MISSING_ACTIVITY_DATE',
        state: 'partial',
        message: `${missingDateRows + invalidDateRows} 条关系缺少可用的作品首播日期，未强行归入时间窗。`,
      });
    }
    if (mediaUnknownRows > 0) {
      warnings.push({
        code: 'MEDIA_UNKNOWN',
        state: 'partial',
        message: `${mediaUnknownRows} 条动画关系没有足够的平台字段判断 TV 口径。`,
      });
    }
    if (unknownRoleRows > 0) {
      warnings.push({
        code: 'ROLE_UNKNOWN',
        state: 'partial',
        message: `${unknownRoleRows} 条关系保留原始职位/角色标签，但无法安全归入主役、配角或标准职位。`,
      });
    }
    if (accepted.length === 0 && state === 'complete') {
      warnings.push({
        code: 'NO_WINDOW_MATCHES',
        state: 'complete',
        message: '当前官方关系中没有落入所选时间窗且满足媒介筛选的作品。',
      });
    }

    const retrievedAt = new Date().toISOString();
    const evidence: PersonActivityResult['evidence'] = [
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
      {
        source: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id} (bounded hydration)',
        retrievedAt,
      },
      {
        source: 'derived-s7',
        operation: 'person-activity-window-composition',
        formulaVersion: PERSON_ACTIVITY_FORMULA_VERSION,
        description:
          '按稳定 subject/character ID 去重；使用作品 first_air_date 归入日历月，保留原始 role 并仅做保守的主役/配角/未知分类。',
        retrievedAt,
      },
    ];

    return {
      state,
      person: personResult.value ? mapPerson(personResult.value) : undefined,
      kind,
      media,
      window: {
        months: windowMonths,
        start: formatDateOnly(window.start),
        end: formatDateOnly(window.end),
        monthKeys: window.monthKeys,
        asOfSemantics: 'calendar_months_ending_on_as_of_date',
      },
      rows: rows.map(({ characterId: _characterId, ...row }) => row),
      summary,
      coverage: {
        relationRowsObserved: candidates.length,
        relationRowsSelected: selectedCandidates.length,
        relationRowsDroppedAtLimit,
        subjectIdsObserved: subjectIds.length,
        subjectDetailRequests: detailIds.length,
        subjectDetailsSucceeded: detailMap.size,
        subjectDetailsFailed: detailFailures.size,
        subjectDetailIdsDroppedAtLimit,
        rowsEligible: accepted.length,
        rowsReturned: rows.length,
        outputTruncated,
        uniqueSubjects: summary.uniqueSubjects,
        uniqueCharacters: summary.uniqueCharacters,
        missingDateRows,
        invalidDateRows,
        outsideWindowRows,
        mediaExcludedRows,
        mediaUnknownRows,
        maxRelations,
        maxSubjectDetails,
        maxRows,
        detailConcurrency: PERSON_ACTIVITY_DETAIL_CONCURRENCY,
        truncated:
          relationRowsDroppedAtLimit > 0 || subjectDetailIdsDroppedAtLimit > 0 || outputTruncated,
        retrievedAt,
      },
      exclusions: exclusionValues,
      sourceOperations,
      evidence,
      limitations: [
        '时间窗按官方作品 first_air_date 的日期归属，不代表实际配音、制作或劳动发生时间。',
        '没有历史快照；本结果只描述当前官方关系与作品详情观察，不能计算增长、趋势或前后窗口变化。',
        '主役、配角和职位分类只对可识别的官方关系标签做保守映射，未知标签保留原文并单独计数。',
        '结果不推断工作时长、工作强度、收入、热度或推荐；达到关系、详情或输出上限的行不会被猜测补全。',
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
