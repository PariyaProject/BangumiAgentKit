/* global window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateIdentity, distBuildIdentity, sourceIdentity } from './render-provenance.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runId =
  process.env.PARIYA_UX002_REFERENCE_RUN_ID ?? 'run95-ux002-reference-fidelity-20261020-v1';
assert.match(runId, /^[a-z0-9][a-z0-9-]{4,90}$/u, 'run id must be a safe filename');

const WIDTHS = [320, 360, 520, 640, 960];
const PACKS = ['warm-editorial', 'clean-gallery', 'graphic-zine'];
const THEMES = ['bangumi-light', 'bangumi-dark'];
const subjectId = 902025;
const coverUrl = 'fixture://ux002/star-harbor-cover.png';
const coverPath = 'tests/render/fixtures/ux002-reference-cover.svg';
const coverBytes = readFileSync(path.join(repoRoot, coverPath));
const coverDataUrl = `data:image/svg+xml;base64,${coverBytes.toString('base64')}`;
const fixtureDisclosure = '合成演示数据，仅用于视觉与布局验收，不代表 Bangumi 当前真实资料。';

const rendererRequire = createRequire(path.join(repoRoot, 'packages/renderer/package.json'));
const { chromium } = rendererRequire('playwright');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const candidate = candidateIdentity();
const sourceBeforeBuild = sourceIdentity();
execFileSync('pnpm', ['build'], { cwd: repoRoot, stdio: 'inherit' });
const source = sourceIdentity();
assert.deepEqual(source, sourceBeforeBuild, 'tracked source changed while building renderer');
const rendererBuild = distBuildIdentity(['packages/renderer/dist']);
assert.ok(
  rendererBuild.roots.includes('packages/renderer/dist'),
  'renderer build identity must include the imported distribution',
);
const { renderHtmlTemplate } = await import('../../packages/renderer/dist/index.js');

const subjectCard = {
  template: 'subject-card',
  version: 1,
  subject: {
    id: subjectId,
    name: '星港纪行',
    nameCn: '星港纪行',
    type: 'anime',
    date: '2025',
    image: coverUrl,
    score: 8.4,
    summary: '合成简介：以星港迁徙与远航为主题的虚构科幻冒险作品。',
    tags: ['科幻', '冒险'],
  },
  collection: {
    status: 'do',
    statusLabel: '在看',
    episodeProgress: '9 / 12 集',
    progressPercentage: 75,
  },
  source: { label: fixtureDisclosure },
};

const ratingHistogram = {
  1: 0,
  2: 0,
  3: 2,
  4: 8,
  5: 24,
  6: 50,
  7: 130,
  8: 360,
  9: 500,
  10: 210,
};
const ratingTotal = Object.values(ratingHistogram).reduce((total, count) => total + count, 0);
const ratingMean =
  Object.entries(ratingHistogram).reduce(
    (total, [score, count]) => total + Number(score) * count,
    0,
  ) / ratingTotal;
const ratingStandardDeviation = Math.sqrt(
  Object.entries(ratingHistogram).reduce(
    (total, [score, count]) => total + (Number(score) - ratingMean) ** 2 * count,
    0,
  ) / ratingTotal,
);
const highScoreCount = ratingHistogram[8] + ratingHistogram[9];
const distribution = Object.entries(ratingHistogram).map(([score, count]) => ({
  score: Number(score),
  count,
  percentage: (count / ratingTotal) * 100,
}));

const subjectStats = {
  template: 'subject-stats',
  version: 1,
  subjectId,
  subjectIdentity: {
    state: 'available',
    source: 'official-v0',
    name: '星港纪行',
    nameCn: '星港纪行',
    coverImage: coverDataUrl,
    nameTruncated: false,
    nameCnTruncated: false,
    retrievedAt: '2025-06-01T00:00:00.000Z',
  },
  state: 'complete',
  raw: {
    score: 8.4,
    ratingTotal,
    ratingHistogram,
    collection: { wish: 2, collect: 4, doing: 2, onHold: 1, dropped: 1 },
  },
  rating: {
    state: 'complete',
    population: ratingTotal,
    mean: ratingMean,
    standardDeviation: ratingStandardDeviation,
    scoreBand8To9Share: {
      state: 'complete',
      count: highScoreCount,
      population: ratingTotal,
      percentage: (highScoreCount / ratingTotal) * 100,
      formula: {
        id: 'bangumi.rating.score_band_8_9_share.v1',
        version: 1,
        inputs: ['rating.count.8', 'rating.count.9'],
        evidenceStatus: 'derived',
        description: '合成固定样例中 8、9 分计数之和除以评分总人数。',
      },
    },
    distribution,
    formulas: {
      percentages: { evidenceStatus: 'derived' },
      histogramMean: { evidenceStatus: 'derived' },
      populationStandardDeviation: { evidenceStatus: 'derived' },
    },
    conflicts: [],
  },
  collection: {
    state: 'complete',
    total: 10,
    distribution: [
      { status: 'wish', count: 2, percentage: 20 },
      { status: 'collect', count: 4, percentage: 40 },
      { status: 'doing', count: 2, percentage: 20 },
      { status: 'on_hold', count: 1, percentage: 10 },
      { status: 'dropped', count: 1, percentage: 10 },
    ],
    completionRate: 0.4,
    completionState: 'complete',
    formulas: {
      percentages: { evidenceStatus: 'derived' },
      completion: { evidenceStatus: 'derived' },
    },
    conflicts: [],
  },
  coverage: {
    sourceRequestsAttempted: 1,
    sourceRequestsSucceeded: 1,
    ratingBucketsExpected: 10,
    ratingBucketsObserved: 10,
    collectionBucketsExpected: 5,
    collectionBucketsObserved: 5,
    ratingPopulation: ratingTotal,
    collectionPopulation: 10,
    formulasAttempted: 6,
    formulasComplete: 6,
    formulasPartial: 0,
    formulasNotComputable: 0,
    formulasConflict: 0,
  },
  source: {
    official: {
      class: 'official-v0',
      operations: ['getSubjectStats'],
      retrievedAt: '2025-06-01T00:00:00.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: ['bangumi.rating.percentages.v1', 'bangumi.rating.histogram_mean.v1'],
      retrievedAt: '2025-06-01T00:00:00.000Z',
    },
  },
  conflicts: [],
  evidence: [],
  warnings: [],
  limitations: [fixtureDisclosure, '当前合成样例不是历史趋势。'],
  retrievedAt: '2025-06-01T00:00:00.000Z',
};

const revisionTimeline = {
  template: 'revision-timeline',
  version: 1,
  state: 'complete',
  entityType: 'subject',
  entityId: subjectId,
  items: [
    {
      id: 90251,
      type: 1,
      summary: '合成修订事件：补充了星港迁徙设定说明。',
      createdAt: '2025-06-01T08:15:00Z',
      creator: { nickname: '演示编辑者' },
    },
    {
      id: 90252,
      type: 5,
      summary: '合成修订事件：修正了条目与关联作品的关系标签。',
      createdAt: '2025-06-03T12:30:00Z',
      creator: { nickname: '演示编辑者' },
    },
    {
      id: 90253,
      type: 1,
      summary: '合成修订事件：补充了全 12 集的章节信息。',
      createdAt: '2025-06-06T16:45:00Z',
      creator: { nickname: '演示编辑者' },
    },
  ],
  coverage: {
    state: 'complete',
    observed: 3,
    returned: 3,
    total: 3,
    totalKind: 'exact',
    limit: 10,
    offset: 0,
    truncated: false,
    rendered: 3,
    missingFields: {},
    truncatedFields: {},
  },
  capabilityStates: { historical_growth: 'not_computable' },
  source: {
    label: '合成修订演示数据',
    operation: '固定本地视觉对照 fixture',
    retrievedAt: '2025-06-06T16:45:00Z',
  },
  limitations: [fixtureDisclosure, '事件均为合成修订记录，不是播出时间表。'],
  warnings: [],
};

const fixtures = [subjectCard, subjectStats, revisionTimeline];
assert.equal(ratingTotal, 1284);
assert.equal(Math.round(ratingMean * 10) / 10, 8.4);
assert.equal(Math.round((highScoreCount / ratingTotal) * 1000) / 10, 67);

const fixtureCoverSha256 = sha256(coverBytes);
const outputDir = path.join(
  repoRoot,
  '.artifacts',
  `render-theme-matrix-${runId}`,
  'fixed-reference-fixture',
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-gpu', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 960, height: 900 },
  deviceScaleFactor: 2,
  javaScriptEnabled: false,
  serviceWorkers: 'block',
});
await context.route('**/*', (route) => route.abort());

