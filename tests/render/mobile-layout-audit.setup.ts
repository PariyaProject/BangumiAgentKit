import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, afterEach, expect } from 'vitest';
import { extractImageUrls, RenderService } from '../../packages/renderer/src/render-service.js';
import { renderHtmlTemplate } from '../../packages/renderer/src/template-engine.js';
import type { RenderViewModel } from '../../packages/renderer/src/view-models/index.js';
import {
  DEFAULT_RENDER_DESIGN_PACK,
  DEFAULT_RENDER_THEME,
  RENDER_DESIGN_PACK_NAMES,
  type RenderDesignPackName,
  type RenderThemeName,
} from '../../packages/renderer/src/themes/index.js';
import {
  closeMobileLayoutBrowser,
  measureRenderRootLayout,
  renderThemePreview,
} from './helpers/mobile-layout.js';
import {
  normalizeVisualMatrixViewModel,
  VISUAL_MATRIX_RETRIEVED_AT,
  VISUAL_MATRIX_RETRIEVED_AT_LABEL,
} from './helpers/visual-matrix-fixture.js';

const rendererRequire = createRequire(
  path.resolve(process.cwd(), 'packages/renderer/package.json'),
);
const sharp = rendererRequire('sharp') as (input: Buffer) => {
  png: (options: { compressionLevel: number; adaptiveFiltering: boolean }) => {
    toBuffer: () => Promise<Buffer>;
  };
};

interface CapturedRender {
  template: string;
  viewModel: RenderViewModel;
  theme: RenderThemeName;
  designPack: RenderDesignPackName;
}

const pendingRenders: CapturedRender[] = [];
const auditedKeys = new Set<string>();
const observedTemplates = new Set<string>();
const themeMatrixEnabled = process.env.PARIYA_RENDER_THEME_MATRIX === '1';
const designPackMatrixEnabled = process.env.PARIYA_RENDER_DESIGN_PACK_MATRIX === '1';
const visualMatrixEnabled = themeMatrixEnabled || designPackMatrixEnabled;
const visualMatrixStartedAtMs = Date.now();
const themeMatrixCandidates = new Map<
  string,
  { template: string; state: string; viewModel: RenderViewModel; size: number }
>();
const themeMatrixThemes: readonly RenderThemeName[] = themeMatrixEnabled
  ? ['bangumi-light', 'bangumi-dark']
  : [DEFAULT_RENDER_THEME];
const themeMatrixDesignPacks: readonly RenderDesignPackName[] = designPackMatrixEnabled
  ? RENDER_DESIGN_PACK_NAMES
  : [DEFAULT_RENDER_DESIGN_PACK];
