import crypto from 'node:crypto';
import { RenderViewModel } from './view-models/index.js';
import { renderHtmlTemplate } from './template-engine.js';
import { BrowserPool } from './browser-pool.js';
import { MemoryCache } from '@bangumi-agent-kit/bangumi-transport';

export function computeRenderCacheKey(
  viewModel: RenderViewModel,
  theme = 'dark',
  width = 960,
): string {
  const payload = JSON.stringify(viewModel);
  const rawKey = `${viewModel.template}:${viewModel.version}:${theme}:${width}:${payload}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export class RenderService {
  private browserPool: BrowserPool;
  private cache: MemoryCache;

  constructor(browserPool?: BrowserPool, cache?: MemoryCache) {
    this.browserPool = browserPool || new BrowserPool();
    this.cache = cache || new MemoryCache(200);
  }

  async renderCard(viewModel: RenderViewModel, theme = 'dark', width = 960): Promise<Buffer> {
    const cacheKey = computeRenderCacheKey(viewModel, theme, width);
    const cachedBuffer = this.cache.get<Buffer>(cacheKey);
    if (cachedBuffer) {
      return cachedBuffer;
    }

    const html = renderHtmlTemplate(viewModel);
    const buffer = await this.browserPool.renderHtmlToBuffer(html);

    this.cache.set(cacheKey, buffer, 3600); // 1 hour render cache
    return buffer;
  }
}
