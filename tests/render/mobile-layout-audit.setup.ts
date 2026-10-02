import { createHash } from 'node:crypto';
import { afterAll, afterEach, expect } from 'vitest';
import { RenderService } from '../../packages/renderer/src/render-service.js';
import { renderHtmlTemplate } from '../../packages/renderer/src/template-engine.js';
import type { RenderViewModel } from '../../packages/renderer/src/view-models/index.js';
import { closeMobileLayoutBrowser, measureRenderRootLayout } from './helpers/mobile-layout.js';

interface CapturedRender {
  template: string;
  viewModel: RenderViewModel;
  theme: 'bangumi-dark' | 'bangumi-light';
}

const pendingRenders: CapturedRender[] = [];
const auditedKeys = new Set<string>();
const observedTemplates = new Set<string>();
const renderCard = RenderService.prototype.renderCard;

RenderService.prototype.renderCard = async function (viewModel, options = {}) {
  const result = await renderCard.call(this, viewModel, options);
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
  await closeMobileLayoutBrowser();
  console.info(
    `[MOBILE_LAYOUT_AUDIT] ${auditedKeys.size} unique fixtures across ${observedTemplates.size} templates`,
  );
});
