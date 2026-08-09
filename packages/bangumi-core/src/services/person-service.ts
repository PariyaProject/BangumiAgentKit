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

export function mapPerson(raw: {
  id: number;
  name?: string;
  type?: number;
  career?: string[];
  short_summary?: string;
  summary?: string;
  images?: Record<string, string>;
}): DomainPerson {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: (raw.career as string[]) || [],
    summary: raw.short_summary || raw.summary || '',
    images: raw.images ? (raw.images as Record<string, string>) : undefined,
  };
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
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: raw.career || [],
    images: raw.images,
    relation: raw.relation || '未知',
    eps: raw.eps || '',
  };
}

function buildDistribution<T>(
  items: readonly T[],
  keyOf: (item: T) => string | undefined,
  subjectIdOf: (item: T) => number | undefined,
): PersonActivityDistribution[] {
  const buckets = new Map<string, { label: string; count: number; subjectIds: Set<number> }>();

  for (const item of items) {
    const rawKey = keyOf(item)?.trim();
    const key = rawKey || 'unknown';
    const bucket = buckets.get(key) || {
      label: rawKey || '未知',
      count: 0,
      subjectIds: new Set<number>(),
    };
    bucket.count += 1;
    const subjectId = subjectIdOf(item);
    if (subjectId !== undefined) bucket.subjectIds.add(subjectId);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      count: bucket.count,
      uniqueSubjects: bucket.subjectIds.size,
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
    ),
    characterRoles: buildDistribution(
      characters,
      (character) => character.staff,
      (character) => character.subjectId,
    ),
  };
}

export function groupSubjectStaff(members: readonly SubjectStaffMember[]): SubjectStaffGroup[] {
  const groups = new Map<string, SubjectStaffMember[]>();
  for (const member of members) {
    const relation = member.relation.trim() || '未知';
    const group = groups.get(relation) || [];
    group.push(member);
    groups.set(relation, group);
  }

  return Array.from(groups.entries())
    .map(([relation, groupedMembers]) => ({
      relation,
      count: groupedMembers.length,
      members: groupedMembers,
    }))
    .sort((left, right) => right.count - left.count || left.relation.localeCompare(right.relation));
}

export interface SearchPersonsOptions {
  limit?: number;
  offset?: number;
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

    const res = await this.api.searchPersons({ limit, offset }, { keyword: query });

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
