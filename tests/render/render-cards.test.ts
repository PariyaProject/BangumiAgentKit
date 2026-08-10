import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  buildCalendarIntelligenceViewModel,
  PersonProfileViewModel,
  buildPersonProfileViewModel,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import type {
  CalendarIntelligenceResult,
  PersonActivityProfile,
} from '@bangumi-agent-kit/bangumi-core';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function assertValidPng(buffer: Buffer) {
  expect(buffer).toBeDefined();
  expect(buffer.length).toBeGreaterThan(1000);
  expect(buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
}

describe('PR-5 Renderer Cards (R01 - R07)', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('R01: Subject Card returns valid PNG signature', async () => {
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 1,
        name: 'Cowboy Bebop',
        nameCn: '星际牛仔',
        type: 'anime',
        date: '1998-04-03',
        score: 9.1,
        rank: 1,
        summary: '2071年，人类居住的空间扩大到了整个太阳系...',
        tags: ['TV', '原创', '科幻', 'SUNRISE'],
      },
      source: { label: 'Bangumi Agent Kit Test' },
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(1920); // 960px * DPR 2
    expect(result.height).toBeGreaterThan(200);
  });

  it('R02: Search List returns valid PNG', async () => {
    const vm: SearchListViewModel = {
      template: 'search-list',
      version: 1,
      query: '命运石之门',
      total: 2,
      items: [
        {
          id: 1,
          name: 'Steins;Gate',
          nameCn: '命运石之门',
          type: 'anime',
          score: 9.2,
          rank: 2,
        },
        {
          id: 2,
          name: 'Steins;Gate 0',
          nameCn: '命运石之门0',
          type: 'anime',
          score: 8.5,
          rank: 50,
        },
      ],
      hasMore: false,
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.template).toBe('search-list');
  });

  it('R03: Cast Card returns valid PNG', async () => {
    const vm: CastCardViewModel = {
      template: 'cast-card',
      version: 1,
      subject: { id: 1, name: 'Steins;Gate', nameCn: '命运石之门' },
      items: [
        {
          character: { id: 1, name: '冈部伦太郎' },
          relation: '主角',
          actors: [{ id: 101, name: '宫野真守' }],
        },
        {
          character: { id: 2, name: '牧濑红莉栖' },
          relation: '主角',
          actors: [{ id: 102, name: '今井麻美' }],
        },
      ],
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.template).toBe('cast-card');
  });

  it('R04: Collection Progress returns valid PNG', async () => {
    const vm: CollectionProgressViewModel = {
      template: 'collection-progress',
      version: 1,
      subject: { id: 1, name: 'Sousou no Frieren', nameCn: '葬送的芙莉莲' },
      status: 'do',
      statusLabel: '在看',
      watchedEpisodes: 16,
      totalEpisodes: 28,
      rating: 9,
      comment: '神作预定，制作精良。',
      progressPercentage: 57,
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.template).toBe('collection-progress');
  });

  it('R05: Calendar returns valid PNG', async () => {
    const calendarResult: CalendarIntelligenceResult = {
      state: 'partial',
      days: [
        {
          weekday: { en: 'Sat', cn: '星期六', ja: '土曜日', id: 6 },
          observed: 3,
          returned: 2,
          overflowCount: 1,
          items: [
            {
              id: 100,
              name: 'Anime 1',
              nameCn: '动画1',
              nameCnProvided: true,
              airDate: '2026-08-15',
              type: 2,
              typeLabel: 'anime',
              score: 8.4,
            },
            {
              id: 101,
              name: 'Anime 2',
              nameCn: 'Anime 2',
              nameCnProvided: false,
              airDate: '',
              score: 7.9,
            },
          ],
        },
      ],
      coverage: {
        state: 'partial',
        observed: 3,
        returned: 2,
        selectedDays: 1,
        maxPerDay: 2,
        maxTotal: 2,
        expectedDays: 7,
        sourceDayCount: 1,
        missingWeekdays: [1, 2, 3, 4, 5, 7],
        missingFields: {
          'item.name_cn': 1,
          'item.air_date': 1,
          'item.rank': 2,
          'item.collection.doing': 2,
          'item.type': 1,
        },
        dateSemantics: 'first_air_date',
        weekdaySemantics:
          '1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday,7=Sunday; timezone=source-unspecified',
        duplicateWeekdays: [],
        extraDayEnvelopes: 0,
        invalidWeekdayCount: 0,
        invalidItemWeekdayCount: 0,
        weekdayConflictCount: 0,
      },
      source: {
        class: 'official-legacy',
        operation: 'GET /calendar',
        retrievedAt: '2026-08-10T00:00:00.000Z',
      },
      evidence: [],
      limitations: ['官方 /calendar 提供日期而非具体播出时间。'],
      warnings: [{ code: 'OUTPUT_TRUNCATED', state: 'partial', message: '已达到显示上限。' }],
    };
    const vm = buildCalendarIntelligenceViewModel(calendarResult);
    const japaneseFallbackVm = buildCalendarIntelligenceViewModel({
      ...calendarResult,
      days: [
        {
          ...calendarResult.days[0]!,
          weekday: { en: '', cn: '', ja: '土曜日', id: 6 },
        },
      ],
    });
    expect(japaneseFallbackVm.days[0]?.weekdayCn).toBe('土曜日');

    const renderResult = await renderService.renderCard(vm);
    assertValidPng(renderResult.buffer);
    expect(renderResult.template).toBe('calendar');
    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 640);
    expect(html).toContain('覆盖：观察 3 条 · 返回 2 条 · 展示 2 条');
    expect(html).toContain('首播日期 2026-08-15');
    expect(html).toContain('原名：Anime 1');
    expect(html).toContain('排名未知');
    expect(html).toContain('已达到显示上限');
  });

  it('PR-7E: Calendar state matrix renders narrow, dense, empty, long-CJK, and unavailable at 640/960', async () => {
    const weekdaySemantics =
      '1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday,7=Sunday; timezone=source-unspecified';
    const makeItem = (id: number, long = false) => ({
      id,
      name: long ? `Original Japanese title ${id} ${'非常に長い作品名'.repeat(8)}` : `Anime ${id}`,
      nameCn: long ? `超长中文条目名称 ${'繁體簡體中文'.repeat(10)}` : `动画${id}`,
      nameCnProvided: true,
      airDate: '2026-08-10',
      airWeekday: 1,
      type: 2,
      typeLabel: 'anime',
      score: 8.5,
      rank: id,
      collectionDoing: 100 + id,
    });
    const makeDay = (id: number, items: ReturnType<typeof makeItem>[]) => ({
      weekday: { en: `Day ${id}`, cn: `星期${id}`, ja: `曜日${id}`, id },
      observed: items.length,
      returned: items.length,
      overflowCount: 0,
      items: items.map((item) => ({ ...item, airWeekday: id })),
    });
    const makeResult = (
      state: CalendarIntelligenceResult['state'],
      days: CalendarIntelligenceResult['days'],
    ): CalendarIntelligenceResult => {
      const observed = days.reduce((total, day) => total + day.observed, 0);
      const returned = days.reduce((total, day) => total + day.returned, 0);
      return {
        state,
        days,
        coverage: {
          state,
          observed,
          returned,
          selectedDays: days.length,
          maxPerDay: 8,
          maxTotal: 56,
          expectedDays: 7,
          sourceDayCount: state === 'complete' ? 7 : days.length,
          missingWeekdays: state === 'complete' ? [] : [2, 3, 4, 5, 6, 7],
          duplicateWeekdays: [],
          extraDayEnvelopes: 0,
          invalidWeekdayCount: 0,
          invalidItemWeekdayCount: 0,
          weekdayConflictCount: 0,
          missingFields: {},
          dateSemantics: 'first_air_date',
          weekdaySemantics,
        },
        source: {
          class: 'official-legacy',
          operation: 'GET /calendar',
          ...(state === 'unavailable'
            ? { attemptedAt: '2026-08-10T00:00:00.000Z' }
            : { retrievedAt: '2026-08-10T00:00:00.000Z' }),
        },
        evidence: [],
        limitations: ['air_date 表示首播日期，不是具体播出时间。'],
        warnings:
          state === 'unavailable'
            ? [{ code: 'UPSTREAM_UNAVAILABLE', state, message: '官方日历源暂时不可用。' }]
            : [],
      };
    };

    const cases: Array<[string, CalendarIntelligenceResult]> = [
      ['narrow', makeResult('partial', [makeDay(1, [makeItem(1), makeItem(2)])])],
      [
        'dense',
        makeResult(
          'complete',
          Array.from({ length: 7 }, (_, index) =>
            makeDay(index + 1, Array.from({ length: 8 }, (_, itemIndex) => makeItem(itemIndex + 1))),
          ),
        ),
      ],
      ['empty', makeResult('partial', [makeDay(1, [])])],
      ['long-CJK', makeResult('partial', [makeDay(1, [makeItem(1, true)])])],
      ['unavailable', makeResult('unavailable', [])],
    ];

    for (const [label, result] of cases) {
      const viewModel = buildCalendarIntelligenceViewModel(result);
      for (const width of [640, 960]) {
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
        });
        assertValidPng(rendered.buffer);
        expect(rendered.template, `${label} ${width}`).toBe('calendar');
        expect(rendered.width, `${label} ${width}`).toBe(width);
        expect(rendered.height, `${label} ${width}`).toBeGreaterThan(100);
      }
    }
  });

  it('R06: CJK Chinese text renders without throwing or breaking layout', async () => {
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 99,
        name: 'Traditional & Simplified CJK Test',
        nameCn: '繁體簡體中文測試：攻殻機動隊 攻壳机动队',
        type: 'anime',
        summary: '测试包含繁简中文字符的排版、换行与渲染逻辑。',
        tags: ['科幻', '攻壳', '押井守'],
      },
      source: { label: 'CJK Test' },
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
  });

  it('R07: Japanese text renders properly', async () => {
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 100,
        name: '新世紀エヴァンゲリオン',
        nameCn: '新世纪福音战士',
        type: 'anime',
        summary: '西暦2015年。第3新東京市に、さまざまな特殊能力を持つ巨大な「使徒」が襲来した。',
        tags: ['アニメ', 'エヴァ', '庵野秀明'],
      },
      source: { label: 'Japanese Test' },
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
  });

  it('R08: Font readiness verification succeeds', async () => {
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 101,
        name: 'Font Test',
        nameCn: '字体就绪测试',
        type: 'anime',
      },
      source: { label: 'Font Check' },
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);
  });

  it('PR-7D: PersonProfile renders long CJK identity, distributions, and partial-state copy', async () => {
    const profile: PersonActivityProfile = {
      person: {
        id: 10868,
        name: '水瀬いのり / 水濑祈 / Inori Minase',
        nameCn: '水濑祈',
        type: 1,
        typeLabel: '个人',
        aliases: ['いのりん', 'Inorin'],
        career: ['seiyu', 'artist', 'actor'],
        summary: '日本の声優、歌手、俳優。'.repeat(120),
        gender: '女性',
        bloodType: 1,
        birthYear: 1995,
        birthMonth: 12,
        birthDay: 2,
      },
      subjects: {
        items: Array.from({ length: 6 }, (_, index) => ({
          id: index + 1,
          name: `Very Long Japanese Title ${index + 1}`,
          nameCn: '这是一个非常长的中文条目名称用于测试移动端换行和层级',
          mediaType: 'anime' as const,
          mediaTypeCode: 2,
          staffRole: '艺术家',
        })),
        observed: 9,
        returned: 6,
        truncated: true,
      },
      characters: {
        items: Array.from({ length: 5 }, (_, index) => ({
          id: index + 101,
          name: index === 0 ? 'ネコネ' : `角色${index + 1}`,
          subjectId: index + 1,
          subjectType: 'anime' as const,
          subjectTypeCode: 2,
          subjectName: 'Very Long Japanese Title',
          subjectNameCn: '传颂之物-虚伪的假面-',
          staff: '主角',
        })),
        observed: 7,
        returned: 5,
        truncated: true,
      },
      summary: {
        uniqueSubjects: 6,
        subjectCredits: 6,
        uniqueCharacters: 5,
        characterCredits: 5,
        characterSubjects: 5,
        subjectMedia: [
          { key: 'anime', label: 'anime', count: 6, uniqueSubjects: 6, rawCodes: [2] },
        ],
        subjectRoles: [{ key: '艺术家', label: '艺术家', count: 6, uniqueSubjects: 6 }],
        characterMedia: [
          { key: 'anime', label: 'anime', count: 5, uniqueSubjects: 5, rawCodes: [2] },
        ],
        characterRoles: [{ key: '主角', label: '主角', count: 5, uniqueSubjects: 5 }],
      },
    };

    const vm: PersonProfileViewModel = buildPersonProfileViewModel(profile, {
      maxSubjectCredits: 1,
      maxCharacterCredits: 1,
      retrievedAt: '2026-08-10T00:00:00Z',
    });

    expect(vm.coverage).toMatchObject({
      state: 'partial',
      observed: 16,
      returned: 11,
      rendered: 2,
      unobserved: 5,
    });
    expect(vm.hiddenSubjectCredits).toBe(5);
    expect(vm.hiddenCharacterCredits).toBe(4);
    expect(vm.unobservedSubjectCredits).toBe(3);
    expect(vm.unobservedCharacterCredits).toBe(2);
    expect(vm.person.summaryTruncated).toBe(true);

    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 640);
    expect(html).toContain('width:640px');
    expect(html).toContain('水濑祈');
    expect(html).toContain('简介（摘要）：');
    expect(html).toContain('已观察 16 条，返回 11 条，展示 2 条');
    expect(html).toContain('另有 5 条已返回关系未展示');
    expect(html).toContain('另有 3 条关系未读取');

    const result = await renderService.renderCard(vm, { width: 640, deviceScaleFactor: 1 });
    assertValidPng(result.buffer);
    expect(result.template).toBe('person-profile');
    expect(result.width).toBe(640);
    expect(result.height).toBeGreaterThan(300);
  });
});
