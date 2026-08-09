import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  PersonProfileViewModel,
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
    const vm: PersonProfileViewModel = {
      template: 'person-profile',
      version: 1,
      person: {
        id: 10868,
        name: '水瀬いのり / 水濑祈 / Inori Minase',
        career: ['seiyu', 'artist', 'actor'],
      },
      summary: {
        uniqueSubjects: 335,
        subjectCredits: 335,
        uniqueCharacters: 319,
        characterCredits: 319,
        characterSubjects: 287,
      },
      mediaBreakdown: [
        { label: 'anime', count: 217, uniqueSubjects: 217 },
        { label: 'game', count: 85, uniqueSubjects: 70 },
      ],
      roleBreakdown: [{ label: '艺术家', count: 237, uniqueSubjects: 237 }],
      characterRoleBreakdown: [
        { label: '主角', count: 156, uniqueSubjects: 120 },
        { label: '配角', count: 144, uniqueSubjects: 115 },
      ],
      subjectCredits: [
        {
          id: 1,
          name: 'Very Long Japanese Title',
          nameCn: '这是一个非常长的中文条目名称用于测试移动端换行和层级',
          role: '艺术家',
        },
      ],
      characterCredits: [
        {
          id: 2,
          name: 'ネコネ',
          role: '主角',
          subjectNameCn: '传颂之物-虚伪的假面-',
        },
      ],
      hiddenSubjectCredits: 327,
      hiddenCharacterCredits: 311,
      coverage: { state: 'partial', observed: 654, returned: 654 },
      limitations: [
        '关系接口没有作品日期，因此不能从此卡片推断最近活动或时间窗口工作量。',
        '没有历史快照，因此不显示增长或趋势结论。',
      ],
      source: { label: 'Bangumi v0 · PersonProfile', retrievedAt: '2026-08-10T00:00:00Z' },
    };

    const result = await renderService.renderCard(vm);
    assertValidPng(result.buffer);
    expect(result.template).toBe('person-profile');
    expect(result.height).toBeGreaterThan(300);
  });
});
