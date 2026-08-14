import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

function backlogResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'partial',
    data: {
      items: Array.from({ length: 30 }, (_, index) => ({
        subjectId: index + 1,
        nameCn: `一个很长的中文收藏标题 ${index + 1}`,
        name: `Original ${index + 1}`,
        status: 'doing',
        statusLabel: '在看',
        airingState: 'finished',
        state: 'complete',
        watchedEpisodes: 1,
        episodeReportedEpisodes: 3,
        remainingEpisodes: 2,
        comment: 'private comment must not be shown',
        reasons: [],
      })),
      summary: {
        eligibleItems: 30,
        returnedItems: 30,
        completeItems: 30,
        incompleteItems: 30,
        notComputableItems: 0,
        unavailableItems: 0,
        conflictItems: 0,
        knownRemainingEpisodes: 60,
        finishedItems: 30,
        finishedIncompleteItems: 30,
        ongoingItems: 0,
        airingUnknownItems: 0,
      },
    },
    coverage: {
      collection: {
        observedRows: 30,
        uniqueRows: 30,
        sourceTotal: 30,
        truncated: false,
        duplicateRows: 0,
      },
      hydration: { succeededSubjects: 30, attemptedSubjects: 30, budgetExceeded: false },
      episodeProgress: { observedRows: 90 },
    },
    warnings: [],
    ...overrides,
  };
}

describe('Standalone collection backlog presenter', () => {
  it('renders a bounded human summary without private comments or object-dump noise', () => {
    const output = formatHuman(backlogResult());

    expect(output).toContain('收藏 backlog · 状态: partial');
    expect(output).toContain('已完结未看完 30');
    expect(output).toContain('一个很长的中文收藏标题 1');
    expect(output).toContain('一个很长的中文收藏标题 12');
    expect(output).not.toContain('一个很长的中文收藏标题 13');
    expect(output).not.toContain('private comment');
    expect(output).toContain('另有 18 条已返回条目未展开。');
  });

  it('keeps permission-denied output actionable and concise', () => {
    const output = formatHuman(
      backlogResult({
        state: 'permission_denied',
        data: {
          items: [],
          summary: {
            eligibleItems: 0,
            returnedItems: 0,
            completeItems: 0,
            incompleteItems: 0,
            notComputableItems: 0,
            unavailableItems: 0,
            conflictItems: 0,
            knownRemainingEpisodes: 0,
            finishedItems: 0,
            finishedIncompleteItems: 0,
            ongoingItems: 0,
            airingUnknownItems: 0,
          },
        },
        error: {
          code: 'PERMISSION_DENIED',
          message: '当前账号没有执行此操作所需的权限。',
          nextAction: '请重新授权',
        },
      }),
    );

    expect(output).toContain('permission_denied');
    expect(output).toContain('PERMISSION_DENIED');
    expect(output).toContain('请重新授权');
    expect(output).not.toContain('private comment');
  });
});
