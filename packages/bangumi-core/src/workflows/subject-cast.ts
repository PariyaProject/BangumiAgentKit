import { CharacterService } from '../services/character-service.js';
import { DomainCharacter, CharacterRelatedPerson } from '../models/character.js';

export interface SubjectCastItem {
  character: DomainCharacter;
  persons: CharacterRelatedPerson[];
  voiceActors?: CharacterRelatedPerson[];
  relatedPersons?: CharacterRelatedPerson[];
}

export interface SubjectCastResult {
  status: 'ok' | 'partial';
  subjectId: number;
  cast: SubjectCastItem[];
  warnings?: string[];
}

/**
 * Simple bounded concurrency pool helper (maxConcurrency = 5)
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      const item = items[idx];
      if (item !== undefined) {
        results[idx] = await fn(item, idx);
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function getSubjectCast(
  characterService: CharacterService,
  subjectId: number,
  options: { limit?: number; maxConcurrency?: number } = {},
): Promise<SubjectCastResult> {
  const limit = options.limit ?? 30;
  const maxConcurrency = options.maxConcurrency ?? 5;

  const characters = await characterService.getSubjectCharacters(subjectId);
  const targetCharacters = characters.slice(0, limit);
  const warnings: string[] = [];

  const cast = await mapConcurrent(targetCharacters, maxConcurrency, async (char) => {
    let persons: CharacterRelatedPerson[] = [];
    try {
      persons = await characterService.getCharacterRelatedPersons(char.id);
    } catch {
      warnings.push(`角色 ${char.name} (ID: ${char.id}) 的人物关系读取失败`);
    }

    // Classify persons into voiceActors vs relatedPersons
    const voiceActors: CharacterRelatedPerson[] = [];
    const relatedPersons: CharacterRelatedPerson[] = [];

    for (const p of persons) {
      const role = (p.roleName || '').toLowerCase();
      if (
        role.includes('cv') ||
        role.includes('声优') ||
        role.includes('配音') ||
        role.includes('actor') ||
        role.includes('voice')
      ) {
        voiceActors.push(p);
      } else {
        relatedPersons.push(p);
      }
    }

    // If metadata doesn't uniquely distinguish voice actors, set warning on item level if needed
    if (relatedPersons.length > 0 && voiceActors.length === 0) {
      warnings.push(
        `Bangumi relation metadata for character ${char.name} does not uniquely identify all persons as voice actors.`,
      );
    }

    return {
      character: char,
      persons,
      voiceActors: voiceActors.length > 0 ? voiceActors : undefined,
      relatedPersons:
        relatedPersons.length > 0 ? relatedPersons : voiceActors.length === 0 ? persons : undefined,
    };
  });

  return {
    status: warnings.length > 0 ? 'partial' : 'ok',
    subjectId,
    cast,
    warnings: warnings.length > 0 ? Array.from(new Set(warnings)) : undefined,
  };
}
