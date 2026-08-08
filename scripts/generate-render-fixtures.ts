import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
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

  await renderService.close();
  console.log('Successfully generated all 5 fixture images.');
}

main().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
