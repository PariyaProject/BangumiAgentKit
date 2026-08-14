import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

function scheduleResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'partial',
    filters: { statuses: ['wish', 'doing', 'on_hold'] },
    data: {
      items: Array.from({ length: 14 }, (_, index) => ({
        subjectId: index + 1,
        nameCn: `一个很长的中文播出计划标题 ${index + 1}`,
        name: `Original ${index + 1}`,
        status: 'doing',
        statusLabel: '在看',
        schedule: {
          weekday: { id: 1, cn: '星期一', en: 'Mon', ja: '月曜日' },
          airDate: '2026-08-10',
          sourceIndex: index,
        },
        progress: {
          state: 'reported',
          watchedEpisodes: 3,
          reportedTotalEpisodes: 12,
          reportedRemainingEpisodes: 9,
          reasons: [],
        },
        comment: 'private comment must not be shown',
        reasons: [],
      })),
      unmatchedCalendar: [],
      unmatchedCollection: [
        {
          subjectId: 99,
          nameCn: '未匹配收藏条目',
          name: 'Unmatched collection',
          status: 'wish',
          statusLabel: '想看',
          progress: { state: 'unknown', reasons: ['本周日历未返回匹配'] },
          reason: 'not_on_calendar',
        },
      ],
      summary: {
        calendarRowsObserved: 15,
        eligibleCollectionRows: 15,
        matchedRows: 14,
        unmatchedCalendarRows: 0,
        unmatchedCollectionRows: 1,
        progressReportedRows: 14,
        progressUnknownRows: 1,
        progressInvalidRows: 0,
        progressConflictRows: 0,
        noMatch: false,
      },
    },
    coverage: {
      calendar: { observedRows: 15 },
      collection: { observedRows: 15, sourceTotal: 15 },
      join: { returnedRows: 15, maxRows: 56 },
    },
    warnings: [{ code: 'COLLECTION_PROGRESS_UNKNOWN', message: '进度保持 unknown' }],
    ...overrides,
  };
}

describe('Standalone collection schedule presenter', () => {
  it('renders a bounded schedule summary without private comments or object dumps', () => {
    const output = formatHuman(scheduleResult());

    expect(output).toContain('收藏本周播出计划 · 状态: partial');
    expect(output).toContain('匹配播出 14');
    expect(output).toContain('一个很长的中文播出计划标题 1');
    expect(output).toContain('一个很长的中文播出计划标题 12');
    expect(output).not.toContain('一个很长的中文播出计划标题 13');
    expect(output).toContain('收藏中未匹配日历: 1 条');
    expect(output).toContain('COLLECTION_PROGRESS_UNKNOWN');
    expect(output).not.toContain('private comment');
    expect(output).not.toContain('[object Object]');
  });

  it('keeps auth errors actionable when no personal rows are available', () => {
    const output = formatHuman(
      scheduleResult({
        state: 'auth_required',
        data: {
          items: [],
          unmatchedCalendar: [],
          unmatchedCollection: [],
          summary: {
            calendarRowsObserved: 0,
            eligibleCollectionRows: 0,
            matchedRows: 0,
            unmatchedCalendarRows: 0,
            unmatchedCollectionRows: 0,
            progressReportedRows: 0,
            progressUnknownRows: 0,
            progressInvalidRows: 0,
            progressConflictRows: 0,
            noMatch: true,
          },
        },
        error: {
          code: 'AUTH_REQUIRED',
          message: '必须先绑定 Bangumi 账号',
          nextAction: '调用 bangumi.auth_start',
        },
      }),
    );

    expect(output).toContain('auth_required');
    expect(output).toContain('AUTH_REQUIRED');
    expect(output).toContain('调用 bangumi.auth_start');
  });
});
