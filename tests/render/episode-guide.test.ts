import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EpisodeGuideResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildEpisodeGuideViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const result: EpisodeGuideResult = {
  subjectId: 123,
  state: 'partial',
  subject: {
    id: 123,
    type: 'anime',
    name: 'Long original title',
    nameCn: '一个用于验证窄宽度换行、字段覆盖和章节层级的超长中文条目标题',
    date: '2026-04-01',
    platform: 'TV',
    episodesReported: 24,
    totalEpisodesReported: 24,
  },
  filters: { category: 'all', includeDescriptions: true },
  items: Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    subjectId: 123,
    category: index === 19 ? ('sp' as const) : ('main' as const),
    rawType: index === 19 ? 1 : 0,
    name: `Original Episode ${index + 1}`,
    nameCn: `第 ${index + 1} 集：一个很长的章节标题用于验证安全换行`,
    sort: index + 1,
    ep: index + 1,
    airdate: index === 2 ? undefined : '2026-04-01',
    discussionCount: index === 3 ? undefined : index + 1,
    duration: index === 4 ? undefined : '00:24:00',
    description: index === 5 ? undefined : '章节简介保持在安全的结构化输出中。',
  })),
  summary: {
    returned: 20,
    byCategory: { main: 19, sp: 1 },
    withAirdate: 19,
    withDuration: 19,
    withDescription: 19,
    withDiscussionCount: 19,
    empty: false,
  },
  coverage: {
    state: 'partial',
    requestedMaxEpisodes: 20,
    sourceTotal: 24,
    totalKind: 'exact',
    observedRows: 20,
    uniqueRows: 20,
    returnedRows: 20,
    sourceLimit: 20,
    sourceOffset: 0,
    truncated: true,
    duplicateRows: 0,
    missingFields: {
      'episode.airdate': 1,
      'episode.duration': 1,
      'episode.discussionCount': 1,
      'episode.description': 1,
    },
    truncatedFields: {},
    invalidFields: {},
    subject: { state: 'complete', attempted: true, retrievedAt: '2026-08-15T00:00:00.000Z' },
    episodes: { state: 'complete', attempted: true, retrievedAt: '2026-08-15T00:00:00.000Z' },
  },
  capabilityStates: { episodeProgress: 'not_computable', watchOrder: 'not_computable' },
  source: {
    class: 'official_v0',
    operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/episodes'],
    attemptedAt: '2026-08-15T00:00:00.000Z',
    retrievedAt: '2026-08-15T00:00:00.000Z',
  },
  evidence: [],
  limitations: ['章节结果是官方 v0 有界页面，不代表完整生命周期。'],
  warnings: [{ code: 'OUTPUT_TRUNCATED', state: 'partial', message: '章节达到读取上限。' }],
};

describe('episode-guide renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders complete semantic context as a zero-network image-free card', async () => {
    const viewModel = buildEpisodeGuideViewModel(result);

    expect(viewModel.template).toBe('episode-guide');
    expect(viewModel.items).toHaveLength(18);
    expect(viewModel.coverage.renderedOmitted).toBe(2);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('EPISODE GUIDE');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('有界样本');
    expect(html).toContain('一个用于验证窄宽度换行');
    expect(html).toContain('缺失字段');
    expect(html).toContain('章节进度与官方观看顺序');
    expect(html).not.toContain('https://');

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('episode-guide');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
