/* global document, NodeFilter, getComputedStyle, window */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderHtmlTemplate } from '../../packages/renderer/dist/index.js';
import {
  getDefaultRenderTypographyOptions,
  resolveRenderTypography,
} from '../../packages/renderer/dist/typography.js';

const root = process.cwd();
const fixturesPath = process.argv[2];
const outputPath = process.argv[3];
assert.ok(
  fixturesPath && outputPath,
  'Pass the exported synthetic fixtures JSON and audit output path.',
);
const fixtureBytes = await readFile(fixturesPath);
const fixtures = JSON.parse(fixtureBytes);
assert.deepEqual(Object.keys(fixtures).sort(), [
  'complete',
  'large-counts',
  'long-original',
  'long-titles',
  'missing-covers',
  'partial',
]);
const resolvedImages = {};
for (const key of ['f', 'g']) {
  const bytes = await readFile(
    path.join(root, `tests/fixtures/render/anime-magazine-cover-${key}.png`),
  );
  resolvedImages[`https://render-fixtures.invalid/anime-magazine/${key}.png`] =
    `data:image/png;base64,${bytes.toString('base64')}`;
}
const typography = await resolveRenderTypography(
  getDefaultRenderTypographyOptions('anime-magazine'),
);
const { chromium } = createRequire(
  new URL('../../packages/renderer/package.json', import.meta.url),
)('playwright');
const browser = await chromium.launch({ headless: true });
const results = [];
let networkAttempts = 0;
try {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  await context.route(/^https?:/u, async (route) => {
    networkAttempts++;
    await route.abort();
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  for (const [state, vm] of Object.entries(fixtures)) {
    for (const width of [320, 375, 414, 768]) {
      for (const theme of ['bangumi-light', 'bangumi-dark']) {
        for (const fontSizeScale of [0.75, 1.25]) {
          await page.setViewportSize({ width, height: 1200 });
          await page.setContent(
            renderHtmlTemplate(vm, theme, resolvedImages, width, 'anime-magazine', {
              ...typography,
              fontSizeScale,
            }),
          );
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map((img) => img.decode()));
          });
          const audit = await page.evaluate(
            (expectedOriginalNames) => {
              const rootElement = document.querySelector('[data-render-root]');
              const bounds = rootElement.getBoundingClientRect();
              const issues = [];
              const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
              let minimumFontSize = Infinity;
              let minimumContrast = Infinity;
              let textNodes = 0;
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 1;
              const drawing = canvas.getContext('2d', { willReadFrequently: true });
              const rgba = (css) => {
                drawing.clearRect(0, 0, 1, 1);
                drawing.fillStyle = css;
                drawing.fillRect(0, 0, 1, 1);
                return [...drawing.getImageData(0, 0, 1, 1).data].map((v, i) =>
                  i === 3 ? v / 255 : v,
                );
              };
              const luminance = (rgb) =>
                rgb.slice(0, 3).reduce((sum, c, i) => {
                  const s = c / 255;
                  return (
                    sum +
                    (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) *
                      [0.2126, 0.7152, 0.0722][i]
                  );
                }, 0);
              // Composite translucent caption ink against white: the lightest possible cover pixel.
              const background = (element) => {
                if (!element) return [255, 255, 255, 1];
                const color = rgba(getComputedStyle(element).backgroundColor);
                if (color[3] >= 0.999) return color;
                const under = element.querySelector(':scope > img')
                  ? [255, 255, 255, 1]
                  : background(element.parentElement);
                return color.map((value, i) =>
                  i === 3 ? 1 : value * color[3] + under[i] * (1 - color[3]),
                );
              };
              let node;
              while ((node = walker.nextNode())) {
                if (!node.textContent.trim()) continue;
                const style = getComputedStyle(node.parentElement);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const fontSize = parseFloat(style.fontSize);
                minimumFontSize = Math.min(minimumFontSize, fontSize);
                const ink = luminance(rgba(style.color));
                const paper = luminance(background(node.parentElement));
                const contrast = (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
                minimumContrast = Math.min(minimumContrast, contrast);
                if (contrast < 4.5)
                  issues.push(
                    `Low contrast ${contrast.toFixed(2)}: ${node.textContent.slice(0, 50)}`,
                  );
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) {
                  if (
                    rect.left < bounds.left - 0.75 ||
                    rect.right > bounds.right + 0.75 ||
                    rect.top < bounds.top - 0.75 ||
                    rect.bottom > bounds.bottom + 0.75
                  ) {
                    issues.push(`Text outside card: ${node.textContent.slice(0, 50)}`);
                  }
                }
                textNodes++;
              }
              for (const missing of rootElement.querySelectorAll('[data-cover-state="missing"]')) {
                const caption = missing.parentElement.querySelector('figcaption');
                if (
                  caption &&
                  missing.getBoundingClientRect().bottom >
                    caption.getBoundingClientRect().top + 0.75
                )
                  issues.push('Missing-cover caption overlaps placeholder');
              }
              const originalTitles = [...rootElement.querySelectorAll('[data-original-title]')];
              if (
                JSON.stringify(originalTitles.map((el) => el.textContent).sort()) !==
                JSON.stringify(expectedOriginalNames.sort())
              )
                issues.push('An original source name is missing or truncated');
              for (const caption of originalTitles) {
                const range = document.createRange();
                range.selectNodeContents(caption);
                for (
                  let ancestor = caption.parentElement;
                  ancestor;
                  ancestor = ancestor.parentElement
                ) {
                  const style = getComputedStyle(ancestor);
                  if (
                    !['hidden', 'clip'].includes(style.overflowY) &&
                    !['hidden', 'clip'].includes(style.overflowX)
                  )
                    continue;
                  const clip = ancestor.getBoundingClientRect();
                  for (const rect of range.getClientRects()) {
                    if (
                      rect.left < clip.left - 0.75 ||
                      rect.right > clip.right + 0.75 ||
                      rect.top < clip.top - 0.75 ||
                      rect.bottom > clip.bottom + 0.75
                    )
                      issues.push('Original name clipped by an ancestor of the cover caption');
                  }
                }
              }
              for (const box of rootElement.querySelectorAll(
                '.magazine-score-grid > div, .magazine-metric-row > :not(:first-child)',
              )) {
                const range = document.createRange();
                range.selectNodeContents(box);
                const boxBounds = box.getBoundingClientRect();
                for (const rect of range.getClientRects()) {
                  if (rect.left < boxBounds.left - 0.75 || rect.right > boxBounds.right + 0.75)
                    issues.push(
                      `Text outside its comparison column: ${box.textContent.slice(0, 50)}`,
                    );
                }
              }
              const rootStyle = getComputedStyle(rootElement);
              const contentWidth =
                rootElement.clientWidth -
                parseFloat(rootStyle.paddingLeft) -
                parseFloat(rootStyle.paddingRight);
              if (contentWidth <= 20 * parseFloat(rootStyle.fontSize)) {
                for (const label of rootElement.querySelectorAll('.magazine-metric-label')) {
                  const parentStyle = getComputedStyle(label.parentElement);
                  const rowContentWidth =
                    label.parentElement.clientWidth -
                    parseFloat(parentStyle.paddingLeft) -
                    parseFloat(parentStyle.paddingRight);
                  if (label.getBoundingClientRect().width < rowContentWidth - 0.75)
                    issues.push('Large-font metric label does not span its full row');
                }
              }
              const scores = [...rootElement.querySelectorAll('[data-metric="score"]')].map(
                (el) => el.getBoundingClientRect().top,
              );
              if (scores.length === 2 && Math.abs(scores[0] - scores[1]) > 0.75)
                issues.push('A/B scores are misaligned');
              const lastLineGlyphCounts = [];
              for (const h2 of rootElement.querySelectorAll('h2')) {
                if (h2.textContent.length < 12 || !h2.firstChild) continue;
                const lines = new Map();
                for (let offset = 0; offset < h2.firstChild.length; offset++) {
                  const range = document.createRange();
                  range.setStart(h2.firstChild, offset);
                  range.setEnd(h2.firstChild, offset + 1);
                  const y = Math.round(range.getBoundingClientRect().top);
                  lines.set(y, (lines.get(y) ?? 0) + 1);
                }
                const count = [...lines.values()].at(-1);
                lastLineGlyphCounts.push(count);
                if (count === 1) issues.push('Isolated final glyph in a long subject title');
              }
              if (minimumFontSize < 12) issues.push('Default font size below 12 CSS px');
              if (document.documentElement.scrollWidth > window.innerWidth)
                issues.push('Horizontal viewport overflow');
              return {
                issues,
                textNodes,
                minimumFontSize,
                minimumContrast,
                lastLineGlyphCounts,
                height: bounds.height,
              };
            },
            vm.cohorts.flatMap((cohort) =>
              cohort.subjects[0]?.name ? [cohort.subjects[0].name] : [],
            ),
          );
          const { root: dom } = await cdp.send('DOM.getDocument');
          const { nodeId } = await cdp.send('DOM.querySelector', {
            nodeId: dom.nodeId,
            selector: 'h1',
          });
          const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
          assert.ok(
            fonts.some((font) => font.isCustomFont && font.glyphCount > 0),
            'Title must use the bundled custom font, not silently fall back.',
          );
          const result = {
            state,
            width,
            theme,
            fontSizeScale,
            ...audit,
            titleFonts: fonts.map(({ familyName, isCustomFont, glyphCount }) => ({
              familyName,
              isCustomFont,
              glyphCount,
            })),
          };
          results.push(result);
        }
      }
    }
  }
} finally {
  await browser.close();
}
const issues = results.flatMap((result) =>
  result.issues.map((issue) => `${result.state}/${result.theme}/${result.width}: ${issue}`),
);
const receipt = {
  schema: 'bangumi-native-design-dom-audit/v1',
  fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
  designPack: 'anime-magazine',
  networkAttempts,
  results,
  issues,
};
await writeFile(outputPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ cases: results.length, networkAttempts, issues, outputPath }));
assert.equal(networkAttempts, 0);
assert.deepEqual(issues, []);
