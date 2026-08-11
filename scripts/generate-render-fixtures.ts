import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  SeriesRelationsViewModel,
} from '../packages/renderer/dist/index.js';

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

  // 6. Series / Watch-Order evidence fixtures
  const seriesPath: SeriesRelationsViewModel['edges'][number] = {
    fromId: 100,
    toId: 101,
    depth: 0,
    relation: '前传',
    relationKind: 'prequel',
    pathIds: [100, 101],
    pathKinds: ['prequel'],
    direct: true,
  };
  const seriesStep: SeriesRelationsViewModel['steps'][number] = {
    id: 101,
    name: 'Prequel Original Title',
    nameCn: '前传条目：長い日本語タイトル與中文说明',
    type: '动画',
    date: '2019-01-01',
    relationLabels: ['前传'],
    relationKinds: ['prequel'],
    relationPaths: [seriesPath],
    depth: 0,
    includedInWatchOrder: true,
    position: 1,
    isRoot: false,
    placement: 'before_root' as const,
    placementReason: '起点直接关系标记为前传，置于起点前',
  };
  const seriesVm: SeriesRelationsViewModel = {
    template: 'series-relations',
    version: 1,
    state: 'partial',
    subjectId: 100,
    root: {
      id: 100,
      name: 'Long Original Title',
      nameCn: '超长中文起点条目與日本語タイトル',
      type: '动画',
      date: '2020-01-01',
    },
    steps: [
      seriesStep,
      {
        ...seriesStep,
        id: 100,
        name: 'Long Original Title',
        nameCn: '超长中文起点条目與日本語タイトル',
        relationLabels: [],
        relationKinds: [],
        relationPaths: [],
        depth: 0,
        position: 2,
        isRoot: true,
        placement: 'root' as const,
        placementReason: '请求的起始条目',
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        ...seriesStep,
        id: 102 + index,
        name: `Sequel Original Title ${index + 1}`,
        nameCn: `续集条目 ${index + 1}：缺失封面与長文本`.repeat(2),
        relationLabels: ['续集'],
        relationKinds: ['sequel'],
        relationPaths: [
          {
            ...seriesPath,
            toId: 102 + index,
            relation: '续集',
            relationKind: 'sequel',
            pathIds: [100, 102 + index],
            pathKinds: ['sequel'],
          },
        ],
        date: undefined,
        position: index + 3,
        placement: 'after_root' as const,
        placementReason: '起点直接关系标记为续集，置于起点后',
      })),
    ],
    related: [
      {
        ...seriesStep,
        id: 200,
        name: 'Original Book',
        nameCn: '原作书籍',
        type: '书籍',
        relationLabels: ['原作'],
        relationKinds: ['source'],
        relationPaths: [
          {
            ...seriesPath,
            toId: 200,
            relation: '原作',
            relationKind: 'source',
            pathIds: [100, 200],
            pathKinds: ['source'],
          },
        ],
        depth: 0,
        includedInWatchOrder: false,
        exclusionReason: 'media_type_not_anime',
      },
      {
        ...seriesStep,
        id: 201,
        name: 'Unknown Relation',
        nameCn: '未映射关系',
        type: '动画',
        relationLabels: ['相关作品'],
        relationKinds: ['unknown'],
        relationPaths: [
          {
            ...seriesPath,
            toId: 201,
            relation: '相关作品',
            relationKind: 'unknown',
            pathIds: [100, 201],
            pathKinds: ['unknown'],
          },
        ],
        depth: 0,
        includedInWatchOrder: false,
        exclusionReason: 'relation_not_watch_step',
      },
    ],
    edges: [seriesPath],
    excluded: {
      count: 2,
      byReason: [
        { reason: 'media_type_not_anime', count: 1 },
        { reason: 'relation_not_watch_step', count: 1 },
      ],
      samples: [],
    },
    coverage: {
      depth: 1,
      maxNodes: 8,
      media: 'all',
      animeNodeLimit: 8,
      nonAnimeEvidenceLimit: 8,
      relatedLimit: 16,
      relationRequests: 3,
      relationRowsObserved: 8,
      uniqueRelatedObserved: 8,
      uniqueRelatedReturned: 6,
      animeNodesObserved: 7,
      animeNodesSelected: 5,
      nonAnimeRowsObserved: 1,
      nonAnimeRowsReturned: 1,
      detailsAttempted: 5,
      detailsFetched: 5,
      detailsFailed: 0,
      relationFailures: 1,
      edgeEvidenceLimit: 64,
      edgeEvidenceReturned: 1,
      edgeEvidenceTruncated: false,
      relatedEvidenceTruncated: true,
      truncated: true,
      truncationReasons: ['relation-read-failure', 'related-evidence=16'],
      retrievedAt: '2026-08-11T00:00:00.000Z',
    },
    evidence: {
      operations: ['条目详情', '条目关系'],
      evidenceCount: 8,
      derivation: 'series-watch-order-v2',
      retrievedAt: '2026-08-11T00:00:00.000Z',
    },
    warnings: ['共有 1 个可选关系读取失败；未读取的分支不会被假设为完整。'],
    limitations: ['这不是 Bangumi 发布的唯一官方观看顺序。', '关系源不保证覆盖整个系列。'],
  };
  for (const width of [640, 960]) {
    const seriesResult = await renderService.renderCard(seriesVm, {
      width,
      deviceScaleFactor: 1,
    });
    const filename = `series-relations-${width}.png`;
    fs.writeFileSync(path.join(outputDir, filename), seriesResult.buffer);
    console.log(
      `Saved ${filename} (${seriesResult.width}x${seriesResult.height}, ${seriesResult.buffer.length} bytes)`,
    );
  }
  const notComputableSeries: SeriesRelationsViewModel = {
    ...seriesVm,
    state: 'not_computable',
    root: { ...seriesVm.root, type: '书籍' },
    steps: [],
    coverage: {
      ...seriesVm.coverage,
      animeNodesSelected: 0,
      detailsAttempted: 0,
      detailsFetched: 0,
      relatedEvidenceTruncated: false,
      truncated: false,
      truncationReasons: [],
    },
    warnings: ['起始条目不是动画；本次结果只能展示关系证据，不能计算动画观看步骤。'],
  };
  const notComputableResult = await renderService.renderCard(notComputableSeries, {
    width: 640,
    deviceScaleFactor: 1,
  });
  fs.writeFileSync(
    path.join(outputDir, 'series-relations-not-computable-640.png'),
    notComputableResult.buffer,
  );
  console.log(
    `Saved series-relations-not-computable-640.png (${notComputableResult.width}x${notComputableResult.height}, ${notComputableResult.buffer.length} bytes)`,
  );

  await renderService.close();
  console.log('Successfully generated all renderer fixture images.');
}

main().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
