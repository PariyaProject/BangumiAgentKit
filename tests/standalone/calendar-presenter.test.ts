import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone calendar presenter', () => {
  it('shows bounded items, coverage, evidence, warnings, and limitations', () => {
    const output = formatHuman({
      state: 'partial',
      days: [
        {
          weekday: { cn: '星期一', en: 'Monday' },
          observed: 9,
          returned: 8,
          overflowCount: 1,
          items: [
            {
              id: 1,
              nameCn: '第一部',
              name: 'First',
              airDate: '2026-08-17',
              typeLabel: 'anime',
              score: 8.2,
              rank: 4,
            },
            { id: 2, nameCn: '第二部', name: 'Second', airDate: '', typeLabel: undefined },
          ],
        },
      ],
      coverage: {
        state: 'partial',
        observed: 9,
        returned: 8,
        selectedDays: 1,
        maxPerDay: 8,
        maxTotal: 8,
        expectedDays: 7,
        sourceDayCount: 6,
        missingWeekdays: [7],
        missingFields: { 'item.air_date': 2 },
      },
      source: {
        class: 'official-legacy',
        operation: 'GET /calendar',
        retrievedAt: '2026-08-16T00:00:00.000Z',
      },
      evidence: [
        { source: 'official-legacy', operation: 'GET /calendar' },
        { source: 'derived-s7', formulaVersion: 'calendar-schedule-v1' },
      ],
      warnings: [{ code: 'OUTPUT_TRUNCATED', message: '日历关系达到显示上限。', state: 'partial' }],
      limitations: ['首播日期不是具体播出时刻。'],
      privateComment: 'must not be rendered',
    });

    expect(output).toContain('每日放送 · 状态: 部分');
    expect(output).toContain('覆盖: 观察 9 · 返回 8');
    expect(output).toContain('第一部 / First');
    expect(output).toContain('缺少星期: 7');
    expect(output).toContain('来源与检索: official-legacy · GET /calendar');
    expect(output).toContain('calendar-schedule-v1');
    expect(output).toContain('OUTPUT_TRUNCATED');
    expect(output).toContain('首播日期不是具体播出时刻。');
    expect(output).not.toContain('must not be rendered');
    expect(output).not.toContain('[object Object]');
  });

  it('names unavailable source state without inventing calendar items', () => {
    const output = formatHuman({
      state: 'unavailable',
      days: [],
      coverage: {
        state: 'unavailable',
        observed: 0,
        returned: 0,
        selectedDays: 0,
        maxPerDay: 3,
        maxTotal: 21,
        expectedDays: 7,
        sourceDayCount: 0,
        missingWeekdays: [1, 2, 3, 4, 5, 6, 7],
        missingFields: {},
      },
      source: { class: 'official-legacy', operation: 'GET /calendar' },
      evidence: [{ source: 'official-legacy', operation: 'GET /calendar' }],
      warnings: [{ code: 'UPSTREAM_UNAVAILABLE', message: '源暂时不可用', state: 'unavailable' }],
      limitations: ['不可用时不返回猜测的播出计划。'],
      error: { code: 'UPSTREAM_UNAVAILABLE', message: '暂时不可用' },
    });

    expect(output).toContain('每日放送 · 状态: 不可用');
    expect(output).toContain('官方日历源暂时不可用，未生成播出样本。');
    expect(output).toContain('UPSTREAM_UNAVAILABLE');
    expect(output).not.toContain('条目 1');
  });
});
