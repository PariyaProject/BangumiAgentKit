/* global document, window */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CollectionIntelligenceService,
  buildCollectionIntelligence,
} from '../../packages/bangumi-core/dist/index.js';
import { formatAuthStatusMessage } from '../../packages/auth/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import {
  buildCollectionIntelligenceViewModel,
  buildCollectionProgressViewModel,
  renderHtmlTemplate,
} from '../../packages/renderer/dist/index.js';
import { AssetResolver } from '../../packages/renderer/dist/asset-resolver.js';
import { handleOAuthCallbackRoute } from '../../apps/api/dist/routes/oauth.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WIDTHS = [320, 360, 520, 640, 960];
const OUTPUT_DIR = path.join(
  repoRoot,
  '.artifacts/render/ux001-auth-personal-visual-qa-2026-10-18',
);
const rendererRequire = createRequire(path.join(repoRoot, 'packages/renderer/package.json'));
const standaloneRequire = createRequire(path.join(repoRoot, 'apps/standalone/package.json'));
const sharp = rendererRequire('sharp');
const { chromium } = standaloneRequire('playwright');

function sourceMetadata(sourceTotal, requestedMaxItems, sourceExhausted) {
  return {
    sourceTotal,
    requestedMaxItems,
    pageSize: requestedMaxItems,
    pagesAttempted: 1,
    pagesSucceeded: 1,
    maxPages: 8,
    sourceExhausted,
    paginationStalled: false,
    sourceTotalChanged: false,
    attemptedAt: '2026-10-18T00:00:00.000Z',
    retrievedAt: '2026-10-18T00:00:01.000Z',
  };
}

function collectionItems() {
  return [
    {
      subjectId: 101,
      subjectName: 'Synthetic anime title with a deliberately long English name',
      subjectNameCn: '合成的中文收藏标题：少女终末旅行以及需要检查换行的扩展标题',
      subjectType: 'anime',
      status: 'doing',
      rating: 9,
      tags: ['科幻', '旅行', '冒险'],
      epStatus: 6,
      updatedAt: '2026-10-17T12:00:00.000Z',
    },
    {
      subjectId: 102,
      subjectName: 'Synthetic sparse item',
      subjectType: 'book',
      status: 'wish',
      tags: [],
    },
  ];
}

function intelligenceCases(unavailable) {
  const completeItems = [
    collectionItems()[0],
    {
      subjectId: 102,
      subjectName: 'Synthetic complete book item',
      subjectType: 'book',
      status: 'wish',
      rating: 8,
      tags: ['奇幻'],
      epStatus: 0,
      updatedAt: '2026-10-16T12:00:00.000Z',
    },
  ];
  const complete = buildCollectionIntelligence(completeItems, sourceMetadata(2, 2, true));
  const partial = buildCollectionIntelligence(collectionItems(), sourceMetadata(80, 2, false));
  const empty = buildCollectionIntelligence([], sourceMetadata(0, 20, true));
  return [
    {
      id: 'collection-intelligence-complete',
      viewModel: buildCollectionIntelligenceViewModel(complete),
      expectedText: ['我的收藏智能概览', '覆盖完整', '观察条目', '最近更新', '统计口径'],
      adjacentMessage: '合成收藏结果为完整观察；当前账号和覆盖状态应与图片一致。',
    },
    {
      id: 'collection-intelligence-partial-long-script',
      viewModel: buildCollectionIntelligenceViewModel(partial),
      expectedText: ['我的收藏智能概览', '部分覆盖', '部分样本', '数据说明', '统计口径'],
      adjacentMessage: '合成收藏来源只返回观察样本；文字与图片都必须保留部分覆盖状态。',
    },
    {
      id: 'collection-intelligence-empty',
      viewModel: buildCollectionIntelligenceViewModel(empty),
      expectedText: ['我的收藏智能概览', '覆盖完整', '暂无收藏条目', '当前统计为 0 条'],
      adjacentMessage: '合成账号有完整的空收藏结果；不得把空结果描述成读取失败。',
    },
    {
      id: 'collection-intelligence-unavailable',
      viewModel: buildCollectionIntelligenceViewModel(unavailable),
      expectedText: ['暂不可用', '官方收藏暂时不可读取', '未用猜测填补结果'],
      adjacentMessage: '合成上游错误；状态应为暂不可用，不得把未知计数显示为零。',
    },
  ];
}

