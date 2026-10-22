#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { RenderService } from '../../packages/renderer/dist/index.js';
import {
  createRuntimeDependenciesWithStorage,
  ToolRegistry,
} from '../../packages/tools/dist/index.js';
import {
  createRenderSubjectCardOfflineAssetGuard,
  createRenderSubjectCardOfflineFetch,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID,
} from '../lib/render-subject-card-offline-profile.mjs';
import { getAgentMcpProfileById } from '../lib/agent-mcp-profile-claims.mjs';

const PROFILE = getAgentMcpProfileById(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID);
const OUTPUT_DIRECTORY = mkdtempSync(path.join(os.tmpdir(), 'bgk-run95-render-card-v4-visual-qa-'));
const CELL_WIDTH = 360;
const CELL_HEADER_HEIGHT = 34;
const VARIANTS = [
  { theme: 'bangumi-light', designPack: 'warm-editorial' },
  { theme: 'bangumi-light', designPack: 'clean-gallery' },
  { theme: 'bangumi-light', designPack: 'graphic-zine' },
  { theme: 'bangumi-dark', designPack: 'warm-editorial' },
  { theme: 'bangumi-dark', designPack: 'clean-gallery' },
  { theme: 'bangumi-dark', designPack: 'graphic-zine' },
];
const rendererRequire = createRequire(
  new URL('../../packages/renderer/package.json', import.meta.url),
);
const sharp = rendererRequire('sharp');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeXml(value) {
  return value.replace(/[<>&"']/gu, (character) => {
    const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
    return entities[character];
  });
}

function labelSvg(label) {
  return Buffer.from(
    '<svg width="' +
      CELL_WIDTH +
      '" height="' +
      CELL_HEADER_HEIGHT +
      '" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f4f0e8"/><text x="10" y="23" font-family="sans-serif" font-size="14" fill="#27323a">' +
      escapeXml(label) +
      '</text></svg>',
  );
}

async function renderVariant(variant) {
  process.env.BANGUMI_RENDER_THEME = variant.theme;
  process.env.BANGUMI_RENDER_DESIGN_PACK = variant.designPack;

  const fixture = createRenderSubjectCardOfflineFetch(PROFILE);
  const assetGuard = createRenderSubjectCardOfflineAssetGuard();
  const renderService = new RenderService(undefined, undefined, assetGuard.assetResolver);
  const storage = new MemoryStorage();
  const artifactBuffers = [];
  const artifactStore = {
    async saveArtifact(buffer, mimeType = 'image/png', size = {}) {
      artifactBuffers.push(Buffer.from(buffer));
      return {
        id: 'render-subject-card-v4-visual-qa',
        mimeType,
        ...size,
        expiresAt: '2099-01-01T00:00:00.000Z',
      };
    },
  };
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient: new HttpClient({
      baseUrl: 'https://api.bgm.tv',
      fetchFn: fixture.fetchFn,
    }),
    renderService,
    artifactStore,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });

  try {
    const result = await registry.executeTool(PROFILE.toolName, PROFILE.calls[0].arguments, {
      principalId: 'anonymous',
      botInstanceId: 'render-subject-card-v4-visual-qa',
      conversationId: 'render-subject-card-v4-visual-qa',
    });
    const artifact = result && result.artifact;
    const png = artifactBuffers[0];
    const fetchBoundary = fixture.snapshot();
    const assetBoundary = assetGuard.snapshot();
    if (
      !artifact ||
      artifact.mimeType !== 'image/png' ||
      artifact.width !== 720 ||
      !Number.isInteger(artifact.height) ||
      artifact.height <= 0 ||
      artifactBuffers.length !== 1 ||
      !png ||
      png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      fetchBoundary.requestCount !== 1 ||
      fetchBoundary.unexpectedRequestCount !== 0 ||
      fetchBoundary.authorizationHeaderCount !== 0 ||
      fetchBoundary.collectionRequestCount !== 0 ||
      assetBoundary.assetResolutionCallCount !== 0 ||
      assetBoundary.nonEmptyAssetUrlCount !== 0 ||
      assetBoundary.blockedAssetRequestCount !== 0
    ) {
      throw new Error('RENDER_SUBJECT_CARD_V4_VISUAL_QA_ASSERTION_FAILED');
    }

    const filename = variant.designPack + '-' + variant.theme + '.png';
    const imagePath = path.join(OUTPUT_DIRECTORY, filename);
    writeFileSync(imagePath, png, { flag: 'wx', mode: 0o600 });
    const metadata = await sharp(png).metadata();
    return {
      theme: variant.theme,
      designPack: variant.designPack,
      file: filename,
      width: metadata.width,
      height: metadata.height,
      byteLength: png.length,
      sha256: sha256(png),
      fixtureRequestCount: fetchBoundary.requestCount,
      externalAssetRequestCount: assetBoundary.assetResolutionCallCount,
    };
  } finally {
    await registry.close();
    await storage.close();
  }
}

