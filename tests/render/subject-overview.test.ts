import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
        actorCoverage: { observed: 1, returned: 1, truncated: false },
      })),
      coverage: { state: 'complete', observed: 8, returned: 8, truncated: false },
      actorCoverage: { observed: 8, returned: 8, truncated: false },
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
      actorLimits: { perCharacter: 4, total: 32 },
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
      { code: 'SECOND_WARNING', state: 'partial', message: '第二条警告。' },
      { code: 'THIRD_WARNING', state: 'partial', message: '第三条警告。' },
      { code: 'FOURTH_WARNING', state: 'partial', message: '第四条警告。' },
      { code: 'FIFTH_WARNING', state: 'partial', message: '第五条警告。' },
      { code: 'SIXTH_WARNING', state: 'partial', message: '第六条警告。' },
    ],
    limitations: [
      '这是有界官方 v0 观察，不宣称完整职员表。',
      '第二条限制。',
      '第三条限制。',
      '第四条限制。',
      '第五条限制。',
    ],
  };
}

function completeFixture(): SubjectOverviewResult {
  const base = fixture('complete');
  return {
    ...base,
    cast: {
      ...base.cast,
      state: 'complete',
      coverage: { ...base.cast.coverage, state: 'complete', truncated: false },
    },
    staff: {
      ...base.staff,
      state: 'complete',
      coverage: { ...base.staff.coverage, state: 'complete', truncated: false },
    },
    coverage: { ...base.coverage, sectionsComplete: 4, sectionsPartial: 0, truncatedSections: [] },
    warnings: [],
    limitations: ['这是有界官方 v0 观察，不宣称完整历史。'],
  };
}

function degradedFixture(state: 'unavailable' | 'not_found'): SubjectOverviewResult {
  const base = fixture(state);
  return {
    ...base,
    subject: undefined,
    stats: {
      state: 'unavailable',
      coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
    },
    cast: {
      state: 'unavailable',
      items: [],
      coverage: { state: 'unavailable', observed: 0, returned: 0, truncated: false },
      actorCoverage: { observed: 0, returned: 0, truncated: false },
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
    coverage: {
      ...base.coverage,
      sectionsComplete: 0,
      sectionsPartial: 0,
      sectionsUnavailable: 4,
      truncatedSections: [],
    },
    evidence: [
      {
        source: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}',
        attemptedAt: '2026-08-14T00:00:00Z',
      },
    ],
    warnings: [
      {
        code: state === 'not_found' ? 'UPSTREAM_NOT_FOUND' : 'UPSTREAM_SUBJECT_UNAVAILABLE',
        state,
        message: state === 'not_found' ? '条目不存在。' : '条目详情暂不可用。',
      },
    ],
    limitations: ['未请求其他区段，未对缺失内容做猜测。'],
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
    expect(html).toContain('另有 2 条警告未展示');
    expect(html).toContain('另有 2 条限制未展示');

    const unavailable = buildSubjectOverviewViewModel(degradedFixture('unavailable'));
    expect(renderHtmlTemplate(unavailable, 'bangumi-light', {}, 960)).toContain('不可用');
    const notFound = buildSubjectOverviewViewModel(degradedFixture('not_found'));
    expect(renderHtmlTemplate(notFound, 'bangumi-light', {}, 960)).toContain('未找到');
  });

  it('renders complete, partial, unavailable, and not-found PNGs at both representative widths', async () => {
    const variants = {
      complete: completeFixture(),
      partial: fixture('partial'),
      unavailable: degradedFixture('unavailable'),
      notFound: degradedFixture('not_found'),
    };
    const visualQaDir = process.env.SUBJECT_OVERVIEW_VISUAL_QA_DIR;
    if (visualQaDir) await mkdir(visualQaDir, { recursive: true });
    for (const [name, result] of Object.entries(variants)) {
      const vm = buildSubjectOverviewViewModel(result);
      for (const width of [640, 960]) {
        const rendered = await renderService.renderCard(vm, { width });
        expect(rendered.template, `${name} template`).toBe('subject-overview');
        expect(rendered.width, `${name} width`).toBe(width * 2);
        expect(rendered.buffer.subarray(0, 8).equals(PNG_MAGIC), `${name} PNG`).toBe(true);
        expect(rendered.buffer.length, `${name} bytes`).toBeGreaterThan(1000);
        if (visualQaDir) {
          await writeFile(
            path.join(visualQaDir, `subject-overview-${name}-${width}.png`),
            rendered.buffer,
          );
        }
      }
    }
  });
});
