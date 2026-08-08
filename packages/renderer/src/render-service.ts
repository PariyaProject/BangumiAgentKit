import crypto from 'node:crypto';
import sharp from 'sharp';
import { MemoryCache } from '@bangumi-agent-kit/bangumi-transport';
import { RenderViewModel } from './view-models/index.js';
import { RenderThemeName } from './themes/index.js';
import { renderHtmlTemplate } from './template-engine.js';
import { BrowserPool } from './browser-pool.js';
import { AssetResolver, RenderWarning } from './asset-resolver.js';
import { RendererError } from './errors.js';

export interface RenderOptions {
  theme?: RenderThemeName;
  width?: number;
  deviceScaleFactor?: number;
  format?: 'png';
}

export interface RenderResult {
  buffer: Buffer;
  mimeType: 'image/png';
  width: number;
  height: number;
  template: RenderViewModel['template'];
  templateVersion: number;
  cacheKey: string;
  warnings: RenderWarning[];
}

export const RENDERER_VERSION = '1.0.0';

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((k) => JSON.stringify(k) + ':' + canonicalizeJson((obj as Record<string, unknown>)[k]));
  return '{' + entries.join(',') + '}';
}

export function computeRenderCacheKey(
  viewModel: RenderViewModel,
  options: RenderOptions = {},
  assetMap: Record<string, string> = {},
): string {
  const theme = options.theme || 'bangumi-dark';
  const width = options.width || 960;
  const dpr = options.deviceScaleFactor || 2;
  const format = options.format || 'png';

  const vmCanonical = canonicalizeJson(viewModel);
  const assetCanonical = canonicalizeJson(assetMap);

  const rawKey = `${RENDERER_VERSION}:${viewModel.template}:${viewModel.version}:${theme}:${width}:${dpr}:${format}:${vmCanonical}:${assetCanonical}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function extractImageUrls(viewModel: RenderViewModel): string[] {
  const urls = new Set<string>();

  if (viewModel.template === 'subject-card') {
    if (viewModel.subject.image) urls.add(viewModel.subject.image);
  } else if (viewModel.template === 'search-list') {
    for (const item of viewModel.items) {
      if (item.image) urls.add(item.image);
    }
  } else if (viewModel.template === 'cast-card') {
    for (const item of viewModel.items) {
      if (item.character.image) urls.add(item.character.image);
      for (const actor of item.actors) {
        if (actor.image) urls.add(actor.image);
      }
    }
  } else if (viewModel.template === 'collection-progress') {
    if (viewModel.subject.image) urls.add(viewModel.subject.image);
  } else if (viewModel.template === 'calendar') {
    for (const day of viewModel.days) {
      for (const item of day.items) {
        if (item.image) urls.add(item.image);
      }
    }
  }

  return Array.from(urls);
}

export class RenderService {
  private browserPool: BrowserPool;
  private cache: MemoryCache;
  private assetResolver: AssetResolver;
  private maxOutputBytes: number;

  constructor(
    browserPool?: BrowserPool,
    cache?: MemoryCache,
    assetResolver?: AssetResolver,
    maxOutputBytes?: number,
  ) {
    this.browserPool = browserPool || new BrowserPool();
    this.cache = cache || new MemoryCache(200);
    this.assetResolver = assetResolver || new AssetResolver();
    this.maxOutputBytes =
      maxOutputBytes ?? parseInt(process.env.RENDERER_MAX_OUTPUT_BYTES || '5242880', 10);
  }

  async renderCard(viewModel: RenderViewModel, options: RenderOptions = {}): Promise<RenderResult> {
    const width = options.width ?? 960;
    const dpr = options.deviceScaleFactor ?? 2;
    const theme = options.theme ?? 'bangumi-dark';

    if (width < 640 || width > 1200) {
      throw new RendererError('RENDER_VALIDATION_ERROR', `Width ${width} out of allowed bounds (640 - 1200).`);
    }
    if (dpr < 1 || dpr > 2) {
      throw new RendererError('RENDER_VALIDATION_ERROR', `deviceScaleFactor ${dpr} out of allowed bounds (1 - 2).`);
    }

    const imageUrls = extractImageUrls(viewModel);
    const resolvedImages: Record<string, string> = {};
    const warnings: RenderWarning[] = [];

    for (const url of imageUrls) {
      const resolved = await this.assetResolver.resolveAsset(url);
      resolvedImages[url] = resolved.dataUrl;
      if (resolved.warning) {
        warnings.push(resolved.warning);
      }
    }

    const cacheKey = computeRenderCacheKey(viewModel, { ...options, theme, width, deviceScaleFactor: dpr }, resolvedImages);
    const cached = this.cache.get<RenderResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const html = renderHtmlTemplate(viewModel, theme, resolvedImages);
    const buffer = await this.browserPool.renderHtmlToBuffer(html, { width, deviceScaleFactor: dpr });

    if (buffer.length > this.maxOutputBytes) {
      throw new RendererError(
        'RENDER_OUTPUT_TOO_LARGE',
        `Render output PNG size (${buffer.length} bytes) exceeds maximum limit (${this.maxOutputBytes} bytes).`,
      );
    }

    const imageMetadata = await sharp(buffer).metadata();
    const result: RenderResult = {
      buffer,
      mimeType: 'image/png',
      width: imageMetadata.width || width,
      height: imageMetadata.height || 0,
      template: viewModel.template,
      templateVersion: viewModel.version,
      cacheKey,
      warnings,
    };

    this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async close(): Promise<void> {
    await this.browserPool.close();
  }
}
