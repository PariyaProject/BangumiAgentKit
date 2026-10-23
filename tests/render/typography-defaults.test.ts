import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_FONT_SIZE_SCALE,
  getDefaultRenderTypographyOptions,
  resolveRenderTypography,
} from '../../packages/renderer/src/typography.js';

const FONT_DIRECTORY = path.resolve('packages/renderer/assets/fonts');

async function fontHash(filename: string): Promise<string> {
  const bytes = await readFile(path.join(FONT_DIRECTORY, filename));
  return createHash('sha256').update(bytes).digest('hex');
}

describe('design-pack default render typography', () => {
  it('keeps Warm Editorial on its existing paired system stacks at the compact scale', async () => {
    const options = getDefaultRenderTypographyOptions('warm-editorial');
    expect(options.fontSizeScale).toBe(DEFAULT_RENDER_FONT_SIZE_SCALE);
    expect(options.bodyFontFile).toBeUndefined();
    expect(options.displayFontFile).toBeUndefined();

    const resolved = await resolveRenderTypography(options);
    expect(resolved.fontFaces).toEqual([]);
  });

  it('loads the bundled rounded body face for Clean Gallery', async () => {
    const options = getDefaultRenderTypographyOptions('clean-gallery');
    expect(options).toMatchObject({
      bodyFontFamily: 'GenSen Rounded',
      bodyFontFile: 'GenSenRounded2TW-R.woff2',
      displayFontFamily: 'GenSen Rounded',
      fontSizeScale: DEFAULT_RENDER_FONT_SIZE_SCALE,
    });
    const resolved = await resolveRenderTypography(options);
    expect(resolved.fontFaces.map(({ role, sha256 }) => ({ role, sha256 }))).toEqual([
      { role: 'body', sha256: await fontHash('GenSenRounded2TW-R.woff2') },
    ]);
  });

  it('pairs the rounded body and Ma Shan Zheng display face for Graphic Zine', async () => {
    const options = getDefaultRenderTypographyOptions('graphic-zine');
    expect(options).toMatchObject({
      bodyFontFamily: 'GenSen Rounded',
      bodyFontFile: 'GenSenRounded2TW-R.woff2',
      displayFontFamily: 'Ma Shan Zheng',
      displayFontFile: 'MaShanZheng-Regular.woff2',
      fontSizeScale: DEFAULT_RENDER_FONT_SIZE_SCALE,
    });
    const resolved = await resolveRenderTypography(options);
    expect(resolved.fontFaces.map(({ role, sha256 }) => ({ role, sha256 }))).toEqual([
      { role: 'body', sha256: await fontHash('GenSenRounded2TW-R.woff2') },
      { role: 'display', sha256: await fontHash('MaShanZheng-Regular.woff2') },
    ]);
  });

  it('does not let an operator font override silently fall back to the bundled directory', async () => {
    const options = getDefaultRenderTypographyOptions('graphic-zine', {
      bodyFontFile: 'operator-body.woff2',
    });
    expect(options.bodyFontFile).toBe('operator-body.woff2');
    expect(options.displayFontFile).toBeUndefined();
    expect(options.fontDirectory).toBeUndefined();
    await expect(resolveRenderTypography(options)).rejects.toThrow(
      'BANGUMI_RENDER_FONT_DIR is required when a custom font file is configured.',
    );
  });
});
