import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, expect } from 'vitest';
import { extractImageUrls, RenderService } from '../../packages/renderer/src/render-service.js';
import { renderHtmlTemplate } from '../../packages/renderer/src/template-engine.js';
import type { RenderViewModel } from '../../packages/renderer/src/view-models/index.js';
import {
  closeMobileLayoutBrowser,
  measureRenderRootLayout,
  renderThemePreview,
} from './helpers/mobile-layout.js';

interface CapturedRender {
  template: string;
  viewModel: RenderViewModel;
  theme: 'bangumi-dark' | 'bangumi-light';
}

const pendingRenders: CapturedRender[] = [];
const auditedKeys = new Set<string>();
const observedTemplates = new Set<string>();
const themeMatrixEnabled = process.env.PARIYA_RENDER_THEME_MATRIX === '1';
const themeMatrixCandidates = new Map<
  string,
  { template: string; state: string; fixtureId: string; viewModel: RenderViewModel; size: number }
>();
const themeMatrixThemes = ['bangumi-dark', 'bangumi-light'] as const;
const themeMatrixWidths = [320, 360, 520, 640, 960] as const;
const syntheticImageData = [
  readFileSync(path.resolve(process.cwd(), 'tests/render/fixtures/subject-overview-cover.png')),
  readFileSync(path.resolve(process.cwd(), 'tests/render/fixtures/subject-overview-character.png')),
].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`);
const renderCard = RenderService.prototype.renderCard;

RenderService.prototype.renderCard = async function (viewModel, options = {}) {
  const result = await renderCard.call(this, viewModel, options);
  if (themeMatrixEnabled) {
    const serialized = JSON.stringify(viewModel);
    const fixtureId = createHash('sha256').update(serialized).digest('hex').slice(0, 12);
    const candidateState = (viewModel as RenderViewModel & { state?: unknown }).state;
    const state = typeof candidateState === 'string' ? candidateState : 'default';
    const key = `${viewModel.template}:${state}`;
    const previous = themeMatrixCandidates.get(key);
    if (!previous || serialized.length > previous.size) {
      themeMatrixCandidates.set(key, {
        template: viewModel.template,
        state,
        fixtureId,
        viewModel: JSON.parse(serialized) as RenderViewModel,
        size: serialized.length,
      });
    }
  }
  if ((options.width ?? 960) !== 360) {
    const serialized = JSON.stringify(viewModel);
    const theme = options.theme ?? 'bangumi-dark';
    const key = createHash('sha256').update(`${theme}:${serialized}`).digest('hex');
    if (!auditedKeys.has(key)) {
      pendingRenders.push({
        template: viewModel.template,
        viewModel: JSON.parse(serialized) as RenderViewModel,
        theme,
      });
      auditedKeys.add(key);
    }
  }
  return result;
};

afterEach(async () => {
  for (const captured of pendingRenders.splice(0)) {
    for (const width of [320, 360, 520]) {
      const html = renderHtmlTemplate(captured.viewModel, captured.theme, {}, width);
      const layout = await measureRenderRootLayout(html, width);
      expect(layout.clientWidth).toBe(width);
      expect(
        layout.scrollWidth,
        `[MOBILE_LAYOUT_AUDIT] ${captured.template} overflow at ${width}px: ${JSON.stringify(layout)}`,
      ).toBe(width);
      expect(
        layout.overflowing,
        `[MOBILE_LAYOUT_AUDIT] ${captured.template} elements cross the ${width}px viewport: ${JSON.stringify(layout)}`,
      ).toEqual([]);
    }
    observedTemplates.add(captured.template);
  }
});

afterAll(async () => {
  if (themeMatrixEnabled) await generateThemeMatrix();
  await closeMobileLayoutBrowser();
  console.info(
    `[MOBILE_LAYOUT_AUDIT] ${auditedKeys.size} unique fixtures across ${observedTemplates.size} templates`,
  );
});

async function generateThemeMatrix(): Promise<void> {
  const runId =
    process.env.PARIYA_RENDER_THEME_MATRIX_RUN_ID ??
    new Date().toISOString().replace(/[:.]/gu, '-');
  const captureId = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const outputDir = path.resolve(
    process.cwd(),
    '.artifacts',
    `render-theme-matrix-${runId}`,
    captureId,
  );
  await mkdir(outputDir, { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];
  const mobileFailures: string[] = [];

  for (const candidate of themeMatrixCandidates.values()) {
    const imageUrls = extractImageUrls(candidate.viewModel);
    const resolvedImages = imageUrls.reduce<Record<string, string>>((images, url, index) => {
      const image = syntheticImageData[index % syntheticImageData.length];
      if (url && image) images[url] = image;
      return images;
    }, {});
    for (const theme of themeMatrixThemes) {
      for (const width of themeMatrixWidths) {
        const html = renderHtmlTemplate(candidate.viewModel, theme, resolvedImages, width);
        const { png, layout } = await renderThemePreview(html, width);
        const filename = `${candidate.template}-${candidate.state}-${candidate.fixtureId}-${theme}-${width}.png`;
        await writeFile(path.join(outputDir, filename), png);
        manifest.push({
          template: candidate.template,
          state: candidate.state,
          fixtureId: candidate.fixtureId,
          theme,
          cssWidth: width,
          filename,
          pngWidth: png.readUInt32BE(16),
          pngHeight: png.readUInt32BE(20),
          bytes: png.length,
          sha256: createHash('sha256').update(png).digest('hex'),
          layout,
          visualReview: 'pending_manual_inspection',
        });
        if (
          width <= 520 &&
          (layout.clientWidth !== width ||
            layout.scrollWidth !== width ||
            layout.overflowing.length > 0)
        ) {
          mobileFailures.push(`${candidate.template}/${candidate.state}/${theme}/${width}`);
        }
      }
    }
  }

  manifest.sort((a, b) =>
    `${a.template}/${a.state}/${a.theme}/${a.cssWidth}`.localeCompare(
      `${b.template}/${b.state}/${b.theme}/${b.cssWidth}`,
    ),
  );
  await writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(
      { runId, captureId, templatesAndStates: themeMatrixCandidates.size, images: manifest },
      null,
      2,
    ),
  );
  console.info(`[THEME_MATRIX] ${manifest.length} PNGs in ${outputDir}`);
  console.info(`[THEME_MATRIX] receipt manifest: ${path.join(outputDir, 'manifest.json')}`);
  if (mobileFailures.length > 0) {
    throw new Error(`Theme matrix mobile layout overflow: ${mobileFailures.join(', ')}`);
  }
}
