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
      relationSelectionStrategy: 'all',
      sampled: false,
      subjectIdsObserved: 4,
      subjectIdsSelected: 4,
      subjectIdsDroppedAtRelationLimit: 0,
      subjectDetailIdsObserved: 4,
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

  it('compares the recent window with the immediately preceding equal window', async () => {
    const fixture = activityFetch();
    const result = await new PersonActivityService(
      new HttpClient({ fetchFn: fixture.fetchFn }),
    ).getPersonActivity(20, {
      asOf: '2026-08-15',
      windowMonths: 6,
      kind: 'voice',
      media: 'tv',
      comparePreviousWindow: true,
    });

    expect(result.summary).toMatchObject({ creditRows: 1, uniqueSubjects: 1 });
    expect(result.comparison).toMatchObject({
      state: 'partial',
      windowMonths: 6,
      recent: {
        window: {
          start: '2026-03-01',
          end: '2026-08-15',
        },
        summary: { creditRows: 1, uniqueSubjects: 1 },
      },
      previous: {
        window: {
          start: '2025-09-01',
          end: '2026-02-28',
        },
        summary: { creditRows: 1, uniqueSubjects: 1 },
      },
      delta: { creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
    });
    expect(result.comparison?.peak).toMatchObject({
      state: 'complete',
      metric: 'uniqueSubjects',
      months: [
        expect.objectContaining({ period: 'recent', month: '2026-05', uniqueSubjects: 1 }),
        expect.objectContaining({ period: 'previous', month: '2026-02', uniqueSubjects: 1 }),
      ],
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'person-activity-period-comparison',
          formulaVersion: 'person-activity-comparison-v1',
        }),
      ]),
    );
    expect(result.limitations.join(' ')).toContain('没有历史快照');
    expect(
      fixture.fetchFn.mock.calls.filter(([input]) =>
        String(input).endsWith('/v0/persons/20/characters'),
      ),
    ).toHaveLength(2);
  });

  it('keeps a failed previous relation source partial and preserves recent evidence', async () => {
    const fixture = activityFetch();
    let characterCalls = 0;
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20/characters')) {
        characterCalls += 1;
        if (characterCalls >= 2) return json({ error: 'previous relation unavailable' }, 503);
      }
      return await fixture.fetchFn(input, init);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        windowMonths: 6,
        kind: 'voice',
        media: 'tv',
        comparePreviousWindow: true,
      },
    );

    expect(result.comparison).toMatchObject({
      state: 'partial',
      recent: { state: 'partial', summary: { uniqueSubjects: 1 } },
      previous: { state: 'unavailable', summary: { uniqueSubjects: 0 } },
      delta: { uniqueSubjects: 1 },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_PERIOD_COVERAGE', state: 'partial' }),
      ]),
    );
    expect(result.comparison?.peak.state).toBe('complete');
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
      subjectDetailIdsObserved: 4,
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

  it('uses an even-spread relation sample instead of an ascending-ID prefix', async () => {
    const relations = Array.from({ length: 8 }, (_, index) => ({
      id: 100 + index,
      name: `角色 ${index + 1}`,
      subject_id: index + 1,
      subject_type: 2,
      subject_name: `Subject ${index + 1}`,
      staff: '主角',
    }));
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) return json(relations);
      if (url.includes('/v0/subjects/')) {
        const id = Number(url.split('/').pop());
        return json(subjectPayload(id, { date: '2026-08-01' }));
      }
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'voice',
        media: 'tv',
        maxRelations: 4,
        maxSubjectDetails: 4,
      },
    );

    expect(result.state).toBe('partial');
    expect(result.rows.map((row) => row.subjectId)).toEqual([1, 3, 6, 8]);
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 8,
      relationRowsSelected: 4,
      relationRowsDroppedAtLimit: 4,
      relationSelectionStrategy: 'deterministic_even_spread',
      sampled: true,
      subjectIdsObserved: 8,
      subjectIdsSelected: 4,
      subjectIdsDroppedAtRelationLimit: 4,
      subjectDetailIdsObserved: 4,
      subjectDetailRequests: 4,
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RELATION_LIMIT_REACHED' })]),
    );
  });

  it('marks output truncation and unknown roles as partial', async () => {
    const fixture = activityFetch();
    const result = await new PersonActivityService(
      new HttpClient({ fetchFn: fixture.fetchFn }),
    ).getPersonActivity(20, {
      asOf: '2026-08-15',
      kind: 'voice',
      media: 'all',
      maxRows: 1,
    });

    expect(result.state).toBe('partial');
    expect(result.coverage.outputTruncated).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OUTPUT_ROW_LIMIT_REACHED', state: 'partial' }),
        expect.objectContaining({ code: 'ROLE_UNKNOWN', state: 'partial' }),
      ]),
    );
  });

  it('preserves the requested person ID when person detail fails', async () => {
    const fixture = activityFetch();
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json({ error: 'person unavailable' }, 503);
      return await fixture.fetchFn(input, init);
    });
    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'voice',
        media: 'all',
      },
    );

    expect(result.personId).toBe(20);
    expect(result.person).toBeUndefined();
    expect(result.state).toBe('partial');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PERSON_DETAIL_UNAVAILABLE', state: 'partial' }),
      ]),
    );
  });

  it('degrades missing subject IDs and reserves empty-window success for evaluable rows', async () => {
    const missingOnlyFetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 101, name: '缺失条目', subject_type: 2, staff: '主角' }]);
      }
      return json({ error: 'not found' }, 404);
    });
    const missingOnly = await new PersonActivityService(
      new HttpClient({ fetchFn: missingOnlyFetch }),
    ).getPersonActivity(20, { asOf: '2026-08-15', kind: 'voice', media: 'all' });

    expect(missingOnly.state).toBe('partial');
    expect(missingOnly.coverage.missingSubjectIdRows).toBe(1);
    expect(missingOnly.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_SUBJECT_ID' })]),
    );
    expect(missingOnly.warnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NO_WINDOW_MATCHES' })]),
    );

    const mixedFetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([
          { id: 101, name: '缺失条目', subject_type: 2, staff: '主角' },
          { id: 102, name: '有效角色', subject_id: 9, subject_type: 2, staff: '主角' },
        ]);
      }
      if (url.endsWith('/v0/subjects/9')) return json(subjectPayload(9, { date: '2026-08-01' }));
      return json({ error: 'not found' }, 404);
    });
    const mixed = await new PersonActivityService(
      new HttpClient({ fetchFn: mixedFetch }),
    ).getPersonActivity(20, { asOf: '2026-08-15', kind: 'voice', media: 'all' });
    expect(mixed.state).toBe('partial');
    expect(mixed.rows).toHaveLength(1);
    expect(mixed.coverage.missingSubjectIdRows).toBe(1);

    const emptyFetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 101, name: '旧作品', subject_id: 9, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/9')) return json(subjectPayload(9, { date: '2020-08-01' }));
      return json({ error: 'not found' }, 404);
    });
    const empty = await new PersonActivityService(
      new HttpClient({ fetchFn: emptyFetch }),
    ).getPersonActivity(20, { asOf: '2026-08-15', kind: 'voice', media: 'all' });
    expect(empty.state).toBe('complete');
    expect(empty.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NO_WINDOW_MATCHES' })]),
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
