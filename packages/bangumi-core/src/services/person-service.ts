import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainPerson,
  PersonActivityDistribution,
  PersonActivityProfile,
  PersonActivitySummary,
  PersonRelationCharacter,
  PersonRelationSubject,
  PersonReleaseChronology,
  PersonReleaseChronologySubject,
  RelationCollection,
  SubjectStaffGroup,
  SubjectStaffMember,
} from '../models/person.js';
import { PersonCandidate, SearchResult, SearchStatus } from '../results/result.js';
import { normalizeSearchText } from '../workflows/resolve-subject.js';
import { mapSubjectType } from './subject-service.js';

export type { PersonRelationCharacter } from '../models/person.js';

export const PERSON_PROFILE_CHRONOLOGY_MAX_SUBJECT_DETAILS = 48;
export const PERSON_PROFILE_CHRONOLOGY_MAX_CONCURRENCY = 4;
export const PERSON_PROFILE_CHRONOLOGY_MAX_RESPONSE_BYTES = 1_048_576;

type ReleaseDateObservation =
  | { kind: 'valid'; date: string; subject: PersonReleaseChronologySubject }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'failed' };

function validIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1]!;
}

function sampleEvenly<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  if (limit <= 1) return [items[Math.floor((items.length - 1) / 2)]!];
  return Array.from({ length: limit }, (_, index) =>
    items[Math.floor((index * (items.length - 1)) / (limit - 1))]!,
  );
}

async function mapConcurrentOrdered<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function imageMap(value: unknown): value is Record<string, string> {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string'))
  );
}

function validPersonRelationCharacter(value: unknown): value is {
  id: number;
  name: string;
  type: number;
  images?: Record<string, string> | null;
  subject_id: number;
  subject_type: number;
  subject_name: string;
  subject_name_cn: string;
  staff?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.name === 'string' &&
    typeof row.type === 'number' &&
    Number.isInteger(row.type) &&
    positiveInteger(row.subject_id) &&
    typeof row.subject_type === 'number' &&
    Number.isInteger(row.subject_type) &&
    typeof row.subject_name === 'string' &&
    typeof row.subject_name_cn === 'string' &&
    imageMap(row.images) &&
    (row.staff === undefined || typeof row.staff === 'string')
  );
}

function validSubjectStaffRow(value: unknown): value is {
  id: number;
  name: string;
  type: number;
  career: string[];
  images?: Record<string, string>;
  relation: string;
  eps: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.name === 'string' &&
    typeof row.type === 'number' &&
    Number.isInteger(row.type) &&
    row.type >= 1 &&
    row.type <= 3 &&
    Array.isArray(row.career) &&
    row.career.every((item) => typeof item === 'string') &&
    typeof row.relation === 'string' &&
    typeof row.eps === 'string' &&
    imageMap(row.images)
  );
}

function mapPersonTypeLabel(type?: number): string {
  switch (type) {
    case 1:
      return '个人';
    case 2:
      return '公司';
    case 3:
      return '组合';
    default:
      return '未知';
  }
}

function collectInfoboxValues(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(collectInfoboxValues);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (typeof record.v === 'string') return record.v.trim() ? [record.v.trim()] : [];
  return [];
}

export function mapPersonAliases(infobox?: unknown[]): string[] | undefined {
  const aliases = new Set<string>();
  for (const entry of infobox || []) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (record.key !== '别名' && record.key !== 'aliases' && record.key !== 'alias') continue;
    for (const value of collectInfoboxValues(record.value)) aliases.add(value);
  }
  return aliases.size > 0 ? Array.from(aliases) : undefined;
}

export function mapPersonNameCn(infobox?: unknown[]): string | undefined {
  for (const entry of infobox || []) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (record.key !== '简体中文名' && record.key !== '中文名' && record.key !== 'name_cn') {
      continue;
    }
    return collectInfoboxValues(record.value)[0];
  }
  return undefined;
}

function isUnknownLastModified(value: string): boolean {
  return value.startsWith('0001-01-01');
}