const themeMatrixWidths = [320, 360, 520, 640, 960] as const;
const syntheticImageData = [
  readFileSync(path.resolve(process.cwd(), 'tests/render/fixtures/subject-overview-cover.png')),
  readFileSync(path.resolve(process.cwd(), 'tests/render/fixtures/subject-overview-character.png')),
].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`);
const renderCard = RenderService.prototype.renderCard;

RenderService.prototype.renderCard = async function (viewModel, options = {}) {
  const result = await renderCard.call(this, viewModel, options);
  if (visualMatrixEnabled) {
    const parsedViewModel = JSON.parse(JSON.stringify(viewModel)) as RenderViewModel;
    const normalizedViewModel = normalizeVisualMatrixViewModel(parsedViewModel, {
      startedAtMs: visualMatrixStartedAtMs,
      nowMs: Date.now(),
    }) as RenderViewModel;
    const serialized = JSON.stringify(normalizedViewModel);
    const candidateState = (normalizedViewModel as RenderViewModel & { state?: unknown }).state;
    const state = typeof candidateState === 'string' ? candidateState : 'default';
    const key = `${viewModel.template}:${state}`;
    const previous = themeMatrixCandidates.get(key);
    if (!previous || serialized.length > previous.size) {
      themeMatrixCandidates.set(key, {
        template: viewModel.template,
        state,
        viewModel: JSON.parse(serialized) as RenderViewModel,
        size: serialized.length,
      });
    }
  }
  if ((options.width ?? 960) !== 360) {
    const serialized = JSON.stringify(viewModel);
    const theme = options.theme ?? DEFAULT_RENDER_THEME;
    const designPack = options.designPack ?? DEFAULT_RENDER_DESIGN_PACK;
    const key = createHash('sha256').update(`${theme}:${designPack}:${serialized}`).digest('hex');
    if (!auditedKeys.has(key)) {
      pendingRenders.push({
        template: viewModel.template,
        viewModel: JSON.parse(serialized) as RenderViewModel,
        theme,
        designPack,
      });
      auditedKeys.add(key);
    }
  }
  return result;
};

afterEach(async () => {
  for (const captured of pendingRenders.splice(0)) {
    for (const width of [320, 360, 520]) {
      const html = renderHtmlTemplate(
        captured.viewModel,
        captured.theme,
        {},
        width,
        captured.designPack,
      );
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
  if (visualMatrixEnabled) await generateThemeMatrix();
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
  const maskFailures: string[] = [];

  for (const candidate of themeMatrixCandidates.values()) {
    const renderedVariants: Array<{
      designPack: RenderDesignPackName;
      theme: RenderThemeName;
      width: number;
      png: Buffer;
      layout: Awaited<ReturnType<typeof renderThemePreview>>['layout'];
    }> = [];
    const imageUrls = extractImageUrls(candidate.viewModel);
    const resolvedImages = imageUrls.reduce<Record<string, string>>((images, url, index) => {
      const image = syntheticImageData[index % syntheticImageData.length];
      if (url && image) images[url] = image;
      return images;
    }, {});
    for (const designPack of themeMatrixDesignPacks) {
      for (const theme of themeMatrixThemes) {
        for (const width of themeMatrixWidths) {
          const html = renderHtmlTemplate(
            candidate.viewModel,
            theme,
            resolvedImages,
            width,
            designPack,
          );
          const { png, layout } = await renderThemePreview(html, width);
          const panelMasks = layout.maskReceipts?.panels ?? [];
          if (panelMasks.some((mask) => !mask.clipPath || mask.clipPath === 'none')) {
            maskFailures.push(
              `${candidate.template}/${candidate.state}/${designPack}/${theme}/${width} has an invalid panel clip path`,
            );
          }
          const progressMasks = layout.maskReceipts?.progressTracks ?? [];
          if (progressMasks.some((clipPath) => !clipPath || clipPath === 'none')) {
            maskFailures.push(
              `${candidate.template}/${candidate.state}/${designPack}/${theme}/${width} has an invalid progress clip path`,
            );
          }
          const canonicalPng = await sharp(png)
            .png({ compressionLevel: 9, adaptiveFiltering: false })
            .toBuffer();
          renderedVariants.push({ designPack, theme, width, png: canonicalPng, layout });
          if (
            width <= 520 &&
            (layout.clientWidth !== width ||
              layout.scrollWidth !== width ||
              layout.overflowing.length > 0)
          ) {
            mobileFailures.push(
              `${candidate.template}/${candidate.state}/${designPack}/${theme}/${width}`,
            );
          }
        }
      }
    }

    const panelMasksByPack = new Map<RenderDesignPackName, string>();
    for (const designPack of themeMatrixDesignPacks) {
      const sample = renderedVariants.find(
        (variant) =>
          variant.designPack === designPack &&
          variant.theme === themeMatrixThemes[0] &&
          variant.width === themeMatrixWidths[0],
      );
      const panels = sample?.layout.maskReceipts?.panels ?? [];
      const clipPath =
        panels.find((mask) => mask.kind === 'panel' && mask.clipPath !== 'none')?.clipPath ??
        panels.find((mask) => mask.kind === 'panel-alt' && mask.clipPath !== 'none')?.clipPath;
      if (clipPath) panelMasksByPack.set(designPack, clipPath);
    }
    if (panelMasksByPack.size > 0 && panelMasksByPack.size !== themeMatrixDesignPacks.length) {
      maskFailures.push(
        `${candidate.template}/${candidate.state} does not apply a primary or alternate panel mask in every design pack`,
      );
    }
    if (
      panelMasksByPack.size === themeMatrixDesignPacks.length &&
      new Set(panelMasksByPack.values()).size !== themeMatrixDesignPacks.length
    ) {
      maskFailures.push(
        `${candidate.template}/${candidate.state} shares a rendered panel shape across design packs`,
      );
    }

    const visualFixtureDigest = createHash('sha256');
    for (const variant of renderedVariants) {
      visualFixtureDigest
        .update(`${variant.designPack}\0${variant.theme}\0${variant.width}\0`)
        .update(createHash('sha256').update(variant.png).digest('hex'))
        .update('\0');
    }
    const fixtureId = visualFixtureDigest.digest('hex').slice(0, 12);

    for (const variant of renderedVariants) {
      const filename = `${candidate.template}-${candidate.state}-${fixtureId}-${variant.designPack}-${variant.theme}-${variant.width}.png`;
      await writeFile(path.join(outputDir, filename), variant.png);
      manifest.push({
        template: candidate.template,
        state: candidate.state,
        fixtureId,
        designPack: variant.designPack,
        theme: variant.theme,
        cssWidth: variant.width,
        filename,
        pngWidth: variant.png.readUInt32BE(16),
        pngHeight: variant.png.readUInt32BE(20),
        bytes: variant.png.length,
        sha256: createHash('sha256').update(variant.png).digest('hex'),
        layout: variant.layout,
        visualReview: 'pending_manual_inspection',
      });
    }
  }

  manifest.sort((a, b) =>
    `${a.template}/${a.state}/${a.designPack}/${a.theme}/${a.cssWidth}`.localeCompare(
      `${b.template}/${b.state}/${b.designPack}/${b.theme}/${b.cssWidth}`,
    ),
  );
  const maskAudit = manifest.reduce<{
    imagesWithPrimaryPanelMask: number;
    imagesWithAlternatePanelMask: number;
    imagesWithProgressMask: number;
  }>(
    (audit, item) => {
      const receipts = (item.layout as Awaited<ReturnType<typeof renderThemePreview>>['layout'])
        .maskReceipts;
      if (!receipts) return audit;
      if (receipts.panels.some((mask) => mask.kind === 'panel' && mask.clipPath !== 'none')) {
        audit.imagesWithPrimaryPanelMask += 1;
      }
      if (receipts.panels.some((mask) => mask.kind === 'panel-alt' && mask.clipPath !== 'none')) {
        audit.imagesWithAlternatePanelMask += 1;
      }
      if (receipts.progressTracks.some((clipPath) => clipPath !== 'none')) {
        audit.imagesWithProgressMask += 1;
      }
      return audit;
    },
    { imagesWithPrimaryPanelMask: 0, imagesWithAlternatePanelMask: 0, imagesWithProgressMask: 0 },
  );
  await writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(
      {
        runId,
        captureId,
        visualFixtureTimestampPolicy: {
          fields: ['retrievedAt', 'retrievedAtLabel'],
          scope: 'retrieval metadata within five minutes of the visual-matrix session clock',
          normalizedTo: VISUAL_MATRIX_RETRIEVED_AT,
          normalizedLabel: VISUAL_MATRIX_RETRIEVED_AT_LABEL,
          historicalRetrievalTimestampsPreserved: true,
          eventTimestampsPreserved: true,
        },
        visualFixtureIdentityPolicy:
          'fixtureId is SHA-256 over ordered design-pack/theme/width keys and canonical PNG SHA-256 values for all variants',
        templatesAndStates: themeMatrixCandidates.size,
        designPacks: themeMatrixDesignPacks,
        themes: themeMatrixThemes,
        maskAudit,
        maskFailures,
        images: manifest,
      },
      null,
      2,
    ),
  );
  console.info(`[VISUAL_MATRIX] ${manifest.length} PNGs in ${outputDir}`);
  console.info(`[VISUAL_MATRIX] receipt manifest: ${path.join(outputDir, 'manifest.json')}`);
  if (mobileFailures.length > 0) {
    throw new Error(`Theme matrix mobile layout overflow: ${mobileFailures.join(', ')}`);
  }
  if (maskFailures.length > 0) {
    throw new Error(`Theme matrix mask audit failed: ${maskFailures.join('; ')}`);
  }
}
