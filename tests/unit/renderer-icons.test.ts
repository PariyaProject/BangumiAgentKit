import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { RendererIcon } from '../../packages/renderer/src/components/RendererIcon.js';
import { getThemeTokens } from '../../packages/renderer/src/themes/index.js';

const rendererRequire = createRequire(path.join(process.cwd(), 'packages/renderer/package.json'));
const { createElement } = rendererRequire('react') as {
  createElement: (component: unknown, props: unknown) => unknown;
};
const { renderToStaticMarkup } = rendererRequire('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string;
};

function renderSubjectIcon(designPack: 'warm-editorial' | 'clean-gallery' | 'graphic-zine') {
  return renderToStaticMarkup(
    createElement(RendererIcon, {
      name: 'subject',
      theme: getThemeTokens('bangumi-light', designPack),
      badge: true,
    }),
  );
}

describe('renderer icon design packs', () => {
  it('uses separate editorial, gallery-geometric, and filled zine icon constructions', () => {
    const editorial = renderSubjectIcon('warm-editorial');
    const gallery = renderSubjectIcon('clean-gallery');
    const zine = renderSubjectIcon('graphic-zine');

    expect(editorial).toContain('data-icon-treatment="editorial-stamp"');
    expect(editorial).toContain('stroke-linecap="round"');
    expect(editorial).toContain('fill="none"');

    expect(gallery).toContain('data-icon-treatment="gallery-geometry"');
    expect(gallery).toContain('stroke-linecap="square"');
    expect(gallery).toContain('stroke-linejoin="miter"');
    expect(gallery).toContain('<rect x="5" y="3.5" width="14" height="17"></rect>');

    expect(zine).toContain('data-icon-treatment="zine-filled"');
    expect(zine).toContain('fill="currentColor"');
    expect(zine).toContain('<path d="M4 3h10l6 6v12H4z"></path>');
    expect(new Set([editorial, gallery, zine]).size).toBe(3);
  });
});
