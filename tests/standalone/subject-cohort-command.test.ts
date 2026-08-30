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

describe('Standalone subject cohort commands', () => {
  it('routes semantic and renderer cohort comparisons with JSON query definitions', async () => {
    const executeTool = vi.fn().mockResolvedValue({ state: 'partial', cohorts: [], metrics: [] });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();
    const aQuery = JSON.stringify({ season: '2026-spring', media: 'anime' });
    const bQuery = JSON.stringify({ season: '2026-summer', media: 'anime' });

    await registry.execute(
      [
        'compare-cohorts',
        '--a-query',
        aQuery,
        '--b-query',
        bQuery,
        '--a-label',
        'Spring',
        '--b-label',
        'Summer',
        '--max-subjects',
        '12',
      ],
      context(host),
    );
    await registry.execute(
      ['render', 'compare-cohorts', '--a-query', aQuery, '--b-query', bQuery],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.compare_subject_cohorts',
      {
        cohorts: [
          { label: 'Spring', query: { season: '2026-spring', media: 'anime' } },
          { label: 'Summer', query: { season: '2026-summer', media: 'anime' } },
        ],
        maxSubjects: 12,
      },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_cohort_comparison',
      {
        cohorts: [
          { query: { season: '2026-spring', media: 'anime' } },
          { query: { season: '2026-summer', media: 'anime' } },
        ],
      },
      expect.anything(),
    );
  });

  it('routes the natural one-cohort aggregate command and renderer', async () => {
    const executeTool = vi.fn().mockResolvedValue({ state: 'complete', cohorts: [], metrics: [] });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();
    const query = JSON.stringify({ season: '2026-spring', media: 'anime', metaTags: ['原创'] });

    await registry.execute(
      ['aggregate-cohort', '--query', query, '--label', 'Spring originals', '--max-subjects', '8'],
      context(host),
    );
    await registry.execute(['render', 'aggregate-cohort', '--query', query], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.aggregate_subject_cohort',
      {
        cohort: {
          label: 'Spring originals',
          query: { season: '2026-spring', media: 'anime', metaTags: ['原创'] },
        },
        maxSubjects: 8,
      },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_cohort_aggregation',
      {
        cohort: { query: { season: '2026-spring', media: 'anime', metaTags: ['原创'] } },
      },
      expect.anything(),
    );
  });

  it('rejects missing, duplicate, malformed, and out-of-range cohort arguments', async () => {
    const executeTool = vi.fn();
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();
    const query = JSON.stringify({ media: 'anime' });

    await expect(registry.execute(['compare-cohorts'], context(host))).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('requires both'),
    });
    await expect(
      registry.execute(['compare-cohorts', '--a-query', '{}', '--b-query', '[]'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2, message: expect.stringContaining('JSON object') });
    await expect(
      registry.execute(
        ['compare-cohorts', '--a-query', query, '--b-query', query, '--max-subjects', '61'],
        context(host),
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(
        ['compare-cohorts', '--a-query', query, '--b-query', query, '--a-query', '{}'],
        context(host),
      ),
    ).rejects.toMatchObject({ exitCode: 2, message: expect.stringContaining('only be specified') });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('formats bounded cohort metrics, missingness, and coverage', () => {
    const human = formatHuman({
      state: 'partial',
      cohorts: [
        {
          label: 'A',
          querySummary: 'A · 媒介=anime',
          coverage: {
            query: {
              state: 'ok',
              coverage: {
                scanned: 2,
                matched: 2,
                returned: 2,
                totalKind: 'estimated',
                budgetExceeded: false,
                state: 'complete',
              },
            },
            detailHydrationsSucceeded: 1,
            detailHydrationsAttempted: 2,
          },
          subjects: [
            {
              id: 1,
              displayName: 'A one',
              score: 8,
              collectionTotal: 10,
              episodesReported: 12,
            },
          ],
        },
        {
          label: 'B',
          querySummary: 'B · 媒介=anime',
          coverage: {
            query: {
              state: 'ok',
              coverage: {
                scanned: 1,
                matched: 1,
                returned: 1,
                totalKind: 'estimated',
                budgetExceeded: true,
                state: 'partial',
              },
            },
            detailHydrationsSucceeded: 0,
            detailHydrationsAttempted: 1,
          },
          subjects: [],
        },
      ],
      metrics: [
        {
          key: 'score',
          label: '平均评分',
          averages: [undefined, undefined],
          partialAverages: [8, undefined],
          validCounts: [1, 0],
          missingCounts: [0, 1],
          conflictCounts: [0, 0],
          state: 'partial',
        },
      ],
      coverage: {
        maxSubjectsPerCohort: 40,
        totalSubjectsReturned: 1,
        detailHydrationsAttempted: 3,
        detailHydrationsSucceeded: 1,
        truncated: true,
      },
      source: { official: { operations: ['searchSubjects'], retrievedAt: '2026-08-30' } },
      formulaVersion: 'subject-cohort-comparison-v1',
      warnings: [{ code: 'COHORT_COVERAGE_DEGRADED', message: 'partial sample' }],
      limitations: ['bounded sample'],
    });

    expect(human).toContain('条目群体比较');
    expect(human).toContain('平均评分');
    expect(human).toContain('有效');
    expect(human).toContain('达到预算');
    expect(human).toContain('partial observation');
  });
});