async function main() {
  if (!PROFILE || PROFILE.id !== RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID) {
    throw new Error('RENDER_SUBJECT_CARD_V4_VISUAL_QA_PROFILE_UNAVAILABLE');
  }

  const originalTheme = process.env.BANGUMI_RENDER_THEME;
  const originalDesignPack = process.env.BANGUMI_RENDER_DESIGN_PACK;
  const results = [];
  try {
    for (const variant of VARIANTS) results.push(await renderVariant(variant));
  } finally {
    if (originalTheme === undefined) delete process.env.BANGUMI_RENDER_THEME;
    else process.env.BANGUMI_RENDER_THEME = originalTheme;
    if (originalDesignPack === undefined) delete process.env.BANGUMI_RENDER_DESIGN_PACK;
    else process.env.BANGUMI_RENDER_DESIGN_PACK = originalDesignPack;
  }

  const cellHeight =
    CELL_HEADER_HEIGHT +
    Math.max(...results.map((result) => Math.round((result.height * CELL_WIDTH) / 720)));
  const layers = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const image = await sharp(path.join(OUTPUT_DIRECTORY, result.file))
      .resize({ width: CELL_WIDTH })
      .png()
      .toBuffer();
    const x = (index % 3) * CELL_WIDTH;
    const y = Math.floor(index / 3) * cellHeight;
    layers.push({ input: labelSvg(result.designPack + ' / ' + result.theme), left: x, top: y });
    layers.push({ input: image, left: x, top: y + CELL_HEADER_HEIGHT });
  }
  const contactSheetPath = path.join(OUTPUT_DIRECTORY, 'comparison.png');
  await sharp({
    create: {
      width: CELL_WIDTH * 3,
      height: cellHeight * 2,
      channels: 4,
      background: '#f4f0e8',
    },
  })
    .composite(layers)
    .png()
    .toFile(contactSheetPath);

  const manifestPath = path.join(OUTPUT_DIRECTORY, 'manifest.json');
  const manifest = {
    profileId: PROFILE.id,
    fixtureSubjectId: PROFILE.calls[0].arguments.subjectId,
    previewOnly: true,
    agentMcpClaimCreated: false,
    externalApiRequestCount: 0,
    variants: results,
    comparison: {
      file: path.basename(contactSheetPath),
      width: CELL_WIDTH * 3,
      height: cellHeight * 2,
      sha256: sha256(await sharp(contactSheetPath).toBuffer()),
    },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  process.stdout.write(
    JSON.stringify({
      outputDirectory: OUTPUT_DIRECTORY,
      comparison: contactSheetPath,
      variants: results.length,
      profileId: PROFILE.id,
      agentMcpClaimCreated: false,
    }) + '\n',
  );
}

main().catch(() => {
  process.stderr.write('RENDER_SUBJECT_CARD_V4_VISUAL_QA_FAILED\n');
  process.exitCode = 1;
});
