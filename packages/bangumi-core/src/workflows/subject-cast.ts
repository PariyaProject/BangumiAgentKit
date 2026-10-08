import { CharacterService, getSubjectCharacterCoverage } from '../services/character-service.js';
import { PersonCandidate } from '../results/result.js';

export const SUBJECT_CAST_DEFAULT_LIMIT = 30;
export const SUBJECT_CAST_MAX_LIMIT = 100;
export const SUBJECT_CAST_INTERNAL_MAX_LIMIT = 200;
export const SUBJECT_CAST_MAX_RESPONSE_BYTES = 1_048_576;

export interface SubjectCastItem {
  character: {
    id: number;
    name: string;
    type: number;
    summary?: string;
    images?: Record<string, string>;
  };
  relation: string;
  actors: PersonCandidate[];
}

export interface MultiRoleVoiceActorGroup {
  person: PersonCandidate;
  distinctCharacterCount: number;
  roles: Array<{
    characterId: number;
    characterName: string;
    relation: string;
  }>;
}

export interface SubjectCastResult {
  status: 'ok';
  subjectId: number;
  cast: SubjectCastItem[];
  observed: number;
  returned: number;
  truncated: boolean;
  schemaDriftRows: number;
  invalidActorIdRows: number;
  selectedRows: number;
  omittedRowsByLimit: number;
  duplicateActorCharacterLinks: number;
  multiRoleVoiceActors: MultiRoleVoiceActorGroup[];
  source: {
    api: 'official-v0';
    operation: 'GET /v0/subjects/{subject_id}/characters';
    retrievedAt: string;
    status: 'observed' | 'partial';
    responseBytes: number | null;
    responseByteLimit: number;
    paginationAvailable: false;
    totalCountAvailable: false;
  };
  limitations: string[];
}

function groupMultiRoleVoiceActors(cast: readonly SubjectCastItem[]): MultiRoleVoiceActorGroup[] {
  const groups = new Map<
    number,
    {
      person: PersonCandidate;
      careers: Set<string>;
      roles: Map<number, { characterId: number; characterName: string; relation: string }>;
    }
  >();

  for (const item of cast) {
    for (const actor of item.actors) {
      if (!Number.isInteger(actor.id) || actor.id <= 0) continue;
      const group = groups.get(actor.id) ?? {
        person: { ...actor, career: [] },
        careers: new Set<string>(),
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
    .sort(([leftId], [rightId]) => leftId - rightId)
    .map(([, group]) => ({
      person: {
        ...group.person,
        career: [...group.careers],
      },
      distinctCharacterCount: group.roles.size,
      roles: [...group.roles.values()],
    }));
}

function normalizeCastLimit(value: number | undefined, maximum: number): number {
  const normalized =
    value !== undefined && Number.isFinite(value) ? Math.floor(value) : SUBJECT_CAST_DEFAULT_LIMIT;
  return Math.min(maximum, Math.max(0, normalized));
}

function normalizeResponseByteLimit(value: number | undefined): number {
  const normalized =
    value !== undefined && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : SUBJECT_CAST_MAX_RESPONSE_BYTES;
  return Math.min(SUBJECT_CAST_MAX_RESPONSE_BYTES, Math.max(1, normalized));
}

export async function getSubjectCast(
  characterService: CharacterService,
  subjectId: number,
  options: { limit?: number; maxLimit?: number; maxResponseBytes?: number } = {},
): Promise<SubjectCastResult> {
  const maximum = Math.min(
    SUBJECT_CAST_INTERNAL_MAX_LIMIT,
    Math.max(
      SUBJECT_CAST_MAX_LIMIT,
      normalizeCastLimit(options.maxLimit, SUBJECT_CAST_INTERNAL_MAX_LIMIT),
    ),
  );
  const limit = normalizeCastLimit(options.limit, maximum);

  const characters = await characterService.getSubjectCharacters(subjectId, {
    limit,
    maxResponseBytes: normalizeResponseByteLimit(options.maxResponseBytes),
  });
  const sourceCoverage = getSubjectCharacterCoverage(characters);
  const targetCharacters = characters.slice(0, limit);

  const cast: SubjectCastItem[] = targetCharacters.map((item) => ({
    character: item.character,
    relation: item.relation,
    actors: item.actors || [],
  }));
  const responseBytes = sourceCoverage?.responseBytes ?? null;
  const omittedRowsByLimit = sourceCoverage?.rowsOmittedByLimit ?? 0;
  const retrievedAt = new Date().toISOString();
  const multiRoleVoiceActors = groupMultiRoleVoiceActors(cast);
  const sourceStatus = sourceCoverage?.sourceStatus ?? 'partial';

  return {
    status: 'ok',
    subjectId,
    cast,
    observed: sourceCoverage?.observed ?? characters.length,
    returned: sourceCoverage?.returned ?? targetCharacters.length,
    truncated: sourceCoverage?.truncated ?? characters.length > targetCharacters.length,
    schemaDriftRows: sourceCoverage?.schemaDriftRows ?? 0,
    invalidActorIdRows: sourceCoverage?.invalidActorIdRows ?? 0,
    selectedRows: sourceCoverage?.returned ?? cast.length,
    omittedRowsByLimit,
    duplicateActorCharacterLinks: sourceCoverage?.duplicateActorCharacterLinks ?? 0,
    multiRoleVoiceActors,
    source: {
      api: 'official-v0',
      operation: 'GET /v0/subjects/{subject_id}/characters',
      retrievedAt,
      status: sourceStatus,
      responseBytes,
      responseByteLimit: sourceCoverage?.responseByteLimit ?? SUBJECT_CAST_MAX_RESPONSE_BYTES,
      paginationAvailable: false,
      totalCountAvailable: false,
    },
    limitations: [
      '分组仅依据这一条作品响应中已选取的合法角色行；接口不提供分页或总数。',
      '未观察到重复声优角色组不表示完整作品角色表中不存在。',
      '角色关系标签按来源原文保留，不解释为统一的主角或主役分类。',
    ],
  };
}
