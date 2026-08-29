import { CharacterService, getSubjectCharacterCoverage } from '../services/character-service.js';
import { PersonCandidate } from '../results/result.js';

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

export interface SubjectCastResult {
  status: 'ok';
  subjectId: number;
  cast: SubjectCastItem[];
  observed: number;
  returned: number;
  truncated: boolean;
  schemaDriftRows: number;
  invalidActorIdRows: number;
}

export async function getSubjectCast(
  characterService: CharacterService,
  subjectId: number,
  options: { limit?: number; maxResponseBytes?: number } = {},
): Promise<SubjectCastResult> {
  const limit = Math.max(0, Math.floor(options.limit ?? 30));

  const characters = await characterService.getSubjectCharacters(subjectId, {
    limit,
    maxResponseBytes: options.maxResponseBytes,
  });
  const sourceCoverage = getSubjectCharacterCoverage(characters);
  const targetCharacters = characters.slice(0, limit);

  const cast: SubjectCastItem[] = targetCharacters.map((item) => ({
    character: item.character,
    relation: item.relation,
    actors: item.actors || [],
  }));

  return {
    status: 'ok',
    subjectId,
    cast,
    observed: sourceCoverage?.observed ?? characters.length,
    returned: sourceCoverage?.returned ?? targetCharacters.length,
    truncated: sourceCoverage?.truncated ?? characters.length > targetCharacters.length,
    schemaDriftRows: sourceCoverage?.schemaDriftRows ?? 0,
    invalidActorIdRows: sourceCoverage?.invalidActorIdRows ?? 0,
  };
}
