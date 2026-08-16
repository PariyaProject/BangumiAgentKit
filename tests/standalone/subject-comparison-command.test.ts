import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import type { CliFlags } from '../../apps/standalone/src/command-parser.js';
import { formatHuman, Presenter } from '../../apps/standalone/src/presenter.js';
import type { StandaloneHost } from '../../apps/standalone/src/standalone-host.js';

const flags: CliFlags = {
  json: true,
  verbose: false,
  force: false,
  interactive: false,
  help: false,
  profile: 'test',
  online: false,
  auth: false,
  render: false,
};

function context(host: StandaloneHost): StandaloneCommandContext {
  return {
    host,
    flags,
    presenter: new Presenter({ stdout: new PassThrough(), stderr: new PassThrough() }),
    confirm: async () => false,
  };
}

describe('Standalone subject comparison commands', () => {
  it('routes semantic and renderer comparison commands with bounded options', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'partial',
      subjectIds: [123, 456],
      metrics: [],
      artifact: { id: 'comparison-fixture' },
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      ['compare', '123', '456', '--max-cast', '4', '--max-staff', '12', '--max-relations', '6'],
      context(host),
    );
    await registry.execute(
      [
        'render',
        'compare',
        '123',
        '456',
        '--max-cast',
        '3',
        '--max-staff',
        '10',
        '--max-relations',
        '5',
      ],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_comparison',
      { subjectIds: [123, 456], maxCast: 4, maxStaff: 12, maxRelations: 6 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_comparison',
      { subjectIds: [123, 456], maxCast: 3, maxStaff: 10, maxRelations: 5 },
      expect.anything(),
    );
  });

  it('rejects duplicate IDs and out-of-range comparison caps before tool execution', async () => {
    const executeTool = vi.fn();
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await expect(registry.execute(['compare', '123', '123'], context(host))).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('subject ids must be different'),
    });
    await expect(
      registry.execute(['render', 'compare', '123', '456', '--max-cast', '21'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(['compare', '123', '456', '789'], context(host)),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('unknown compare argument'),
    });
    await expect(
      registry.execute(['compare', '123', '456', '--typo', '9'], context(host)),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('unknown compare argument'),
    });
    await expect(
      registry.execute(['compare', '123', '456', '--max-cast'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2, message: expect.stringContaining('requires a value') });
    await expect(
      registry.execute(
        ['compare', '123', '456', '--max-cast', '4', '--max-cast', '5'],
        context(host),
      ),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('only be specified once'),
    });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('formats a bounded human comparison with identities, metrics, diagnostics, and sources', () => {
    const human = formatHuman({
      state: 'partial',
      subjectIds: [123, 456],
      subjects: [
        {
          subjectId: 123,
          state: 'complete',
          subject: {
            id: 123,
            type: 'anime',
            name: 'A title',
            nameCn: '甲条目',
            date: '2020-01-01',
            platform: 'TV',
            episodesReported: 12,
            totalEpisodesReported: 12,
          },
          sections: {
            stats: 'complete',
            cast: 'partial',
            staff: 'complete',
            relations: 'complete',
          },
          coverage: {
            sourceRequestsAttempted: 5,
            sourceRequestsSucceeded: 5,
            sectionsComplete: 3,
            sectionsPartial: 1,
            sectionsUnavailable: 0,
            sectionsNotComputable: 0,
            truncatedSections: ['cast'],
            limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
          },
          warnings: [],
          limitations: ['角色区段受上限约束。'],
          statistics: {
            state: 'conflict',
            rating: {
              state: 'conflict',
              population: 100,
              mean: 8.6,
              standardDeviation: 0.49,
              distribution: [
                { score: 8, count: 60, percentage: 60 },
                { score: 9, count: 40, percentage: 40 },
              ],
              formulas: {
                percentages: { id: 'bangumi.rating.percentages.v1', version: 1 },
                histogramMean: { id: 'bangumi.rating.histogram_mean.v1', version: 1 },
                populationStandardDeviation: {
                  id: 'bangumi.rating.population_sd.v1',
                  version: 1,
                },
              },
              conflicts: [
                {
                  scope: 'rating',
                  fieldPaths: ['histogramMean', 'rating.score'],
                  reason: 'derived histogram mean differs materially from upstream score',
                  candidates: [
                    {
                      source: { class: 'derived-s7', provider: 'derived' },
                      value: 8.6,
                    },
                    {
                      source: { class: 'official-v0', provider: 'bangumi' },
                      value: 7.4,
                    },
                  ],
                },
              ],
            },
            collection: {
              state: 'complete',
              total: 100,
              distribution: [
                { status: 'wish', count: 20, percentage: 20 },
                { status: 'collect', count: 50, percentage: 50 },
              ],
              completionRate: 0.5,
              completionState: 'complete',
              formulas: {
                percentages: { id: 'bangumi.collection.percentages.v1', version: 1 },
                completion: { id: 'bangumi.subject.completion.v1', version: 1 },
              },
            },
            coverage: {
              ratingBucketsExpected: 10,
              ratingBucketsObserved: 10,
              collectionBucketsExpected: 5,
              collectionBucketsObserved: 5,
              formulasAttempted: 5,
              formulasComplete: 4,
              formulasPartial: 0,
              formulasNotComputable: 0,
              formulasConflict: 1,
            },
            evidence: [
              {
                source: 'official-v0',
                provider: 'bangumi',
                operation: 'getSubjectById',
                fieldPath: 'rating.score',
              },
              {
                source: 'derived-s7',
                provider: 'derived',
                operation: 'bangumi.rating.histogram_mean.v1',
                fieldPath: 'histogramMean',
              },
            ],
          },
        },
        {
          subjectId: 456,
          state: 'unavailable',
          sections: {
            stats: 'unavailable',
            cast: 'unavailable',
            staff: 'unavailable',
            relations: 'unavailable',
          },
          coverage: {
            sourceRequestsAttempted: 1,
            sourceRequestsSucceeded: 0,
            sectionsComplete: 0,
            sectionsPartial: 0,
            sectionsUnavailable: 4,
            sectionsNotComputable: 0,
            truncatedSections: [],
            limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
          },
          warnings: [
            { code: 'UPSTREAM_NOT_FOUND', state: 'not_found', message: '官方条目未找到。' },
          ],
          limitations: ['条目详情不可用时不猜测区段。'],
        },
      ],
      metrics: [
        {
          key: 'score',
          label: '官方评分',
          values: [null, 7.5],
          delta: null,
          deltaPrecision: 1,
          state: 'conflict',
          conflicts: [
            {
              side: 'A',
              candidates: [
                {
                  source: { class: 'official_v0', provider: 'bangumi' },
                  value: 8.6,
                  metricValue: 8.6,
                },
                {
                  source: { class: 'derived', provider: 'fixture-derived' },
                  value: 8.7,
                  metricValue: 8.7,
                },
              ],
              reason: 'official and derived score conflict',
            },
          ],
        },
        {
          key: 'rank',
          label: '官方排名',
          values: [42, 120],
          delta: 78,
          deltaPrecision: 0,
          state: 'complete',
        },
      ],
      coverage: {
        requestedSubjects: 2,
        returnedSubjects: 1,
        subjectsComplete: 1,
        subjectsPartial: 0,
        subjectsUnavailable: 1,
        subjectsNotFound: 0,
        metricsComplete: 1,
        metricsUnknown: 1,
        metricsConflict: 0,
        limits: { maxSubjects: 2, maxCast: 4, maxStaff: 12, maxRelations: 8, maxOverlapItems: 24 },
      },
      overlapFormulaVersion: 'subject-comparison-overlap-v1',
      overlaps: {
        cast: {
          state: 'partial',
          items: [
            {
              personId: 900,
              name: '共同声优',
              career: ['seiyu'],
              credits: [
                { side: 'A', subjectId: 123, characters: [{ name: '甲角色', relation: '主角' }] },
                { side: 'B', subjectId: 456, characters: [{ name: '乙角色', relation: '配角' }] },
              ],
            },
          ],
          coverage: {
            state: 'partial',
            left: {
              state: 'partial',
              rowsObserved: 4,
              rowsReturned: 4,
              uniqueIdsReturned: 2,
              missingIdRows: 0,
              truncated: true,
            },
            right: {
              state: 'complete',
              rowsObserved: 3,
              rowsReturned: 3,
              uniqueIdsReturned: 2,
              missingIdRows: 0,
              truncated: false,
            },
            returned: 1,
            omitted: 0,
            truncated: true,
          },
        },
        staff: {
          state: 'unavailable',
          items: [],
          coverage: {
            state: 'unavailable',
            left: {
              state: 'complete',
              rowsObserved: 1,
              rowsReturned: 1,
              uniqueIdsReturned: 1,
              missingIdRows: 0,
              truncated: false,
            },
            right: {
              state: 'unavailable',
              rowsObserved: 0,
              rowsReturned: 0,
              uniqueIdsReturned: 0,
              missingIdRows: 0,
              truncated: false,
            },
            returned: 0,
            omitted: 0,
            truncated: false,
          },
        },
      },
      source: {
        official: {
          class: 'official-v0',
          operations: ['GET /v0/subjects/{subject_id}'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
        },
        derived: {
          class: 'derived-s7',
          operations: ['subject-comparison'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
        },
      },
      warnings: [
        {
          code: 'SUBJECT_STATE_DEGRADED',
          state: 'partial',
          subjectId: 456,
          message: '条目不可用。',
        },
      ],
      limitations: ['比较仅覆盖当前官方快照。'],
    });

    expect(human).toContain('甲条目');
    expect(human).toContain('官方评分');
    expect(human).toContain('候选 official_v0/bangumi=8.6；derived/fixture-derived=8.7');
    expect(human).toContain('冲突，不计算');
    expect(human).toContain('UPSTREAM_NOT_FOUND');
    expect(human).toContain('official-v0');
    expect(human).toContain('derived-s7');
    expect(human).toContain(
      '统计智能：冲突 · 评分样本 100 · 直方图均值 8.60 · 标准差 0.49 · 完成率 50.0%',
    );
    expect(human).toContain('评分分布：8=60 (60.0%)；9=40 (40.0%)');
    expect(human).toContain('收藏分布：想看=20 (20.0%)；看过=50 (50.0%)');
    expect(human).toContain('统计覆盖：评分桶 10/10 · 收藏桶 5/5 · 公式完整 4/5');
    expect(human).toContain('bangumi.rating.percentages.v1@v1');
    expect(human).toContain('统计冲突：rating · histogramMean,rating.score');
    expect(human).toContain('统计证据：getSubjectById:rating.score');
    expect(human).toContain('共同声优');
    expect(human).toContain('共同关系公式：subject-comparison-overlap-v1');
    expect(human).toContain('不生成推荐或胜负结论');
    expect(human.split('\n').length).toBeLessThanOrEqual(80);
    expect(Buffer.byteLength(human, 'utf8')).toBeLessThanOrEqual(24_000);
  });

  it('keeps Standalone statistics state labels and diagnostics aligned across degraded states', () => {
    const formulas = {
      percentages: { id: 'bangumi.rating.percentages.v1', version: 1 },
      histogramMean: { id: 'bangumi.rating.histogram_mean.v1', version: 1 },
      populationStandardDeviation: { id: 'bangumi.rating.population_sd.v1', version: 1 },
    };
    const collectionFormulas = {
      percentages: { id: 'bangumi.collection.percentages.v1', version: 1 },
      completion: { id: 'bangumi.subject.completion.v1', version: 1 },
    };
    const cases = [
      { state: 'complete', label: '完整', formulasComplete: 5, formulasNotComputable: 0 },
      { state: 'partial', label: '部分', formulasComplete: 3, formulasNotComputable: 0 },
      { state: 'conflict', label: '冲突', formulasComplete: 4, formulasNotComputable: 0 },
      {
        state: 'not_computable',
        label: '不可计算',
        formulasComplete: 0,
        formulasNotComputable: 5,
      },
      { state: 'unavailable', label: '不可用', formulasComplete: 0, formulasNotComputable: 0 },
    ] as const;

    for (const item of cases) {
      const statistics = {
        state: item.state,
        rating: {
          state: item.state,
          population:
            item.state === 'not_computable' || item.state === 'unavailable' ? undefined : 100,
          mean: item.state === 'not_computable' || item.state === 'unavailable' ? undefined : 8.6,
          standardDeviation:
            item.state === 'not_computable' || item.state === 'unavailable' ? undefined : 0.49,
          distribution: [],
          formulas,
          ...(item.state === 'conflict'
            ? {
                conflicts: [
                  {
                    state: 'conflict',
                    scope: 'rating',
                    fieldPaths: ['histogramMean', 'rating.score'],
                    reason: 'derived histogram mean differs materially from upstream score',
                    candidates: [
                      { source: { class: 'derived-s7', provider: 'derived' }, value: 8.6 },
                      { source: { class: 'official-v0', provider: 'bangumi' }, value: 7.4 },
                    ],
                  },
                ],
              }
            : {}),
        },
        collection: {
          state: item.state === 'conflict' ? 'complete' : item.state,
          total: item.state === 'not_computable' || item.state === 'unavailable' ? undefined : 100,
          distribution: [],
          completionRate:
            item.state === 'not_computable' || item.state === 'unavailable' ? undefined : 0.5,
          completionState: item.state === 'conflict' ? 'complete' : item.state,
          formulas: collectionFormulas,
        },
        coverage: {
          ratingBucketsExpected: 10,
          ratingBucketsObserved: item.state === 'unavailable' ? 0 : 10,
          collectionBucketsExpected: 5,
          collectionBucketsObserved: item.state === 'unavailable' ? 0 : 5,
          formulasAttempted: item.state === 'unavailable' ? 0 : 5,
          formulasComplete: item.formulasComplete,
          formulasPartial: item.state === 'partial' ? 2 : 0,
          formulasNotComputable: item.formulasNotComputable,
          formulasConflict: item.state === 'conflict' ? 1 : 0,
        },
        evidence: [],
        warnings: [],
        limitations: [],
      };
      const human = formatHuman({
        state: 'partial',
        subjectIds: [123, 456],
        subjects: [
          {
            subjectId: 123,
            state: 'partial',
            subject: { nameCn: '甲条目' },
            sections: {
              stats: item.state,
              cast: 'complete',
              staff: 'complete',
              relations: 'complete',
            },
            coverage: {
              sourceRequestsAttempted: 1,
              sourceRequestsSucceeded: 1,
              sectionsComplete: 3,
              sectionsPartial: 1,
              sectionsUnavailable: 0,
              sectionsNotComputable: 0,
              truncatedSections: [],
              limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
            },
            warnings: [],
            limitations: [],
            statistics,
          },
          {
            subjectId: 456,
            state: 'unavailable',
            sections: {
              stats: 'unavailable',
              cast: 'unavailable',
              staff: 'unavailable',
              relations: 'unavailable',
            },
            coverage: {
              sourceRequestsAttempted: 1,
              sourceRequestsSucceeded: 0,
              sectionsComplete: 0,
              sectionsPartial: 0,
              sectionsUnavailable: 4,
              sectionsNotComputable: 0,
              truncatedSections: [],
              limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
            },
            warnings: [],
            limitations: [],
          },
        ],
        metrics: [],
        coverage: {
          requestedSubjects: 2,
          returnedSubjects: 1,
          subjectsComplete: 0,
          subjectsPartial: 1,
          subjectsUnavailable: 1,
          subjectsNotFound: 0,
          metricsComplete: 0,
          metricsUnknown: 0,
          metricsConflict: 0,
          limits: {
            maxSubjects: 2,
            maxCast: 4,
            maxStaff: 12,
            maxRelations: 8,
            maxOverlapItems: 24,
          },
        },
      });

      expect(human).toContain(`统计智能：${item.label}`);
      expect(human).toContain('统计覆盖：评分桶');
      expect(human).toContain('bangumi.rating.percentages.v1@v1');
      if (item.state === 'conflict') {
        expect(human).toContain('统计冲突：rating · histogramMean,rating.score');
      }
    }
  });
});
