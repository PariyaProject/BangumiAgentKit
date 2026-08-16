import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainPerson,
  PersonActivityDistribution,
  PersonActivityProfile,
  PersonActivitySummary,
  PersonRelationCharacter,
  PersonRelationSubject,
  RelationCollection,
  SubjectStaffGroup,
  SubjectStaffMember,
} from '../models/person.js';
import { PersonCandidate, SearchResult, SearchStatus } from '../results/result.js';
import { normalizeSearchText } from '../workflows/resolve-subject.js';
import { mapSubjectType } from './subject-service.js';

export type { PersonRelationCharacter } from '../models/person.js';

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
  name_cn?: string;
  image?: string;
}): PersonRelationSubject {
  return {
    id: raw.id,
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
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
  images?: Record<string, string>;
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

    return {
      person: mapPerson(rawPerson),
      subjects,
      characters,
      summary: aggregatePersonActivity(subjects.items, characters.items),
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

  async getSubjectStaff(
    subjectId: number,
    limit = 100,
  ): Promise<RelationCollection<SubjectStaffMember>> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId);
    const allStaff = (raw || []).map(mapSubjectStaffMember);
    const safeLimit = Math.max(0, Math.floor(limit));
    return {
      items: allStaff.slice(0, safeLimit),
      observed: allStaff.length,
      returned: Math.min(allStaff.length, safeLimit),
      truncated: allStaff.length > safeLimit,
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
