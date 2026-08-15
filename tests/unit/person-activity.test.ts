import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  PersonActivityService,
  PERSON_ACTIVITY_DETAIL_CONCURRENCY,
} from '@bangumi-agent-kit/bangumi-core';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function personPayload() {
  return {
    id: 20,
    name: 'Person',
    career: ['seiyu'],
    infobox: [{ key: '简体中文名', value: '人物' }],
  };
}

function subjectPayload(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 2,
    name: `Subject ${id}`,
    name_cn: `条目 ${id}`,
    date: '2026-05-10',
    platform: 'TV',
    rating: { score: 8, rank: id, total: 10, count: {} },
    ...overrides,
  };
}

function activityFetch(options: { failSubjectIds?: number[] } = {}) {
  let activeDetails = 0;
  let peakDetails = 0;
  const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/v0/persons/20')) return json(personPayload());
    if (url.endsWith('/v0/persons/20/characters')) {
      return json([
        {
          id: 101,
          name: '主角',
          subject_id: 1,
          subject_type: 2,
          subject_name: 'Subject 1',
          staff: '主角',
        },
        {
          id: 102,
          name: '配角',
          subject_id: 2,
          subject_type: 2,
          subject_name: 'Subject 2',
          staff: '配角',
        },
        {
          id: 103,
          name: '音乐角色',
          subject_id: 3,
          subject_type: 3,
          subject_name: 'Subject 3',
          staff: '演唱',
        },
        { id: 104, name: '未知平台', subject_id: 4, subject_type: 2, subject_name: 'Subject 4' },
      ]);
    }
    if (url.includes('/v0/subjects/')) {
      const id = Number(url.split('/').pop());
      activeDetails += 1;
      peakDetails = Math.max(peakDetails, activeDetails);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeDetails -= 1;
      if (options.failSubjectIds?.includes(id)) return json({ error: 'fixture failure' }, 503);
      if (id === 2) return json(subjectPayload(id, { date: '2026-02-12' }));
      if (id === 3)
        return json(subjectPayload(id, { type: 3, platform: 'CD', date: '2026-06-02' }));
      if (id === 4) return json(subjectPayload(id, { platform: undefined, date: '2026-06-02' }));
      return json(subjectPayload(id));
    }
    return json({ error: 'not found' }, 404);
  });
  return { fetchFn, getPeakDetails: () => peakDetails };
}

describe('PersonActivityService', () => {
  it('hydrates bounded subject details and preserves window/media/role evidence', async () => {
    const fixture = activityFetch();
    const service = new PersonActivityService(new HttpClient({ fetchFn: fixture.fetchFn }));

    const result = await service.getPersonActivity(20, {
      asOf: '2026-08-15',
      windowMonths: 6,
      kind: 'voice',
      media: 'tv',
    });

    expect(result.state).toBe('partial');
    expect(result.person?.nameCn).toBe('人物');
    expect(result.window).toMatchObject({
      start: '2026-03-01',
      end: '2026-08-15',
      monthKeys: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
    });
    expect(result.summary).toMatchObject({
      creditRows: 1,
      uniqueSubjects: 1,
      uniqueCharacters: 1,
    });
    expect(result.summary.byRole).toEqual([
      expect.objectContaining({ key: 'main', creditRows: 1 }),
    ]);
    expect(result.rows[0]).toMatchObject({
      subjectId: 1,
      firstAirDate: '2026-05-10',
      roleFamily: 'main',
      rawRole: '主角',
    });
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 4,
      relationRowsSelected: 4,
      subjectIdsObserved: 4,
      subjectDetailRequests: 4,
      subjectDetailsSucceeded: 4,
      rowsEligible: 1,
      rowsReturned: 1,
      outsideWindowRows: 1,
      mediaExcludedRows: 1,
      mediaUnknownRows: 1,
      detailConcurrency: PERSON_ACTIVITY_DETAIL_CONCURRENCY,
    });
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'outside_window', count: 1 }),
        expect.objectContaining({ reason: 'media_excluded', count: 1 }),
        expect.objectContaining({ reason: 'media_unknown', count: 1 }),
      ]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          formulaVersion: 'person-activity-window-v1',
        }),
      ]),
    );
    expect(fixture.getPeakDetails()).toBeLessThanOrEqual(PERSON_ACTIVITY_DETAIL_CONCURRENCY);
  });

  it('distinguishes detail caps and detail failures from empty success', async () => {
    const fixture = activityFetch({ failSubjectIds: [2] });
    const service = new PersonActivityService(new HttpClient({ fetchFn: fixture.fetchFn }));

    const result = await service.getPersonActivity(20, {
      asOf: '2026-08-15',
      kind: 'voice',
      media: 'all',
      maxSubjectDetails: 1,
      maxRows: 1,
    });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      subjectDetailRequests: 1,
      subjectDetailIdsDroppedAtLimit: 3,
      subjectDetailsFailed: 0,
      rowsReturned: 1,
    });
    expect(result.exclusions).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'subject_detail_cap', count: 3 })]),
    );
    expect(result.coverage.outputTruncated).toBe(false);

    const failed = await new PersonActivityService(
      new HttpClient({ fetchFn: activityFetch({ failSubjectIds: [1] }).fetchFn }),
    ).getPersonActivity(20, { asOf: '2026-08-15', kind: 'voice', media: 'all' });
    expect(failed.state).toBe('partial');
    expect(failed.coverage.subjectDetailsFailed).toBe(1);
    expect(failed.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'subject_detail_unavailable', count: 1 }),
      ]),
    );
  });

  it('returns not_computable when every observed credit lacks a usable activity date', async () => {
    const fixture = activityFetch();
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 101, name: '角色', subject_id: 1, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/1')) return json(subjectPayload(1, { date: undefined }));
      return json({ error: 'not found' }, 404);
    });
    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'voice',
        media: 'all',
      },
    );

    expect(result.state).toBe('not_computable');
    expect(result.coverage.missingDateRows).toBe(1);
    expect(result.rows).toEqual([]);
    expect(fixture.getPeakDetails()).toBe(0);
  });
});
