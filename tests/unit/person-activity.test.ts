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
      if (id === 1) return json(subjectPayload(id, { meta_tags: ['原创', '奇幻'] }));
      if (id === 2) return json(subjectPayload(id, { date: '2026-02-12' }));
      if (id === 3)
        return json(
          subjectPayload(id, { type: 3, platform: 'CD', date: '2026-06-02', meta_tags: [] }),
        );
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
      origin: {
        explicitOriginalSubjects: 1,
        notObservedSubjects: 0,
        unknownSubjects: 0,
      },
    });
    expect(result.summary.byRole).toEqual([
      expect.objectContaining({ key: 'main', creditRows: 1 }),
    ]);
    expect(result.rows[0]).toMatchObject({
      subjectId: 1,
      firstAirDate: '2026-05-10',
      roleFamily: 'main',
      rawRole: '主角',
      origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
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
      origin: {
        subjectsObserved: 1,
        explicitOriginalSubjects: 1,
        notObservedSubjects: 0,
        unknownSubjects: 0,
      },
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

  it('keeps positive-only origin observations distinct from not-observed and unknown states', async () => {
    const fixture = activityFetch();
    const result = await new PersonActivityService(
      new HttpClient({ fetchFn: fixture.fetchFn }),
    ).getPersonActivity(20, { asOf: '2026-08-15', windowMonths: 6, kind: 'voice', media: 'all' });

    expect(result.summary.origin).toEqual({
      explicitOriginalSubjects: 1,
      notObservedSubjects: 1,
      unknownSubjects: 1,
    });
    expect(result.coverage.origin).toEqual({
      subjectsObserved: 3,
      explicitOriginalSubjects: 1,
      notObservedSubjects: 1,
      unknownSubjects: 1,
      subjectsWithMetaTags: 2,
      subjectsPartial: 0,
      subjectsUnknown: 1,
      tagsObserved: 2,
      tagsValid: 2,
      tagsReturned: 2,
      tagsOmitted: 0,
      malformedTagValues: 0,
      textTruncatedTags: 0,
      truncatedSubjects: 0,
      truncated: false,
      maxTagsPerSubject: 32,
      maxTagCharacters: 96,
      responseLimitBytes: 1048576,
    });
    expect(result.rows.map((row) => row.origin)).toEqual([
      expect.objectContaining({ state: 'not_observed', metaTags: [] }),
      expect.objectContaining({ state: 'unknown' }),
      expect.objectContaining({ state: 'explicit_original', metaTags: ['原创', '奇幻'] }),
    ]);
    expect(result.limitations).toEqual(
      expect.arrayContaining([expect.stringContaining('未观察到该标签不等于改编')]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'person-activity-origin-observation',
          formulaVersion: 'person-activity-origin-v1',
        }),
      ]),
    );
  });

  it('filters exact director labels and supports a bounded 36-month staff window', async () => {
    const detailIds: number[] = [];
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([
          { id: 301, name: '导演作品', staff: '导演' },
          { id: 302, name: '脚本作品', staff: '脚本' },
          { id: 303, name: '監督作品', staff: '監督' },
          { id: 304, name: '缺失职位作品' },
          { id: 305, name: '副导演作品', staff: '副导演' },
        ]);
      }
      if (url.includes('/v0/subjects/')) {
        const id = Number(url.split('/').pop());
        detailIds.push(id);
        if (id === 301) return json(subjectPayload(id, { date: '2024-01-10' }));
        if (id === 303) return json(subjectPayload(id, { date: '2025-11-10' }));
      }
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'staff',
        staffRole: 'director',
        media: 'tv',
        windowMonths: 36,
      },
    );

    expect(result.state).toBe('partial');
    expect(result).toMatchObject({
      kind: 'staff',
      staffRole: 'director',
      window: {
        months: 36,
        start: '2023-09-01',
        end: '2026-08-15',
      },
      rows: [
        { subjectId: 303, rawRole: '監督' },
        { subjectId: 301, rawRole: '导演' },
      ],
      coverage: {
        relationRowsObserved: 5,
        relationRowsSelected: 2,
        staffRoleExcludedRows: 3,
        staffRoleUnknownRows: 1,
        subjectIdsObserved: 2,
        subjectIdsSelected: 2,
        subjectDetailRequests: 2,
        subjectDetailsSucceeded: 2,
      },
    });
    expect(detailIds).toEqual([301, 303]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STAFF_ROLE_FILTER' }),
        expect.objectContaining({ code: 'STAFF_ROLE_FILTER_UNKNOWN', state: 'partial' }),
      ]),
    );
    expect(result.limitations).toEqual(
      expect.arrayContaining([expect.stringContaining('只匹配官方 person-subject relation')]),
    );
  });

  it('bounds tag projections, retains a positive original tag beyond the prefix, and reports drift', async () => {
    const longTag = '界'.repeat(140);
    const metaTags = [
      longTag,
      ...Array.from({ length: 40 }, (_, index) => `标签-${index}`),
      '原创',
      42,
    ];
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 101, name: '角色', subject_id: 1, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/1')) {
        return json(subjectPayload(1, { date: '2026-08-01', meta_tags: metaTags }));
      }
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      { asOf: '2026-08-15', kind: 'voice', media: 'all' },
    );

    expect(result.state).toBe('partial');
    expect(result.rows[0]?.origin).toMatchObject({
      state: 'explicit_original',
      metaTags: expect.arrayContaining(['原创']),
      metaTagsCoverage: {
        state: 'partial',
        observed: 43,
        valid: 42,
        returned: 32,
        omitted: 10,
        malformed: 1,
        textTruncated: 1,
        truncated: true,
      },
    });
    expect(result.rows[0]?.origin.metaTags).toHaveLength(32);
    expect(result.rows[0]?.origin.metaTags?.some((tag) => tag.length > 96)).toBe(false);
    expect(result.coverage.origin).toMatchObject({
      subjectsObserved: 1,
      subjectsWithMetaTags: 1,
      subjectsPartial: 1,
      subjectsUnknown: 0,
      tagsObserved: 43,
      tagsValid: 42,
      tagsReturned: 32,
      tagsOmitted: 10,
      malformedTagValues: 1,
      textTruncatedTags: 1,
      truncatedSubjects: 1,
      truncated: true,
      maxTagsPerSubject: 32,
      maxTagCharacters: 96,
      responseLimitBytes: 1048576,
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORIGIN_META_TAG_COVERAGE' })]),
    );
  });

  it('does not call malformed meta_tags not-observed when no positive tag is reliable', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 101, name: '角色', subject_id: 1, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/1')) {
        return json(subjectPayload(1, { date: '2026-08-01', meta_tags: [42, '漫画'] }));
      }
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      { asOf: '2026-08-15', kind: 'voice', media: 'all' },
    );

    expect(result.rows[0]?.origin).toMatchObject({
      state: 'unknown',
      metaTags: ['漫画'],
      metaTagsCoverage: { state: 'partial', malformed: 1 },
    });
    expect(result.summary.origin).toEqual({
      explicitOriginalSubjects: 0,
      notObservedSubjects: 0,
      unknownSubjects: 1,
    });
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
      delta: { state: 'partial', creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
    });
    expect(result.comparison?.peak).toMatchObject({
      state: 'partial',
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
      delta: { state: 'partial' },
    });
    expect(result.state).toBe('partial');
    expect(result.comparison?.delta).not.toHaveProperty('uniqueSubjects');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_PERIOD_COVERAGE', state: 'partial' }),
        expect.objectContaining({ code: 'COMPARISON_DELTA_NOT_COMPUTABLE', state: 'partial' }),
      ]),
    );
    expect(result.comparison?.peak.state).toBe('partial');
  });

  it('does not turn unavailable comparison periods into zero delta or peak values', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json({ error: 'relations unavailable' }, 503);
      }
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'voice',
        media: 'all',
        comparePreviousWindow: true,
      },
    );

    expect(result.state).toBe('unavailable');
    expect(result.comparison).toMatchObject({
      state: 'unavailable',
      recent: { state: 'unavailable' },
      previous: { state: 'unavailable' },
      delta: { state: 'unavailable' },
      peak: { state: 'unavailable', months: [] },
    });
    expect(result.comparison?.delta).not.toHaveProperty('creditRows');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_DELTA_NOT_COMPUTABLE', state: 'unavailable' }),
        expect.objectContaining({ code: 'COMPARISON_PEAK_NOT_COMPUTABLE', state: 'unavailable' }),
      ]),
    );
  });

  it('keeps missing and invalid dates as not-computable comparison periods', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([
          { id: 101, name: '缺日期', subject_id: 1, subject_type: 2, staff: '主角' },
          { id: 102, name: '坏日期', subject_id: 2, subject_type: 2, staff: '配角' },
        ]);
      }
      if (url.endsWith('/v0/subjects/1')) return json(subjectPayload(1, { date: undefined }));
      if (url.endsWith('/v0/subjects/2')) return json(subjectPayload(2, { date: '2026-02-31' }));
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'voice',
        media: 'all',
        comparePreviousWindow: true,
      },
    );

    expect(result.state).toBe('not_computable');
    expect(result.comparison).toMatchObject({
      state: 'not_computable',
      recent: { state: 'not_computable' },
      previous: { state: 'not_computable' },
      delta: { state: 'not_computable' },
      peak: { state: 'not_computable', months: [] },
    });
    expect(result.comparison?.delta).not.toHaveProperty('uniqueSubjects');
    expect(result.coverage).toMatchObject({ missingDateRows: 1, invalidDateRows: 1 });
  });

  it('keeps all-kind sampled and all-detail-failed comparisons explicitly partial', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([
          { id: 101, name: '角色一', subject_id: 1, subject_type: 2, staff: '主角' },
          { id: 102, name: '角色二', subject_id: 2, subject_type: 2, staff: '配角' },
        ]);
      }
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([
          { id: 3, name: '作品三', subject_type: 2, staff: '脚本' },
          { id: 4, name: '作品四', subject_type: 2, staff: '导演' },
        ]);
      }
      if (url.includes('/v0/subjects/')) return json({ error: 'detail unavailable' }, 503);
      return json({ error: 'not found' }, 404);
    });

    const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
      20,
      {
        asOf: '2026-08-15',
        kind: 'all',
        media: 'all',
        maxRelations: 2,
        comparePreviousWindow: true,
      },
    );

    expect(result.state).toBe('partial');
    expect(result.comparison).toMatchObject({
      state: 'partial',
      recent: { state: 'partial', coverage: { relationRowsDroppedAtLimit: 2 } },
      previous: { state: 'partial', coverage: { relationRowsDroppedAtLimit: 2 } },
      delta: { state: 'partial' },
      peak: { state: 'partial', months: [] },
    });
    expect(result.comparison?.delta).not.toHaveProperty('creditRows');
  });

  it.each(['voice', 'staff', 'all'] as const)(
    'keeps %s comparison semantics complete when both sources are readable',
    async (kind) => {
      const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/v0/persons/20')) return json(personPayload());
        if (url.endsWith('/v0/persons/20/characters')) {
          return json([{ id: 101, name: '角色', subject_id: 1, subject_type: 2, staff: '主角' }]);
        }
        if (url.endsWith('/v0/persons/20/subjects')) {
          return json([{ id: 1, name: '作品', subject_type: 2, staff: '脚本' }]);
        }
        if (url.endsWith('/v0/subjects/1')) return json(subjectPayload(1, { date: '2026-05-10' }));
        return json({ error: 'not found' }, 404);
      });

      const result = await new PersonActivityService(new HttpClient({ fetchFn })).getPersonActivity(
        20,
        { asOf: '2026-08-15', kind, media: 'all', comparePreviousWindow: true },
      );

      expect(result.comparison).toMatchObject({
        state: 'complete',
        delta: { state: 'complete' },
        peak: { state: 'complete' },
      });
      expect(result.comparison?.delta).toHaveProperty('uniqueSubjects');
    },
  );

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
