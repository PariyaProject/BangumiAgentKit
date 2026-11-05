/* global document, NodeFilter, Node */
/** Closed synthetic native calendar QA. Never runs an acceptance profile. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { RenderService } from '../../packages/renderer/dist/index.js';
import { BrowserPool } from '../../packages/renderer/dist/browser-pool.js';
import {
  getDefaultRenderTypographyOptions,
  resolveRenderTypography,
} from '../../packages/renderer/dist/typography.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(
  new URL('../../packages/renderer/package.json', import.meta.url),
)('playwright');
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--output' || args[2] !== '--baseline') {
  throw Error(
    'Usage: node render-calendar-magazine-qa.mjs --output /fresh/dir --baseline /before/receipt.json',
  );
}
const output = path.resolve(args[1]);
const baselinePath = path.resolve(args[3]);
const fixturePath = path.join(root, 'tests/fixtures/render/calendar-compact.json');
const fixtures = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
if (fixtures.schema !== 'calendar-magazine-synthetic-fixtures/v1' || fixtures.cases.length !== 8)
  throw Error('Invalid closed fixture');
const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
if (
  baseline.schema !== 'run95-calendar-before-change-host-baseline/v1' ||
  baseline.results.length !== 32
)
  throw Error('Invalid before-change baseline');
await fs.mkdir(output); // Create-only: never replace previous evidence or previews.
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const sourcePaths = [
  'packages/renderer/src/templates/CalendarCard.tsx',
  'packages/renderer/src/render-service.ts',
  'scripts/acceptance/render-calendar-magazine-qa.mjs',
  'tests/fixtures/render/calendar-compact.json',
];
const sourceFiles = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (name) => [name, hash(await fs.readFile(path.join(root, name)))]),
  ),
);
const urls = ['https://calendar-fixture.invalid/a.png', 'https://calendar-fixture.invalid/b.png'];
const assets = Object.fromEntries(
  await Promise.all(
    urls.map(async (url, i) => [
      url,
      'data:image/png;base64,' +
        (
          await fs.readFile(
            path.join(root, `tests/fixtures/render/anime-magazine-cover-${i ? 'g' : 'f'}.png`),
          )
        ).toString('base64'),
    ]),
  ),
);
let assetRequests = 0;
let externalRequests = 0;
const deny = () => {
  externalRequests++;
  throw Error('External network denied');
};
globalThis.fetch = deny;
const resolver = {
  resolveAsset: async (url) => {
    if (!assets[url]) return deny();
    assetRequests++;
    return { dataUrl: assets[url] };
  },
};
class ObservedPool extends BrowserPool {
  lastHtml = '';
  async renderHtmlToBuffer(html, options) {
    this.lastHtml = html;
    return super.renderHtmlToBuffer(html, options);
  }
}
const pool = new ObservedPool();
const render = new RenderService(pool, undefined, resolver);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 1 });
await context.route('**/*', async (route) => {
  if (route.request().url().startsWith('data:')) return route.continue();
  externalRequests++;
  await route.abort();
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const results = [];
const failures = [];
let executionFailure = null;
try {
  const packs = ['anime-magazine', 'warm-editorial', 'clean-gallery', 'graphic-zine'];
  for (const designPack of packs) {
    const cases = designPack === 'anime-magazine' ? fixtures.cases : [fixtures.cases[0]];
    for (const specimen of cases) {
      for (const theme of ['bangumi-light', 'bangumi-dark']) {
        for (const width of [320, 375, 414, 768]) {
          const scales = designPack === 'anime-magazine' && width === 320 ? [0.75, 1.25] : [0.75];
          for (const scale of scales) {
            const typography = await resolveRenderTypography(
              getDefaultRenderTypographyOptions(designPack, { fontSizeScale: scale }),
            );
            const options = {
              designPack,
              theme,
              width,
              deviceScaleFactor: 1,
              cache: false,
              typography: { fontSizeScale: scale },
            };
            const result = await render.renderCard(specimen.viewModel, options);
            const html = pool.lastHtml;
            await page.setViewportSize({ width, height: 800 });
            await page.setContent(html, { waitUntil: 'load' });
            await page.evaluate(() => document.fonts.ready);
            const dom = await page.evaluate(
              (families) => {
                const frame = document.querySelector('[data-render-root]');
                const bounds = frame.getBoundingClientRect();
                const outside = [];
                const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode())) {
                  if (!node.textContent.trim()) continue;
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  for (const rect of range.getClientRects()) {
                    if (
                      rect.left < bounds.left - 1 ||
                      rect.right > bounds.right + 1 ||
                      rect.bottom > bounds.bottom + 1
                    ) {
                      outside.push(node.textContent.slice(0, 80));
                      break;
                    }
                  }
                }
                const orphanLines = [];
                for (const element of frame.querySelectorAll(
                  '[data-calendar-item-title], [data-calendar-original-title]',
                )) {
                  const text = element.firstChild;
                  if (text?.nodeType !== Node.TEXT_NODE || text.textContent.length < 2) continue;
                  const lines = new Map();
                  for (let i = 0; i < text.textContent.length; i++) {
                    const range = document.createRange();
                    range.setStart(text, i);
                    range.setEnd(text, i + 1);
                    const rect = range.getBoundingClientRect();
                    if (!rect.width) continue;
                    const top = Math.round(rect.top);
                    lines.set(top, (lines.get(top) ?? '') + text.textContent[i]);
                  }
                  const values = [...lines.values()].map((line) => line.trim()).filter(Boolean);
                  if (
                    values.length > 1 &&
                    values.some((line) => /^[、。，！？；：）」』】》〉]$/.test(line))
                  )
                    orphanLines.push(...values.filter((line) => line.length === 1));
                }
                return {
                  width: bounds.width,
                  height: bounds.height,
                  horizontalOverflow: document.documentElement.scrollWidth > bounds.width,
                  outsideText: outside,
                  isolatedPunctuation: orphanLines,
                  brokenImages: [...frame.querySelectorAll('img')].filter(
                    (img) => !img.complete || !img.naturalWidth,
                  ).length,
                  loadedFonts: families.map((family) => ({
                    family,
                    loaded: document.fonts.check(`12px ${JSON.stringify(family)}`, '界'),
                  })),
                  titleCount: frame.querySelectorAll('[data-calendar-item-title]').length,
                };
              },
              typography.fontFaces.map((face) => face.family),
            );
            const key = `${designPack}-${specimen.id}-${theme}-${width}-${scale}`;
            if (designPack === 'anime-magazine') {
              const { root: documentRoot } = await cdp.send('DOM.getDocument');
              let { nodeId } = await cdp.send('DOM.querySelector', {
                nodeId: documentRoot.nodeId,
                selector: '[data-calendar-item-title]',
              });
              if (!nodeId)
                ({ nodeId } = await cdp.send('DOM.querySelector', {
                  nodeId: documentRoot.nodeId,
                  selector: '[data-calendar-layout] > div > span:last-child',
                }));
              const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
              dom.usedFonts = fonts.map(({ familyName, isCustomFont, glyphCount }) => ({
                familyName,
                isCustomFont,
                glyphCount,
              }));
              if (!fonts.some((font) => font.isCustomFont && font.glyphCount > 0))
                failures.push(key);
            }
            const expectedItems = specimen.viewModel.days.reduce(
              (count, day) => count + day.items.length,
              0,
            );
            if (
              dom.horizontalOverflow ||
              dom.outsideText.length ||
              dom.isolatedPunctuation.length ||
              dom.brokenImages ||
              dom.loadedFonts.some((font) => !font.loaded) ||
              (designPack === 'anime-magazine' && dom.titleCount !== expectedItems)
            )
              failures.push(key);
            const beforeKey = `${designPack}-${theme}-${width}`;
            const old = baseline.results.find((record) => record.key === beforeKey);
            const record = {
              key,
              designPack,
              state: specimen.id,
              theme,
              cssWidth: width,
              scale,
              width: result.width,
              height: result.height,
              bytes: result.buffer.length,
              htmlBytes: Buffer.byteLength(html),
              pngSha256: hash(result.buffer),
              htmlSha256: hash(html),
              cacheKey: result.cacheKey,
              dom,
              typography: typography.cacheIdentity,
              preview: null,
            };
            if (designPack !== 'anime-magazine') {
              record.baseline = {
                htmlEqual: record.htmlSha256 === old.htmlSha256,
                pngEqual: record.pngSha256 === old.pngSha256,
                cacheEqual: record.cacheKey === old.cacheKey,
              };
              if (Object.values(record.baseline).some((same) => !same)) failures.push(key);
            } else if (specimen.id === 'partial-three' && scale === 0.75) {
              record.oldCacheRejected = record.cacheKey !== old.cacheKey;
              if (!record.oldCacheRejected || (width === 375 && result.height > 680))
                failures.push(key);
            }
            const keep =
              designPack === 'anime-magazine' &&
              ((width === 375 && theme === 'bangumi-light') ||
                (width === 320 && theme === 'bangumi-dark') ||
                (specimen.id === 'long-missing-covers' && width === 320));
            if (keep) {
              record.preview = key + '.png';
              await fs.writeFile(path.join(output, record.preview), result.buffer);
            }
            results.push(record);
            await fs.appendFile(path.join(output, 'results.jsonl'), JSON.stringify(record) + '\n');
          }
        }
      }
      console.log(JSON.stringify({ designPack, state: specimen.id, completed: results.length }));
    }
  }
} catch (error) {
  executionFailure = {
    code: error.code ?? error.name,
    reason: String(error.message).slice(0, 500),
    completedCases: results.length,
  };
} finally {
  await render.close();
  await browser.close();
}
const receipt = {
  schema: 'run95-calendar-magazine-native-synthetic-qa/v1',
  sourceHead,
  sourceFiles,
  fixturesSha256: hash(await fs.readFile(fixturePath)),
  baselineSha256: hash(await fs.readFile(baselinePath)),
  results,
  failures: [...new Set(failures)],
  assetRequests,
  externalRequests,
  executionFailure,
  limits: [
    'Offline synthetic host renderer only; not native VM account compatibility or actual client/aesthetic acceptance.',
    'Only selected previews retained; all case hashes, loaded fonts and text bounds recorded.',
  ],
};
await fs.writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
if (receipt.failures.length || externalRequests || executionFailure || results.length !== 104)
  throw Error(`Native QA failed; inspect ${path.join(output, 'receipt.json')}`);
console.log(
  JSON.stringify({
    output,
    cases: results.length,
    retainedPreviews: results.filter((record) => record.preview).length,
    externalRequests,
  }),
);
