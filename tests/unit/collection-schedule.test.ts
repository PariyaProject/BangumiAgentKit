import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CollectionScheduleService,
  type CollectionScheduleStatus,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

const weekdayNames = [
  ['Mon', '星期一', '月曜日'],
  ['Tue', '星期二', '火曜日'],
  ['Wed', '星期三', '水曜日'],
  ['Thu', '星期四', '木曜日'],
  ['Fri', '星期五', '金曜日'],
  ['Sat', '星期六', '土曜日'],
  ['Sun', '星期日', '日曜日'],
] as const;

function calendarPayload(
  itemsByWeekday: Record<number, Array<Record<string, unknown>>> = {},
): Array<Record<string, unknown>> {
  return weekdayNames.map(([en, cn, ja], index) => ({
    weekday: { en, cn, ja, id: index + 1 },
    items: itemsByWeekday[index + 1] || [],
  }));
}

function calendarItem(subjectId: number, weekday = 1): Record<string, unknown> {
  return {
    id: subjectId,
    type: 2,
    name: `Original ${subjectId}`,
    name_cn: `动画 ${subjectId}`,
    air_date: '2026-08-10',
    air_weekday: weekday,
  };
}

function collectionRow(
  subjectId: number,
  type: number,
  options: { eps?: number | string | null; epStatus?: number; name?: string } = {},
): Record<string, unknown> {
  return {
    subject_id: subjectId,
    subject_type: 2,
    type,
    ep_status: options.epStatus ?? 3,
    comment: 'private comment must not be copied into schedule output',
    subject: {
      id: subjectId,
      type: 2,
      name: options.name || `Original ${subjectId}`,
      name_cn: `动画 ${subjectId}`,
      date: '2026-08-10',
      eps: options.eps ?? 12,
    },
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

function collectionService(fetchFn: typeof fetch): CollectionScheduleService {
  const transport = new HttpClient({ fetchFn });
  return new CollectionScheduleService(buildClient(fetchFn), transport);
}

describe('CollectionScheduleService', () => {
  it('joins the official seven-day calendar to the selected current-account collection', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') {
        return response(
          calendarPayload({
            1: [calendarItem(1), calendarItem(99)],
          }),
        );
      }
      return response({
        total: 3,
        limit: 50,
        offset: 0,
        data: [collectionRow(1, 3), collectionRow(2, 1), collectionRow(3, 2)],
      });
    };

    const result = await collectionService(fetchFn).getCollectionSchedule('bound-user');

    expect(result.state).toBe('complete');
    expect(result.filters.statuses).toEqual(['wish', 'doing', 'on_hold']);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({
      subjectId: 1,
      status: 'doing',
      schedule: { weekday: { id: 1, cn: '星期一' }, sourceIndex: 0 },
      progress: {
        state: 'reported',
        watchedEpisodes: 3,
        reportedTotalEpisodes: 12,
        reportedRemainingEpisodes: 9,
      },
    });
    expect(result.data.unmatchedCalendar).toMatchObject([
      { subjectId: 99, reason: 'not_collected', weekday: { id: 1 } },
    ]);
    expect(result.data.unmatchedCollection).toMatchObject([
      { subjectId: 2, status: 'wish', reason: 'not_on_calendar' },
    ]);
    expect(result.data.summary).toMatchObject({
      calendarRowsObserved: 2,
      eligibleCollectionRows: 2,
      matchedRows: 1,
      unmatchedCalendarRows: 1,
      unmatchedCollectionRows: 1,
      progressReportedRows: 2,
      progressUnknownRows: 0,
    });
    expect(result.source.collection.authScope).toBe('account');
    expect(JSON.stringify(result)).not.toContain('private comment');
  });

  it('retains successful collection pages and marks a later upstream failure partial', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') {
        return response(calendarPayload({ 1: [calendarItem(1)] }));
      }
      if (url.searchParams.get('offset') === '0') {
        return response({
          total: 2,
          limit: 1,
          offset: 0,
          data: [collectionRow(1, 3)],
        });
      }
      return response({ message: 'temporary failure' }, 503);
    };

    const result = await collectionService(fetchFn).getCollectionSchedule('bound-user', {
      maxCollectionItems: 2,
    });

    expect(result.state).toBe('partial');
    expect(result.data.items).toHaveLength(1);
    expect(result.coverage.collection).toMatchObject({
      observedRows: 1,
      pagesSucceeded: 1,
      pageFailureOffset: 1,
      pageFailureCode: 'UPSTREAM_UNAVAILABLE',
    });
    expect(result.warnings.some((warning) => warning.code === 'COLLECTION_PAGE_FAILURE')).toBe(
      true,
    );
    expect(result.data.unmatchedCollection).toEqual([]);
  });

  it('returns unavailable without fabricated personal schedule when collection auth fails initially', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') {
        return response(calendarPayload({ 1: [calendarItem(1)] }));
      }
      return response({ message: 'unauthorized' }, 401);
    };

    const result = await collectionService(fetchFn).getCollectionSchedule('bound-user');

    expect(result.state).toBe('auth_required');
    expect(result.data.items).toEqual([]);
    expect(result.coverage.collection.pagesSucceeded).toBe(0);
    expect(result.error?.code).toBe('AUTH_REQUIRED');
    expect(result.source.collection.retrievedAt).toBeUndefined();
    expect(result.data.summary.noMatch).toBe(true);
  });

  it('keeps invalid, unknown, and conflicting progress explicit', async () => {
    const statuses: CollectionScheduleStatus[] = ['doing'];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') {
        return response(
          calendarPayload({
            1: [calendarItem(1), calendarItem(2), calendarItem(3)],
          }),
        );
      }
      return response({
        total: 3,
        limit: 50,
        offset: 0,
        data: [
          collectionRow(1, 3, { eps: 0, epStatus: 3 }),
          collectionRow(2, 3, { eps: 12, epStatus: 20 }),
          collectionRow(3, 3, { eps: 'TBD', epStatus: 3 }),
        ],
      });
    };

    const result = await collectionService(fetchFn).getCollectionSchedule('bound-user', {
      statuses,
    });

    expect(result.state).toBe('partial');
    expect(result.data.items.map((item) => item.progress.state)).toEqual([
      'unknown',
      'conflict',
      'invalid',
    ]);
    expect(
      result.data.items.every((item) => item.progress.reportedRemainingEpisodes === undefined),
    ).toBe(true);
    expect(result.data.summary).toMatchObject({
      progressUnknownRows: 1,
      progressConflictRows: 1,
      progressInvalidRows: 1,
    });
    expect(result.warnings.some((warning) => warning.code === 'COLLECTION_PROGRESS_CONFLICT')).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.code === 'COLLECTION_PROGRESS_UNKNOWN')).toBe(
      true,
    );
  });
});
