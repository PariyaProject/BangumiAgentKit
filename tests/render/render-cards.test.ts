import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
} from '@bangumi-agent-kit/renderer';

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
    const vm: CalendarViewModel = {
      template: 'calendar',
      version: 1,
      days: [
        {
          weekdayCn: '星期六',
          items: [
            { id: 100, name: 'Anime 1', nameCn: '动画1', score: 8.4 },
            { id: 101, name: 'Anime 2', nameCn: '动画2', score: 7.9 },
          ],
        },
      ],
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.template).toBe('calendar');
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
});
