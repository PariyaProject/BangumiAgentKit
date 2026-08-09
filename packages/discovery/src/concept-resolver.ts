import {
  createEvidenceRef,
  SOURCE_V0,
  type EvidenceRef,
} from '@bangumi-agent-kit/provider-core';
import type {
  ConceptCandidate,
  ConceptDefinition,
  ConceptResolution,
} from './contracts.js';

export const DEFAULT_CONCEPT_DEFINITIONS: readonly ConceptDefinition[] = [
  { input: '后宫', canonical: '后宫', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '异世界', canonical: '异世界', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '原创', canonical: '原创', source: 'meta_tag', reason: 'Exact literal meta-tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '百合', canonical: '百合', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '日常', canonical: '日常', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '校园', canonical: '校园', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
  { input: '战斗', canonical: '战斗', source: 'tag', reason: 'Exact literal tag facet; no synonym expansion.', lastVerified: '2026-08-09' },
];

function evidenceFor(definition: ConceptDefinition): EvidenceRef {
  return createEvidenceRef({
    source: { ...SOURCE_V0, operation: 'searchSubjects', experimental: true },
    retrievedAt: `${definition.lastVerified}T00:00:00.000Z`,
    fieldPath: `filter.${definition.source === 'tag' ? 'tag' : 'meta_tags'}`,
    freshness: { state: 'unknown' },
    confidence: 'medium',
  });
}

export class ConceptResolver {
  private readonly definitions: readonly ConceptDefinition[];

  constructor(definitions: readonly ConceptDefinition[] = DEFAULT_CONCEPT_DEFINITIONS) {
    this.definitions = definitions.map((item) => ({ ...item }));
  }

  list(): ConceptDefinition[] {
    return this.definitions.map((item) => ({ ...item }));
  }

  resolve(input: string): ConceptResolution {
    const normalized = input.trim();
    const matches = this.definitions.filter((item) => item.input === normalized);
    const candidates: ConceptCandidate[] = matches.map((item) => ({
      source: item.source,
      value: item.canonical,
      canonical: item.canonical,
      reason: item.reason,
      evidence: [evidenceFor(item)],
    }));
    if (candidates.length === 1) {
      return {
        input: normalized,
        state: 'exact',
        candidates,
        message: `Resolved "${normalized}" to the exact ${candidates[0]?.source} literal "${candidates[0]?.canonical}".`,
      };
    }
    if (candidates.length > 1) {
      return {
        input: normalized,
        state: 'ambiguous',
        candidates,
        message: `Concept "${normalized}" matches multiple official facet sources; specify the source explicitly.`,
      };
    }
    return {
      input: normalized,
      state: 'unknown',
      candidates: [],
      message: `Concept "${normalized}" is not in the deterministic vocabulary; no semantic expansion was attempted.`,
    };
  }

  resolveMany(inputs: readonly string[]): ConceptResolution[] {
    return inputs.map((input) => this.resolve(input));
  }
}

export function resolveSubjectConcept(
  input: string,
  definitions: readonly ConceptDefinition[] = DEFAULT_CONCEPT_DEFINITIONS,
): ConceptResolution {
  return new ConceptResolver(definitions).resolve(input);
}
