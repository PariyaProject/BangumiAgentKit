import { CharacterService } from '../services/character-service.js';
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
}

export async function getSubjectCast(
  characterService: CharacterService,
  subjectId: number,
  options: { limit?: number } = {},
): Promise<SubjectCastResult> {
  const limit = options.limit ?? 30;

  const characters = await characterService.getSubjectCharacters(subjectId);
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
  };
}
