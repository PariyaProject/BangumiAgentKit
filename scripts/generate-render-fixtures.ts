import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  buildSeriesRelationsViewModel,
} from '../packages/renderer/dist/index.js';
import type { SeriesRelationsViewModel } from '../packages/renderer/dist/index.js';
import {
  assertSeriesWatchOrderFixture,
  buildSeriesWatchOrderFixtureRuns,
  SERIES_FIXTURE_VARIANTS,
} from './series-watch-order-fixtures.js';

async function main() {
  const outputDir = path.join(process.cwd(), '.artifacts', 'render');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const renderService = new RenderService();

  console.log('Generating render fixtures in .artifacts/render/...');

  // 1. Subject card fixture
  const subjectVm: SubjectCardViewModel = {
    template: 'subject-card',
    version: 1,
    subject: {
      id: 265,
      name: '新世紀エヴァンゲリオン',
      nameCn: '新世纪福音战士：终 (超长中文标题测试)',
      type: 'anime',
      date: '2021-03-08',
      score: 8.8,
      rank: 15,
      summary:
        '西暦2015年。第3新東京市に、さまざまな特殊能力を持つ巨大な「使徒」が襲来した。主人公・碇シンジは、国連直属の非公開組織・特務機関ネルフの最高司令官である父・ゲンドウっから、汎用ヒト型決戦兵器エヴァンゲリオン初号機のパイロットに指名される。',
      tags: ['科幻', '机战', 'EVA', '庵野秀明', '神作', '经典', '心理', '剧场版'],
    },
    collection: {
      status: 'collect',
      statusLabel: '已看过',
      rating: 10,
      comment: '人类补完计划终章，完美的告别。',
      episodeProgress: '全 1 集',
    },
    source: { label: 'Bangumi Agent Kit Fixture Generator' },
  };

  const subjectResult = await renderService.renderCard(subjectVm);
  fs.writeFileSync(path.join(outputDir, 'subject.png'), subjectResult.buffer);
  console.log(
    `Saved subject.png (${subjectResult.width}x${subjectResult.height}, ${subjectResult.buffer.length} bytes)`,
  );

  // 2. Search list fixture
  const searchVm: SearchListViewModel = {
    template: 'search-list',
    version: 1,
    query: '攻壳机动队',
    total: 15,
    items: Array.from({ length: 10 }).map((_, i) => ({
      id: 1000 + i,
      name: `Ghost in the Shell ${i + 1}`,
      nameCn: `攻壳机动队 ${i + 1}：S.A.C. Solid State Society`,
      type: 'anime',
      score: 8.5 + (i % 5) * 0.1,
      rank: 10 + i,
    })),
    hasMore: true,
  };

  const searchResult = await renderService.renderCard(searchVm);
  fs.writeFileSync(path.join(outputDir, 'search.png'), searchResult.buffer);
  console.log(
    `Saved search.png (${searchResult.width}x${searchResult.height}, ${searchResult.buffer.length} bytes)`,
  );

  // 3. Cast card fixture
  const castVm: CastCardViewModel = {
    template: 'cast-card',
    version: 1,
    subject: { id: 1, name: 'Steins;Gate', nameCn: '命运石之门' },
    items: Array.from({ length: 20 }).map((_, i) => ({
      character: { id: 100 + i, name: `角色 ${i + 1} (冈部伦太郎 / 牧濑红莉栖)` },
      relation: i < 3 ? '主角' : '配角',
      actors: [{ id: 500 + i, name: `声优 ${i + 1} (宫野真守 / 今井麻美)` }],
    })),
    hiddenCount: 5,
  };

  const castResult = await renderService.renderCard(castVm);
  fs.writeFileSync(path.join(outputDir, 'cast.png'), castResult.buffer);
  console.log(
    `Saved cast.png (${castResult.width}x${castResult.height}, ${castResult.buffer.length} bytes)`,
  );

  // 4. Collection progress fixture
  const collectionVm: CollectionProgressViewModel = {
    template: 'collection-progress',
    version: 1,
    subject: { id: 300, name: 'Sousou no Frieren', nameCn: '葬送的芙莉莲' },
    status: 'do',
    statusLabel: '在看',
    watchedEpisodes: 24,
    totalEpisodes: 28,
    rating: 9,
    comment: '动画演出极其优秀，音乐与节奏控制堪称大师级水平。',
    progressPercentage: 86,
  };

  const collectionResult = await renderService.renderCard(collectionVm);
  fs.writeFileSync(path.join(outputDir, 'collection-progress.png'), collectionResult.buffer);
  console.log(
    `Saved collection-progress.png (${collectionResult.width}x${collectionResult.height}, ${collectionResult.buffer.length} bytes)`,
  );

  // 5. Calendar fixture
  const calendarVm: CalendarViewModel = {
    template: 'calendar',
    version: 1,
    days: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'].map(
      (day, dIdx) => ({
        weekdayCn: day,
        items: Array.from({ length: 5 }).map((_, i) => ({
          id: dIdx * 10 + i,
          name: `Anime ${dIdx}-${i}`,
          nameCn: `新番条目 ${dIdx + 1}-${i + 1}`,
          score: 7.5 + (i % 3) * 0.5,
        })),
        overflowCount: dIdx === 5 ? 3 : undefined,
      }),
    ),
  };

  const calendarResult = await renderService.renderCard(calendarVm);
  fs.writeFileSync(path.join(outputDir, 'calendar.png'), calendarResult.buffer);
  console.log(
    `Saved calendar.png (${calendarResult.width}x${calendarResult.height}, ${calendarResult.buffer.length} bytes)`,
  );

  // 6. Series / Watch-Order evidence fixtures. Each ViewModel is derived from
  // a typed SeriesWatchOrderResult and checked before it reaches the renderer.
  const seriesFixtures = await buildSeriesWatchOrderFixtureRuns();
  for (const variant of SERIES_FIXTURE_VARIANTS) {
    const fixture = seriesFixtures[variant];
    assertSeriesWatchOrderFixture(fixture);
    const viewModel = buildSeriesRelationsViewModel(fixture.result);
    for (const width of [640, 960]) {
      const renderResult = await renderService.renderCard(viewModel, {
        width,
        deviceScaleFactor: 1,
      });
      const filename = `series-relations-${variant}-${width}.png`;
      fs.writeFileSync(path.join(outputDir, filename), renderResult.buffer);
      console.log(
        `Saved ${filename} (${renderResult.width}x${renderResult.height}, ${renderResult.buffer.length} bytes)`,
      );
    }
  }

  // 7. Realistic maximum display input: 17 steps, 24 related rows, and the
  // service's 64-edge evidence boundary. This is a valid partial VM because
  // the related evidence cap is explicit; the PNG is used for visual height
  // and mobile/chat readability QA, not as a substitute for service fixtures.
  const completeViewModel = buildSeriesRelationsViewModel(seriesFixtures.complete.result);
  const maximumRootId = 900;
  const maximumSteps = Array.from({ length: 17 }, (_, index) => {
    const isRoot = index === 8;
    const base = completeViewModel.steps[isRoot ? 1 : 0]!;
    return {
      ...base,
      id: isRoot ? maximumRootId : maximumRootId + index + 1,
      name: isRoot ? 'Maximum Input Root' : `Maximum Step ${index + 1}`,
      nameCn: isRoot ? '最大输入起点' : `最大输入观看步骤 ${index + 1}`,
      position: index + 1,
      isRoot,
      placement: isRoot
        ? ('root' as const)
        : index < 8
          ? ('before_root' as const)
          : ('after_root' as const),
      placementReason: isRoot ? '请求的起始条目' : '起点直接关系标记为续集，置于起点后',
    };
  });
  const maximumRelated = Array.from({ length: 24 }, (_, index) => {
    const isAnime = index < 16;
    const base = completeViewModel.related[isAnime ? 0 : 3]!;
    return {
      ...base,
      id: maximumRootId + index + 1,
      name: isAnime ? `Maximum Related ${index + 1}` : `Maximum Non-Anime ${index - 15}`,
      nameCn: isAnime ? `最大关系证据 ${index + 1}` : `最大非动画证据 ${index - 15}`,
      type: isAnime ? '动画' : '书籍',
      includedInWatchOrder: isAnime,
      ...(isAnime ? {} : { exclusionReason: 'media_type_not_anime' as const }),
    };
  });
  const maximumEdges = Array.from({ length: 64 }, (_, index) => ({
    ...completeViewModel.edges[0]!,
    fromId: maximumRootId,
    toId: maximumRootId + index + 1,
    pathIds: [maximumRootId, maximumRootId + index + 1],
  }));
  const maximumViewModel: SeriesRelationsViewModel = {
    ...completeViewModel,
    subjectId: maximumRootId,
    state: 'partial',
    root: {
      ...completeViewModel.root,
      id: maximumRootId,
      name: 'Maximum Input Root',
      nameCn: '最大输入起点',
    },
    steps: maximumSteps,
    related: maximumRelated,
    edges: maximumEdges,
    excluded: {
      count: 48,
      byReason: [
        { reason: 'node_cap', count: 40 },
        { reason: 'media_type_not_anime', count: 8 },
      ],
      samples: maximumRelated.slice(16, 20).map((item) => ({
        ...item,
        includedInWatchOrder: false,
        exclusionReason: 'media_type_not_anime' as const,
      })),
    },
    coverage: {
      ...completeViewModel.coverage,
      depth: 1,
      maxNodes: 16,
      animeNodeLimit: 16,
      relatedLimit: 24,
      relationRowsObserved: 64,
      uniqueRelatedObserved: 64,
      uniqueRelatedReturned: 24,
      animeNodesObserved: 56,
      animeNodesSelected: 16,
      nonAnimeRowsObserved: 8,
      nonAnimeRowsReturned: 8,
      detailsAttempted: 16,
      detailsFetched: 16,
      edgeEvidenceReturned: 64,
      relatedEvidenceTruncated: true,
      truncated: true,
      truncationReasons: ['maxNodes=16', 'related-evidence=24'],
    },
    evidence: { ...completeViewModel.evidence, evidenceCount: 18 },
    warnings: ['关系证据达到有界上限 24；未展示的条目通过覆盖和排除统计保留。'],
  };
  for (const width of [640, 960]) {
    const renderResult = await renderService.renderCard(maximumViewModel, {
      width,
      deviceScaleFactor: 1,
    });
    const filename = `series-relations-maximum-${width}.png`;
    fs.writeFileSync(path.join(outputDir, filename), renderResult.buffer);
    console.log(
      `Saved ${filename} (${renderResult.width}x${renderResult.height}, ${renderResult.buffer.length} bytes)`,
    );
  }

  await renderService.close();
  console.log('Successfully generated all renderer fixture images.');
}

main().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