const manifest = [];
try {
  for (const fixture of fixtures) {
    const fixtureId = sha256(JSON.stringify(fixture)).slice(0, 12);
    const resolvedImages = fixture.template === 'subject-card' ? { [coverUrl]: coverDataUrl } : {};
    const expectedText =
      fixture.template === 'revision-timeline'
        ? ['Bangumi 修订历史', '条目修订', '合成修订事件', '合成演示数据']
        : fixture.template === 'subject-stats'
          ? ['星港纪行', '1,284', '8.4', '合成演示数据']
          : ['星港纪行', '8.4', '9 / 12 集', '合成演示数据'];

    for (const designPack of PACKS) {
      for (const theme of THEMES) {
        for (const cssWidth of WIDTHS) {
          const html = renderHtmlTemplate(fixture, theme, resolvedImages, cssWidth, designPack);
          const page = await context.newPage();
          await page.setViewportSize({ width: cssWidth, height: 900 });
          await page.setContent(html, { waitUntil: 'load' });
          const root = page.locator('[data-render-root]');
          const visual = await root.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const frame = element.querySelector('[data-render-frame="true"]');
            const hero = element.querySelector('[data-layout="subject-cover-art-stage"]');
            const panel = element.querySelector(
              '[data-layout="warm-score-panel"], [data-layout="zine-score-progress-hero"], [data-layout="subject-card-summary"]',
            );
            const scorePanelOverflows = Array.from(
              element.querySelectorAll(
                '[data-layout="warm-score-panel"], [data-layout="zine-score-panel"]',
              ),
            )
              .map((node) => ({
                layout: node.getAttribute('data-layout'),
                clientWidth: node.clientWidth,
                scrollWidth: node.scrollWidth,
                text: (node.textContent ?? '').trim().slice(0, 48),
              }))
              .filter((node) => node.scrollWidth > node.clientWidth + 1);
            const panelMasks = Array.from(
              element.querySelectorAll(
                '[data-render-mask="panel"], [data-render-mask="panel-alt"]',
              ),
            ).map((node) => ({
              kind: node.getAttribute('data-render-mask'),
              token: node.style.clipPath || 'none',
              clipPath: window.getComputedStyle(node).clipPath,
            }));
            const progressTrack = element.querySelector(
              '[data-layout="progress-track"], [data-layout="subject-progress-track"]',
            );
            const shapeMaskElements = Array.from(element.querySelectorAll('*')).filter((node) =>
              node.style.clipPath?.startsWith('shape('),
            );
            const expectedShapeMaskElements = Array.from(
              new Set(
                [
                  frame,
                  hero,
                  progressTrack,
                  ...element.querySelectorAll('[data-render-mask]'),
                  ...element.querySelectorAll('[data-icon-mask="badge"]'),
                ].filter(Boolean),
              ),
            );
            const unsupportedShapeMasks = expectedShapeMaskElements
              .map((node) => ({
                layout: node.getAttribute('data-layout') ?? node.getAttribute('data-render-mask'),
                clipPath: window.getComputedStyle(node).clipPath,
              }))
              .filter(
                (entry) =>
                  !entry.clipPath.startsWith('shape(') ||
                  !window.CSS.supports('clip-path', entry.clipPath),
              );
            const overflows = Array.from(element.querySelectorAll('*'))
              .map((node) => {
                const box = node.getBoundingClientRect();
                return {
                  tag: node.tagName.toLowerCase(),
                  layout: node.getAttribute('data-layout'),
                  left: Math.round(box.left),
                  right: Math.round(box.right),
                  scrollWidth: node.scrollWidth,
                  clientWidth: node.clientWidth,
                  text: (node.textContent ?? '').trim().slice(0, 64),
                };
              })
              .filter(
                (node) =>
                  node.left < bounds.left - 1 ||
                  node.right > bounds.right + 1 ||
                  node.scrollWidth > node.clientWidth + 1,
              )
              .slice(0, 20);
            return {
              cssWidth: Math.round(bounds.width),
              cssHeight: Math.round(bounds.height),
              rootScrollWidth: element.scrollWidth,
              rootClientWidth: element.clientWidth,
              maskReceipts: {
                frame: frame ? window.getComputedStyle(frame).clipPath : null,
                frameToken: frame?.style.clipPath || null,
                hero: hero ? window.getComputedStyle(hero).clipPath : null,
                heroToken: hero?.style.clipPath || null,
                panel: panel ? window.getComputedStyle(panel).clipPath : null,
                panelToken: panel?.style.clipPath || null,
                panelPrimaryCount: panelMasks.filter(
                  (mask) => mask.kind === 'panel' && mask.clipPath !== 'none',
                ).length,
                panelAltCount: panelMasks.filter(
                  (mask) => mask.kind === 'panel-alt' && mask.clipPath !== 'none',
                ).length,
                panelPrimaryMask:
                  panelMasks.find((mask) => mask.kind === 'panel')?.clipPath ?? null,
                panelPrimaryMaskToken:
                  panelMasks.find((mask) => mask.kind === 'panel')?.token ?? null,
                panelAltMask:
                  panelMasks.find((mask) => mask.kind === 'panel-alt')?.clipPath ?? null,
                panelAltMaskToken:
                  panelMasks.find((mask) => mask.kind === 'panel-alt')?.token ?? null,
                progress: progressTrack ? window.getComputedStyle(progressTrack).clipPath : null,
                progressToken: progressTrack?.style.clipPath || null,
                shapeMaskCount: shapeMaskElements.length,
                unsupportedShapeMasks,
                badgeMaskCount: element.querySelectorAll('[data-icon-mask="badge"]').length,
                coverStickerCount: element.querySelectorAll(
                  '[data-layout="zine-cover-stickers"] > span',
                ).length,
              },
              scorePanelOverflows,
              overflows,
              text: (element.textContent ?? '').replace(/\s+/gu, ' ').trim(),
            };
          });
          assert.equal(
            visual.cssWidth,
            cssWidth,
            `${fixture.template}/${designPack}/${theme}/${cssWidth}`,
          );
          assert.equal(
            visual.rootScrollWidth,
            visual.rootClientWidth,
            `${fixture.template}/${designPack}/${theme}/${cssWidth} root overflow`,
          );
          assert.ok(
            visual.maskReceipts.shapeMaskCount > 0,
            `${fixture.template}/${designPack}/${theme}/${cssWidth} missing CSS shape masks`,
          );
          assert.deepEqual(
            visual.maskReceipts.unsupportedShapeMasks,
            [],
            `${fixture.template}/${designPack}/${theme}/${cssWidth} has an unsupported CSS shape mask`,
          );
          assert.ok(
            visual.maskReceipts.frame && visual.maskReceipts.frame !== 'none',
            `${fixture.template}/${designPack}/${theme}/${cssWidth} missing frame mask`,
          );
          assert.ok(
            visual.maskReceipts.panelPrimaryCount + visual.maskReceipts.panelAltCount > 0,
            `${fixture.template}/${designPack}/${theme}/${cssWidth} missing rendered panel mask`,
          );
          if (fixture.template === 'subject-card') {
            assert.ok(
              visual.maskReceipts.hero && visual.maskReceipts.hero !== 'none',
              `${fixture.template}/${designPack}/${theme}/${cssWidth} missing hero mask`,
            );
            assert.ok(
              visual.maskReceipts.progress && visual.maskReceipts.progress !== 'none',
              `${fixture.template}/${designPack}/${theme}/${cssWidth} missing progress mask`,
            );
          }
          if (fixture.template === 'subject-card' && designPack === 'graphic-zine') {
            assert.equal(
              visual.maskReceipts.coverStickerCount,
              2,
              `${fixture.template}/${designPack}/${theme}/${cssWidth} missing diagonal cover stickers`,
            );
          }
          assert.deepEqual(
            visual.scorePanelOverflows,
            [],
            `${fixture.template}/${designPack}/${theme}/${cssWidth} score panel overflow`,
          );
          for (const text of expectedText) {
            assert.ok(
              visual.text.includes(text),
              `${fixture.template}/${designPack}/${theme}/${cssWidth} missing text: ${text}`,
            );
          }

          const png = await root.screenshot({ type: 'png' });
          const filename = `${fixture.template}-complete-${fixtureId}-${designPack}-${theme}-${cssWidth}.png`;
          await writeFile(path.join(outputDir, filename), png);
          manifest.push({
            template: fixture.template,
            state: 'complete',
            fixtureId,
            designPack,
            theme,
            cssWidth,
            filename,
            pngWidth: png.readUInt32BE(16),
            pngHeight: png.readUInt32BE(20),
            bytes: png.length,
            sha256: sha256(png),
            layout: visual,
            expectedText,
            captureMode: 'render-root',
            visualReview: 'pending_reference_comparison',
          });
          await page.close();
        }
      }
    }
  }
} finally {
  await context.close();
  await browser.close();
}

