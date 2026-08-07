import { CharacterService } from '../services/character-service.js';
import { DomainCharacter, CharacterRelatedPerson } from '../models/character.js';

export interface SubjectCastItem {
  character: DomainCharacter;
  actors: CharacterRelatedPerson[];
}

export async function getSubjectCast(
  characterService: CharacterService,
  subjectId: number
): Promise<SubjectCastItem[]> {
  const characters = await characterService.getSubjectCharacters(subjectId);
  const result: SubjectCastItem[] = [];

  for (const char of characters) {
    let actors: CharacterRelatedPerson[] = [];
    try {
      actors = await characterService.getCharacterRelatedPersons(char.id);
    } catch {
      // Ignore person lookup error for single character
    }
    result.push({
      character: char,
      actors,
    });
  }

  return result;
}
