import { describe, expect, it } from 'vitest';
import {
  OfficialLegacyCalendarProvider,
  OfficialV0Provider,
  type LegacyCalendarApi,
  type OfficialV0Api,
} from '@bangumi-agent-kit/provider-core';
import type { CalendarItem, Subject } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

function subjectFixture(): Subject {
  return {
    id: 123,
    type: 2,
    name: '少女終末旅行',
    name_cn: '少女终末旅行',
    summary: 'fixture subject',
    series: false,
    nsfw: false,
    locked: false,
    date: '2017-10-06',
    platform: 'TV',
    images: {
      large: 'https://example.test/large.png',
      common: 'https://example.test/common.png',
      medium: 'https://example.test/medium.png',
      small: 'https://example.test/small.png',
      grid: 'https://example.test/grid.png',
    },
    infobox: [],
    volumes: 0,
    eps: 12,
    total_episodes: 12,
    rank: 42,
    rating: {
      rank: 42,
      total: 100,
      count: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
      score: 8.2,
    },
    collection: { wish: 10, collect: 40, doing: 20, on_hold: 5, dropped: 2 },
    meta_tags: [],
    tags: [],
  } as unknown as Subject;
}

function calendarFixture(): CalendarItem[] {
  return [
    {
      weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
      items: [
        {
          id: 123,
          url: 'https://bgm.tv/subject/123',
          type: 2,
          name: '少女終末旅行',
          name_cn: '少女终末旅行',
          summary: 'fixture subject',
          air_date: '2017-10-06',
          air_weekday: 1,
          rating: { total: 100, count: { '8': 50 }, score: 8.2 },
          images: { medium: 'https://example.test/medium.png' },
        },
      ],
    },
  ];
}