function progressCases(coverUrl, coverDataUrl, failedCoverUrl, failedCoverDataUrl, warningCode) {
  const complete = buildCollectionProgressViewModel(
    { id: 101, name: 'Synthetic anime title', nameCn: '合成条目：少女终末旅行', image: coverUrl },
    {
      status: 'doing',
      statusLabel: '在看',
      watchedEpisodes: 6,
      totalEpisodes: 12,
      rating: 9,
      comment: 'Synthetic comment for visual QA only.',
    },
  );
  const long = buildCollectionProgressViewModel(
    {
      id: 102,
      name: 'A very long Latin title for Bangumi mobile result cards and wrapping behavior',
      nameCn: '超长中文标题：授权后的个人收藏进度卡片需要在手机宽度上保持清晰层级',
      image: coverUrl,
    },
    {
      status: 'doing',
      statusLabel: '进行中',
      watchedEpisodes: 18,
      totalEpisodes: 26,
      rating: 8,
      comment:
        '这是一段纯合成的长简评。It mixes Latin and Chinese text to exercise safe wrapping without any real account content.',
    },
  );
  const sparse = buildCollectionProgressViewModel(
    { id: 103, name: 'Synthetic title without optional fields' },
    { status: 'wish', statusLabel: '想看', watchedEpisodes: 0 },
  );
  const failedCover = buildCollectionProgressViewModel(
    {
      id: 104,
      name: 'Synthetic item with failed cover delivery',
      nameCn: '封面加载失败时仍应保留条目进度',
      image: failedCoverUrl,
    },
    {
      status: 'done',
      statusLabel: '已完成',
      watchedEpisodes: 12,
      totalEpisodes: 12,
      rating: 10,
    },
  );
  return [
    {
      id: 'collection-progress-complete',
      viewModel: complete,
      resolvedImages: { [coverUrl]: coverDataUrl },
      expectedImageCount: 1,
      expectedText: ['合成条目：少女终末旅行', '在看', '已看 6 / 12 集'],
      adjacentMessage: '已绑定合成账号；此卡片展示同一合成条目的个人收藏进度。',
    },
    {
      id: 'collection-progress-long-mixed-script',
      viewModel: long,
      resolvedImages: { [coverUrl]: coverDataUrl },
      expectedImageCount: 1,
      expectedText: ['超长中文标题', '进行中', '18 / 26 集'],
      adjacentMessage: '长中英标题和简评均为合成数据；进度和评分状态应与图片一致。',
    },
    {
      id: 'collection-progress-missing-cover-fields',
      viewModel: sparse,
      resolvedImages: {},
      expectedImageCount: 0,
      expectedText: ['Synthetic title without optional fields', '想看', '已看 0 集'],
      adjacentMessage: '合成条目没有封面、总集数或评分；缺失值应保持缺失。',
    },
    {
      id: 'collection-progress-cover-fetch-failure',
      viewModel: failedCover,
      resolvedImages: { [failedCoverUrl]: failedCoverDataUrl },
      expectedImageCount: 0,
      expectedText: ['封面加载失败时仍应保留条目进度', '封面暂不可用', '已看 12 / 12 集'],
      adjacentMessage: '合成封面请求失败；渲染仍提供占位图并保留状态与进度。',
      assetWarningCodes: [warningCode],
    },
  ];
}

async function callbackPages() {
  const successService = {
    consumeCallbackState: async () => undefined,
    handleCallback: async () => ({
      accountId: 'synthetic-account',
      principalId: 'synthetic-principal',
      username: 'synthetic-user-with-long-name',
      nickname: '合成账号Synthetic Account with a deliberately long display name',
    }),
  };
  const cancelledService = {
    consumeCallbackState: async () => undefined,
    handleCallback: async () => {
      throw new Error('must not exchange a denied authorization');
    },
  };
  const invalidService = {
    consumeCallbackState: async () => {
      throw new Error('synthetic invalid state details must not render');
    },
    handleCallback: async () => {
      throw new Error('must not use invalid state');
    },
  };
  const failedService = {
    consumeCallbackState: async () => undefined,
    handleCallback: async () => {
      throw new Error('synthetic internal error details must not render');
    },
  };
  const success = await handleOAuthCallbackRoute(successService)(
    'synthetic-code',
    'synthetic-state',
  );
  const cancelled = await handleOAuthCallbackRoute(cancelledService)(
    undefined,
    'synthetic-state',
    'access_denied',
  );
  const invalid = await handleOAuthCallbackRoute(invalidService)(
    undefined,
    'synthetic-state',
    'access_denied',
  );
  const failed = await handleOAuthCallbackRoute(failedService)('synthetic-code', 'synthetic-state');
  return [
    {
      id: 'callback-success-long-identity',
      html: success.body,
      expectedText: ['绑定成功', 'Synthetic Account', '下一步'],
    },
    {
      id: 'callback-provider-denial',
      html: cancelled.body,
      expectedText: ['授权已取消', '已有绑定状态没有改变', '下一步'],
    },
    {
      id: 'callback-invalid-state',
      html: invalid.body,
      expectedText: ['无法确认这次 Bangumi 授权请求', '下一步'],
    },
    {
      id: 'callback-internal-failure',
      html: failed.body,
      expectedText: ['授权未完成', '下一步'],
    },
  ];
}

