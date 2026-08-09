import { z } from 'zod';
import { DiscoveryEngine, ConceptResolver } from '@bangumi-agent-kit/discovery';
import { defineTool } from '../define-tool.js';

const range = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict();

const budget = z
  .object({
    maxPages: z.number().int().min(1).max(1000).optional(),
    maxCandidates: z.number().int().min(1).max(100_000).optional(),
    maxHydrations: z.number().int().min(0).max(10_000).optional(),
    concurrency: z.number().int().min(1).max(32).optional(),
    maxConceptProbes: z.number().int().min(0).max(100).optional(),
    maxReturnedItems: z.number().int().min(1).max(1000).optional(),
  })
  .strict();

const discoveryQueryInput = z
  .object({
    keyword: z.string().max(200).optional(),
    media: z
      .union([
        z.enum(['anime', 'book', 'music', 'game', 'real']),
        z.array(z.enum(['anime', 'book', 'music', 'game', 'real'])).min(1).max(5),
      ])
      .optional(),
    categories: z
      .union([
        z.enum(['tv', 'ova', 'movie', 'web']),
        z.array(z.enum(['tv', 'ova', 'movie', 'web'])).min(1).max(4),
      ])
      .optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    month: z.number().int().min(1).max(12).optional(),
    season: z.string().regex(/^\d{4}-(winter|spring|summer|autumn)$/u).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    tags: z.array(z.string().min(1).max(120)).max(50).optional(),
    metaTags: z.array(z.string().min(1).max(120)).max(50).optional(),
    excludeMetaTags: z.array(z.string().min(1).max(120)).max(50).optional(),
    concepts: z.array(z.string().min(1).max(120)).max(20).optional(),
    rating: range.optional(),
    ratingCount: range.optional(),
    rank: range.optional(),
    collectionCount: range.optional(),
    nsfw: z.union([z.enum(['include', 'exclude', 'only']), z.boolean()]).optional(),
    sort: z.enum(['relevance', 'heat', 'rank', 'score', 'date']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    resultMode: z.enum(['top', 'all']).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    explain: z.enum(['none', 'compact', 'full']).optional(),
    budget: budget.optional(),
  })
  .strict();

export function createDiscoveryTools() {
  const querySubjects = defineTool({
    name: 'bangumi.query_subjects',
    description:
      '按受控条件发现 Bangumi 条目。支持媒体类型、季/月日期、标签、概念、评分/排名/收藏人数范围与 explain；它是有界、可解释的 discovery，不替代已知 ID 的 bangumi.get_subject。',
    input: discoveryQueryInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new Error('ProviderRegistry is required to run query_subjects tool');
      }
      return new DiscoveryEngine(deps.providerRegistry).query(input, { authScope: 'public' });
    },
  });

  const resolveConcept = defineTool({
    name: 'bangumi.resolve_subject_concept',
    description:
      '解析一个受控的条目 discovery 概念。只接受精确词表匹配；未知或同时命中 tag/meta_tag 的概念会明确返回，不进行隐式语义扩展。',
    input: z.object({ concept: z.string().trim().min(1).max(120) }).strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => new ConceptResolver().resolve(input.concept),
  });

  return [querySubjects, resolveConcept] as const;
}
