import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone collection dashboard presenter', () => {
  it('shows section states and bounded aggregate coverage without private comments', () => {
    const output = formatHuman({
      state: 'partial',
      data: {
        sections: {
          intelligence: {
            state: 'complete',
            result: {
              state: 'complete',
              data: {
                backlog: { total: 3 },
                ratings: { rated: 4, average: 8.5 },
                tags: { distinct: 12 },
              },
              coverage: { state: 'complete' },
            },
          },
          backlog: {
            state: 'not_computable',
            result: {
              state: 'not_computable',
              data: {
                summary: {
                  returnedItems: 2,
                  knownRemainingEpisodes: 5,
                  completeItems: 1,
                  notComputableItems: 1,
                },
              },
              coverage: { state: 'not_computable' },
            },
          },
          schedule: {
            state: 'upstream_error',
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'calendar unavailable',
              nextAction: '稍后重试',
            },
          },
        },
      },
      coverage: {
        sectionsSucceeded: 2,
        sectionsAttempted: 3,
        collectionRowsObserved: 6,
        collectionRowsBound: 9,
        episodeRowsObserved: 5,
        episodeRowsRequested: 4000,
      },
      warnings: [
        {
          section: 'schedule',
          code: 'UPSTREAM_UNAVAILABLE',
          state: 'upstream_error',
          message: 'calendar unavailable',
        },
      ],
      comment: 'private comment must not be shown',
    });

    expect(output).toContain('收藏 Dashboard · 状态: partial');
    expect(output).toContain('收藏概览 · 状态: complete');
    expect(output).toContain('backlog · 状态: not_computable');
    expect(output).toContain('七日播出计划 · 状态: upstream_error');
    expect(output).toContain('组合覆盖: 区段 2/3 · 收藏行 6/9 · episode 行 5/4000');
    expect(output).toContain('UPSTREAM_UNAVAILABLE');
    expect(output).not.toContain('private comment');
  });
});
