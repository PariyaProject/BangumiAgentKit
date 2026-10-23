#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderService } from '../../packages/renderer/dist/index.js';
import {
  getDefaultRenderTypographyOptions,
  resolveRenderTypography,
} from '../../packages/renderer/dist/typography.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_ID = process.env.PARIYA_UX002_IMAGE_RUN_ID ?? 'run95-ux002-v19-image-bearing-local';
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/u.test(RUN_ID)) {
  throw new Error('PARIYA_UX002_IMAGE_RUN_ID is invalid.');
}
const COVERS_DIRECTORY = path.resolve(
  process.env.PARIYA_UX002_COVERS_DIR ?? path.join(ROOT, '.artifacts/ux002-v19-covers'),
);
const OUTPUT_DIRECTORY = path.join(
  ROOT,
  '.artifacts',
  `ux002-v19-image-bearing-${RUN_ID}`,
);
const PACKS = ['warm-editorial', 'clean-gallery', 'graphic-zine'];
const THEMES = ['bangumi-light', 'bangumi-dark'];
const WIDTHS = [320, 360, 375, 414, 520, 640, 768, 960];
const SCALE = 2;
const SOURCE_PATHS = [
  'packages/renderer/src/components/TitleBlock.tsx',
  'packages/renderer/src/render-service.ts',
  'packages/renderer/src/templates/SubjectCard.tsx',
  'packages/renderer/src/themes/index.ts',
  'packages/renderer/src/typography.ts',
  'packages/renderer/assets/fonts/GenSenRounded2TW-R.woff2',
  'packages/renderer/assets/fonts/MaShanZheng-Regular.woff2',
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function digestFiles(paths) {
  const digest = createHash('sha256');
  const files = {};
  for (const relativePath of paths) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    const hash = sha256(bytes);
    files[relativePath] = hash;
    digest.update(relativePath, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(bytes);
    digest.update('\0', 'utf8');
  }
  return { digest: digest.digest('hex'), files };
}

const viewModel = {
  template: 'subject-card',
  version: 1,
  subject: {
    id: 902025,
    name: 'Star Harbor Chronicle',
    nameCn: '星港纪行',
    type: 'anime',
    date: '2025-04-06',
    image: 'fixture://ux002/v19-pack-cover',
    score: 8.4,
    rank: 128,
    summary: '合成简介：一位旅人在星港迁徙与远航之间寻找新的归属。',
    tags: ['科幻', '冒险', '成长'],
  },
  collection: {
    status: 'do',
    statusLabel: '在看',
    rating: 9,
    episodeProgress: '已看 9 / 12 集',
    progressPercentage: 75,
  },
  source: { label: '合成演示数据' },
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const source = await digestFiles(SOURCE_PATHS);
const coverAssets = {};
for (const pack of PACKS) {
  const bytes = await readFile(path.join(COVERS_DIRECTORY, `${pack}.png`));
  coverAssets[pack] = {
    sha256: sha256(bytes),
    byteLength: bytes.length,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  };
}

const typographyProfiles = {};
for (const pack of PACKS) {
  const resolved = await resolveRenderTypography(getDefaultRenderTypographyOptions(pack));
  typographyProfiles[pack] = {
    fontSizeScale: resolved.fontSizeScale,
    bodyFontFamily: resolved.bodyFontFamily ?? null,
    displayFontFamily: resolved.displayFontFamily ?? null,
    fontFiles: resolved.fontFaces.map((face) => ({ role: face.role, sha256: face.sha256 })),
  };
}

const manifest = {
  schemaVersion: 1,
  runId: RUN_ID,
  generationSourceSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  sourceBase: (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim(),
  sourceDigest: source.digest,
  sourceFiles: source.files,
  sourceData: 'Synthetic Bangumi subject; no public API or account request.',
  coverAssets: Object.fromEntries(
    Object.entries(coverAssets).map(([pack, item]) => [pack, {
      sha256: item.sha256,
      byteLength: item.byteLength,
    }]),
  ),
  typographyProfiles,
  designPacks: PACKS,
  themes: THEMES,
  widthsCssPx: WIDTHS,
  deviceScaleFactor: SCALE,
  externalRequests: 0,
  outputs: [],
};

for (const designPack of PACKS) {
  const coverDataUrl = coverAssets[designPack].dataUrl;
  let assetResolutionCalls = 0;
  const renderer = new RenderService(
    undefined,
    undefined,
    {
      async resolveAsset(url) {
        assetResolutionCalls += 1;
        if (url !== viewModel.subject.image) throw new Error('Unexpected visual-QA asset URL.');
        return { dataUrl: coverDataUrl, warning: undefined };
      },
    },
    12 * 1024 * 1024,
  );
  try {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const rendered = await renderer.renderCard(viewModel, {
          theme,
          designPack,
          width,
          deviceScaleFactor: SCALE,
          format: 'png',
          cache: false,
        });
        const filename = `${designPack}-${theme}-${width}.png`;
        const bytes = rendered.buffer;
        await writeFile(path.join(OUTPUT_DIRECTORY, filename), bytes);
        manifest.outputs.push({
          filename,
          designPack,
          theme,
          cssWidthPx: width,
          pixelWidth: rendered.width,
          pixelHeight: rendered.height,
          byteLength: bytes.length,
          sha256: sha256(bytes),
          warningCount: rendered.warnings.length,
        });
      }
    }
  } finally {
    await renderer.close();
  }
  if (assetResolutionCalls !== THEMES.length * WIDTHS.length) {
    throw new Error(`${designPack} asset resolution count did not match the local render matrix.`);
  }
}

await writeFile(
  path.join(OUTPUT_DIRECTORY, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify({
  runId: RUN_ID,
  sourceDigest: source.digest,
  outputCount: manifest.outputs.length,
  outputDirectory: OUTPUT_DIRECTORY,
  manifestPath: path.join(OUTPUT_DIRECTORY, 'manifest.json'),
}));
