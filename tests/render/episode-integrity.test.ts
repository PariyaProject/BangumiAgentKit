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
  asOf: {
    date: '2026-04-03',
    source: 'explicit',
    retrievedAt: '2026-04-03T00:00:00.000Z',
    evaluatedAt: '2026-04-03T00:00:01.000Z',
  },
  integrity: {
    state: 'conflict',
    formulaVersion: 'episode-integrity-v1',
    counts: {
      observedRows: 2,
      uniqueRows: 2,
      returnedRows: 2,
      main: 1,
      special: 1,
      unknown: 0,
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
      state: 'partial',
      basis: 'explicit',
      populations: {
        observed: {
          rows: 2,
          validRows: 2,
          airedRows: 2,
          futureRows: 0,
          missingRows: 0,
          invalidRows: 0,
          unknownRows: 0,
        },
        unique: {
          rows: 2,
          validRows: 2,
          airedRows: 2,
          futureRows: 0,
          missingRows: 0,
          invalidRows: 0,
          unknownRows: 0,
        },
        returned: {
          rows: 2,
          validRows: 2,
          airedRows: 2,
          futureRows: 0,
          missingRows: 0,
          invalidRows: 0,
          unknownRows: 0,
        },
        omitted: {
          rows: 0,
          validRows: 0,
          airedRows: 0,
          futureRows: 0,
          missingRows: 0,
          invalidRows: 0,
          unknownRows: 0,
        },
      },
      rows: [
        {
          id: 1,
          quality: 'valid',
          airdate: '2026-04-01',
          category: 'main',
          rawType: 0,
          ep: 1,
          sort: 1,
          unique: true,
          returned: true,
        },
        {
          id: 2,
          quality: 'valid',
          airdate: '2026-04-02',
          category: 'sp',
          rawType: 1,
          sort: 1,
          unique: true,
          returned: true,
        },
      ],
    },
    anomalies: {
      duplicateEpisodeIds: 0,
      duplicateAirdateConflicts: 0,
      duplicateLogicalKeys: 0,
      airdateConflictGroups: 1,
      nonMonotonicMainAirdates: 0,
      missingAirdates: 0,
      invalidAirdates: 0,
      duplicateEpisodeIdsList: [],
      duplicateAirdateConflictIds: [],
      logicalAirdateConflicts: [],
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
    attempts: [
      {
        operation: 'GET /v0/subjects/{subject_id}',
        state: 'complete',
        attemptedAt: '2026-04-03T00:00:00.000Z',
        retrievedAt: '2026-04-03T00:00:00.100Z',
      },
      {
        operation: 'GET /v0/episodes',
        state: 'complete',
        attemptedAt: '2026-04-03T00:00:00.000Z',
        retrievedAt: '2026-04-03T00:00:00.200Z',
      },
    ],
  },
  evidence: [
    {
      source: 'derived',
      operations: ['episode-integrity-composition'],
      attemptedAt: '2026-04-03T00:00:01.000Z',
      formulaVersion: 'episode-integrity-v1',
    },
  ],
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
    expect(html).toContain('方法与证据');
    expect(html).toContain('GET /v0/episodes');
    expect(html).toContain('观察人口');
    expect(html).not.toContain('https://');

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('episode-integrity');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });

  it('keeps mobile dense output bounded and renders desktop density', async () => {
    const denseItems = Array.from({ length: 24 }, (_, index) => ({
      ...result.items[0],
      id: index + 1,
      ep: index + 1,
      sort: index + 1,
      nameCn: `第 ${index + 1} 集 · 长中文标题用于移动端换行检查 · mixed-script-${index + 1}`,
      airdate: index % 2 === 0 ? '2026-04-01' : undefined,
    }));
    const densePopulation = {
      rows: 24,
      validRows: 12,
      airedRows: 12,
      futureRows: 0,
      missingRows: 12,
      invalidRows: 0,
      unknownRows: 12,
    };
    const denseResult = {
      ...result,
      state: 'partial',
      items: denseItems,
      summary: { ...result.summary, returned: 24, byCategory: { main: 24 } },
      integrity: {
        ...result.integrity,
        state: 'partial',
        counts: {
          ...result.integrity.counts,
          observedRows: 24,
          uniqueRows: 24,
          returnedRows: 24,
          main: 24,
          special: 0,
          unknown: 0,
          airedMain: 12,
          futureMain: 0,
          mainWithValidAirdate: 12,
          mainWithUnknownAirdate: 12,
          byCategory: { main: 24 },
        },
        dateCoverage: {
          ...result.integrity.dateCoverage,
          observedRows: 24,
          uniqueRows: 24,
          returnedRows: 24,
          validRows: 12,
          airedRows: 12,
          futureRows: 0,
          missingRows: 12,
          invalidRows: 0,
          unknownRows: 12,
          populations: {
            observed: densePopulation,
            unique: densePopulation,
            returned: densePopulation,
            omitted: {
              rows: 0,
              validRows: 0,
              airedRows: 0,
              futureRows: 0,
              missingRows: 0,
              invalidRows: 0,
              unknownRows: 0,
            },
          },
          rows: denseItems.map((item) => ({
            id: item.id,
            quality: item.airdate ? 'valid' : 'missing',
            ...(item.airdate ? { airdate: item.airdate } : {}),
            category: 'main' as const,
            rawType: 0,
            ep: item.ep,
            sort: item.sort,
            unique: true,
            returned: true,
          })),
        },
      },
      coverage: {
        ...result.coverage,
        state: 'partial',
        episodeGuide: {
          ...result.coverage.episodeGuide,
          sourceTotal: 24,
          observedRows: 24,
          uniqueRows: 24,
          returnedRows: 24,
          truncated: false,
        },
      },
    } as unknown as EpisodeIntegrityResult;

    const mobileViewModel = buildEpisodeIntegrityViewModel(denseResult);
    expect(mobileViewModel.items).toHaveLength(12);
    expect(mobileViewModel.coverage.renderedOmitted).toBe(12);
    const mobileHtml = renderHtmlTemplate(mobileViewModel, 'bangumi-dark', {}, 640);
    expect(mobileHtml).toContain('渲染器省略已返回章节');
    expect(mobileHtml).toContain('mixed-script-1');

    const mobileRendered = await renderService.renderCard(mobileViewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(mobileRendered.buffer.length).toBeGreaterThan(1000);

    const desktopViewModel = buildEpisodeIntegrityViewModel(denseResult, { maxItems: 24 });
    const desktopHtml = renderHtmlTemplate(desktopViewModel, 'bangumi-dark', {}, 960);
    expect(desktopViewModel.items).toHaveLength(24);
    expect(desktopHtml).toContain('mixed-script-24');
    const desktopRendered = await renderService.renderCard(desktopViewModel, {
      width: 960,
      deviceScaleFactor: 1,
    });
    expect(desktopRendered.buffer.length).toBeGreaterThan(1000);
  });

  it('renders every declared degraded and complete state label', () => {
    for (const state of [
      'complete',
      'partial',
      'conflict',
      'unavailable',
      'not_found',
      'not_computable',
    ] as const) {
      const viewModel = buildEpisodeIntegrityViewModel({
        ...result,
        state,
        items: state === 'complete' ? result.items : [],
        integrity: { ...result.integrity, state },
        coverage: { ...result.coverage, state, integrity: { ...result.coverage.integrity, state } },
      } as unknown as EpisodeIntegrityResult);
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
      expect(html).toContain(
        {
          complete: '覆盖完整',
          partial: '部分覆盖',
          conflict: '存在冲突',
          unavailable: '来源不可用',
          not_found: '未找到',
          not_computable: '不可计算',
        }[state],
      );
    }
  });
});
