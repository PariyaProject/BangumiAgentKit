import crypto from 'node:crypto';
import sharp from 'sharp';
import { RenderViewModel } from './view-models/index.js';
import { RenderThemeName } from './themes/index.js';
import { renderHtmlTemplate } from './template-engine.js';
import { BrowserPool } from './browser-pool.js';
import { AssetResolver, RenderWarning, ResolvedAsset } from './asset-resolver.js';
import { RendererError } from './errors.js';
import { RendererLruCache } from './lru-cache.js';

export interface RenderOptions {
  theme?: RenderThemeName;
  width?: number;
  deviceScaleFactor?: number;
  format?: 'png';
  cache?: boolean;
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

const DISCOVERY_MAX_RENDERED_ITEMS = 12;
const SERIES_MAX_RENDERED_STEPS = 17;
const SERIES_MAX_RENDERED_RELATED = 24;
const SERIES_MAX_RENDERED_EDGES = 64;
const SUBJECT_OVERVIEW_MAX_RENDERED_CAST = 6;

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalizeJson((obj as Record<string, unknown>)[k]),
  );
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
  } else if (viewModel.template === 'discovery-results') {
    for (const item of viewModel.items.slice(0, DISCOVERY_MAX_RENDERED_ITEMS)) {
      if (item.image) urls.add(item.image);
    }
  } else if (viewModel.template === 'series-relations') {
    if (viewModel.root.image) urls.add(viewModel.root.image);
    const stepLimit = Math.min(
      SERIES_MAX_RENDERED_STEPS,
      Math.max(1, Math.floor(viewModel.coverage.maxNodes) + 1),
    );
    for (const item of viewModel.steps.slice(0, stepLimit)) {
      if (item.image) urls.add(item.image);
    }
    const relatedLimit = Math.min(
      SERIES_MAX_RENDERED_RELATED,
      Math.max(0, Math.floor(viewModel.coverage.relatedLimit)),
    );
    for (const item of viewModel.related.slice(0, relatedLimit)) {
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
  } else if (viewModel.template === 'person-profile') {
    if (viewModel.person.image) urls.add(viewModel.person.image);
  } else if (viewModel.template === 'subject-overview') {
    if (viewModel.subject.image) urls.add(viewModel.subject.image);
    for (const item of viewModel.cast.items.slice(0, SUBJECT_OVERVIEW_MAX_RENDERED_CAST)) {
      if (item.character.image) urls.add(item.character.image);
    }
  }

  return Array.from(urls);
}

