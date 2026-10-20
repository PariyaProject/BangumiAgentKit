import { describe, expect, it } from 'vitest';
import {
  getThemeTokens,
  RenderThemeName,
  RENDER_DESIGN_PACK_NAMES,
  RenderDesignPackName,
} from '../../packages/renderer/src/themes/index.js';

function relativeLuminance(color: string): number {
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
});
