import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CollectionDashboardService,
  type CollectionDashboardResult,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function calendarPayload(): Array<Record<string, unknown>> {
  return [
    ['Mon', '星期一', '月曜日'],
    ['Tue', '星期二', '火曜日'],
    ['Wed', '星期三', '水曜日'],
    ['Thu', '星期四', '木曜日'],
    ['Fri', '星期五', '金曜日'],
    ['Sat', '星期六', '土曜日'],
    ['Sun', '星期日', '日曜日'],
  ].map(([en, cn, ja], index) => ({
    weekday: { en, cn, ja, id: index + 1 },
    items:
      index === 0
        ? [
            {
              id: 1,
              type: 2,
              name: 'Original',
              name_cn: '中文条目',
              air_date: '2026-08-10',
              air_weekday: 1,
            },
          ]
        : [],
  }));
}

function collectionRow(): Record<string, unknown> {
  return {
    subject_id: 1,
    subject_type: 2,
    type: 3,
    rate: 9,
    tags: ['favorite'],
    ep_status: 1,
    updated_at: '2026-08-14T00:00:00.000Z',
    comment: 'private comment must not be returned',
    subject: {
      id: 1,
      type: 2,
      name: 'Original',
      name_cn: '中文条目',
      date: '2026-08-10',
      eps: 2,
      images: {},
    },
  };
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

function episodePayload(): Record<string, unknown> {
  return {
    total: 2,
    limit: 100,
    offset: 0,
    data: [
      {
        type: 2,
        updated_at: 1_723_600_000,
        episode: {
          id: 1,
          subject_id: 1,
          type: 0,
          name: 'Episode 1',
          name_cn: '第一集',
          sort: 1,
          ep: 1,
          airdate: '2026-01-01',
        },
      },
      {
        type: 1,
        updated_at: 1_723_600_000,
        episode: {
          id: 2,
          subject_id: 1,
          type: 0,
          name: 'Episode 2',
          name_cn: '第二集',
          sort: 2,
          ep: 2,
          airdate: '2026-01-02',
        },
      },
    ],
  };
}

describe('CollectionDashboardService', () => {
  it('composes three bounded account sections without copying private collection fields', async () => {
    const requests: URL[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname === '/calendar') return response(calendarPayload());
      if (url.pathname.endsWith('/episodes')) return response(episodePayload());
      return response({ total: 1, limit: 50, offset: 0, data: [collectionRow()] });
    };
    const result = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', {
      maxCollectionItems: 1,
      maxSubjects: 1,
      maxEpisodesPerSubject: 2,
      maxRows: 1,
      statuses: ['doing'],
    });

    expect(result.state).toBe('complete');
    expect(result.coverage).toMatchObject({
      sectionsAttempted: 3,
      sectionsRequested: 3,
      sectionsInvoked: 3,
      sectionsSucceeded: 3,
      maxConcurrentSections: 1,
      maxConcurrentRequests: 3,
      upstreamRequestsBound: 35,
      upstreamAttemptsBound: 105,
      collectionRowsRequested: 3,
      collectionRowsBound: 3,
      backlogSubjectsSucceeded: 1,
      episodeRowsRequested: 2,
      episodeRowsObserved: 2,
      calendarRowsObserved: 1,
    });
    expect(result.data.sections.intelligence.result?.data.backlog.doing).toBe(1);
    expect(result.data.sections.backlog.result?.data.summary.knownRemainingEpisodes).toBe(1);
    expect(result.data.sections.schedule.result?.data.summary.matchedRows).toBe(1);
    expect(result.evidence[0]).toMatchObject({
      section: 'dashboard',
      formulaVersion: 'collection-dashboard-v1',
      authScope: 'account',
    });
    expect(
      result.evidence.find(
        (item) => item.section === 'schedule' && item.source === 'official-legacy',
      )?.authScope,
    ).toBeUndefined();
    expect(result.coverage.retrievedAt).toBe(result.source.retrievedAt);
    expect(result.source.retrievedAt).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(requests.filter((url) => url.pathname.endsWith('/collections')).length).toBe(3);
  });

  it('keeps the hard paginator bound under short non-empty pages and maximum fan-out', async () => {
    const requests: URL[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname === '/calendar') return response(calendarPayload());
      if (url.pathname.endsWith('/episodes')) {
        return response({
          total: 1000,
          limit: 100,
          offset: Number(url.searchParams.get('offset') || 0),
          data: [episodePayload().data[0]],
        });
      }
      return response({
        total: 1000,
        limit: 50,
        offset: Number(url.searchParams.get('offset') || 0),
        data: [collectionRow()],
      });
    };

    const result = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', {
      maxCollectionItems: 100,
      maxSubjects: 1,
      maxEpisodesPerSubject: 1000,
      maxRows: 100,
    });

    expect(result.coverage.upstreamRequestsBound).toBe(35);
    expect(result.coverage.upstreamAttemptsBound).toBe(105);
    expect(requests.filter((url) => url.pathname.endsWith('/collections'))).toHaveLength(24);
    expect(requests.filter((url) => url.pathname.endsWith('/episodes'))).toHaveLength(10);
    expect(requests.filter((url) => url.pathname === '/calendar')).toHaveLength(1);
  });

  it('keeps a failed section explicit while retaining successful sibling sections', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') return response({ message: 'calendar down' }, 503);
      if (url.pathname.endsWith('/episodes')) return response(episodePayload());
      return response({ total: 1, limit: 50, offset: 0, data: [collectionRow()] });
    };

    const result: CollectionDashboardResult = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', { maxCollectionItems: 1, maxSubjects: 1 });

    expect(result.state).toBe('partial');
    expect(result.data.sections.intelligence.result).toBeDefined();
    expect(result.data.sections.backlog.result).toBeDefined();
    expect(result.data.sections.schedule.result?.state).toBe('upstream_error');
    expect(result.warnings.some((warning) => warning.section === 'schedule')).toBe(true);
    expect(result.data.sections.schedule.result?.data.items).toEqual([]);
    expect(result.coverage.sectionsSucceeded).toBe(2);
  });

  it('preserves auth failure states and never counts unavailable results as success', async () => {
    const fetchFn: typeof fetch = async () => response({ message: 'login required' }, 401);
    const result = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', { maxCollectionItems: 1, maxSubjects: 1 });

    expect(result.state).toBe('auth_required');
    expect(result.coverage.sectionsSucceeded).toBe(0);
    expect(result.coverage.retrievedAt).toBeUndefined();
    expect(result.data.sections.intelligence.state).toBe('auth_required');
    expect(result.data.sections.backlog.state).toBe('auth_required');
    expect(result.data.sections.schedule.state).toBe('auth_required');
  });

  it('stops scheduling after the bounded deadline and records every unobserved section', async () => {
    const requests: URL[] = [];
    let abortObserved = false;
    const fetchFn: typeof fetch = async (input, init) => {
      requests.push(new URL(String(input)));
      init?.signal?.addEventListener('abort', () => {
        abortObserved = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      return response({ total: 0, limit: 50, offset: 0, data: [] });
    };
    const result = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', {
      maxCollectionItems: 1,
      maxSubjects: 1,
      maxEpisodesPerSubject: 1,
      maxDurationMs: 20,
    });

    expect(result.state).toBe('unavailable');
    expect(result.coverage).toMatchObject({
      sectionsSucceeded: 0,
      sectionsRequested: 3,
      sectionsAttempted: 1,
      sectionsInvoked: 1,
      deadlineSkippedSections: 2,
      timedOutSections: 1,
      deadlineMs: 20,
    });
    expect(result.warnings.filter((warning) => warning.code === 'UPSTREAM_TIMEOUT')).toHaveLength(
      3,
    );
    expect(requests).toHaveLength(1);
    expect(abortObserved).toBe(true);
  });
});
