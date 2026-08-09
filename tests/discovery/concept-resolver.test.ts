import { describe, expect, it } from 'vitest';
import {
  ConceptResolver,
  DEFAULT_CONCEPT_DEFINITIONS,
  resolveSubjectConcept,
} from '@bangumi-agent-kit/discovery';

describe('deterministic subject concepts', () => {
  it('resolves only exact curated literals with source evidence', () => {
    const result = resolveSubjectConcept('后宫');
    expect(result.state).toBe('exact');
    expect(result.candidates).toMatchObject([{ source: 'tag', value: '后宫', canonical: '后宫' }]);
    expect(result.candidates[0]?.evidence[0]?.source.class).toBe('official_v0');
  });

  it('does not silently expand an unknown concept', () => {
    const result = resolveSubjectConcept('异世界转生');
    expect(result.state).toBe('unknown');
    expect(result.candidates).toEqual([]);
    expect(result.message).toContain('no semantic expansion');
  });

  it('surfaces ambiguity when a literal exists in both official facets', () => {
    const resolver = new ConceptResolver([
      ...DEFAULT_CONCEPT_DEFINITIONS,
      { input: '双源', canonical: '双源', source: 'tag', reason: 'fixture', lastVerified: '2026-08-09' },
      { input: '双源', canonical: '双源', source: 'meta_tag', reason: 'fixture', lastVerified: '2026-08-09' },
    ]);
    const result = resolver.resolve('双源');
    expect(result.state).toBe('ambiguous');
    expect(result.candidates.map((item) => item.source)).toEqual(['tag', 'meta_tag']);
  });
});