function normalizedText(value) {
  return value.replace(/\s+/gu, ' ').trim();
}

async function capturePage(browser, id, width, html, expectedText, extra = {}) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images, async (image) => {
        try {
          await image.decode();
        } catch {
          // A broken URL is represented by the renderer's explicit fallback block.
        }
      }),
    );
  });
  const pageText = await page.locator('body').innerText();
  const documentMetrics = await page.evaluate(() => ({
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
    images: Array.from(document.images, (image) => ({
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      x: Math.round(image.getBoundingClientRect().x),
      y: Math.round(image.getBoundingClientRect().y),
      width: Math.round(image.getBoundingClientRect().width),
      height: Math.round(image.getBoundingClientRect().height),
    })),
  }));
  if (
    extra.expectedImageCount !== undefined &&
    documentMetrics.images.length !== extra.expectedImageCount
  ) {
    throw new Error(
      `${id} at ${width}px rendered ${documentMetrics.images.length} images; expected ${extra.expectedImageCount}`,
    );
  }
  if (documentMetrics.images.some((image) => !image.complete || image.naturalWidth === 0)) {
    throw new Error(`${id} at ${width}px has an unloaded image`);
  }
  const filePath = path.join(OUTPUT_DIR, `${id}-w${width}.png`);
  const png = Buffer.from(await page.screenshot({ path: filePath, fullPage: true }));
  const imageMetadata = await sharp(png).metadata();
  await page.close();
  const documentText = normalizedText(pageText);
  return {
    id,
    widthCssPx: width,
    widthPx: imageMetadata.width ?? width,
    heightPx: imageMetadata.height ?? 0,
    sha256: createHash('sha256').update(png).digest('hex'),
    file: path.relative(repoRoot, filePath),
    horizontalOverflow: documentMetrics.documentWidth > documentMetrics.viewportWidth,
    expectedTextPresent: expectedText.map((expected) =>
      documentText.includes(normalizedText(expected)),
    ),
    imageElements: documentMetrics.images,
    documentText,
    assetWarningCodes: [],
    manualVisualReview: 'pending',
    ...extra,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const coverSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#172554" />
          <stop offset="0.52" stop-color="#7c3aed" />
          <stop offset="1" stop-color="#f97316" />
        </linearGradient>
        <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#22d3ee" />
          <stop offset="1" stop-color="#f0abfc" />
        </linearGradient>
      </defs>
      <rect width="300" height="420" fill="url(#sky)" />
      <circle cx="224" cy="112" r="76" fill="#fde68a" fill-opacity="0.82" />
      <path d="M0 286 88 177l55 62 45-70 112 132v119H0Z" fill="#0f172a" fill-opacity="0.84" />
      <path d="M0 321 78 239l46 45 73-97 103 120v113H0Z" fill="#1e293b" fill-opacity="0.92" />
      <path d="M18 292 111 219l-18 86 70-49 43 63H18Z" fill="url(#ribbon)" fill-opacity="0.9" />
      <circle cx="48" cy="72" r="3" fill="#fff" />
      <circle cx="80" cy="112" r="2" fill="#fff" />
      <circle cx="156" cy="54" r="3" fill="#fff" />
      <circle cx="261" cy="206" r="2" fill="#fff" />
      <rect x="20" y="329" width="260" height="1" fill="#fff" fill-opacity="0.65" />
      <text x="22" y="361" fill="#fff" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1">SYNTHETIC</text>
      <text x="22" y="386" fill="#fff" font-family="Arial, sans-serif" font-size="15" letter-spacing="2">COLLECTION POSTER</text>
      <text x="22" y="406" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="9" letter-spacing="1.5">VISUAL QA ONLY · NO REAL ARTWORK</text>
    </svg>
  `;
  const coverPng = await sharp(Buffer.from(coverSvg)).png().toBuffer();
  const coverDataUrl = `data:image/png;base64,${coverPng.toString('base64')}`;
  const coverUrl = 'https://fixture.invalid/synthetic-cover.png';
  const failedCoverUrl = 'https://fixture.invalid/synthetic-cover-failure.png';
  const fakeTransport = {
    request: async (url) => {
      if (url === failedCoverUrl) throw new Error('synthetic asset transport failure');
      return {
        status: 200,
        headers: { 'content-type': 'image/png' },
        buffer: coverPng,
        url,
      };
    },
  };
  const fakeResolver = {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
  };
  const assetResolver = new AssetResolver(fakeTransport, fakeResolver);
  const failedAsset = await assetResolver.resolveAsset(failedCoverUrl);
  if (!failedAsset.warning) throw new Error('Synthetic cover failure did not produce a warning');

  const unavailable = await new CollectionIntelligenceService(
    new GeneratedBangumiOpenApiClient(
      new HttpClient({
        fetchFn: async () =>
          new Response(JSON.stringify({ message: 'synthetic upstream failure' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
      }),
    ),
  ).getCollectionIntelligence('synthetic-user');
  const visualCases = [
    ...progressCases(
      coverUrl,
      coverDataUrl,
      failedCoverUrl,
      failedAsset.dataUrl,
      failedAsset.warning.code,
    ),
    ...intelligenceCases(unavailable),
  ];
  const pages = await callbackPages();
  const authStatusMessages = {
    unbound: formatAuthStatusMessage({ bound: false, accountCount: 0 }),
    inactive: formatAuthStatusMessage({ bound: false, accountCount: 2 }),
    boundWithoutCredential: formatAuthStatusMessage({
      bound: true,
      accountCount: 1,
      account: { username: 'synthetic-user', nickname: '合成账号' },
    }),
    boundWithCredential: formatAuthStatusMessage({
      bound: true,
      accountCount: 1,
      account: { username: 'synthetic-user', nickname: '合成账号' },
      credential: { expiresAt: '2026-10-20T10:00:00.000Z', refreshable: true },
    }),
  };

  const browser = await chromium.launch({ headless: true });
  const records = [];
  try {
    for (const page of pages) {
      for (const width of WIDTHS) {
        records.push(await capturePage(browser, page.id, width, page.html, page.expectedText));
      }
    }
    for (const visualCase of visualCases) {
      for (const width of WIDTHS) {
        const html = renderHtmlTemplate(
          visualCase.viewModel,
          'bangumi-dark',
          visualCase.resolvedImages ?? {},
          width,
        );
        records.push(
          await capturePage(browser, visualCase.id, width, html, visualCase.expectedText, {
            adjacentMessage: visualCase.adjacentMessage,
            assetWarningCodes: visualCase.assetWarningCodes ?? [],
            expectedImageCount: visualCase.expectedImageCount,
          }),
        );
      }
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fixtureOnly: true,
    liveOauthOrAccountRequests: 0,
    qqOrTimActions: 0,
    deviceScaleFactor: 1,
    widthsCssPx: WIDTHS,
    callbackPageCount: pages.length,
    collectionRendererCaseCount: visualCases.length,
    imageCount: records.length,
    authStatusMessages,
    records,
  };
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      state: records.every(
        (record) => !record.horizontalOverflow && record.expectedTextPresent.every(Boolean),
      )
        ? 'AUTOMATED_LAYOUT_CHECKS_PASS'
        : 'VISUAL_REVIEW_REQUIRED',
      imageCount: records.length,
      callbackPageCount: pages.length,
      collectionRendererCaseCount: visualCases.length,
      cssWidths: WIDTHS,
      overflowImages: records.filter((record) => record.horizontalOverflow).length,
      missingTextChecks: records.filter((record) =>
        record.expectedTextPresent.some((value) => !value),
      ).length,
      manifestPath: path.relative(repoRoot, manifestPath),
    })}\n`,
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
