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
            state: 'complete',
            rating: {
              state: 'complete',
              population: 100,
              mean: 8.6,
              standardDeviation: 0.49,
            },
            collection: {
              state: 'complete',
              completionRate: 0.5,
              completionState: 'complete',
            },
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
      '统计智能：完整 · 评分样本 100 · 直方图均值 8.60 · 标准差 0.49 · 完成率 50.0%',
    );
    expect(human).toContain('共同声优');
    expect(human).toContain('共同关系公式：subject-comparison-overlap-v1');
    expect(human).toContain('不生成推荐或胜负结论');
    expect(human.split('\n').length).toBeLessThanOrEqual(80);
    expect(Buffer.byteLength(human, 'utf8')).toBeLessThanOrEqual(24_000);
  });
});
