import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeRenderCacheKey,
  RenderService,
  SubjectCardViewModel,
} from '@bangumi-agent-kit/renderer';
import {
  normalizeRenderTypographyOptions,
  renderHtmlTemplate,
  resolveRenderTypography,
  scaleInlineFontSizeDeclarations,
} from '../../packages/renderer/src/internal/index.js';

const tempDirectories: string[] = [];

async function createFontDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bgk-render-font-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('renderer typography configuration', () => {
  it('keeps default typography scale at 1 and scales rendered CSS font-size values', () => {
    expect(normalizeRenderTypographyOptions()).toMatchObject({ fontSizeScale: 1 });
    expect(
      scaleInlineFontSizeDeclarations(
        '<span style="font-size: 12px; line-height: 1.4">Type</span>',
        0.75,
      ),
    ).toBe('<span style="font-size: 9px; line-height: 1.4">Type</span>');
  });

  it('rejects invalid scales and CSS-injection-like font-family values', () => {
    expect(() => normalizeRenderTypographyOptions({ fontSizeScale: 0.74 })).toThrow(
      'RENDER_VALIDATION_ERROR',
    );
    expect(() => normalizeRenderTypographyOptions({ fontSizeScale: 1.26 })).toThrow(
      'RENDER_VALIDATION_ERROR',
    );
    expect(() =>
      normalizeRenderTypographyOptions({ bodyFontFamily: 'Safe Font; color:red' }),
    ).toThrow('RENDER_VALIDATION_ERROR');
    expect(() => normalizeRenderTypographyOptions({ bodyFontFile: '../outside.woff2' })).toThrow(
      'RENDER_VALIDATION_ERROR',
    );
  });

  it('loads bounded font files from the configured directory and binds their content hash', async () => {
    const fontDirectory = await createFontDirectory();
    await writeFile(
      path.join(fontDirectory, 'rounded.woff2'),
      Buffer.from('synthetic-font-fixture'),
    );

    const typography = await resolveRenderTypography({
      fontSizeScale: 0.75,
      bodyFontFamily: 'Rounded Fixture, sans-serif',
      fontDirectory,
      bodyFontFile: 'rounded.woff2',
    });

    expect(typography.fontFaces).toHaveLength(1);
    const bodyFace = typography.fontFaces[0];
    expect(bodyFace).toMatchObject({
      role: 'body',
      family: 'Rounded Fixture',
      format: 'woff2',
    });
    expect(bodyFace?.dataUrl).toMatch(/^data:font\/woff2;base64,/);
    expect(typography.cacheIdentity.bodyFontSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses configured font roles and scale in static HTML and the render cache key', async () => {
    const fontDirectory = await createFontDirectory();
    await writeFile(
      path.join(fontDirectory, 'rounded.woff2'),
      Buffer.from('synthetic-font-fixture'),
    );
    const viewModel: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 1, name: '字体测试作品', type: 'anime' },
      source: { label: 'Typography fixture' },
    };
    const typography = await resolveRenderTypography({
      fontSizeScale: 0.75,
      bodyFontFamily: 'Rounded Fixture, sans-serif',
      fontDirectory,
      bodyFontFile: 'rounded.woff2',
    });
    const html = renderHtmlTemplate(
      viewModel,
      'bangumi-light',
      {},
      320,
      'clean-gallery',
      typography,
    );

    expect(html).toContain('@font-face{font-family:"Rounded Fixture"');
    expect(html).toContain('font-size:9px');
    const normalKey = computeRenderCacheKey(viewModel);
    const scaledKey = computeRenderCacheKey(viewModel, {
      typography: { fontSizeScale: 0.75 },
    });
    const fontKey = computeRenderCacheKey(
      viewModel,
      { typography: { fontSizeScale: 0.75, bodyFontFile: 'rounded.woff2' } },
      {},
      { body: typography.cacheIdentity.bodyFontSha256 },
    );
    expect(normalKey).not.toBe(scaledKey);
    expect(scaledKey).not.toBe(fontKey);
  });

  it('rejects invalid renderer typography before asset resolution or browser rendering', async () => {
    const resolveAsset = vi.fn();
    const service = new RenderService(undefined, undefined, { resolveAsset } as never);
    const viewModel: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 1,
        name: 'Validation fixture',
        type: 'anime',
        image: 'https://lain.bgm.tv/cover.jpg',
      },
      source: { label: 'Typography fixture' },
    };

    await expect(
      service.renderCard(viewModel, { typography: { fontSizeScale: 0.5 } }),
    ).rejects.toMatchObject({ code: 'RENDER_VALIDATION_ERROR' });
    expect(resolveAsset).not.toHaveBeenCalled();
    await service.close();
  });
});