export function mapPerson(raw: {
  id: number;
  name?: string;
  type?: number;
  career?: string[];
  short_summary?: string;
  summary?: string;
  images?: Record<string, string>;
  locked?: boolean;
  last_modified?: string;
  infobox?: unknown[];
  gender?: string;
  blood_type?: number;
  birth_year?: number;
  birth_mon?: number;
  birth_day?: number;
  stat?: { comments?: number; collects?: number };
}): DomainPerson {
  const type = raw.type ?? 1;
  const person: DomainPerson = {
    id: raw.id,
    name: raw.name || '',
    nameCn: mapPersonNameCn(raw.infobox),
    type,
    typeLabel: mapPersonTypeLabel(type),
    career: (raw.career as string[]) || [],
    summary: raw.short_summary || raw.summary || '',
    images: raw.images ? (raw.images as Record<string, string>) : undefined,
    aliases: mapPersonAliases(raw.infobox),
  };

  if (raw.locked !== undefined) person.locked = raw.locked;
  if (raw.last_modified) {
    if (isUnknownLastModified(raw.last_modified)) {
      person.lastModifiedState = 'unknown';
    } else {
      person.lastModified = raw.last_modified;
      person.lastModifiedState = 'known';
    }
  }
  if (Array.isArray(raw.infobox)) person.infobox = raw.infobox;
  if (raw.gender) person.gender = raw.gender;
  if (raw.blood_type !== undefined) person.bloodType = raw.blood_type;
  if (raw.birth_year !== undefined) person.birthYear = raw.birth_year;
  if (raw.birth_mon !== undefined) person.birthMonth = raw.birth_mon;
  if (raw.birth_day !== undefined) person.birthDay = raw.birth_day;
  if (raw.stat && raw.stat.comments !== undefined && raw.stat.collects !== undefined) {
    person.stat = { comments: raw.stat.comments, collects: raw.stat.collects };
  }

  return person;
}

export function mapPersonCandidate(raw: {
  id: number;
  name?: string;
  career?: string[];
  images?: { large?: string; medium?: string; small?: string; grid?: string };
}): PersonCandidate {
  const image = raw.images?.medium || raw.images?.small || raw.images?.grid || raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    career: (raw.career as string[]) || [],
    image,
  };
}

export function mapPersonRelationSubject(raw: {
  id: number;
  type?: number;
  staff?: string;
  eps?: string;
  name?: string;
  name_cn?: string | null;
  image?: string;
}): PersonRelationSubject {
  return {
    id: raw.id,
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    nameCnSource: typeof raw.name_cn === 'string' ? raw.name_cn : null,
    staffRole: raw.staff || undefined,
    mediaType: mapSubjectType(raw.type),
    mediaTypeCode: raw.type,
    eps: raw.eps || undefined,
    image: raw.image || undefined,
  };
}

export function mapPersonRelationCharacter(raw: {
  id: number;
  name?: string;
  type?: number;
  images?: Record<string, string> | null;
  subject_id?: number;
  subject_type?: number;
  subject_name?: string;
  subject_name_cn?: string;
  staff?: string;
}): PersonRelationCharacter {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type,
    image: raw.images?.medium || raw.images?.small || raw.images?.grid || raw.images?.large,
    subjectId: raw.subject_id,
    subjectType: raw.subject_type === undefined ? undefined : mapSubjectType(raw.subject_type),
    subjectTypeCode: raw.subject_type,
    subjectName: raw.subject_name || undefined,
    subjectNameCn: raw.subject_name_cn || raw.subject_name || undefined,
    staff: raw.staff || undefined,
  };
}

export function mapSubjectStaffMember(raw: {
  id: number;
  name?: string;
  type?: number;
  career?: string[];
  images?: Record<string, string>;
  relation?: string;
  eps?: string;
}): SubjectStaffMember {
  const rawRelation = raw.relation || '';
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: raw.career || [],
    images: raw.images,
    relation: rawRelation.trim() || '未知',
    rawRelation,
    eps: raw.eps || '',
  };
}

