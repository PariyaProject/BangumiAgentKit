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
      },
      collection: {
        state: 'complete',
        total: 10,
        completionRate: 0.4,
        completionState: 'complete',
        distribution: [{ status: 'collect', count: 4, percentage: 40 }],
      },
      coverage: {
        sourceRequestsSucceeded: 1,
        sourceRequestsAttempted: 1,
        ratingPopulation: 100,
        collectionPopulation: 10,
        formulasComplete: 4,
        formulasAttempted: 4,
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
