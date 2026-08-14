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
      episodeProgress: { observedRows: 90, uniqueRows: 90 },
    },
    warnings: [],
    ...overrides,
  };
}

describe('Standalone collection backlog presenter', () => {
  it('renders a bounded human summary without private comments or object-dump noise', () => {
    const output = formatHuman(backlogResult());

    expect(output).toContain('收藏 backlog · 状态: partial');
    expect(output).toContain('已播完未看完 30');
    expect(output).toContain('不证明未发布后续或排除 hiatus');
    expect(output).toContain('正篇行 raw=90/unique=90');
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

  it.each([
    ['AUTH_REQUIRED', '需要绑定账号'],
    ['AUTH_EXPIRED', '请重新授权'],
    ['PERMISSION_DENIED', '请确认账号权限'],
    ['RATE_LIMITED', '请稍后重试'],
    ['UPSTREAM_UNAVAILABLE', '稍后重试或查看服务状态'],
    ['NETWORK_ERROR', '检查网络后重试'],
  ])('keeps row-level %s recovery metadata visible', (code, nextAction) => {
    const output = formatHuman(
      backlogResult({
        data: {
          items: [
            {
              subjectId: 99,
              nameCn: '行级错误条目',
              name: 'row error item',
              status: 'doing',
              statusLabel: '在看',
              airingState: 'unknown',
              airingReason: 'episode evidence unavailable',
              state: 'unavailable',
              reasons: [code],
              error: {
                code,
                message: `${code} message`,
                nextAction,
              },
            },
          ],
          summary: {
            eligibleItems: 1,
            returnedItems: 1,
            completeItems: 0,
            incompleteItems: 0,
            notComputableItems: 0,
            unavailableItems: 1,
            conflictItems: 0,
            knownRemainingEpisodes: 0,
            finishedItems: 0,
            finishedIncompleteItems: 0,
            ongoingItems: 0,
            airingUnknownItems: 1,
          },
        },
      }),
    );

    expect(output).toContain(code);
    expect(output).toContain(`${code} message`);
    expect(output).toContain(nextAction);
  });

  it('bounds long CJK, emoji, combining, control, error, and warning fields', () => {
    const longMixed = `${'界'.repeat(100_000)}\n\u0000\u0007${'👩🏽‍💻'.repeat(10_000)}e\u0301`;
    const output = formatHuman(
      backlogResult({
        data: {
          items: Array.from({ length: 12 }, (_, index) => ({
            subjectId: index + 1,
            nameCn: longMixed,
            name: longMixed,
            status: 'doing',
            statusLabel: longMixed,
            airingState: 'unknown',
            airingReason: longMixed,
            state: 'unavailable',
            reasons: [longMixed],
            error: {
              code: `ERR-${longMixed}`,
              message: longMixed,
              nextAction: longMixed,
            },
          })),
          summary: {
            eligibleItems: 12,
            returnedItems: 12,
            completeItems: 0,
            incompleteItems: 0,
            notComputableItems: 0,
            unavailableItems: 12,
            conflictItems: 0,
            knownRemainingEpisodes: 0,
            finishedItems: 0,
            finishedIncompleteItems: 0,
            ongoingItems: 0,
            airingUnknownItems: 12,
          },
        },
        error: {
          code: longMixed,
          message: longMixed,
          nextAction: longMixed,
        },
        warnings: Array.from({ length: 12 }, (_, index) => ({
          code: `WARNING-${index}-${longMixed}`,
          state: 'partial',
          message: longMixed,
        })),
      }),
    );

    expect(output.split('\n').length).toBeLessThanOrEqual(80);
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(24_000);
    const segmenterConstructor = (
      Intl as unknown as {
        Segmenter?: new (
          locales?: string | string[],
          options?: { granularity: 'grapheme' },
        ) => { segment(value: string): Iterable<{ segment: string }> };
      }
    ).Segmenter;
    if (segmenterConstructor) {
      const segmenter = new segmenterConstructor('zh-CN', { granularity: 'grapheme' });
      expect(Array.from(segmenter.segment(output)).length).toBeLessThanOrEqual(12_000);
    }
    expect(output).toContain('输出已截断');
    expect(
      Array.from(output).some((character) => {
        const codePoint = character.codePointAt(0) || 0;
        return (
          (codePoint <= 0x1f && codePoint !== 0x0a) || (codePoint >= 0x7f && codePoint <= 0x9f)
        );
      }),
    ).toBe(false);
    expect(output).not.toContain('\uFFFD');
  });
});
