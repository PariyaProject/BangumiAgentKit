import { describe, expect, it } from 'vitest';
import {
  calendarFieldPolicy,
  mergeCalendarWithSubjects,
  selectFallbackSources,
  sourceAvailability,
  sourceUnavailableResult,
  type CalendarDayData,
  type CalendarSubjectData,
  type CapabilityResult,
  type ProviderSubjectData,
} from '@bangumi-agent-kit/provider-core';

const legacyMembership: CalendarSubjectData = {
  id: 123,
  name: 'Legacy title',
  nameCn: 'Legacy CN',
  airDate: '2026-08-09',
  score: 7.1,
};

const calendarData: CalendarDayData[] = [
  {
    weekday: { en: 'Sun', cn: '星期日', ja: '日曜日', id: 7 },
    items: [legacyMembership],
  },
];

const subjectData: ProviderSubjectData = {
  id: 123,
  type: 2,
  name: 'Canonical title',
  nameCn: 'Canonical CN',
  summary: 'canonical',
  nsfw: false,
  locked: false,
  platform: 'TV',
  images: {},
  eps: 1,
  totalEpisodes: 1,
  stats: {
    score: 8.2,
    rank: 10,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    collection: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 },
  },
};

describe('PR-7B source policy and merge', () => {
  it('PF19/PF20: field policy keeps S2 membership and S1 canonical subject separate', () => {
    const calendar: CapabilityResult<CalendarDayData[]> = {
      state: 'ok',
      data: calendarData,
      evidence: {
        membership: [{ source: { class: 'official_legacy', provider: 'bangumi' }, retrievedAt: '2026-08-09T00:00:00Z' }],
        weekday: [{ source: { class: 'official_legacy', provider: 'bangumi' }, retrievedAt: '2026-08-09T00:00:00Z' }],
      },
      coverage: { state: 'complete', returned: 1 },
      retrievedAt: '2026-08-09T00:00:00Z',
    };
    const subject: CapabilityResult<ProviderSubjectData> = {
      state: 'ok',
      data: subjectData,
      evidence: {
        name: [{ source: { class: 'official_v0', provider: 'bangumi' }, retrievedAt: '2026-08-09T00:00:00Z', fieldPath: 'name' }],
      },
      retrievedAt: '2026-08-09T00:00:00Z',
    };

    const result = mergeCalendarWithSubjects(calendar, new Map([[123, subject]]));
    expect(result.state).toBe('ok');
    expect(result.data?.[0]?.items[0]?.membership.name).toBe('Legacy title');
    expect(result.data?.[0]?.items[0]?.subject?.name).toBe('Canonical title');
    expect(result.evidence?.membership?.[0]?.source.class).toBe('official_legacy');
    expect(result.evidence?.['subject.name']?.[0]?.source.class).toBe('official_v0');

    expect(calendarFieldPolicy()).toEqual(
      expect.arrayContaining([
        { field: 'membership', sourceClass: 'official_legacy' },
        { field: 'weekday', sourceClass: 'official_legacy' },
        { field: 'subject', sourceClass: 'official_v0' },
      ]),
    );
  });

  it('PF21/PF22: S3 and S5 are disabled and never selected as implicit fallbacks', () => {
    expect(sourceAvailability('structured_web')).toBe('disabled');
    expect(sourceAvailability('website_html')).toBe('disabled');
    expect(selectFallbackSources('subject', 'official_v0')).toEqual([]);
    expect(selectFallbackSources('calendar', 'official_legacy')).toEqual([]);
  });

  it('negative: v0 failure leaves calendar membership and does not call HTML', () => {
    const calendar: CapabilityResult<CalendarDayData[]> = {
      state: 'ok',
      data: calendarData,
      evidence: {
        membership: [{ source: { class: 'official_legacy', provider: 'bangumi' }, retrievedAt: '2026-08-09T00:00:00Z' }],
        weekday: [{ source: { class: 'official_legacy', provider: 'bangumi' }, retrievedAt: '2026-08-09T00:00:00Z' }],
      },
      retrievedAt: '2026-08-09T00:00:00Z',
    };
    let htmlCalled = false;
    const subjectFailure: CapabilityResult<ProviderSubjectData> = {
      state: 'unavailable',
      error: { code: 'timeout', retryable: true },
      warnings: [{ code: 'UPSTREAM_TIMEOUT', message: 'subject unavailable' }],
    };
    if (selectFallbackSources('subject', 'official_v0').includes('website_html')) htmlCalled = true;

    const result = mergeCalendarWithSubjects(calendar, new Map([[123, subjectFailure]]));
    expect(htmlCalled).toBe(false);
    expect(result.data?.[0]?.items[0]?.membership.id).toBe(123);
    expect(result.data?.[0]?.items[0]?.subject).toBeUndefined();
    expect(result.state).toBe('partial');
  });

  it('negative: snapshot absence is not an empty successful result', () => {
    const result = sourceUnavailableResult<unknown>({ class: 'snapshot', provider: 'local' });
    expect(result.state).toBe('not_computable');
    expect(result.warnings?.[0]?.code).toBe('SOURCE_NOT_CONFIGURED');
    expect(result.data).toBeUndefined();
  });
});