function normalizeRenderViewModel(viewModel: RenderViewModel): RenderViewModel {
  if (viewModel.template === 'subject-overview') {
    const castItems = viewModel.cast.items.slice(0, SUBJECT_OVERVIEW_MAX_RENDERED_CAST);
    const omitted = Math.max(0, viewModel.cast.items.length - castItems.length);
    if (omitted === 0) return viewModel;

    return {
      ...viewModel,
      state: viewModel.state === 'not_found' ? 'not_found' : 'partial',
      warnings: [
        ...viewModel.warnings,
        {
          code: 'RENDERER_CAST_OUTPUT_TRUNCATED',
          state: 'partial',
          message: `渲染器对角色区段应用了安全显示上限；省略 ${omitted} 条已返回角色。`,
        },
      ],
      cast: {
        ...viewModel.cast,
        items: castItems,
        hiddenCount: (viewModel.cast.hiddenCount ?? 0) + omitted,
        coverage: {
          ...viewModel.cast.coverage,
          truncated: true,
        },
      },
    };
  }

  if (viewModel.template === 'series-relations') {
    const stepLimit = Math.min(
      SERIES_MAX_RENDERED_STEPS,
      Math.max(1, Math.floor(viewModel.coverage.maxNodes) + 1),
    );
    const relatedLimit = Math.min(
      SERIES_MAX_RENDERED_RELATED,
      Math.max(0, Math.floor(viewModel.coverage.relatedLimit)),
    );
    const edgeLimit = Math.min(
      SERIES_MAX_RENDERED_EDGES,
      Math.max(0, Math.floor(viewModel.coverage.edgeEvidenceLimit)),
    );
    const steps = viewModel.steps.slice(0, stepLimit);
    const related = viewModel.related.slice(0, relatedLimit);
    const edges = viewModel.edges.slice(0, edgeLimit);
    const renderedOmitted = {
      steps: Math.max(0, viewModel.steps.length - steps.length),
      related: Math.max(0, viewModel.related.length - related.length),
      edges: Math.max(0, viewModel.edges.length - edges.length),
    };
    const renderTruncated =
      renderedOmitted.steps > 0 || renderedOmitted.related > 0 || renderedOmitted.edges > 0;
    const omissionLabels = [
      renderedOmitted.steps > 0 ? `步骤 ${renderedOmitted.steps}` : undefined,
      renderedOmitted.related > 0 ? `关系证据 ${renderedOmitted.related}` : undefined,
      renderedOmitted.edges > 0 ? `边证据 ${renderedOmitted.edges}` : undefined,
    ].filter((label): label is string => Boolean(label));
    const truncationReasons = [
      ...viewModel.coverage.truncationReasons,
      ...omissionLabels.map((label) => `renderer-${label}`),
    ];

    return {
      ...viewModel,
      steps,
      related,
      edges,
      ...(renderTruncated
        ? {
            state:
              viewModel.state === 'not_computable'
                ? ('not_computable' as const)
                : ('partial' as const),
            warnings: [
              ...new Set([
                ...viewModel.warnings,
                `渲染器对关系证据应用了安全显示上限；省略 ${omissionLabels.join('、')}。`,
              ]),
            ],
          }
        : {}),
      coverage: {
        ...viewModel.coverage,
        uniqueRelatedReturned: related.length,
        edgeEvidenceReturned: edges.length,
        relatedEvidenceTruncated:
          viewModel.coverage.relatedEvidenceTruncated || related.length < viewModel.related.length,
        edgeEvidenceTruncated:
          viewModel.coverage.edgeEvidenceTruncated || edges.length < viewModel.edges.length,
        truncated: viewModel.coverage.truncated || renderTruncated,
        truncationReasons: [...new Set(truncationReasons)],
        ...(renderTruncated
          ? {
              renderedOmitted: {
                steps: Math.max(
                  viewModel.coverage.renderedOmitted?.steps ?? 0,
                  renderedOmitted.steps,
                ),
                related: Math.max(
                  viewModel.coverage.renderedOmitted?.related ?? 0,
                  renderedOmitted.related,
                ),
                edges: Math.max(
                  viewModel.coverage.renderedOmitted?.edges ?? 0,
                  renderedOmitted.edges,
                ),
              },
            }
          : viewModel.coverage.renderedOmitted
            ? { renderedOmitted: viewModel.coverage.renderedOmitted }
            : {}),
      },
    };
  }

  if (viewModel.template !== 'discovery-results') return viewModel;

  const items = viewModel.items.slice(0, DISCOVERY_MAX_RENDERED_ITEMS);
  const overflow = Math.max(0, viewModel.items.length - items.length);
  const hiddenCount = Math.max(0, (viewModel.hiddenCount ?? 0) + overflow);

  return {
    ...viewModel,
    items,
    ...(hiddenCount > 0 ? { hiddenCount } : { hiddenCount: undefined }),
    coverage: {
      ...viewModel.coverage,
      rendered: items.length,
    },
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (item !== undefined) {
        results[current] = await fn(item);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

export class RenderService {
  private browserPool: BrowserPool;
  private cache: RendererLruCache<RenderResult>;
  private assetResolver: AssetResolver;
  private maxOutputBytes: number;
  private timeoutMs: number;
  private maxAssetConcurrency: number;

  constructor(
    browserPool?: BrowserPool,
    cache?: RendererLruCache<RenderResult>,
    assetResolver?: AssetResolver,
    maxOutputBytes?: number,
  ) {
    this.browserPool = browserPool || new BrowserPool();
    this.cache = cache || new RendererLruCache<RenderResult>(200);
    this.assetResolver = assetResolver || new AssetResolver();
    this.maxOutputBytes =
      maxOutputBytes ?? parseInt(process.env.RENDERER_MAX_OUTPUT_BYTES || '5242880', 10);
    this.timeoutMs = parseInt(process.env.RENDERER_TIMEOUT_MS || '8000', 10);
    this.maxAssetConcurrency = parseInt(process.env.RENDERER_ASSET_MAX_CONCURRENCY || '4', 10);
  }

  async renderCard(viewModel: RenderViewModel, options: RenderOptions = {}): Promise<RenderResult> {
    const normalizedViewModel = normalizeRenderViewModel(viewModel);
    const width = options.width ?? 960;
    const dpr = options.deviceScaleFactor ?? 2;
    const theme = options.theme ?? 'bangumi-dark';
    const cacheEnabled =
      options.cache !== false && normalizedViewModel.template !== 'collection-dashboard';

    if (width < 640 || width > 1200) {
      throw new RendererError(
        'RENDER_VALIDATION_ERROR',
        `Width ${width} out of allowed bounds (640 - 1200).`,
      );
    }
    if (dpr < 1 || dpr > 2) {
      throw new RendererError(
        'RENDER_VALIDATION_ERROR',
        `deviceScaleFactor ${dpr} out of allowed bounds (1 - 2).`,
      );
    }

    const controller = new AbortController();
    let timeoutTimer: NodeJS.Timeout | null = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const imageUrls = extractImageUrls(normalizedViewModel);
      const resolvedAssets = await mapConcurrent(
        imageUrls,
        this.maxAssetConcurrency,
        async (url): Promise<{ url: string; resolved: ResolvedAsset }> => {
          if (controller.signal.aborted) {
            throw new RendererError(
              'RENDER_TIMEOUT',
              `Total render deadline reached before resolving assets.`,
            );
          }
          const resolved = await this.assetResolver.resolveAsset(url, controller.signal);
          return { url, resolved };
        },
      );

      const resolvedImages: Record<string, string> = {};
      const warnings: RenderWarning[] = [];

      for (const item of resolvedAssets) {
        resolvedImages[item.url] = item.resolved.dataUrl;
        if (item.resolved.warning) {
          warnings.push(item.resolved.warning);
        }
      }

      const cacheKey = computeRenderCacheKey(
        normalizedViewModel,
        { ...options, theme, width, deviceScaleFactor: dpr },
        resolvedImages,
      );
      if (cacheEnabled) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      if (controller.signal.aborted) {
        throw new RendererError(
          'RENDER_TIMEOUT',
          `Total render deadline reached before HTML generation.`,
        );
      }

      const html = renderHtmlTemplate(normalizedViewModel, theme, resolvedImages, width);
      const buffer = await this.browserPool.renderHtmlToBuffer(html, {
        width,
        deviceScaleFactor: dpr,
        signal: controller.signal,
      });

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
        template: normalizedViewModel.template,
        templateVersion: normalizedViewModel.version,
        cacheKey,
        warnings,
      };

      if (cacheEnabled) this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (
        controller.signal.aborted &&
        !(err instanceof RendererError && err.code === 'RENDER_TIMEOUT')
      ) {
        throw new RendererError(
          'RENDER_TIMEOUT',
          `Total render deadline reached (${this.timeoutMs}ms).`,
        );
      }
      throw err;
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    }
  }

  async close(): Promise<void> {
    await this.browserPool.close();
  }
}
