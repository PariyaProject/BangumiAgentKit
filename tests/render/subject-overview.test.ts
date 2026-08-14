import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildSubjectOverviewViewModel,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import type { SubjectOverviewResult } from '@bangumi-agent-kit/bangumi-core';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fixture(state: SubjectOverviewResult['state'] = 'complete'): SubjectOverviewResult {
  return {
    state,
    subjectId: 123,
    subject: {
      id: 123,
      type: 'anime',
      name: '少女終末旅行',
      nameCn: '少女终末旅行',
      summary: '一个用于检查长文本、统计、角色、职员和关系布局的渲染 fixture。',
      nsfw: false,
      locked: false,
      date: '2017-10-06',
      platform: 'TV',
      images: { common: 'https://example.test/cover.png' },
      score: 8.6,
      rank: 42,
      eps: 12,
      totalEpisodes: 12,
    },
    stats: {
      state: 'complete',
      data: {
        score: 8.6,
        rank: 42,
        ratingTotal: 100,
        ratingHistogram: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
        collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
      },
      coverage: { state: 'complete', observed: 1, returned: 1, truncated: false },
    },
    cast: {
      state: 'complete',
      items: Array.from({ length: 8 }, (_, index) => ({
        character: {
          id: index + 1,
          name: `非常に長い角色名称 ${index + 1} チトとユーリの旅路`,
          type: 1,
          images: {},
        },
        relation: index % 2 === 0 ? '主角' : '配角',
        actors: [
          { id: index + 101, name: `声优 ${index + 1}`, career: ['seiyu'], image: undefined },
        ],
      })),
      coverage: { state: 'complete', observed: 8, returned: 8, truncated: false },
    },
    staff: {
      state: 'partial',
      items: Array.from({ length: 10 }, (_, index) => ({
        id: index + 201,
        name: `制作人员 ${index + 1}`,
        type: 1,
        career: [],
        relation: index % 2 === 0 ? '导演' : '作画监督',
        rawRelation: index % 2 === 0 ? '导演' : '作画监督',
        eps: '',
        images: {},
      })),
      groups: [
        { relation: '导演', count: 5, memberIds: [201, 203, 205, 207, 209] },
        { relation: '作画监督', count: 5, memberIds: [202, 204, 206, 208, 210] },
      ],
      coverage: { state: 'partial', observed: 12, returned: 10, truncated: true },
    },
    relations: {
      state: 'complete',
      items: Array.from({ length: 9 }, (_, index) => ({
        id: index + 301,
        type: index % 2 === 0 ? 'anime' : 'book',
        name: `Related Original Title ${index + 1}`,
        nameCn: `关联作品 ${index + 1}`,
        relation: index % 2 === 0 ? '续集' : '原作',
        images: {},
      })),
      coverage: { state: 'complete', observed: 9, returned: 9, truncated: false },
    },
    coverage: {
      sourceRequestsAttempted: 5,
      sourceRequestsSucceeded: 5,
      sectionsComplete: 3,
      sectionsPartial: 1,
      sectionsUnavailable: 0,
      sectionsNotComputable: 0,
      truncatedSections: ['staff'],
      limits: { maxCast: 8, maxStaff: 24, maxRelations: 12 },
    },
    evidence: [
      {
        source: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}',
        retrievedAt: '2026-08-14T00:00:00Z',
      },
      { source: 'derived-s7', operation: 'getSubjectStats', retrievedAt: '2026-08-14T00:00:00Z' },
    ],
    warnings: [
      {
        code: 'STAFF_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'staff',
        message: '职员达到上限。',
      },
    ],
    limitations: ['这是有界官方 v0 观察，不宣称完整职员表。'],
  };
}

describe('Subject Overview renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('builds a bounded semantic ViewModel and preserves degraded states in HTML', () => {
    const vm = buildSubjectOverviewViewModel(fixture());
    expect(vm.template).toBe('subject-overview');
    expect(vm.cast.items).toHaveLength(6);
    expect(vm.staff.groups).toHaveLength(2);
    expect(vm.relations.items).toHaveLength(8);
    expect(vm.staff.hiddenCount).toBeGreaterThan(0);

    const html = renderHtmlTemplate(vm, 'bangumi-dark', {}, 640);
    expect(html).toContain('少女终末旅行');
    expect(html).toContain('评分与收藏统计');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('STAFF_OUTPUT_TRUNCATED');
    expect(html).toContain('限制：这是有界官方 v0 观察');

    const unavailable = buildSubjectOverviewViewModel({
      ...fixture('unavailable'),
      subject: undefined,
      stats: {
        state: 'unavailable',
        coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
      },
      cast: {
        state: 'unavailable',
        items: [],
        coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
      },
      staff: {
        state: 'unavailable',
        items: [],
        groups: [],
        coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
      },
      relations: {
        state: 'unavailable',
        items: [],
        coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
      },
    });
    expect(renderHtmlTemplate(unavailable, 'bangumi-light', {}, 960)).toContain('不可用');
  });

  it('renders a valid PNG at the narrow representative width', async () => {
    const vm = buildSubjectOverviewViewModel(fixture());
    const result = await renderService.renderCard(vm, { width: 640 });
    expect(result.template).toBe('subject-overview');
    expect(result.width).toBe(1280);
    expect(result.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(1000);
  });
});