describe('PR-7B official provider foundation', () => {
  it('PF16/PF19: v0 Subject is canonical and exposes raw stats with v0 evidence', async () => {
    const api: OfficialV0Api = { getSubjectById: async () => subjectFixture() };
    const result = await new OfficialV0Provider(api).getSubject(123);

    expect(result.state).toBe('ok');
    expect(result.data?.nameCn).toBe('少女终末旅行');
    expect(result.data?.stats.ratingHistogram[10]).toBe(10);
    expect(result.evidence?.['name_cn']?.[0]?.source.class).toBe('official_v0');
    expect(result.evidence?.['rating.score']?.[0]?.source.class).toBe('official_v0');
    expect(result.retrievedAt).toBeTruthy();
    expect(result.evidence?.['name']?.[0]?.freshness?.state).toBe('unknown');
    expect(result.coverage?.state).toBe('complete');
  });

  it('Subject stats capability retains the v0 evidence paths', async () => {
    const result = await new OfficialV0Provider({
      getSubjectById: async () => subjectFixture(),
    }).getSubjectStats(123);

    expect(result.state).toBe('ok');
    expect(result.data?.collection.collect).toBe(40);
    expect(result.evidence?.['collection.collect']?.[0]?.source.class).toBe('official_v0');
    expect(result.evidence?.['name_cn']).toBeUndefined();
  });

  it('records stats retrieval after a delayed source request completes', async () => {
    let dispatchedAt = 0;
    let completedAt = 0;
    const result = await new OfficialV0Provider({
      getSubjectById: async () => {
        dispatchedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 25));
        completedAt = Date.now();
        return subjectFixture();
      },
    }).getSubjectStats(123);

    const retrievedAt = new Date(String(result.retrievedAt)).getTime();
    expect(dispatchedAt).toBeLessThan(completedAt);
    expect(completedAt).toBeLessThanOrEqual(retrievedAt);
    expect(result.evidence?.['rating.score']?.[0]?.retrievedAt).toBe(result.retrievedAt);
  });

  it('PF17: legacy Calendar retains authoritative membership and weekday provenance', async () => {
    const api: LegacyCalendarApi = { getCalendar: async () => calendarFixture() };
    const result = await new OfficialLegacyCalendarProvider(api).getCalendar();

    expect(result.state).toBe('ok');
    expect(result.data?.[0]?.weekday.id).toBe(1);
    expect(result.data?.[0]?.items[0]?.id).toBe(123);
    expect(result.evidence?.membership?.[0]?.source.class).toBe('official_legacy');
    expect(result.evidence?.weekday?.[0]?.source.operation).toBe('getCalendar');
    expect(result.retrievedAt).toBeTruthy();
    expect(result.evidence?.membership?.[0]?.freshness?.state).toBe('unknown');
    expect(result.evidence?.weekday?.[0]?.freshness?.state).toBe('unknown');
  });

  it('PF15/negative: required response fields fail visibly as schema drift', async () => {
    const malformed = subjectFixture() as Record<string, unknown>;
    delete (malformed.rating as Record<string, unknown>).count;
    const result = await new OfficialV0Provider({
      getSubjectById: async () => malformed as Subject,
    }).getSubject(123);

    expect(result.state).toBe('unavailable');
    expect(result.error?.code).toBe('schema_drift');
    expect(result.warnings?.[0]?.code).toBe('SCHEMA_DRIFT');
    expect(result.data).toBeUndefined();
  });

  it('maps upstream auth and not-found errors without exposing upstream bodies', async () => {
    const notFound = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('NOT_FOUND', 'private upstream body', false, 404);
      },
    }).getSubject(404);
    const auth = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('AUTH_REQUIRED', 'credential detail', false, 401);
      },
    }).getSubject(123);

    expect(notFound.state).toBe('not_found');
    expect(notFound.error?.code).toBe('not_found');
    expect(auth.state).toBe('auth_required');
    expect(JSON.stringify(auth)).not.toContain('credential detail');
  });

  it('SC07/SC08: preserves typed rate-limit and generic upstream warnings', async () => {
    const rateLimited = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('RATE_LIMITED', 'rate limit body', true, 429);
      },
    }).getSubject(123);
    const generic = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('UNKNOWN_ERROR', 'generic upstream body', false, 500);
      },
    }).getSubject(123);

    expect(rateLimited.state).toBe('upstream_error');
    expect(rateLimited.error).toEqual({ code: 'rate_limited', retryable: true });
    expect(rateLimited.warnings?.[0]?.code).toBe('UPSTREAM_RATE_LIMITED');
    expect(generic.state).toBe('upstream_error');
    expect(generic.error).toEqual({ code: 'upstream_error', retryable: false });
    expect(generic.warnings?.[0]?.code).toBe('UPSTREAM_ERROR');
    expect(JSON.stringify(rateLimited)).not.toContain('rate limit body');
    expect(JSON.stringify(generic)).not.toContain('generic upstream body');
  });

  it('SC06: maps a transport timeout to unavailable with a timeout warning', async () => {
    const result = await new OfficialV0Provider({
      getSubjectById: async () => {
        throw new BangumiError('NETWORK_ERROR', 'Request timed out', true);
      },
    }).getSubject(123);

    expect(result.state).toBe('unavailable');
    expect(result.error).toEqual({ code: 'timeout', retryable: true });
    expect(result.warnings?.[0]?.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('SC09: rejects missing and non-boolean required subject flags as schema drift', async () => {
    for (const field of ['nsfw', 'locked'] as const) {
      const malformed = subjectFixture() as unknown as Record<string, unknown>;
      delete malformed[field];
      const missing = await new OfficialV0Provider({
        getSubjectById: async () => malformed as Subject,
      }).getSubject(123);

      const wrongType = subjectFixture() as unknown as Record<string, unknown>;
      wrongType[field] = field === 'nsfw' ? 'false' : 0;
      const invalid = await new OfficialV0Provider({
        getSubjectById: async () => wrongType as Subject,
      }).getSubject(123);

      expect(missing.state).toBe('unavailable');
      expect(missing.error?.code).toBe('schema_drift');
      expect(invalid.state).toBe('unavailable');
      expect(invalid.error?.code).toBe('schema_drift');
    }
  });
});
