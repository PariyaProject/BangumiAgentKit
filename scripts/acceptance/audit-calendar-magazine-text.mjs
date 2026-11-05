/* global document, NodeFilter, getComputedStyle */
/** DOM-only typography audit. Pixels/cache/real clients are separate evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { renderHtmlTemplate } from '../../packages/renderer/dist/template-engine.js';
import {
  getDefaultRenderTypographyOptions,
  resolveRenderTypography,
} from '../../packages/renderer/dist/typography.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(new URL('../../packages/renderer/package.json', import.meta.url));
const { chromium } = require('playwright');
const sharp = require('sharp');
const output = process.argv[2];
const regressionsOnly = process.argv[3] === '--regressions';
if (!output || (process.argv.length !== 3 && !(process.argv.length === 4 && regressionsOnly)))
  throw Error('Pass one fresh output JSON path and optional --regressions.');
const file = await fs.open(output, 'wx');
const fixtureBytes = await fs.readFile(
  path.join(root, 'tests/fixtures/render/calendar-compact.json'),
);
const sourceFiles = Object.fromEntries(
  await Promise.all(
    [
      'packages/renderer/src/templates/CalendarCard.tsx',
      'packages/renderer/src/template-engine.ts',
      'packages/renderer/src/themes/anime-magazine.ts',
      'packages/renderer/src/typography.ts',
      'scripts/acceptance/audit-calendar-magazine-text.mjs',
    ].map(async (name) => [
      name,
      createHash('sha256')
        .update(await fs.readFile(path.join(root, name)))
        .digest('hex'),
    ]),
  ),
);
const fixtures = JSON.parse(fixtureBytes).cases;
// Text geometry depends on fixed CSS cover boxes, not on photographic pixels.
// One local pixel avoids repeating native image work or storing large HTML files.
const pixel =
  'data:image/png;base64,' +
  (
    await sharp({ create: { width: 1, height: 1, channels: 4, background: '#ffffff' } })
      .png()
      .toBuffer()
  ).toString('base64');
const images = Object.fromEntries(
  ['https://calendar-fixture.invalid/a.png', 'https://calendar-fixture.invalid/b.png'].map(
    (url) => [url, pixel],
  ),
);
const typography = await resolveRenderTypography(
  getDefaultRenderTypographyOptions('anime-magazine'),
);
const browser = await chromium.launch({ headless: true });
const results = [];
let networkAttempts = 0;
try {
  const context = await browser.newContext();
  await context.route(/^https?:/u, async (route) => {
    networkAttempts++;
    await route.abort();
  });
  const page = await context.newPage();
  for (const specimen of fixtures)
    for (const width of [320, 375, 414, 768])
      for (const theme of ['bangumi-light', 'bangumi-dark'])
        for (const scale of [0.75, 1.25]) {
          if (
            regressionsOnly &&
            !(
              (specimen.id === 'bounded-large' && width === 320 && scale === 1.25) ||
              (specimen.id === 'long-missing-covers' && width === 375 && scale === 0.75)
            )
          )
            continue;
          await page.setViewportSize({ width, height: 800 });
          await page.setContent(
            renderHtmlTemplate(specimen.viewModel, theme, images, width, 'anime-magazine', {
              ...typography,
              fontSizeScale: scale,
            }),
          );
          await page.evaluate(() => document.fonts.ready);
          const audit = await page.evaluate(() => {
            const frame = document.querySelector('[data-render-root]');
            const bounds = frame.getBoundingClientRect();
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            const rgba = (css) => {
              context.clearRect(0, 0, 1, 1);
              context.fillStyle = css;
              context.fillRect(0, 0, 1, 1);
              return [...context.getImageData(0, 0, 1, 1).data].map((v, i) =>
                i === 3 ? v / 255 : v,
              );
            };
            const background = (element) => {
              if (!element) return [255, 255, 255, 1];
              const color = rgba(getComputedStyle(element).backgroundColor);
              if (color[3] >= 0.999) return color;
              const under = background(element.parentElement);
              return color.map((v, i) => (i === 3 ? 1 : v * color[3] + under[i] * (1 - color[3])));
            };
            const luminance = (color) =>
              color.slice(0, 3).reduce((sum, value, index) => {
                const c = value / 255;
                return (
                  sum +
                  (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
                    [0.2126, 0.7152, 0.0722][index]
                );
              }, 0);
            const issues = [];
            let minContrast = Infinity;
            const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              if (!node.textContent.trim()) continue;
              const ink = luminance(rgba(getComputedStyle(node.parentElement).color)),
                paper = luminance(background(node.parentElement));
              const contrast = (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
              minContrast = Math.min(minContrast, contrast);
              if (contrast < 4.5) issues.push('Low contrast: ' + node.textContent.slice(0, 50));
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const rect of range.getClientRects())
                if (
                  rect.left < bounds.left - 0.75 ||
                  rect.right > bounds.right + 0.75 ||
                  rect.top < bounds.top - 0.75 ||
                  rect.bottom > bounds.bottom + 0.75
                )
                  issues.push('Outside card: ' + node.textContent.slice(0, 50));
            }
            const titleLines = [];
            for (const title of frame.querySelectorAll(
              '[data-calendar-item-title], [data-calendar-original-title]',
            )) {
              const node = title.firstChild;
              if (!node || node.nodeType !== 3) continue;
              const lines = new Map();
              for (let i = 0; i < node.textContent.length; i++) {
                const range = document.createRange();
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rect = range.getBoundingClientRect();
                if (!rect.width) continue;
                const top = Math.round(rect.top);
                lines.set(top, (lines.get(top) ?? '') + node.textContent[i]);
              }
              const text = [...lines.values()].map((line) => line.trim()).filter(Boolean);
              titleLines.push({
                lineCount: text.length,
                lastLineGlyphs: [...(text.at(-1) ?? '')].length,
              });
              if (
                text.length > 1 &&
                text.some((line) => /^[、。，！？；：）」』】》〉]$/.test(line))
              )
                issues.push('Isolated punctuation');
              if (text.length > 1 && [...(text.at(-1) ?? '')].length === 1)
                issues.push('Isolated final title glyph');
            }
            return { issues, minContrast, titleLines, height: bounds.height };
          });
          results.push({ state: specimen.id, width, theme, scale, ...audit });
        }
} finally {
  await browser.close();
  await file.writeFile(
    JSON.stringify(
      {
        schema: 'calendar-magazine-text-audit/v1',
        sourceFiles,
        fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
        typography: typography.cacheIdentity,
        results,
        networkAttempts,
        limits:
          'DOM typography only. Fixed local cover boxes; no PNG/cache/account/client equivalence claim.',
      },
      null,
      2,
    ) + '\n',
  );
  await file.close();
}
const failures = results.filter((row) => row.issues.length);
console.log(
  JSON.stringify({
    cases: results.length,
    failures: failures.map(({ state, width, theme, scale, issues }) => ({
      state,
      width,
      theme,
      scale,
      issues,
    })),
    networkAttempts,
  }),
);
if (failures.length || networkAttempts || results.length !== (regressionsOnly ? 4 : 128))
  process.exitCode = 1;