assert.deepEqual(sourceIdentity(), source, 'tracked source changed during reference rendering');
assert.deepEqual(
  distBuildIdentity(['packages/renderer/dist']),
  rendererBuild,
  'renderer dist changed during reference rendering',
);

manifest.sort((left, right) =>
  `${left.template}/${left.designPack}/${left.theme}/${left.cssWidth}`.localeCompare(
    `${right.template}/${right.designPack}/${right.theme}/${right.cssWidth}`,
  ),
);
assert.equal(manifest.length, 90);
const frameMaskTokensByPack = new Map();
const frameMasksAt320ByPack = new Map();
for (const item of manifest) {
  const currentToken = frameMaskTokensByPack.get(item.designPack);
  if (currentToken && currentToken !== item.layout.maskReceipts.frameToken) {
    throw new Error(`Frame mask token drifted within ${item.designPack}`);
  }
  frameMaskTokensByPack.set(item.designPack, item.layout.maskReceipts.frameToken);
  if (item.cssWidth === 320 && !frameMasksAt320ByPack.has(item.designPack)) {
    frameMasksAt320ByPack.set(item.designPack, item.layout.maskReceipts.frame);
  }
}
assert.equal(
  new Set(frameMaskTokensByPack.values()).size,
  PACKS.length,
  'design packs must define distinct frame mask tokens',
);
assert.equal(
  new Set(frameMasksAt320ByPack.values()).size,
  PACKS.length,
  'design packs must render distinct frame masks at 320px',
);
const panelMaskTokensByTemplatePack = new Map();
const panelMasksAt320ByTemplatePack = new Map();
const panelMaskTokensAt320ByTemplatePack = new Map();
const panelAltCountsByTemplatePack = new Map();
for (const item of manifest) {
  const key = `${item.template}/${item.designPack}`;
  const { panelPrimaryMaskToken, panelAltMaskToken, panelAltCount } = item.layout.maskReceipts;
  if (panelPrimaryMaskToken) {
    const currentToken = panelMaskTokensByTemplatePack.get(key);
    if (currentToken && currentToken !== panelPrimaryMaskToken) {
      throw new Error(`Primary panel mask token drifted within ${key}`);
    }
    panelMaskTokensByTemplatePack.set(key, panelPrimaryMaskToken);
  }
  if (item.cssWidth === 320 && !panelMasksAt320ByTemplatePack.has(key)) {
    panelMasksAt320ByTemplatePack.set(
      key,
      item.layout.maskReceipts.panelPrimaryMask ?? item.layout.maskReceipts.panelAltMask,
    );
    panelMaskTokensAt320ByTemplatePack.set(key, panelPrimaryMaskToken ?? panelAltMaskToken);
  }
  if (panelAltCount > 0) {
    const altKey = `${key}/alternate`;
    const currentAltToken = panelMaskTokensByTemplatePack.get(altKey);
    if (currentAltToken && currentAltToken !== panelAltMaskToken) {
      throw new Error(`Alternate panel mask token drifted within ${key}`);
    }
    panelMaskTokensByTemplatePack.set(altKey, panelAltMaskToken);
    panelAltCountsByTemplatePack.set(
      key,
      (panelAltCountsByTemplatePack.get(key) ?? 0) + panelAltCount,
    );
  }
}
const referenceTemplates = [...new Set(manifest.map((item) => item.template))];
for (const template of referenceTemplates) {
  const maskTokens = PACKS.map((designPack) =>
    panelMaskTokensAt320ByTemplatePack.get(`${template}/${designPack}`),
  );
  const renderedMasks = PACKS.map((designPack) =>
    panelMasksAt320ByTemplatePack.get(`${template}/${designPack}`),
  );
  assert.ok(maskTokens.every(Boolean), `${template} must report a panel mask per pack`);
  assert.ok(renderedMasks.every(Boolean), `${template} must render a panel mask per pack`);
  assert.equal(
    new Set(maskTokens).size,
    PACKS.length,
    `${template} must define a distinct panel mask for each pack`,
  );
  assert.equal(
    new Set(renderedMasks).size,
    PACKS.length,
    `${template} must render distinct panel masks at 320px`,
  );
}
for (const template of ['subject-card', 'subject-stats']) {
  const key = `${template}/warm-editorial`;
  assert.ok(
    (panelAltCountsByTemplatePack.get(key) ?? 0) > 0,
    `${key} must exercise its alternate folio mask`,
  );
  assert.notEqual(
    panelMaskTokensByTemplatePack.get(`${key}/alternate`),
    panelMaskTokensByTemplatePack.get('subject-card/warm-editorial'),
    `${key} must use a visibly distinct alternate folio mask`,
  );
}
const progressMaskTokensByPack = new Map();
const progressMasksAt320ByPack = new Map();
for (const item of manifest.filter((row) => row.template === 'subject-card')) {
  const currentToken = progressMaskTokensByPack.get(item.designPack);
  if (currentToken && currentToken !== item.layout.maskReceipts.progressToken) {
    throw new Error(`Progress mask token drifted within ${item.designPack}`);
  }
  progressMaskTokensByPack.set(item.designPack, item.layout.maskReceipts.progressToken);
  if (item.cssWidth === 320 && !progressMasksAt320ByPack.has(item.designPack)) {
    progressMasksAt320ByPack.set(item.designPack, item.layout.maskReceipts.progress);
  }
}
assert.equal(
  new Set(progressMaskTokensByPack.values()).size,
  PACKS.length,
  'design packs must define distinct progress mask tokens',
);
assert.equal(
  new Set(progressMasksAt320ByPack.values()).size,
  PACKS.length,
  'design packs must render distinct progress masks at 320px',
);
await writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      runId,
      candidate,
      source,
      rendererBuild,
      fixture: {
        subjectId,
        title: '星港纪行',
        year: 2025,
        format: 'TV anime',
        episodes: 12,
        genres: ['science-fiction', 'adventure'],
        score: 8.4,
        ratingTotal,
        ratingHistogram,
        weightedMean: ratingMean,
        linkedSyntheticProgress: '9/12',
        historySemantics: 'synthetic revision events, never airing dates',
        disclosure: fixtureDisclosure,
        coverPath,
        coverSha256: fixtureCoverSha256,
      },
      designPacks: PACKS,
      themes: THEMES,
      widths: WIDTHS,
      images: manifest,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      state: 'REFERENCE_FIDELITY_MATRIX_CREATED',
      runId,
      candidate,
      images: manifest.length,
      fixtureGroups: fixtures.length,
      packs: PACKS.length,
      palettes: THEMES.length,
      widths: WIDTHS,
      outputDir: path.relative(repoRoot, outputDir),
    },
    null,
    2,
  ),
);
