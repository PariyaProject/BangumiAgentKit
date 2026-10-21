import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  buildSubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  buildCalendarIntelligenceViewModel,
  buildRevisionTimelineViewModel,
  PersonProfileViewModel,
  buildPersonProfileViewModel,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import type {
  CalendarIntelligenceResult,
  RevisionIntelligenceResult,
  PersonActivityProfile,
} from '@bangumi-agent-kit/bangumi-core';
import { measureRenderRootLayout } from './helpers/mobile-layout.js';

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

  it('keeps authenticated subject progress explicit and omits percentages for invalid totals', () => {
    const subject = {
      id: 990,
      name: '星港纪行',
      nameCn: '星港纪行',
      type: 'anime' as const,
      summary: '',
      nsfw: false,
      locked: false,
      eps: 12,
      totalEpisodes: 12,
    };
    const viewModel = buildSubjectCardViewModel(subject, {
      collection: {
        status: 'do',
        statusLabel: '在看',
        watchedEpisodes: 9,
        totalEpisodes: 12,
      },
    });
    const html = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320);

    expect(viewModel.collection).toMatchObject({
      episodeProgress: '已看 9 / 12 集',
      progressPercentage: 75,
    });
    expect(html).toContain('data-layout="subject-progress-track"');
    expect(html).toContain('aria-valuenow="75"');

    const invalid = buildSubjectCardViewModel(subject, {
      collection: {
        status: 'do',
        watchedEpisodes: 13,
        totalEpisodes: 12,
      },
    });
    expect(invalid.collection?.progressPercentage).toBeUndefined();
    expect(renderHtmlTemplate(invalid, 'bangumi-light', {}, 320)).not.toContain(
      'data-layout="subject-progress-track"',
    );
  });

  it('gives each subject-card pack its own reference-led hierarchy', async () => {
    const viewModel: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 902025,
        name: 'Star Harbor Journey',
        nameCn: '星港纪行',
        type: 'anime',
        date: '2025',
        image: 'data:image/svg+xml;base64,PHN2Zy8+',
        score: 8.4,
        tags: ['科幻', '冒险'],
      },
      collection: {
        status: 'do',
        statusLabel: '在看',
        episodeProgress: '9 / 12 集',
        progressPercentage: 75,
      },
      source: { label: '合成演示数据' },
    };

    const warm = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 640, 'warm-editorial');
    expect(warm).toContain('data-layout="warm-score-progress-hero"');
    expect(warm).toContain('data-score-size="hero"');
    expect(warm.match(/data-layout="subject-cover-artwork"/gu)).toHaveLength(1);
    expect(warm).not.toContain('data-layout="subject-cover-poster"');
    const warmMobile = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320, 'warm-editorial');
    const warmMobileLayout = await measureRenderRootLayout(warmMobile, 320);
    const warmMobileScore = warmMobileLayout.layoutElements.find(
      (element) => element.layout === 'score-value',
    );
    expect(warmMobile).toContain('font-size:27px');
    expect(warmMobileScore).toBeDefined();
    expect(warmMobileScore!.height).toBeLessThanOrEqual(55);
    expect(warmMobileLayout.overflowing).toEqual([]);
    expect(warmMobileLayout.contentOverflowing).toEqual([]);

    const longTitleGalleryViewModel: SubjectCardViewModel = {
      ...viewModel,
      subject: {
        ...viewModel.subject,
        name: 'ぼっち・ざ・ろっく！',
        nameCn: '孤独摇滚！',
        rank: 73,
      },
    };
    const gallery = renderHtmlTemplate(
      longTitleGalleryViewModel,
      'bangumi-light',
      {},
      320,
      'clean-gallery',
    );
    expect(gallery.indexOf('data-layout="gallery-category-header"')).toBeLessThan(
      gallery.indexOf('data-layout="subject-cover-art-stage"'),
    );
    expect(gallery).toContain('data-layout="gallery-title-score-row"');
    expect(gallery).toContain('data-layout="gallery-subject-details"');
    const galleryDate = renderHtmlTemplate(
      {
        ...longTitleGalleryViewModel,
        subject: { ...longTitleGalleryViewModel.subject, date: '1998-04-03' },
      },
      'bangumi-light',
      {},
      320,
      'clean-gallery',
    );
    expect(galleryDate).toContain('data-layout="gallery-subject-date-label"');
    expect(galleryDate).toContain('data-layout="gallery-subject-date-value"');
    expect(galleryDate).toContain('1998-04-03');
    for (const width of [320, 360, 520]) {
      const html = renderHtmlTemplate(
        {
          ...longTitleGalleryViewModel,
          subject: { ...longTitleGalleryViewModel.subject, date: '1998-04-03' },
        },
        'bangumi-light',
        {},
        width,
        'clean-gallery',
      );
      const layout = await measureRenderRootLayout(html, width);
      const label = layout.layoutElements.find(
        (element) => element.layout === 'gallery-subject-date-label',
      );
      const date = layout.layoutElements.find(
        (element) => element.layout === 'gallery-subject-date-value',
      );
      expect(label, `date label at ${width}px`).toBeDefined();
      expect(date, `date value at ${width}px`).toBeDefined();
      expect(Math.abs(label!.top - date!.top), `date row at ${width}px`).toBeLessThanOrEqual(1);
      expect(layout.overflowing, `date row overflow at ${width}px`).toEqual([]);
    }
    const warmDate = renderHtmlTemplate(
      {
        ...longTitleGalleryViewModel,
        subject: { ...longTitleGalleryViewModel.subject, date: '1998-04-03' },
      },
      'bangumi-light',
      {},
      320,
      'warm-editorial',
    );
    expect(warmDate).toContain('data-layout="no-wrap-metadata-item"');
    expect(warmDate).toContain('1998-04-03');
    expect(gallery).not.toContain('BANGUMI · 条目档案');
    expect(gallery).toContain('data-layout="subject-cover-artwork"');
    expect(gallery.match(/data-layout="subject-cover-artwork"/gu)).toHaveLength(1);
    expect(gallery).toContain('演示数据');
    expect(gallery).toContain('grid-template-columns:minmax(0, 1fr)');
    expect(gallery).not.toContain('data-layout="subject-cover-poster"');
    const galleryWide = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 960, 'clean-gallery');
    expect(galleryWide).toContain('font-size:57px');

    const zine = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320, 'graphic-zine');
    expect(zine).toContain('data-layout="zine-subject-title-overlay"');
    expect(zine).toContain('data-title-eyebrow-backplate="true"');
    expect(zine).toContain('条目档案');
    expect(zine).not.toContain('BANGUMI · 条目档案');
    expect(zine).toContain('data-layout="zine-score-progress-hero"');
    expect(zine).toContain('综合评分');
    expect(zine.match(/data-layout="subject-cover-artwork"/gu)).toHaveLength(1);
    expect(zine).not.toContain('data-layout="subject-cover-poster"');

    const zineNoCover = renderHtmlTemplate(
      { ...viewModel, subject: { ...viewModel.subject, image: undefined } },
      'bangumi-light',
      {},
      320,
      'graphic-zine',
    );
    expect(zineNoCover).toContain('data-cover-placeholder="poster"');
    const zineNoCoverLayout = await measureRenderRootLayout(zineNoCover, 320);
    expect(
      zineNoCoverLayout.contentOverflowing.filter(
        (item) => item.layoutContext === 'graphic-zine-cover-hero',
      ),
    ).toEqual([]);

    const zineMobileLayout = await measureRenderRootLayout(zine, 320);
    const zineMobileScore = zineMobileLayout.layoutElements.find(
      (element) => element.layout === 'score-value',
    );
    expect(zineMobileScore).toBeDefined();
    expect(zineMobileScore!.height).toBeLessThanOrEqual(80);
    expect(
      zineMobileLayout.contentOverflowing.filter(
        (item) => item.layoutContext === 'zine-score-progress-hero',
      ),
    ).toEqual([]);
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

    const mobileResult = await renderService.renderCard(vm, {
      width: 360,
      deviceScaleFactor: 2,
    });
    assertValidPng(mobileResult.buffer);
    expect(mobileResult.width).toBe(720);
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
            makeDay(
              index + 1,
              Array.from({ length: 8 }, (_, itemIndex) => makeItem(itemIndex + 1)),
            ),
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

  it('PR-7F: Revision timeline renders complete, partial, empty, long-CJK, and unavailable at 640/960', async () => {
    const makeResult = (
      state: RevisionIntelligenceResult['state'],
      items: RevisionIntelligenceResult['items'],
      total = items.length,
    ): RevisionIntelligenceResult => {
      const missingFields: Record<string, number> =
        items.length > 1 ? { 'revision.summary': 1 } : {};
      const truncated = total > items.length;
      const partial = state === 'partial';
      return {
        state,
        entityType: 'subject',
        entityId: 218707,
        items,
        coverage: {
          state,
          observed: items.length,
          returned: items.length,
          total,
          totalKind: state === 'unavailable' ? 'estimated' : 'exact',
          limit: 10,
          offset: 0,
          truncated,
          missingFields,
          truncatedFields: {},
        },
        capabilityStates: { historical_growth: 'not_computable' },
        source: {
          class: 'official-v0',
          operation: 'GET /v0/revisions/subjects',
          ...(state === 'unavailable'
            ? { attemptedAt: '2026-08-10T00:00:00.000Z' }
            : { retrievedAt: '2026-08-10T00:00:00.000Z' }),
        },
        evidence: [],
        limitations: ['当前仅代表官方有界修订页面。'],
        warnings: [
          ...(partial
            ? [{ code: 'OUTPUT_TRUNCATED', state: 'partial' as const, message: '有界样本。' }]
            : []),
          ...(state === 'unavailable'
            ? [
                {
                  code: 'UPSTREAM_UNAVAILABLE',
                  state: 'unavailable' as const,
                  message: '官方修订源暂时不可用。',
                },
              ]
            : []),
        ],
      };
    };

    const cases: Array<[string, RevisionIntelligenceResult]> = [
      [
        'complete',
        makeResult('complete', [
          {
            id: 1,
            type: 1,
            summary: '修改条目中文名',
            createdAt: '2026-08-01T00:00:00Z',
            creator: { username: 'editor', nickname: '编辑者' },
          },
        ]),
      ],
      [
        'partial-long-CJK',
        makeResult(
          'partial',
          [
            {
              id: 2,
              type: 1,
              summary: `修改简介：${'这是一个很长的繁體簡體中文修订摘要，用于测试移动端换行。'.repeat(8)} <script>no-html</script>`,
              createdAt: '2026-08-02T00:00:00Z',
            },
            { id: 3, type: 2 },
          ],
          10,
        ),
      ],
      ['empty', makeResult('complete', [], 0)],
      ['unavailable', makeResult('unavailable', [], 0)],
    ];

    const formattedDateHtml = renderHtmlTemplate(
      buildRevisionTimelineViewModel(cases[0]![1]),
      'bangumi-light',
      {},
      320,
    );
    expect(formattedDateHtml).toContain('2026-08-01');
    expect(formattedDateHtml).not.toContain('2026-08-01T00:00:00Z');
    expect(formattedDateHtml).toContain('获取于 2026-08-10 00:00 UTC');
    expect(formattedDateHtml).not.toContain('2026-08-10T00:00:00.000Z');

    for (const [label, result] of cases) {
      const viewModel = buildRevisionTimelineViewModel(result);
      for (const width of [640, 960]) {
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
        });
        assertValidPng(rendered.buffer);
        expect(rendered.template, `${label} ${width}`).toBe('revision-timeline');
        expect(rendered.width, `${label} ${width}`).toBe(width);
        expect(rendered.height, `${label} ${width}`).toBeGreaterThan(100);
      }
    }

    const longSummaryVm = buildRevisionTimelineViewModel(cases[1]![1]);
    const longSummaryHtml = renderHtmlTemplate(longSummaryVm, 'bangumi-light', {}, 320);
    expect(longSummaryHtml).toContain('摘要节选 · 前 72 字符');
    expect(longSummaryHtml).not.toContain('摘要节选 · 前 160 字符');
    expect(longSummaryHtml).toContain('font-size:9.75px');
    expect(longSummaryHtml).toContain('图片显示 2 条');
    for (const width of [320, 360, 520]) {
      for (const pack of ['warm-editorial', 'clean-gallery', 'graphic-zine'] as const) {
        const coverageHtml = renderHtmlTemplate(longSummaryVm, 'bangumi-light', {}, width, pack);
        const coverageLayout = await measureRenderRootLayout(coverageHtml, width);
        const coverageItems = coverageLayout.layoutElements.filter(
          (element) => element.layout === 'timeline-coverage-item',
        );
        expect(coverageItems, `${pack} coverage items at ${width}px`).toHaveLength(
          4 + (longSummaryVm.coverage.truncated ? 1 : 0),
        );
        expect(
          coverageItems.map((item) => item.text),
          `${pack} keeps total count with its label at ${width}px`,
        ).toContain('总数 10');
        expect(
          coverageItems.every((element) => element.height <= 25),
          `${pack} coverage chips should stay on one line at ${width}px`,
        ).toBe(true);
        expect(coverageLayout.overflowing, `${pack} coverage overflow at ${width}px`).toEqual([]);
      }
    }
    expect(longSummaryHtml).toContain('data-tone="indigo"');
    expect(longSummaryHtml).toContain('data-tone="coral"');

    const typedVm = structuredClone(longSummaryVm);
    const firstRevision = typedVm.items[0];
    expect(firstRevision).toBeDefined();
    typedVm.items = [
      { ...firstRevision!, id: firstRevision!.id + 100_000, type: 103 },
      { ...firstRevision!, id: firstRevision!.id + 100_001, type: 999 },
    ];
    const typedHtml = renderHtmlTemplate(typedVm, 'bangumi-light', {}, 320);
    expect(typedHtml).toContain('data-layout="timeline-event-marker"');
    expect(typedHtml).toContain('条目锁定 · 类型 103');
    expect(typedHtml).toContain('未分类修订类型 · 类型 999');
    expect(typedHtml).toContain('data-tone="indigo"');
    for (const width of [320, 360, 520]) {
      for (const pack of ['warm-editorial', 'clean-gallery', 'graphic-zine'] as const) {
        const html = renderHtmlTemplate(typedVm, 'bangumi-light', {}, width, pack);
        const layout = await measureRenderRootLayout(html, width);
        const metaItems = layout.layoutElements.filter(
          (element) => element.layout === 'timeline-event-meta-item',
        );
        expect(metaItems, `${pack} event metadata at ${width}px`).toHaveLength(4);
        expect(
          metaItems.every((element) => element.height <= 25),
          `${pack} event ID metadata should stay on one line at ${width}px`,
        ).toBe(true);
        expect(layout.overflowing).toEqual([]);
      }
    }

    const zineHtml = renderHtmlTemplate(typedVm, 'bangumi-light', {}, 320, 'graphic-zine');
    expect(zineHtml).toContain('data-render-pack="graphic-zine"');
    expect(zineHtml).toContain('data-timeline-pack="graphic-zine"');

    const partialVm = buildRevisionTimelineViewModel(
      makeResult(
        'partial',
        [
          {
            id: 4,
            type: 1,
            summary: '<script>no-html</script>',
          },
        ],
        2,
      ),
    );
    const html = renderHtmlTemplate(partialVm, 'bangumi-dark', {}, 640);
    expect(html).toContain('data-layout="timeline-rail"');
    expect(html).toContain('aria-label="Bangumi 修订记录时间线"');
    expect(html).toContain('&lt;script&gt;no-html&lt;/script&gt;');
    expect(html).toContain('历史增长趋势：当前源不支持计算');
  }, 20_000);

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
        items: Array.from({ length: 6 }, (_, index) => {
          const name = `Very Long Japanese Title ${index + 1}`;
          const sourceTitle = '这是一个非常长的中文条目名称用于测试移动端换行和层级';
          const nameCnSource =
            index === 1 ? name : index === 2 ? '' : index === 3 ? null : sourceTitle;
          return {
            id: index + 1,
            name,
            nameCn:
              typeof nameCnSource === 'string' && nameCnSource.length > 0 ? nameCnSource : name,
            nameCnSource,
            mediaType: 'anime' as const,
            mediaTypeCode: 2,
            staffRole: '艺术家',
          };
        }),
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
      releaseChronology: {
        state: 'partial',
        sourceCompleteness: 'undocumented',
        dateSemantics: 'official-subject-air-release-date',
        samplingStrategy: 'evenly-spaced-returned-anime-relations',
        relationRowsObserved: 9,
        relationRowsReturned: 6,
        relationRowsTruncated: true,
        animeRelationRowsReturned: 6,
        uniqueAnimeSubjects: 6,
        selectedSubjectIds: [1, 2, 3],
        selectedSubjectDetails: 3,
        succeededSubjectDetails: 3,
        failedSubjectDetails: 0,
        validDateSubjects: 3,
        missingDateSubjects: 0,
        invalidDateSubjects: 0,
        omittedAnimeSubjects: 3,
        maxConcurrency: 4,
        responseByteLimit: 1_048_576,
        earliestObserved: {
          date: '2000-01-01',
          subjects: [
            { id: 1, name: 'Very Long Japanese Title 1' },
            { id: 2, name: 'Very Long Japanese Title 2' },
          ],
        },
        latestObserved: {
          date: '2025-10-01',
          subjects: [{ id: 3, name: 'Very Long Japanese Title 3' }],
        },
        limitations: [
          '极值只代表本次采样到的动画条目官方 subject.date；官方字段语义是播出/发行日期，不代表人物实际参与或工作的日期。',
          '人物作品关系接口未声明顺序、总数、分页或完整性；本次样本不能代表完整人物生涯。',
        ],
      },
    };

    const vm: PersonProfileViewModel = buildPersonProfileViewModel(profile, {
      maxSubjectCredits: 4,
      maxCharacterCredits: 1,
      retrievedAt: '2026-08-10T00:00:00Z',
    });

    expect(vm.coverage).toMatchObject({
      state: 'partial',
      observed: 16,
      returned: 11,
      rendered: 5,
      unobserved: 5,
    });
    expect(vm.hiddenSubjectCredits).toBe(2);
    expect(vm.hiddenCharacterCredits).toBe(4);
    expect(vm.unobservedSubjectCredits).toBe(3);
    expect(vm.unobservedCharacterCredits).toBe(2);
    expect(vm.person.summaryTruncated).toBe(true);
    expect(vm.releaseChronology?.earliestObserved).toMatchObject({
      date: '2000-01-01',
      subjects: [
        { id: 1, name: 'Very Long Japanese Title 1' },
        { id: 2, name: 'Very Long Japanese Title 2' },
      ],
    });

    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 640);
    expect(html).toContain('width:640px');
    expect(html).toContain('水濑祈');
    expect(html).toContain('简介（摘要）：');
    expect(html).toContain('动画播出/发行日期观察（受限样本）');
    expect(html).toContain('本次样本中最早日期：2000-01-01');
    expect(html).toContain('Very Long Japanese Title 1 (#1)');
    expect(html).toContain('已观察 16 条，返回 11 条，展示 5 条');
    expect(html).toContain('上游未说明作品关系是否完整');
    expect(html).toContain('上游已提供中文名（与原名相同）');
    expect(html).toContain('上游中文名字段为空');
    expect(html).toContain('本次没有可用的中文名字段（缺失或值无效）');
    expect(html).toContain('另有 2 条已返回关系未展示');
    expect(html).toContain('另有 3 条关系未读取');
    expect(html).toContain('人物编号 10868');
    expect(html).not.toContain('Person ID:');
    expect(html).toContain('Bangumi 官方 v0 · 人物资料');
    expect(html).not.toContain('person.birth_year');

    const result = await renderService.renderCard(vm, { width: 640, deviceScaleFactor: 1 });
    assertValidPng(result.buffer);
    expect(result.template).toBe('person-profile');
    expect(result.width).toBe(640);
    expect(result.height).toBeGreaterThan(300);

    for (const width of [320, 360, 520]) {
      const mobileHtml = renderHtmlTemplate(vm, 'bangumi-dark', {}, width);
      const mobileLayout = await measureRenderRootLayout(mobileHtml, width);
      expect(mobileLayout).toMatchObject({ clientWidth: width, scrollWidth: width });
    }

    const mobileResult = await renderService.renderCard(vm, {
      width: 360,
      deviceScaleFactor: 2,
    });
    assertValidPng(mobileResult.buffer);
    expect(mobileResult.width).toBe(720);
    expect(mobileResult.height).toBeLessThanOrEqual(8192);
    expect(mobileResult.buffer.length).toBeLessThan(5_000_000);
  });

  it('localizes profile labels and keeps sparse synthetic data inside 320px', async () => {
    const vm = {
      template: 'person-profile',
      version: 1,
      state: 'partial',
      person: {
        id: 990602,
        name: '合成声优人物の日本語名 990602',
        nameCn: '合成声优人员 990602（长标题换行检查）',
        career: ['voice actor'],
        summary: '仅供离线验收的合成资料；用于检查中文、日文混排、长文本换行和摘要截断。'.repeat(8),
        gender: 'unknown',
        bloodType: null,
        identityMissingFields: ['person.birth_year', 'person.blood_type'],
      },
      summary: {
        uniqueSubjects: 1,
        subjectCredits: 1,
        uniqueCharacters: 1,
        characterCredits: 1,
        characterSubjects: 1,
      },
      mediaBreakdown: [{ label: 'anime', count: 1, uniqueSubjects: 1, rawCodes: [2] }],
      characterMediaBreakdown: [{ label: 'anime', count: 1, uniqueSubjects: 1, rawCodes: [2] }],
      roleBreakdown: [{ label: 'voice actor', count: 1, uniqueSubjects: 1 }],
      characterRoleBreakdown: [{ label: 'main', count: 1, uniqueSubjects: 1 }],
      subjectCredits: [
        {
          id: 990604,
          name: '合成作品の日本語原名 990604',
          nameCn: '合成作品：一个很长的中文条目标题用于移动端换行检查',
          nameCnSource: '合成作品：一个很长的中文条目标题用于移动端换行检查',
          role: 'voice actor',
        },
      ],
      characterCredits: [
        {
          id: 990605,
          name: '合成角色の長い日本語名',
          role: 'main',
          subjectNameCn: '合成作品：一个很长的中文条目标题用于移动端换行检查',
        },
      ],
      coverage: { state: 'partial', observed: 2, returned: 2, rendered: 2, unobserved: 0 },
      limitations: ['作品和角色关系只代表接口返回样本；上游没有提供总数、分页或完整性承诺。'],
      warnings: [
        {
          code: 'MISSING_IDENTITY_FIELDS',
          state: 'partial',
          message: '身份字段缺失：person.birth_year、person.blood_type',
        },
        {
          code: 'NOT_COMPUTABLE',
          state: 'not_computable',
          message: '不可计算：最近活动、声优工作量时间窗口',
        },
      ],
      source: { label: 'Bangumi 官方 v0 · 人物资料', retrievedAt: '2026-10-18T05:30:00Z' },
    } as unknown as PersonProfileViewModel;

    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 320);
    expect(html).toContain('人物编号 990602');
    expect(html).toContain('合成声优人员 990602（长标题换行检查）');
    expect(html).toContain('合成声优人物の日本語名 990602');
    expect(html).not.toContain('Synthetic');
    expect(html).toContain('声优');
    expect(html).toContain('动画');
    expect(html).toContain('主役');
    expect(html).toContain('官方类型码：2');
    expect(html).not.toContain('Person ID:');
    expect(html).not.toContain('voice actor');
    expect(html).not.toContain('>anime<');
    expect(html).not.toContain('(null)');
    expect(html).not.toContain('person.birth_year');

    const layout = await measureRenderRootLayout(html, 320);
    expect(layout).toMatchObject({ clientWidth: 320, scrollWidth: 320 });

    const result = await renderService.renderCard(vm, { width: 320, deviceScaleFactor: 1 });
    assertValidPng(result.buffer);
    expect(result.width).toBe(320);
  });

  it('keeps version-1 person profile coverage compatible with existing fields', () => {
    const coverage: PersonProfileViewModel['coverage'] = {
      state: 'complete',
      observed: 4,
      returned: 4,
      rendered: 4,
      unobserved: 0,
    };

    expect(coverage).toEqual({
      state: 'complete',
      observed: 4,
      returned: 4,
      rendered: 4,
      unobserved: 0,
    });
  });
});
