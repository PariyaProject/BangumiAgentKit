import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import {
  SubjectService,
  EpisodeService,
  CharacterService,
  PersonService,
  UserService,
  RevisionService,
  IndexReadService,
  CalendarService,
  buildCalendarIntelligence,
  calendarSubjectTypeLabel,
  parseCalendarPayload,
  resolveSubject,
  getSubjectCast,
} from '../../packages/bangumi-core/src/index.js';

describe('Phase 3: Read-Only Domain Services & Workflows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('SubjectService searches and maps subjects correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [
            {
              id: 226998,
              type: 2,
              name: '少女終末旅行',
              name_cn: '少女终末旅行',
              summary: '人类文明毁坏之后的终末世界...',
              nsfw: false,
              rating: { score: 8.6, rank: 30, total: 5000 },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new SubjectService(client);

    const res = await service.searchSubjects('少女终末旅行');
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe(226998);
    expect(res.items[0]?.type).toBe('anime');
    expect(res.items[0]?.score).toBe(8.6);
  });

  it('EpisodeService parses and filters main episodes vs SPs', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 3,
          data: [
            { id: 101, type: 0, sort: 1, name: 'Ep 1' },
            { id: 102, type: 0, sort: 2, name: 'Ep 2' },
            { id: 103, type: 1, sort: 1, name: 'SP 1' },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new EpisodeService(client);

    const epsRes = await service.getEpisodes(100);
    const eps = epsRes.items;
    expect(eps.length).toBe(3);
    expect(eps[0]?.category).toBe('main');
    expect(eps[2]?.category).toBe('sp');

    const filtered = service.filterMainEpisodesUpTo(eps, 1);
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.id).toBe(101);
  });

  it('CharacterService & PersonService retrieve character and cast info', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/characters/1001/persons')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 2001,
                name: '水瀬いのり',
                type: 1,
                subject_id: 100,
                subject_type: 2,
                subject_name: 'anime',
                subject_name_cn: '动画',
                staff: 'CV',
              },
            ]),
            {
              status: 200,
            },
          ),
        );
      }
      if (url.includes('/persons/2001')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 2001, name: '水瀬いのり', type: 1, career: ['artist'] }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ id: 1001, name: 'チト', summary: '主人公之一' }), {
          status: 200,
        }),
      );
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const charService = new CharacterService(client);
    const personService = new PersonService(client);

    const char = await charService.getCharacterById(1001);
    expect(char.name).toBe('チト');

    const persons = await charService.getCharacterRelatedPersons(1001);
    expect(persons[0]?.name).toBe('水瀬いのり');

    const person = await personService.getPersonById(2001);
    expect(person.name).toBe('水瀬いのり');
  });

  it('UserService fetches user profile and collection status', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [
            {
              subject_id: 226998,
              type: 2,
              rate: 9,
              comment: '神作！',
              subject: { name: '少女終末旅行', type: 2 },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new UserService(client);

    const res = await service.getUserCollections('testuser');
    expect(res.total).toBe(1);
    expect(res.items[0]?.subjectId).toBe(226998);
    expect(res.items[0]?.status).toBe('done');
    expect(res.items[0]?.rating).toBe(9);
  });

  it('RevisionService fetches subject revision logs', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [{ id: 1, type: 1, summary: '修改中文名称', created_at: '2026-01-01' }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new RevisionService(client);

    const res = await service.getSubjectRevisions(100);
    expect(res.total).toBe(1);
    expect(res.items[0]?.summary).toBe('修改中文名称');
  });

  it('IndexReadService reads index details and subjects', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/subjects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ total: 1, data: [{ id: 10, name: 'Anime 1', order: 1 }] }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 50,
            title: '推荐动画榜',
            desc: '测试目录',
            stat: { collects: 100 },
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new IndexReadService(client);

    const idx = await service.getIndexById(50);
    expect(idx.title).toBe('推荐动画榜');

    const subjects = await service.getIndexSubjects(50);
    expect(subjects.items[0]?.name).toBe('Anime 1');
  });

  it('CalendarService retrieves anime broadcast schedule', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
            items: [
              {
                id: 1,
                type: 2,
                name: 'Anime Mon',
                name_cn: '周一动画',
                summary: 'summary',
                air_date: '2026-08-03',
                air_weekday: 1,
                rating: { score: 8.5 },
                rank: 20,
                collection: { doing: 300 },
              },
            ],
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new HttpClient();
    const service = new CalendarService(client);

    const calendar = await service.getCalendar();
    expect(calendar.length).toBe(1);
    expect(calendar[0]?.weekday.cn).toBe('星期一');
    expect(calendar[0]?.items[0]?.nameCn).toBe('周一动画');
    expect(calendar[0]?.items[0]).toMatchObject({
      type: 2,
      typeLabel: 'anime',
      nameCnProvided: true,
      summary: 'summary',
      airWeekday: 1,
      rank: 20,
      collectionDoing: 300,
    });
  });

  it('Calendar intelligence filters weekdays, caps rows, and preserves unknowns', () => {
    const result = buildCalendarIntelligence(
      [
        {
          weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
          items: [
            { id: 1, name: 'A', nameCn: '甲', airDate: '2026-08-10' },
            { id: 2, name: 'B', nameCn: '乙', airDate: '' },
          ],
        },
        {
          weekday: { en: 'Tue', cn: '星期二', ja: '火曜日', id: 2 },
          items: [{ id: 3, name: 'C', nameCn: '丙', airDate: '' }],
        },
      ],
      { weekday: 1, maxPerDay: 1, maxTotal: 1 },
      '2026-08-10T00:00:00.000Z',
    );

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      observed: 2,
      returned: 1,
      selectedDays: 1,
      maxPerDay: 1,
      maxTotal: 1,
    });
    expect(result.days[0]).toMatchObject({ observed: 2, returned: 1, overflowCount: 1 });
    expect(result.days[0]?.items).toHaveLength(1);
    expect(calendarSubjectTypeLabel(2)).toBe('anime');
    expect(calendarSubjectTypeLabel(99)).toBe('other');
    expect(calendarSubjectTypeLabel(undefined)).toBeUndefined();
  });

  it('Calendar intelligence exposes source-day coverage and missing-field counts', () => {
    const result = buildCalendarIntelligence([
      {
        weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
        items: [
          {
            id: 1,
            name: 'Original title',
            nameCn: 'Original title',
            nameCnProvided: false,
            airDate: '',
          },
        ],
      },
    ]);

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      expectedDays: 7,
      sourceDayCount: 1,
      missingWeekdays: [2, 3, 4, 5, 6, 7],
      dateSemantics: 'first_air_date',
      missingFields: {
        'item.name_cn': 1,
        'item.air_date': 1,
        'item.rating.score': 1,
        'item.rank': 1,
        'item.collection.doing': 1,
        'item.type': 1,
      },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_DAY_COVERAGE' })]),
    );
    expect(result.limitations[0]).toContain('首播日期');
  });

  it('Calendar intelligence builder does not invent acquisition provenance', () => {
    const result = buildCalendarIntelligence(
      Array.from({ length: 7 }, (_, index) => ({
        weekday: {
          en: `Day ${index + 1}`,
          cn: `星期${index + 1}`,
          ja: `曜日${index + 1}`,
          id: index + 1,
        },
        items: [],
      })),
    );

    expect(result.state).toBe('complete');
    expect(result.source.cache).toBe('unknown');
    expect(result.source.retrievedAt).toBeUndefined();
    expect(result.source.attemptedAt).toBeUndefined();
    expect(result.evidence[0]?.retrievedAt).toBeUndefined();
    expect(result.evidence[0]?.attemptedAt).toBeUndefined();
  });

  it('Calendar intelligence caps source days to seven unique weekdays', () => {
    const result = buildCalendarIntelligence(
      Array.from({ length: 20 }, (_, index) => ({
        weekday: {
          en: `Day ${index + 1}`,
          cn: `星期${(index % 7) + 1}`,
          ja: `曜日${(index % 7) + 1}`,
          id: (index % 7) + 1,
        },
        items: [
          {
            id: index + 1,
            name: `Anime ${index + 1}`,
            nameCn: `动画${index + 1}`,
            airDate: '',
          },
        ],
      })),
    );

    expect(result.days).toHaveLength(7);
    expect(result.coverage).toMatchObject({
      sourceDayCount: 20,
      observed: 20,
      returned: 20,
      expectedDays: 7,
      missingWeekdays: [],
      extraDayEnvelopes: 13,
    });
    expect(result.state).toBe('partial');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_DAY_COVERAGE' })]),
    );
  });

  it('Calendar intelligence never marks an invalid legacy weekday filter complete', () => {
    const result = buildCalendarIntelligence(
      Array.from({ length: 7 }, (_, index) => ({
        weekday: {
          en: `Day ${index + 1}`,
          cn: `星期${index + 1}`,
          ja: `曜日${index + 1}`,
          id: index + 1,
        },
        items: [],
      })),
      { weekday: 8 },
    );

    expect(result.state).toBe('partial');
    expect(result.days).toEqual([]);
    expect(result.coverage).toMatchObject({ requestedWeekday: 8, selectedDays: 0 });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_WEEKDAY_FILTER' })]),
    );
  });

  it('Calendar intelligence classifies contradictory item weekdays as partial conflicts', () => {
    const week = Array.from({ length: 7 }, (_, index) => ({
      weekday: {
        en: `Day ${index + 1}`,
        cn: `星期${index + 1}`,
        ja: `曜日${index + 1}`,
        id: index + 1,
      },
      items:
        index === 0
          ? [{ id: 1, name: 'Conflict', nameCn: '冲突', airDate: '', airWeekday: 2 }]
          : [],
    }));

    const conflict = buildCalendarIntelligence(week);

    expect(conflict.state).toBe('partial');
    expect(conflict.coverage).toMatchObject({
      weekdayConflictCount: 1,
      invalidItemWeekdayCount: 0,
    });
    expect(conflict.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WEEKDAY_CONFLICT' })]),
    );

    const invalid = buildCalendarIntelligence([
      ...week.slice(0, 1).map((day) => ({
        ...day,
        items: [{ id: 2, name: 'Invalid', nameCn: '越界', airDate: '', airWeekday: 8 }],
      })),
      ...week.slice(1),
    ]);

    expect(invalid.state).toBe('partial');
    expect(invalid.coverage).toMatchObject({
      weekdayConflictCount: 0,
      invalidItemWeekdayCount: 1,
    });
    expect(invalid.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_DRIFT' })]),
    );
  });

  it('CalendarService reports malformed legacy envelopes as schema drift', async () => {
    const malformedPayloads = [
      [{}],
      [
        {
          weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
          items: {},
        },
      ],
      [
        {
          weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
          items: [{ id: 1, name: 'Invalid weekday', air_weekday: 8 }],
        },
      ],
      { weekday: { id: 1 }, items: [] },
    ];

    for (const payload of malformedPayloads) {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
      const result = await new CalendarService(
        new HttpClient({ fetchFn: mockFetch }),
      ).getCalendarIntelligence();

      expect(result.state).toBe('unavailable');
      expect(result.error).toMatchObject({ code: 'PARSER_ERROR' });
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_DRIFT' })]),
      );
    }
  });

  it('parseCalendarPayload accepts an empty calendar but rejects non-array roots', () => {
    expect(parseCalendarPayload([])).toEqual([]);
    expect(() => parseCalendarPayload({})).toThrow('PARSER_ERROR');
  });

  it('parseCalendarPayload rejects oversized source envelopes and item arrays before mapping', () => {
    const day = (id: number, items: unknown[] = []) => ({
      weekday: { en: `Day ${id}`, cn: `星期${id}`, ja: `曜日${id}`, id },
      items,
    });
    const item = (id: number) => ({ id, name: `Item ${id}` });

    expect(() => parseCalendarPayload(Array.from({ length: 33 }, (_, index) => day((index % 7) + 1))))
      .toThrow('PARSER_ERROR');
    expect(() => parseCalendarPayload([day(1, Array.from({ length: 129 }, (_, index) => item(index + 1)))]))
      .toThrow('PARSER_ERROR');
    expect(() =>
      parseCalendarPayload(
        Array.from({ length: 7 }, (_, dayIndex) =>
          day(dayIndex + 1, Array.from({ length: 80 }, (_, itemIndex) => item(dayIndex * 80 + itemIndex + 1))),
        ),
      ),
    ).toThrow('PARSER_ERROR');
  });

  it('CalendarService maps an upstream failure to an unavailable calendar result', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    const service = new CalendarService(new HttpClient({ fetchFn: mockFetch }));

    const result = await service.getCalendarIntelligence();

    expect(result.state).toBe('unavailable');
    expect(result.error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UPSTREAM_RATE_LIMITED' })]),
    );
    expect(result.source.retrievedAt).toBeUndefined();
    expect(result.source.attemptedAt).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('Calendar intelligence makes one official request for each upstream failure class', async () => {
    const cases = [
      {
        label: '503',
        fetchFn: vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })),
        error: 'UPSTREAM_UNAVAILABLE',
      },
      {
        label: 'network',
        fetchFn: vi.fn().mockRejectedValue(new Error('socket closed')),
        error: 'NETWORK_ERROR',
      },
    ];

    for (const testCase of cases) {
      const result = await new CalendarService(
        new HttpClient({ fetchFn: testCase.fetchFn }),
      ).getCalendarIntelligence();

      expect(result.state, testCase.label).toBe('unavailable');
      expect(result.error?.code, testCase.label).toBe(testCase.error);
      expect(testCase.fetchFn, testCase.label).toHaveBeenCalledTimes(1);
    }
  });

  it('Calendar intelligence bypasses the legacy cache and timestamps successful acquisition', async () => {
    const payload = [
      {
        weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
        items: [{ id: 1, name: 'Fresh Anime' }],
      },
    ];
    const mockFetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
      );
    const service = new CalendarService(new HttpClient({ fetchFn: mockFetch }));

    const first = await service.getCalendarIntelligence();
    const second = await service.getCalendarIntelligence();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(first.source.cache).toBe('bypassed');
    expect(first.source.retrievedAt).toBeTruthy();
    expect(first.source.attemptedAt).toBeTruthy();
    expect(second.source.retrievedAt).toBeTruthy();
  });

  it('Workflow resolveSubject handles exact ID and keyword disambiguation', async () => {
    const client = new HttpClient();
    const subjectService = new SubjectService(client);

    vi.spyOn(subjectService, 'getSubjectById').mockResolvedValue({
      id: 12345,
      type: 'anime',
      name: 'Steins;Gate',
      nameCn: '命运石之门',
      summary: '',
      nsfw: false,
      locked: false,
    });

    const resById = await resolveSubject(subjectService, '12345');
    expect(resById.status).toBe('exact');
    expect(resById.exact?.id).toBe(12345);

    vi.spyOn(subjectService, 'searchSubjects').mockResolvedValue({
      total: 2,
      limit: 5,
      offset: 0,
      items: [
        {
          id: 1,
          type: 'anime',
          name: 'Steins;Gate',
          nameCn: '命运石之门',
          summary: '',
          nsfw: false,
          locked: false,
        },
        {
          id: 2,
          type: 'anime',
          name: 'Steins;Gate 0',
          nameCn: '命运石之门0',
          summary: '',
          nsfw: false,
          locked: false,
        },
      ],
    });

    const resExactName = await resolveSubject(subjectService, '命运石之门');
    expect(resExactName.status).toBe('exact');
    expect(resExactName.exact?.id).toBe(1);

    const resDisambig = await resolveSubject(subjectService, '命运');
    expect(resDisambig.status).toBe('disambiguation');
    expect(resDisambig.candidates?.length).toBe(2);
  });

  it('Workflow resolveSubject propagates 500 / Network errors on numeric lookup', async () => {
    const client = new HttpClient();
    const subjectService = new SubjectService(client);
    const searchSpy = vi.spyOn(subjectService, 'searchSubjects');

    vi.spyOn(subjectService, 'getSubjectById').mockRejectedValue({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Server error',
    });

    await expect(resolveSubject(subjectService, '12345')).rejects.toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Server error',
    });
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('Workflow resolveSubject falls back to keyword search only on 404', async () => {
    const client = new HttpClient();
    const subjectService = new SubjectService(client);
    vi.spyOn(subjectService, 'getSubjectById').mockRejectedValue({
      status: 404,
      code: 'NOT_FOUND',
    });
    vi.spyOn(subjectService, 'searchSubjects').mockResolvedValue({
      total: 1,
      limit: 5,
      offset: 0,
      items: [
        {
          id: 12345,
          type: 'anime',
          name: 'Target Subject',
          nameCn: '目标条目',
          summary: '',
          nsfw: false,
          locked: false,
        },
      ],
    });

    const res = await resolveSubject(subjectService, '12345');
    expect(res.status).toBe('exact');
  });

  it('Workflow getSubjectCast aggregates character and VA details with 1 HTTP request', async () => {
    const client = new HttpClient();
    const charService = new CharacterService(client);

    vi.spyOn(charService, 'getSubjectCharacters').mockResolvedValue([
      {
        character: { id: 10, name: 'Chito', type: 1, summary: '' },
        relation: '主角',
        actors: [{ id: 20, name: 'Inori Minase', career: ['seiyu'] }],
      },
    ]);

    const castRes = await getSubjectCast(charService, 226998);
    expect(castRes.cast.length).toBe(1);
    expect(castRes.cast[0]?.character.name).toBe('Chito');
    expect(castRes.cast[0]?.relation).toBe('主角');
    expect(castRes.cast[0]?.actors[0]?.name).toBe('Inori Minase');
  });
});
