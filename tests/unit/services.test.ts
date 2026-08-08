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
          new Response(JSON.stringify([{ id: 2001, name: '水瀬いのり', role_name: '声优' }]), {
            status: 200,
          }),
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
          data: [{ subject_id: 226998, type: 2, rate: 9, comment: '神作！' }],
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
            items: [{ id: 1, name: 'Anime Mon', name_cn: '周一动画', air_date: '2026-08-03' }],
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

  it('Workflow getSubjectCast aggregates character and VA details', async () => {
    const client = new HttpClient();
    const charService = new CharacterService(client);

    vi.spyOn(charService, 'getSubjectCharacters').mockResolvedValue([
      { id: 10, name: 'Chito', type: 1, summary: '' },
    ]);

    vi.spyOn(charService, 'getCharacterRelatedPersons').mockResolvedValue([
      { id: 20, name: 'Inori Minase', roleName: '声优' },
    ]);

    const castRes = await getSubjectCast(charService, 226998);
    expect(castRes.cast.length).toBe(1);
    expect(castRes.cast[0]?.character.name).toBe('Chito');
    expect(castRes.cast[0]?.persons[0]?.name).toBe('Inori Minase');
  });
});
