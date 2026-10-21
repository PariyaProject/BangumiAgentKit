import crypto from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { RendererError } from './errors.js';

export const MIN_RENDER_FONT_SIZE_SCALE = 0.75;
export const MAX_RENDER_FONT_SIZE_SCALE = 1.25;
const MAX_RENDER_FONT_FILE_BYTES = 20 * 1024 * 1024;

const GENERIC_FAMILIES = new Set([
  'cursive',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif',
]);

const FONT_FORMATS: Record<string, { mime: string; format: string }> = {
  '.otf': { mime: 'font/otf', format: 'opentype' },
  '.ttf': { mime: 'font/ttf', format: 'truetype' },
  '.woff': { mime: 'font/woff', format: 'woff' },
  '.woff2': { mime: 'font/woff2', format: 'woff2' },
};

export interface RenderTypographyOptions {
  /** A global multiplier for template font sizes. Defaults to 1. */
  fontSizeScale?: number;
  /** Optional comma-separated CSS family stack for body copy. */
  bodyFontFamily?: string;
  /** Optional comma-separated CSS family stack for display text. */
  displayFontFamily?: string;
  /** Absolute, operator-configured directory containing only trusted local fonts. */
  fontDirectory?: string;
  /** Font file basenames within fontDirectory. Paths and traversal are rejected. */
  bodyFontFile?: string;
  displayFontFile?: string;
}

export interface ResolvedRenderFontFace {
  role: 'body' | 'display';
  family: string;
  dataUrl: string;
  format: string;
  sha256: string;
}

export interface ResolvedRenderTypography {
  fontSizeScale: number;
  bodyFontFamily?: string;
  displayFontFamily?: string;
  fontFaces: ResolvedRenderFontFace[];
  cacheIdentity: {
    fontSizeScale: number;
    bodyFontFamily?: string;
    displayFontFamily?: string;
    bodyFontSha256?: string;
    displayFontSha256?: string;
  };
}

export const DEFAULT_RESOLVED_RENDER_TYPOGRAPHY: ResolvedRenderTypography = {
  fontSizeScale: 1,
  fontFaces: [],
  cacheIdentity: { fontSizeScale: 1 },
};

interface ParsedFontFamily {
  name: string;
  css: string;
  generic: boolean;
}

function invalidTypography(message: string): never {
  throw new RendererError('RENDER_VALIDATION_ERROR', message);
}

function parseFontFamilyStack(value: string): ParsedFontFamily[] {
  if (value.length > 512) {
    invalidTypography('Configured font family stack exceeds 512 characters.');
  }

  const rawNames = value.split(',').map((item) => item.trim());
  if (rawNames.length === 0 || rawNames.length > 16 || rawNames.some((item) => !item)) {
    invalidTypography('Configured font family stack must contain 1 to 16 non-empty names.');
  }

  return rawNames.map((rawName) => {
    const hasOuterDoubleQuotes = rawName.startsWith('"') && rawName.endsWith('"');
    const hasOuterSingleQuotes = rawName.startsWith("'") && rawName.endsWith("'");
    const name = hasOuterDoubleQuotes || hasOuterSingleQuotes ? rawName.slice(1, -1) : rawName;
    if (!name || name.length > 80 || !/^[\p{L}\p{N}_ -]+$/u.test(name)) {
      invalidTypography(
        'Configured font family names may contain only letters, numbers, spaces, _ and -.',
      );
    }

    const generic = GENERIC_FAMILIES.has(name.toLowerCase());
    return { name, generic, css: generic ? name : `"${name}"` };
  });
}

export function normalizeFontFamilyStack(value: string): string {
  return parseFontFamilyStack(value)
    .map((family) => family.css)
    .join(', ');
}

function configuredFontFileName(value: string | undefined, role: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (
    value.length > 160 ||
    value === '.' ||
    value === '..' ||
    path.basename(value) !== value ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    invalidTypography(`Configured ${role} font must be a file basename inside the font directory.`);
  }

  const extension = path.extname(value).toLowerCase();
  if (!FONT_FORMATS[extension]) {
    invalidTypography(`Configured ${role} font must use .otf, .ttf, .woff, or .woff2.`);
  }
  return value;
}

export function normalizeRenderTypographyOptions(
  options: RenderTypographyOptions = {},
): RenderTypographyOptions & { fontSizeScale: number } {
  const fontSizeScale = options.fontSizeScale ?? 1;
  if (
    !Number.isFinite(fontSizeScale) ||
    fontSizeScale < MIN_RENDER_FONT_SIZE_SCALE ||
    fontSizeScale > MAX_RENDER_FONT_SIZE_SCALE
  ) {
    invalidTypography(
      `fontSizeScale must be between ${MIN_RENDER_FONT_SIZE_SCALE} and ${MAX_RENDER_FONT_SIZE_SCALE}.`,
    );
  }

  const bodyFontFamily = options.bodyFontFamily
    ? normalizeFontFamilyStack(options.bodyFontFamily)
    : undefined;
  const displayFontFamily = options.displayFontFamily
    ? normalizeFontFamilyStack(options.displayFontFamily)
    : undefined;
  const bodyFontFile = configuredFontFileName(options.bodyFontFile, 'body');
  const displayFontFile = configuredFontFileName(options.displayFontFile, 'display');
  const hasFontFiles = Boolean(bodyFontFile || displayFontFile);
  const fontDirectory = options.fontDirectory?.trim()
    ? path.resolve(options.fontDirectory.trim())
    : undefined;

  if (hasFontFiles && !fontDirectory) {
    invalidTypography('BANGUMI_RENDER_FONT_DIR is required when a custom font file is configured.');
  }
  if (hasFontFiles && options.fontDirectory && !path.isAbsolute(options.fontDirectory)) {
    invalidTypography('Configured font directory must be an absolute path.');
  }

  return {
    fontSizeScale,
    bodyFontFamily,
    displayFontFamily,
    fontDirectory,
    bodyFontFile,
    displayFontFile,
  };
}