function buildDistribution<T>(
  items: readonly T[],
  keyOf: (item: T) => string | undefined,
  subjectIdOf: (item: T) => number | undefined,
  rawCodeOf?: (item: T) => number | undefined,
): PersonActivityDistribution[] {
  const buckets = new Map<
    string,
    { label: string; count: number; subjectIds: Set<number>; rawCodes: Set<number> }
  >();

  for (const item of items) {
    const rawKey = keyOf(item)?.trim();
    const key = rawKey || 'unknown';
    const bucket = buckets.get(key) || {
      label: rawKey || '未知',
      count: 0,
      subjectIds: new Set<number>(),
      rawCodes: new Set<number>(),
    };
    bucket.count += 1;
    const subjectId = subjectIdOf(item);
    if (subjectId !== undefined) bucket.subjectIds.add(subjectId);
    const rawCode = rawCodeOf?.(item);
    if (rawCode !== undefined) bucket.rawCodes.add(rawCode);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      count: bucket.count,
      uniqueSubjects: bucket.subjectIds.size,
      rawCodes:
        bucket.rawCodes.size > 0
          ? Array.from(bucket.rawCodes).sort((left, right) => left - right)
          : undefined,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function aggregatePersonActivity(
  subjects: readonly PersonRelationSubject[],
  characters: readonly PersonRelationCharacter[],
): PersonActivitySummary {
  return {
    subjectCredits: subjects.length,
    uniqueSubjects: new Set(subjects.map((subject) => subject.id)).size,
    characterCredits: characters.length,
    uniqueCharacters: new Set(characters.map((character) => character.id)).size,
    characterSubjects: new Set(
      characters
        .map((character) => character.subjectId)
        .filter((subjectId): subjectId is number => subjectId !== undefined),
    ).size,
    subjectMedia: buildDistribution(
      subjects,
      (subject) => subject.mediaType,
      (subject) => subject.id,
      (subject) => subject.mediaTypeCode,
    ),
    subjectRoles: buildDistribution(
      subjects,
      (subject) => subject.staffRole,
      (subject) => subject.id,
    ),
    characterMedia: buildDistribution(
      characters,
      (character) => character.subjectType,
      (character) => character.subjectId,
      (character) => character.subjectTypeCode,
    ),
    characterRoles: buildDistribution(
      characters,
      (character) => character.staff,
      (character) => character.subjectId,
    ),
  };
}

export function groupSubjectStaff(members: readonly SubjectStaffMember[]): SubjectStaffGroup[] {
  const groups = new Map<string, Set<number>>();
  for (const member of members) {
    const relation = member.relation.trim() || '未知';
    const group = groups.get(relation) || new Set<number>();
    group.add(member.id);
    groups.set(relation, group);
  }

  return Array.from(groups.entries())
    .map(([relation, groupedMembers]) => ({
      relation,
      count: groupedMembers.size,
      memberIds: Array.from(groupedMembers),
    }))
    .sort((left, right) => right.count - left.count || left.relation.localeCompare(right.relation));
}

export interface SearchPersonsOptions {
  limit?: number;
  offset?: number;
  career?: string[];
}

export interface PersonProfileOptions {
  maxSubjects?: number;
  maxCharacters?: number;
  includeChronology?: boolean;
  maxChronologySubjects?: number;
}

export class PersonService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async searchPersons(
    query: string,
    options: SearchPersonsOptions = {},
  ): Promise<SearchResult<PersonCandidate>> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    const res = await this.api.searchPersons(
      { limit, offset },
      {
        keyword: query,
        ...(options.career && options.career.length > 0
          ? { filter: { career: [...options.career] } }
          : {}),
      },
    );

    const data = res.data || [];
    const candidates = data.map(mapPersonCandidate);

    const normQuery = normalizeSearchText(query);
    const exactMatches = candidates.filter(
      (c: PersonCandidate) => normalizeSearchText(c.name) === normQuery,
    );

    let status: SearchStatus = 'disambiguation';
    let exact: PersonCandidate | undefined;

    if (candidates.length === 0) {
      status = 'not_found';
    } else if (exactMatches.length === 1) {
      status = 'exact';
      exact = exactMatches[0];
    } else if (exactMatches.length > 1) {
      status = 'disambiguation';
    } else if (candidates.length === 1) {
      status = 'exact';
      exact = candidates[0];
    } else {
      status = 'disambiguation';
    }

    return {
      status,
      query,
      total: res.total || 0,
      limit: res.limit || limit,
      offset: res.offset || offset,
      exact,
      candidates,
      meta: { source: 'bangumi-v0' },
    };
  }

  async getPersonById(personId: number): Promise<DomainPerson> {
    const raw = await this.api.getPersonById(personId);
    return mapPerson(raw);
  }

  async getPersonProfile(
    personId: number,
    options: PersonProfileOptions = {},
  ): Promise<PersonActivityProfile> {
    const subjectLimit = Math.max(0, Math.floor(options.maxSubjects ?? 500));
    const characterLimit = Math.max(0, Math.floor(options.maxCharacters ?? 500));
    const [rawPerson, rawSubjects, rawCharacters] = await Promise.all([
      this.api.getPersonById(personId),
      this.api.getRelatedSubjectsByPersonId(personId),
      this.api.getRelatedCharactersByPersonId(personId),
    ]);

    const allSubjects = (rawSubjects || []).map(mapPersonRelationSubject);
    const allCharacters = (rawCharacters || []).map(mapPersonRelationCharacter);
    const subjects: RelationCollection<PersonRelationSubject> = {
      items: allSubjects.slice(0, subjectLimit),
      observed: allSubjects.length,
      returned: Math.min(allSubjects.length, subjectLimit),
      truncated: allSubjects.length > subjectLimit,
    };
    const characters: RelationCollection<PersonRelationCharacter> = {
      items: allCharacters.slice(0, characterLimit),
      observed: allCharacters.length,
      returned: Math.min(allCharacters.length, characterLimit),
      truncated: allCharacters.length > characterLimit,
    };
    const releaseChronology = options.includeChronology
      ? await this.getReleaseChronology(subjects, options.maxChronologySubjects)
      : undefined;

    return {
      person: mapPerson(rawPerson),
      subjects,
      characters,
      summary: aggregatePersonActivity(subjects.items, characters.items),
      ...(releaseChronology ? { releaseChronology } : {}),
    };
  }

  private async getReleaseChronology(
    subjects: RelationCollection<PersonRelationSubject>,
    requestedLimit = PERSON_PROFILE_CHRONOLOGY_MAX_SUBJECT_DETAILS,
  ): Promise<PersonReleaseChronology> {
    const safeRequestedLimit = Number.isFinite(requestedLimit)
      ? Math.floor(requestedLimit)
      : PERSON_PROFILE_CHRONOLOGY_MAX_SUBJECT_DETAILS;
    const detailLimit = Math.max(
      1,
      Math.min(PERSON_PROFILE_CHRONOLOGY_MAX_SUBJECT_DETAILS, safeRequestedLimit),
    );
    const animeRows = subjects.items.filter((subject) => subject.mediaTypeCode === 2);
    const uniqueAnimeSubjects = new Map<number, PersonRelationSubject>();
    for (const subject of animeRows) {
      if (!uniqueAnimeSubjects.has(subject.id)) uniqueAnimeSubjects.set(subject.id, subject);
    }
    const candidates = [...uniqueAnimeSubjects.values()];
    const selected = sampleEvenly(candidates, detailLimit);
    const observations = await mapConcurrentOrdered(
      selected,
      PERSON_PROFILE_CHRONOLOGY_MAX_CONCURRENCY,
      async (subject): Promise<ReleaseDateObservation> => {
        try {
          const raw = await this.api.getSubjectById(subject.id, {
            maxResponseBytes: PERSON_PROFILE_CHRONOLOGY_MAX_RESPONSE_BYTES,
          });
          const date = (raw as { date?: unknown } | null)?.date;
          if (date === undefined || date === null) return { kind: 'missing' };
          if (!validIsoCalendarDate(date)) return { kind: 'invalid' };
          return {
            kind: 'valid',
            date,
            subject: { id: subject.id, name: subject.name },
          };
        } catch {
          return { kind: 'failed' };
        }
      },
    );
    const dated = observations
      .filter((observation): observation is Extract<ReleaseDateObservation, { kind: 'valid' }> =>
        observation.kind === 'valid',
      )
      .sort((left, right) => left.date.localeCompare(right.date) || left.subject.id - right.subject.id);
    const earliestDate = dated[0]?.date;
    const latestDate = dated.at(-1)?.date;
    const limitations = [
      '极值只代表本次采样到的动画条目官方 subject.date；官方字段语义是播出/发行日期，不代表人物实际参与或工作的日期。',
      '人物作品关系接口未声明顺序、总数、分页或完整性；即使本次返回行全部采样，也不能据此推断人物完整生涯的最早或最近作品。',
      '等距选样依据关系接口的返回顺序，仅用于确定性抽样，不把该顺序解释为时间顺序。',
    ];
    if (dated.length === 0) {
      limitations.unshift(
        '本次选取的动画作品没有取得有效日期；这不证明人物没有动画作品，也不证明所有相关作品都没有日期。',
      );
    }
    const extreme = (date: string | undefined) => {
      if (!date) return undefined;
      return {
        date,
        subjects: dated
          .filter((observation) => observation.date === date)
          .map((observation) => observation.subject),
      };
    };

    return {
      state: dated.length > 0 ? 'partial' : 'not_computable',
      sourceCompleteness: 'undocumented',
      dateSemantics: 'official-subject-air-release-date',
      samplingStrategy:
        candidates.length > selected.length
          ? 'evenly-spaced-returned-anime-relations'
          : 'all-returned-anime-relations',
      relationRowsObserved: subjects.observed,
      relationRowsReturned: subjects.returned,
      relationRowsTruncated: subjects.truncated,
      animeRelationRowsReturned: animeRows.length,
      uniqueAnimeSubjects: candidates.length,
      selectedSubjectIds: selected.map((subject) => subject.id),
      selectedSubjectDetails: selected.length,
      succeededSubjectDetails: observations.filter((observation) => observation.kind !== 'failed')
        .length,
      failedSubjectDetails: observations.filter((observation) => observation.kind === 'failed')
        .length,
      validDateSubjects: dated.length,
      missingDateSubjects: observations.filter((observation) => observation.kind === 'missing')
        .length,
      invalidDateSubjects: observations.filter((observation) => observation.kind === 'invalid')
        .length,
      omittedAnimeSubjects: Math.max(0, candidates.length - selected.length),
      maxConcurrency: PERSON_PROFILE_CHRONOLOGY_MAX_CONCURRENCY,
      responseByteLimit: PERSON_PROFILE_CHRONOLOGY_MAX_RESPONSE_BYTES,
      ...(extreme(earliestDate) ? { earliestObserved: extreme(earliestDate) } : {}),
      ...(extreme(latestDate) ? { latestObserved: extreme(latestDate) } : {}),
      limitations,
    };
  }

  async getPersonRelatedSubjects(personId: number, limit = 20): Promise<PersonRelationSubject[]> {
    const raw = await this.api.getRelatedSubjectsByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map(mapPersonRelationSubject);
  }

  async getPersonRelatedCharacters(
    personId: number,
    limit = 20,
  ): Promise<PersonRelationCharacter[]> {
    const raw = await this.api.getRelatedCharactersByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map(mapPersonRelationCharacter);
  }

  async getPersonRelatedCharactersWithCoverage(
    personId: number,
    limit = 120,
    options: { maxResponseBytes?: number } = {},
  ): Promise<RelationCollection<PersonRelationCharacter>> {
    const raw = await this.api.getRelatedCharactersByPersonId(personId, {
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    });
    const rawRows: unknown[] = Array.isArray(raw) ? raw : [];
    const validRows = rawRows.filter(validPersonRelationCharacter);
    const safeLimit = Math.max(0, Math.floor(limit));
    const selectedRows = validRows.slice(0, safeLimit);
    const items = selectedRows.map((row) => {
      const item = mapPersonRelationCharacter(row);
      // Keep the exact source value, including an empty role label.
      if (row.staff !== undefined) item.staff = row.staff;
      return item;
    });
    const schemaDriftRows = Array.isArray(raw) ? rawRows.length - validRows.length : 1;
    return {
      items,
      observed: rawRows.length,
      returned: items.length,
      truncated: validRows.length > items.length || schemaDriftRows > 0,
      schemaDriftRows,
    };
  }

  async getSubjectStaff(
    subjectId: number,
    limit = 100,
    options: { maxResponseBytes?: number; signal?: AbortSignal } = {},
  ): Promise<RelationCollection<SubjectStaffMember>> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId, {
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    const rawRows = Array.isArray(raw) ? raw : [];
    const validRows = rawRows.filter(validSubjectStaffRow);
    const schemaDriftRows = Array.isArray(raw) ? rawRows.length - validRows.length : 1;
    const safeLimit = Math.max(0, Math.floor(limit));
    const selectedRows = validRows.slice(0, safeLimit);
    const items = selectedRows.map(mapSubjectStaffMember);
    return {
      items,
      observed: rawRows.length,
      returned: items.length,
      truncated: validRows.length > items.length || schemaDriftRows > 0,
      schemaDriftRows,
    };
  }

  async getSubjectPersons(subjectId: number): Promise<DomainPerson[]> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId);
    return (raw || []).map((item) => ({
      id: item.id,
      name: item.name || '',
      type: item.type || 1,
      career: item.career || [],
      summary: '',
      images: item.images ? (item.images as Record<string, string>) : undefined,
    }));
  }
}
