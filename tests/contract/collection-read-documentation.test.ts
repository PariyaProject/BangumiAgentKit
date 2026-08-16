import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface CatalogEntry {
  name: string;
  description: string;
}

describe('collection read catalog and documentation contract', () => {
  it('keeps promoted official operations discoverable in the current docs and catalog', () => {
    const catalog = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/tool-catalog.json'), 'utf8'),
    ) as CatalogEntry[];
    const officialDocs = readFileSync(
      resolve(process.cwd(), 'docs/research/official-api-capabilities.md'),
      'utf8',
    );
    const gapDocs = readFileSync(
      resolve(process.cwd(), 'docs/research/bangumi-capability-gap.md'),
      'utf8',
    );
    const promoted = [
      ['bangumi.get_episode_collections', 'getUserSubjectEpisodeCollection'],
      ['bangumi.list_character_collections', 'getUserCharacterCollections'],
      ['bangumi.get_character_collection', 'getUserCharacterCollection'],
      ['bangumi.list_person_collections', 'getUserPersonCollections'],
      ['bangumi.get_person_collection', 'getUserPersonCollection'],
    ] as const;

    for (const [toolName, operationId] of promoted) {
      const entry = catalog.find((candidate) => candidate.name === toolName);
      expect(entry, `${toolName} catalog entry`).toBeDefined();
      expect(entry?.description).toContain('官方');
      expect(officialDocs).toContain(toolName);
      expect(officialDocs).toContain(operationId);
    }

    const episodeEntry = catalog.find(
      (candidate) => candidate.name === 'bangumi.get_episode_collections',
    );
    expect(episodeEntry?.description).toContain('items[].type');
    expect(episodeEntry?.description).toContain('items[].status');
    expect(officialDocs).toContain('### Current semantic coverage');
    expect(officialDocs).toContain('### Historical PR-7A snapshot');
    expect(gapDocs).toContain('## 当前语义面补充');
    expect(gapDocs).toContain('bangumi.get_episode_collections');
  });
});
