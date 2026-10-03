import { z } from 'zod';
import {
  compareSubjectCohorts,
  DiscoveryEngine,
  ConceptResolver,
  SUBJECT_COHORT_MAX_SUBJECTS,
} from '@bangumi-agent-kit/discovery';
import { defineTool } from '../define-tool.js';

const range = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict();

const discoveryQueryInputBase = z
  .object({
    keyword: z.string().max(200).optional(),
    media: z
      .union([
        z.enum(['anime', 'book', 'music', 'game', 'real']),
        z
          .array(z.enum(['anime', 'book', 'music', 'game', 'real']))
          .min(1)
          .max(5),
      ])
      .optional(),
    categories: z
      .union([
        z.enum(['tv', 'ova', 'movie', 'web']),
        z
          .array(z.enum(['tv', 'ova', 'movie', 'web']))
          .min(1)
          .max(4),
      ])
      .optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    month: z.number().int().min(1).max(12).optional(),
    season: z
      .string()
      .regex(/^\d{4}-(winter|spring|summer|autumn)$/u)
      .optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
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
    limit: z.number().int().min(1).max(100).optional(),
    explain: z.enum(['none', 'compact', 'full']).optional(),
  })
  .strict();

function rejectTieBreakWithoutScore(
  input: { sort?: string; tieBreak?: unknown },
  context: z.RefinementCtx,
): void {
  if (input.tieBreak !== undefined && input.sort !== 'score') {
    context.addIssue({
      code: 'custom',
      path: ['tieBreak'],
      message: 'tieBreak is currently supported only with sort=score',
    });
  }
}

export const discoveryQueryInput = discoveryQueryInputBase
  .extend({
    tieBreak: z
      .object({
        field: z.literal('ratingCount'),
        order: z.enum(['asc', 'desc']).optional(),
      })
      .strict()
      .optional()
      .describe('同主排序值时的次级顺序；当前仅支持 sort=score 时按评分人数排序，默认从高到低。'),
  })
  .strict()
  .superRefine(rejectTieBreakWithoutScore);

// Cohort aggregation must use the bounded all-results path; the cohort
// service rejects "top" because its metrics are intended to describe the
// bounded returned sample. Encode that execution contract in MCP Schema so
// clients cannot submit an input that the tool will turn into INTERNAL_ERROR.
const cohortDiscoveryQueryInput = discoveryQueryInputBase
  .extend({
    resultMode: z.literal('all').default('all'),
  })
  .strict();

const subjectCohortDefinitionInput = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    query: cohortDiscoveryQueryInput,
  })
  .strict();

const subjectCohortLimitInput = z
  .number()
  .int()
  .min(1)
  .max(SUBJECT_COHORT_MAX_SUBJECTS)
  .optional()
  .describe('每个 cohort 最多保留的返回条目数，默认 40；不代表完整数据库枚举');

export const subjectCohortComparisonInput = z
  .object({
    cohorts: z
      .array(subjectCohortDefinitionInput)
      .min(1)
      .max(2)
      .describe('一个或两个 cohort 定义；两侧时差值按输入顺序计算为 B − A'),
    maxSubjects: subjectCohortLimitInput,
  })
  .strict();

export const subjectCohortAggregationInput = z
  .object({
    cohort: subjectCohortDefinitionInput.describe('一个用于聚合观察的 cohort 定义'),
    maxSubjects: subjectCohortLimitInput,
  })
  .strict();

export function createDiscoveryTools() {
  const querySubjects = defineTool({
    name: 'bangumi.query_subjects',
    description:
      '按受控条件发现 Bangumi 条目。支持媒体类型、日期、标签/精确概念、评分/排名/收藏人数范围、匹配度/收藏热度/排名/评分排序，以及评分同分时按评分人数作次级排序；heat 表示当前收藏人数，不是讨论热度或历史趋势。结果受官方搜索实验状态与显式覆盖限制约束；不替代已知 ID 的 bangumi.get_subject。',
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

  const compareSubjectCohortsTool = defineTool({
    name: 'bangumi.compare_subject_cohorts',
    description:
      '比较一个或两个由现有 discovery 条件定义的 Bangumi 条目 cohort。仅使用官方 v0 discovery 与有界条目详情，输出平均评分、平均热度（collection 各状态之和）和平均报告话数；两侧时才输出 B−A 差值，同时输出每项有效/缺失/冲突计数、查询覆盖与检索证据。结果是有界返回样本，不生成推荐、质量、因果或历史趋势结论。',
    input: subjectCohortComparisonInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new Error('ProviderRegistry is required to run compare_subject_cohorts tool');
      }
      return compareSubjectCohorts(
        input.cohorts,
        { maxSubjects: input.maxSubjects },
        deps.providerRegistry,
        { authScope: 'public' },
      );
    },
  });

  const aggregateSubjectCohortTool = defineTool({
    name: 'bangumi.aggregate_subject_cohort',
    description:
      '聚合一个由现有 discovery 条件定义的 Bangumi 条目 cohort。仅使用官方 v0 discovery 与有界条目详情，输出平均评分、平均热度（collection 各状态之和）、平均报告话数、覆盖状态、检索证据和明确限制；不生成推荐、质量、因果或历史趋势结论。',
    input: subjectCohortAggregationInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new Error('ProviderRegistry is required to run aggregate_subject_cohort tool');
      }
      return compareSubjectCohorts(
        [input.cohort],
        { maxSubjects: input.maxSubjects },
        deps.providerRegistry,
        { authScope: 'public' },
      );
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

  return [
    querySubjects,
    compareSubjectCohortsTool,
    aggregateSubjectCohortTool,
    resolveConcept,
  ] as const;
}

export type DiscoveryQueryToolInput = z.infer<typeof discoveryQueryInput>;
export type SubjectCohortComparisonToolInput = z.infer<typeof subjectCohortComparisonInput>;
export type SubjectCohortAggregationToolInput = z.infer<typeof subjectCohortAggregationInput>;