async function loadFontFace(
  role: 'body' | 'display',
  fontFile: string,
  fontDirectory: string,
  familyOverride: string | undefined,
): Promise<ResolvedRenderFontFace> {
  try {
    const directory = await realpath(fontDirectory);
    const candidate = path.resolve(directory, fontFile);
    const relativeCandidate = path.relative(directory, candidate);
    if (relativeCandidate.startsWith('..') || path.isAbsolute(relativeCandidate)) {
      invalidTypography(`Configured ${role} font escapes the approved font directory.`);
    }

    const resolvedPath = await realpath(candidate);
    const relativeResolved = path.relative(directory, resolvedPath);
    if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved)) {
      invalidTypography(`Configured ${role} font resolves outside the approved font directory.`);
    }

    const fileStats = await stat(resolvedPath);
    if (
      !fileStats.isFile() ||
      fileStats.size === 0 ||
      fileStats.size > MAX_RENDER_FONT_FILE_BYTES
    ) {
      invalidTypography(`Configured ${role} font must be a regular file no larger than 20 MiB.`);
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    const fontFormat = FONT_FORMATS[extension];
    if (!fontFormat) {
      invalidTypography(`Configured ${role} font must use .otf, .ttf, .woff, or .woff2.`);
    }

    const bytes = await readFile(resolvedPath);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const familyOverrideNames = familyOverride ? parseFontFamilyStack(familyOverride) : [];
    const firstFamily = familyOverrideNames[0];
    const family =
      firstFamily && !firstFamily.generic
        ? firstFamily.name
        : `BangumiCustom${role === 'body' ? 'Body' : 'Display'}-${sha256.slice(0, 12)}`;

    return {
      role,
      family,
      format: fontFormat.format,
      sha256,
      dataUrl: `data:${fontFormat.mime};base64,${bytes.toString('base64')}`,
    };
  } catch (error) {
    if (error instanceof RendererError) throw error;
    invalidTypography(
      `Configured ${role} font could not be read inside the approved font directory.`,
    );
  }
}

export async function resolveRenderTypography(
  options: RenderTypographyOptions = {},
): Promise<ResolvedRenderTypography> {
  const normalized = normalizeRenderTypographyOptions(options);
  const fontFaces: ResolvedRenderFontFace[] = [];
  const fontDirectory = normalized.fontDirectory;
  if ((normalized.bodyFontFile || normalized.displayFontFile) && !fontDirectory) {
    invalidTypography('BANGUMI_RENDER_FONT_DIR is required when a custom font file is configured.');
  }

  if (normalized.bodyFontFile && fontDirectory) {
    fontFaces.push(
      await loadFontFace('body', normalized.bodyFontFile, fontDirectory, normalized.bodyFontFamily),
    );
  }
  if (normalized.displayFontFile && fontDirectory) {
    fontFaces.push(
      await loadFontFace(
        'display',
        normalized.displayFontFile,
        fontDirectory,
        normalized.displayFontFamily,
      ),
    );
  }

  return {
    fontSizeScale: normalized.fontSizeScale,
    bodyFontFamily: normalized.bodyFontFamily,
    displayFontFamily: normalized.displayFontFamily,
    fontFaces,
    cacheIdentity: {
      fontSizeScale: normalized.fontSizeScale,
      bodyFontFamily: normalized.bodyFontFamily,
      displayFontFamily: normalized.displayFontFamily,
      bodyFontSha256: fontFaces.find((face) => face.role === 'body')?.sha256,
      displayFontSha256: fontFaces.find((face) => face.role === 'display')?.sha256,
    },
  };
}

export function renderFontFamilyStack(
  role: 'body' | 'display',
  designPackFamily: string,
  typography: ResolvedRenderTypography,
): string {
  const face = typography.fontFaces.find((candidate) => candidate.role === role);
  const configured = role === 'body' ? typography.bodyFontFamily : typography.displayFontFamily;
  const customName = face ? parseFontFamilyStack(face.family)[0]?.name : undefined;
  const configuredNames = configured ? parseFontFamilyStack(configured) : [];
  const designPackNames = parseFontFamilyStack(designPackFamily);
  const names = [
    ...(customName ? [customName] : []),
    ...configuredNames.filter((family) => !family.generic).map((family) => family.name),
    ...designPackNames.filter((family) => !family.generic).map((family) => family.name),
    ...configuredNames.filter((family) => family.generic).map((family) => family.name),
    ...designPackNames.filter((family) => family.generic).map((family) => family.name),
  ];
  const unique = names.filter(
    (name, index) =>
      names.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase()) === index,
  );
  return unique
    .map((name) => (GENERIC_FAMILIES.has(name.toLowerCase()) ? name : `"${name}"`))
    .join(', ');
}

export function scaleInlineFontSizeDeclarations(markup: string, scale: number): string {
  if (scale === 1) return markup;
  return markup.replace(
    /(\bfont-size\s*:\s*)(\d+(?:\.\d+)?)(px|pt|rem|em|%)(?=\s*(?:;|"))/gi,
    (_match, prefix: string, amount: string, unit: string) => {
      const scaled = Number((Number(amount) * scale).toFixed(3));
      return `${prefix}${scaled}${unit}`;
    },
  );
}
