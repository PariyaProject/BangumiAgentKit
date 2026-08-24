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

describe('Standalone subject statistics commands', () => {
  it('routes semantic and renderer statistics commands', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'complete',
      subjectId: 123,
      rating: { state: 'complete', distribution: [] },
      collection: { state: 'complete', distribution: [], completionState: 'complete' },
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(['stats', '123'], context(host));
    await registry.execute(['render', 'stats', '123'], context(host));
    await registry.execute(['render', 'subject-stats', '456'], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_stats_intelligence',
      { subjectId: 123 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_stats_intelligence',
      { subjectId: 123 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      3,
      'bangumi.render_subject_stats_intelligence',
      { subjectId: 456 },
      expect.anything(),
    );
  });

  it('routes bounded statistics history commands and presents observations', async () => {
    const history = {
      state: 'partial',
      subjectId: 123,
      collection: {
        observationsObserved: 1,
        observationsReturned: 1,
        completeObservations: 1,
        changePairs: 0,
        retentionDays: 365,
        maxObservations: 24,
        recordCurrent: true,
      },
      observations: [
        {
          observedAt: '2026-08-24T00:00:00.000Z',
          state: 'complete',
          snapshot: {
            raw: { score: 8.6, ratingTotal: 100 },
            collection: { total: 10, completionRate: 0.4 },
          },
        },
      ],
      changes: [],
      source: {
        official: { operations: ['getSubjectStats'], observationCount: 1 },
        derived: { operations: [], observationCount: 1 },
      },
      warnings: [],
      limitations: ['从显式启用后开始；不会回填。'],
    };
    const executeTool = vi.fn().mockResolvedValue(history);
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      [
        'stats-history',
        '123',
        '--record-current',
        '--max-observations',
        '12',
        '--retention-days',
        '30',
      ],
      context(host),
    );
    await registry.execute(['render', 'stats-history', '123', '--record-current'], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_stats_history',
      { subjectId: 123, recordCurrent: true, maxObservations: 12, retentionDays: 30 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_stats_history',
      { subjectId: 123, recordCurrent: true },
      expect.anything(),
    );

    const output = formatHuman(history);
    expect(output).toContain('条目统计观察历史');
    expect(output).toContain('2026-08-24T00:00:00.000Z');
    expect(output).toContain('recordCurrent');
  });

  it('presents complete and unavailable statistics with bounded diagnostics', () => {
    const complete = formatHuman({
      state: 'complete',
      subjectId: 123,
      raw: { score: 8.6, ratingTotal: 100 },
      rating: {
        state: 'complete',
        mean: 8.6,
        standardDeviation: 0.49,
        distribution: [{ score: 8, count: 40, percentage: 40 }],
        formulas: {
          percentages: {
            id: 'bangumi.rating.percentages.v1',
            version: 1,
            inputs: ['rating.count.1', 'rating.count.10'],
            description: 'rating bucket count / population × 100',
          },
          histogramMean: {
            id: 'bangumi.rating.histogram_mean.v1',
            version: 1,
            inputs: ['rating.count.1', 'rating.count.10'],
            description: 'sum(rating score × bucket count) / rating histogram population',
          },
          populationStandardDeviation: {
            id: 'bangumi.rating.population_sd.v1',
            version: 1,
            inputs: ['rating.count.1', 'rating.count.10'],
            description: 'population standard deviation over the rating histogram',
          },
        },
      },
      collection: {
        state: 'complete',
        total: 10,
        completionRate: 0.4,
        completionState: 'complete',
        distribution: [{ status: 'collect', count: 4, percentage: 40 }],
        formulas: {
          percentages: {
            id: 'bangumi.collection.percentages.v1',
            version: 1,
            inputs: ['collection.wish', 'collection.dropped'],
            description: 'collection bucket count / population × 100',
          },
          completion: {
            id: 'bangumi.subject.completion.v1',
            version: 1,
            inputs: ['collection.wish', 'collection.dropped'],
            description: 'collect / collection population',
          },
        },
      },
      coverage: {
        sourceRequestsSucceeded: 1,
        sourceRequestsAttempted: 1,
        ratingBucketsObserved: 10,
        ratingBucketsExpected: 10,
        collectionBucketsObserved: 5,
        collectionBucketsExpected: 5,
        ratingPopulation: 100,
        collectionPopulation: 10,
        formulasComplete: 5,
        formulasPartial: 0,
        formulasAttempted: 5,
        formulasConflict: 0,
        formulasNotComputable: 0,
      },
      source: {
        official: { operations: ['getSubjectStats'] },
        derived: { operations: ['bangumi.rating.percentages.v1'] },
      },
      warnings: [],
      limitations: ['当前快照不是历史趋势。'],
    });
    expect(complete).toContain('条目统计智能');
    expect(complete).toContain('完成率 40.0%');
    expect(complete).toContain('评分分布');
    expect(complete).toContain('覆盖：来源请求 1/1 成功');
    expect(complete).toContain('评分桶 10/10');
    expect(complete).toContain('公式 直方图均值');
    expect(complete).toContain('bangumi.rating.histogram_mean.v1');

    const unavailable = formatHuman({
      state: 'unavailable',
      subjectId: 123,
      rating: { state: 'unavailable', distribution: [] },
      collection: {
        state: 'unavailable',
        completionState: 'unavailable',
        distribution: [],
      },
      warnings: [{ code: 'UPSTREAM_UNAVAILABLE', state: 'unavailable', message: '统计源不可用。' }],
      limitations: ['不可用时不猜测统计值。'],
    });
    expect(unavailable).toContain('状态: 不可用');
    expect(unavailable).toContain('官方评分 未知');
    expect(unavailable).toContain('UPSTREAM_UNAVAILABLE');
    expect(unavailable).not.toContain('NaN');
  });
});
