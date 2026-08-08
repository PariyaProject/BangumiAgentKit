import { chromium, Browser, BrowserContext } from 'playwright';
import { RendererError } from './errors.js';

export interface BrowserPoolOptions {
  maxConcurrency?: number;
  timeoutMs?: number;
  deviceScaleFactor?: number;
}

class Semaphore {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.activeCount < this.max) {
      this.activeCount++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }
}

export class BrowserPool {
  private browserPromise: Promise<Browser> | null = null;
  private semaphore: Semaphore;
  private timeoutMs: number;
  private deviceScaleFactor: number;
  private isClosed = false;

  constructor(options?: BrowserPoolOptions) {
    const maxConcurrency = options?.maxConcurrency ?? parseInt(process.env.RENDERER_MAX_CONCURRENCY || '3', 10);
    this.timeoutMs = options?.timeoutMs ?? parseInt(process.env.RENDERER_TIMEOUT_MS || '8000', 10);
    this.deviceScaleFactor = options?.deviceScaleFactor ?? 2;
    this.semaphore = new Semaphore(maxConcurrency);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.isClosed) {
      throw new RendererError('RENDERER_CLOSED', 'BrowserPool has been closed.');
    }
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
      });
    }
    return this.browserPromise;
  }

  async renderHtmlToBuffer(html: string, options?: { width?: number; deviceScaleFactor?: number }): Promise<Buffer> {
    if (this.isClosed) {
      throw new RendererError('RENDERER_CLOSED', 'BrowserPool is closed.');
    }

    await this.semaphore.acquire();
    let context: BrowserContext | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const browser = await this.getBrowser();
      const width = options?.width ?? 960;
      const dpr = options?.deviceScaleFactor ?? this.deviceScaleFactor;

      context = await browser.newContext({
        viewport: { width, height: 800 },
        deviceScaleFactor: dpr,
        javaScriptEnabled: false,
        serviceWorkers: 'block',
      });

      // Total network isolation - abort any network request
      await context.route('**/*', (route) => route.abort());

      const page = await context.newPage();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new RendererError('RENDER_TIMEOUT', `Rendering timed out after ${this.timeoutMs}ms.`));
        }, this.timeoutMs);
      });

      const renderPromise = (async () => {
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const locator = page.locator('[data-render-root]');
        const buffer = await locator.screenshot({ type: 'png' });
        return buffer;
      })();

      const buffer = await Promise.race([renderPromise, timeoutPromise]);
      return buffer;
    } catch (err) {
      if (err instanceof RendererError) throw err;
      throw new RendererError('RENDER_BROWSER_ERROR', `Playwright render failed: ${String(err)}`);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (context) {
        await context.close().catch(() => {});
      }
      this.semaphore.release();
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      this.browserPromise = null;
      await browser.close().catch(() => {});
    }
  }

  getActiveCount(): number {
    return this.semaphore.getActiveCount();
  }
}
