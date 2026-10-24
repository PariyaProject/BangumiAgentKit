import { describe, expect, it } from 'vitest';
import {
  getThemeTokens,
  RenderThemeName,
  RENDER_DESIGN_PACK_NAMES,
  RenderDesignPackName,
} from '../../packages/renderer/src/themes/index.js';

function relativeLuminance(color: string): number {
  const oklch = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/u.exec(color);
  if (oklch) {
    // CSS Color 4 §19: OKLCH → OKLab → LMS → D65 XYZ → linear sRGB.
    // https://www.w3.org/TR/css-color-4/#color-conversion-code
    const lightness = Number(oklch[1]) / 100;
    const chroma = Number(oklch[2]);
    const radians = (Number(oklch[3]) * Math.PI) / 180;
    const a = chroma * Math.cos(radians);
    const b = chroma * Math.sin(radians);
    const multiply = (matrix: number[][], vector: number[]) =>
      matrix.map((row) =>
        row.reduce((sum, coefficient, index) => sum + coefficient * vector[index]!, 0),
      );
    const lms = multiply(
      [
        [1, 0.3963377773761749, 0.2158037573099136],
        [1, -0.1055613458156586, -0.0638541728258133],
        [1, -0.0894841775298119, -1.2914855480194092],
      ],
      [lightness, a, b],
    ).map((channel) => channel ** 3);
    const xyz = multiply(
      [
        [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
        [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
        [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
      ],
      lms,
    );
    const rgb = multiply(
      [
        [12831 / 3959, -329 / 214, -1974 / 3959],
        [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
        [705 / 12673, -2585 / 12673, 705 / 667],
      ],
      xyz,
    ).map((channel) => Math.max(0, Math.min(1, channel)));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  }
  if (!/^#[a-f0-9]{6}$/iu.test(color)) throw new Error(`Unsupported test colour: ${color}`);
  const [red, green, blue] = color
    .slice(1)
    .match(/../gu)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('renderer theme text contrast', () => {
  it('computes OKLCH luminance for black, white and sRGB red instead of returning NaN', () => {
    expect(relativeLuminance('oklch(0% 0 0)')).toBeCloseTo(0, 6);
    expect(relativeLuminance('oklch(100% 0 0)')).toBeCloseTo(1, 6);
    expect(relativeLuminance('oklch(62.795536% 0.25768331 29.233885)')).toBeCloseTo(
      relativeLuminance('#ff0000'),
      5,
    );
    expect(() => relativeLuminance('unsupported(1 2 3)')).toThrow('Unsupported test colour');
  });
  const themeCases = RENDER_DESIGN_PACK_NAMES.flatMap((designPack: RenderDesignPackName) =>
    (['bangumi-light', 'bangumi-dark'] as const).map((name: RenderThemeName) => ({
      designPack,
      name,
      theme: getThemeTokens(name, designPack),
    })),
  );

  it.each(themeCases)('$designPack / $name keeps text tokens readable', ({ theme }) => {
    const textColors = [
      theme.text,
      theme.textMuted,
      theme.accent,
      theme.score,
      theme.success,
      theme.warning,
    ];
    const surfaces = [
      theme.background,
      theme.surface,
      theme.surfaceAlt,
      ...Object.values(theme.tones).map((tone) => tone.surface),
    ];

    for (const foreground of textColors) {
      for (const background of surfaces) {
        expect(
          contrastRatio(foreground, background),
          `${theme.name}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(themeCases)(
    '$designPack / $name keeps semantic icon tones legible on their surfaces',
    ({ theme }) => {
      for (const [name, tone] of Object.entries(theme.tones)) {
        expect(
          contrastRatio(tone.foreground, tone.surface),
          `${theme.name} ${name}: ${tone.foreground} on ${tone.surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(themeCases.filter(({ designPack }) => designPack !== 'anime-magazine'))(
    '$designPack / $name defines distinct render masks',
    ({ theme }) => {
      const { masks } = theme.design;
      for (const mask of [
        masks.frame,
        masks.hero,
        masks.cover,
        masks.panel,
        masks.panelAlt,
        masks.progress,
        masks.tag,
      ]) {
        expect(mask).not.toBe('none');
      }
      expect(masks.panel).not.toBe(masks.panelAlt);
    },
  );

  it.each(themeCases.filter(({ designPack }) => designPack === 'anime-magazine'))(
    '$designPack / $name keeps metric panels open while cover geometry belongs to the native component',
    ({ theme }) => {
      expect(theme.design.masks.frame).toBe('none');
      expect(theme.design.masks.panel).toBe('none');
      expect(theme.design.masks.panelAlt).toBe('none');
    },
  );
});
