import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EpisodeIntegrityResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildEpisodeIntegrityViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const result: EpisodeIntegrityResult = {
  subjectId: 123,
  state: 'conflict',
  subject: {
    id: 123,
    type: 'anime',
    name: 'Long original title',
    nameCn: '一个用于验证章节完整性密集卡片换行的超长中文条目标题',
    episodesReported: 12,
    totalEpisodesReported: 13,
  },
  filters: { category: 'all', includeDescriptions: false },
  items: [
    {
      id: 1,
      subjectId: 123,
      category: 'main',
      rawType: 0,
      name: 'Episode 1',
      nameCn: '第一集',
      sort: 1,
      ep: 1,
      airdate: '2026-04-01',
      duration: '00:24:00',
    },
    {
      id: 2,
      subjectId: 123,
      category: 'sp',
      rawType: 1,
      name: 'Special',
      nameCn: '特别篇',
      sort: 1,
      airdate: '2026-04-02',
      duration: '00:12:00',
    },
  ],
  summary: {
    returned: 2,
    byCategory: { main: 1, sp: 1 },
    withAirdate: 2,
    withDuration: 2,
    withDescription: 0,
    withDiscussionCount: 0,
    empty: false,
  },
  asOf: { date: '2026-04-03', source: 'explicit', retrievedAt: '2026-04-03T00:00:00.000Z' },
  integrity: {
    state: 'conflict',
    formulaVersion: 'episode-integrity-v1',
    counts: {
      observedRows: 2,
      uniqueRows: 2,
      returnedRows: 2,
      main: 1,
      special: 1,
      airedMain: 1,
      futureMain: 0,
      mainWithValidAirdate: 1,
      mainWithUnknownAirdate: 0,
      byCategory: { main: 1, sp: 1 },
    },
    subjectTotals: { episodesReported: 12, totalEpisodesReported: 13 },
    checks: {
      reportedVsDatabase: {
        state: 'conflict',
        left: 12,
        right: 13,
        difference: -1,
        reason: 'source conflict',
      },
      reportedVsObservedMain: {
        state: 'partial',
        left: 12,
        right: 1,
        difference: 11,
        reason: 'bounded',
      },
      databaseVsObservedMain: {
        state: 'partial',
        left: 13,
        right: 1,
        difference: 12,
        reason: 'bounded',
      },
      reportedVsAiredMain: {
        state: 'partial',
        left: 12,
        right: 1,
        difference: 11,
        reason: 'bounded',
      },
    },
    dateCoverage: {
      asOfDate: '2026-04-03',
      observedRows: 2,
      uniqueRows: 2,
      returnedRows: 2,
      validRows: 2,
      airedRows: 2,
      futureRows: 0,
      missingRows: 0,
      invalidRows: 0,
      unknownRows: 0,
    },
    anomalies: {
      duplicateEpisodeIds: 0,
      duplicateAirdateConflicts: 0,
      duplicateLogicalKeys: 0,
      airdateConflictGroups: 1,
      nonMonotonicMainAirdates: 0,
      missingAirdates: 0,
      invalidAirdates: 0,
    },
  },
  coverage: {
    state: 'conflict',
    episodeGuide: {
      state: 'partial',
      requestedMaxEpisodes: 2,
      sourceTotal: 4,
      totalKind: 'exact',
      observedRows: 2,
      uniqueRows: 2,
      returnedRows: 2,
      sourceLimit: 2,
      sourceOffset: 0,
      truncated: true,
      duplicateRows: 0,
      overReturnedRows: 0,
      sourceLimitMismatch: false,
      identityConflicts: {},
      filterConflicts: {},
      missingFields: {},
      truncatedFields: {},
      invalidFields: {},
      subject: { state: 'complete', attempted: true },
      episodes: { state: 'complete', attempted: true },
    },
    integrity: {
      state: 'conflict',
      denominator: 'bounded',
      comparisons: 'partial',
    },
  },
  capabilityStates: {
    episodeProgress: 'not_computable',
    watchOrder: 'not_computable',
    airingHistory: 'not_computable',
  },
  source: {
    class: 'official_v0',
    operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/episodes'],
    attemptedAt: '2026-04-03T00:00:00.000Z',
    retrievedAt: '2026-04-03T00:00:00.000Z',
    attempts: [],
  },
  evidence: [],
  limitations: ['章节完整性只使用官方 v0 有界页面。'],
  warnings: [
    { code: 'EPISODE_INTEGRITY_CONFLICT', state: 'conflict', message: '日期冲突已保留。' },
  ],
};

describe('episode-integrity renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders dense conflict evidence as a zero-network image-free card', async () => {
    const viewModel = buildEpisodeIntegrityViewModel(result);

    expect(viewModel.template).toBe('episode-integrity');
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('EPISODE INTEGRITY');
    expect(html).toContain('章节完整性');
    expect(html).toContain('存在冲突');
    expect(html).toContain('已播正篇');
    expect(html).toContain('特别篇');
    expect(html).toContain('日期冲突组');
    expect(html).toContain('episode-integrity-v1');
    expect(html).not.toContain('https://');

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('episode-integrity');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
