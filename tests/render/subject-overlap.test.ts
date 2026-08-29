import { describe, expect, it } from 'vitest';
import type { SubjectOverlapResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectOverlapViewModel,
  extractImageUrls,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import { getTemplate } from '../../packages/renderer/src/templates/TemplateRegistry.js';

const result: SubjectOverlapResult = {
  subjectIds: [101, 102, 103],
  state: 'partial',
  kind: 'all',
  castRole: 'main',
  subjects: [101, 102, 103].map((id) => ({
    subjectId: id,
    state: id === 103 ? 'partial' : 'complete',
    subject: {
      id,
      name: `Subject ${id}`,
      nameCn: `一个用于窄宽度测试的长条目标题 ${id}`,
      type: 'anime' as const,
      date: '2026-01-01',
      platform: 'TV',
    },
    sections: { cast: id === 103 ? 'partial' : 'complete', staff: 'complete' },
    coverage: {
      sourceRequestsAttempted: 4,
      sourceRequestsSucceeded: 4,
      cast: { observed: 80, returned: 24, truncated: id !== 101 },
      staff: { observed: 48, returned: 48, truncated: false },
    },
  })),
  pairs: [
    {
      pairId: '101:102',
      leftSubjectId: 101,
      rightSubjectId: 102,
      rank: 1,
      rankScore: 2,
      rankBasis: 'combined_matched_ids',
      cast: {
        state: 'complete',
        coverage: {
          state: 'complete',
          left: {
            subjectId: 101,
            state: 'complete',
            rowsObserved: 2,
            rowsReturned: 2,
            uniqueIdsReturned: 2,
            missingIdRows: 0,
            truncated: false,
          },
          right: {
            subjectId: 102,
            state: 'complete',
            rowsObserved: 2,
            rowsReturned: 2,
            uniqueIdsReturned: 2,
            missingIdRows: 0,
            truncated: false,
          },
          candidateIds: 3,
          matchedIds: 1,
          unionIds: 3,
          returned: 1,
          omitted: 0,
          overlapRate: 1 / 3,
          truncated: false,
        },
        items: [
          {
            personId: 900,
            name: '共同主役',
            career: ['seiyuu'],
            matchBasis: 'recognized_main_role',
            credits: [
              {
                subjectId: 101,
                characters: [{ name: '角色一', relation: '主角', roleFamily: 'main' }],
              },
              {
                subjectId: 102,
                characters: [{ name: '角色二', relation: '主役', roleFamily: 'main' }],
              },
            ],
          },
        ],
      },
      staff: {
        state: 'complete',
        coverage: {
          state: 'complete',
          left: {
            subjectId: 101,
            state: 'complete',
            rowsObserved: 2,
            rowsReturned: 2,
            uniqueIdsReturned: 2,
            missingIdRows: 0,
            truncated: false,
          },
          right: {
            subjectId: 102,
            state: 'complete',
            rowsObserved: 2,
            rowsReturned: 2,
            uniqueIdsReturned: 2,
            missingIdRows: 0,
            truncated: false,
          },
          candidateIds: 3,
          matchedIds: 1,
          unionIds: 3,
          returned: 1,
          omitted: 0,
          overlapRate: 1 / 3,
          truncated: false,
        },
        items: [
          {
            personId: 910,
            name: '共同导演',
            career: ['director'],
            credits: [
              { subjectId: 101, rawRelations: ['导演'], relations: ['导演'], eps: [] },
              { subjectId: 102, rawRelations: ['导演'], relations: ['导演'], eps: [] },
            ],
          },
        ],
      },
    },
  ],
  formulaVersion: 'subject-overlap-v1',
  coverage: {
    requestedSubjects: 3,
    returnedSubjects: 3,
    requestedPairs: 3,
    returnedPairs: 1,
    omittedPairs: 2,
    limits: { maxSubjects: 8, maxCast: 24, maxStaff: 48, maxPairs: 1, maxPeople: 24 },
    truncated: true,
  },
  source: {
    official: {
      class: 'official-v0',
      operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/characters'],
      attemptedAt: '2026-08-29T00:00:00.000Z',
      retrievedAt: '2026-08-29T00:00:01.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: ['subject-overlap-composition'],
      attemptedAt: '2026-08-29T00:00:00.000Z',
      retrievedAt: '2026-08-29T00:00:01.000Z',
    },
  },
  operationEvidence: [
    {
      source: 'official-v0',
      operation: 'GET /v0/subjects/{subject_id}/characters',
      subjectId: 101,
      attemptedAt: '2026-08-29T00:00:00.000Z',
      retrievedAt: '2026-08-29T00:00:01.000Z',
      outcome: 'succeeded',
    },
  ],
  evidence: [
    {
      source: 'derived-s7',
      operation: 'subject-overlap-composition',
      formulaVersion: 'subject-overlap-v1',
      description: '有界稳定 ID 重合观察。',
    },
  ],
  warnings: [{ code: 'PAIR_LIMIT_REACHED', state: 'partial', message: '条目对达到上限。' }],
  limitations: ['不代表完整演职员表或历史连续合作。'],
};

describe('subject-overlap renderer', () => {
  it('renders pair ranking, ratios, raw evidence, limits, and no image assets', () => {
    const viewModel = buildSubjectOverlapViewModel(result);
    expect(getTemplate('subject-overlap').version).toBe(1);
    expect(viewModel.template).toBe('subject-overlap');
    expect(extractImageUrls(viewModel)).toEqual([]);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('条目关系重合');
    expect(html).toContain('共同主役');
    expect(html).toContain('重合 33.3%');
    expect(html).toContain('共同导演');
    expect(html).toContain('PAIR_LIMIT_REACHED');
    expect(html).toContain('subject-overlap-v1');
    expect(html).toContain('不代表完整演职员表');
    expect(html).toContain('官方获取于：2026-08-29T00:00:01.000Z');
    expect(html).not.toContain('https://');
  });

  it('reports bounded renderer omissions for high-cardinality evidence', () => {
    const firstPair = result.pairs[0]!;
    const firstPerson = firstPair.cast!.items[0]!;
    const crowded = {
      ...result,
      pairs: [
        {
          ...firstPair,
          cast: {
            ...firstPair.cast!,
            items: Array.from({ length: 9 }, (_, index) => ({
              ...firstPerson,
              personId: firstPerson.personId + index,
              name: `${firstPerson.name}-${index}`,
            })),
          },
        },
      ],
    };
    const html = renderHtmlTemplate(buildSubjectOverlapViewModel(crowded), 'bangumi-dark', {}, 640);
    expect(html).toContain('人物渲染上限：8');
    expect(html).toContain('另有 1 位共同人物未展开');
  });
});
