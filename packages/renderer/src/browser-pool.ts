import { chromium, Browser, BrowserContext } from 'playwright';
import { RendererError } from './errors.js';

export interface BrowserPoolOptions {
  maxConcurrency?: number;
  timeoutMs?: number;
  deviceScaleFactor?: number;
}

class QueueItem {
  constructor(
    public resolve: () => void,
    public reject: (err: RendererError) => void,
  ) {}
}

class Semaphore {
  private activeCount = 0;
  private queue: QueueItem[] = [];

  constructor(private max: number) {}

  async acquire(signal?: AbortSignal): Promise<void> {
    if (this.activeCount < this.max) {
      this.activeCount++;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new RendererError('RENDER_TIMEOUT', 'Acquire aborted due to deadline.'));
        return;
      }

      const item = new QueueItem(
        () => {
          this.activeCount++;
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        },
        (err) => {
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(err);
        },
      );

      const onAbort = () => {
        const idx = this.queue.indexOf(item);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(new RendererError('RENDER_TIMEOUT', 'Acquire aborted due to deadline.'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      this.queue.push(item);
    });
  }

  release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    }
  }

  rejectAllQueued(err: RendererError): void {
    const items = [...this.queue];
    this.queue = [];
    for (const item of items) {
      item.reject(err);
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export class BrowserPool {
  private browserPromise: Promise<Browser> | null = null;
  private semaphore: Semaphore;
  private timeoutMs: number;
  private deviceScaleFactor: number;
  private isClosed = false;
  private activeRenderCount = 0;
  private activeRenderResolves: Array<() => void> = [];

  constructor(options?: BrowserPoolOptions) {
    const maxConcurrency =
      options?.maxConcurrency ?? parseInt(process.env.RENDERER_MAX_CONCURRENCY || '3', 10);
    this.timeoutMs = options?.timeoutMs ?? parseInt(process.env.RENDERER_TIMEOUT_MS || '8000', 10);
    this.deviceScaleFactor = options?.deviceScaleFactor ?? 2;
    this.semaphore = new Semaphore(maxConcurrency);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.isClosed) {
      throw new RendererError('RENDERER_CLOSED', 'BrowserPool has been closed.');
    }
    if (!this.browserPromise) {
      const disableSandbox = process.env.RENDERER_DISABLE_CHROMIUM_SANDBOX === 'true';
      const args = ['--disable-gpu', '--disable-dev-shm-usage'];
      if (disableSandbox) {
        args.push('--no-sandbox', '--disable-setuid-sandbox');
      }

      this.browserPromise = chromium.launch({
        headless: true,
        args,
      });
    }
    return this.browserPromise;
  }

  async renderHtmlToBuffer(
    html: string,
    options?: { width?: number; deviceScaleFactor?: number; signal?: AbortSignal },
  ): Promise<Buffer> {
    if (this.isClosed) {
      throw new RendererError('RENDERER_CLOSED', 'BrowserPool is closed.');
    }

    await this.semaphore.acquire(options?.signal);

    this.activeRenderCount++;
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

      // Total network isolation - abort any network request inside Playwright
      await context.route('**/*', (route) => route.abort());

      const page = await context.newPage();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new RendererError('RENDER_TIMEOUT', `Rendering timed out after ${this.timeoutMs}ms.`),
          );
        }, this.timeoutMs);

        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new RendererError('RENDER_TIMEOUT', 'Rendering aborted due to deadline.'));
          });
        }
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
      this.activeRenderCount--;
      if (this.activeRenderCount === 0) {
        for (const resolve of this.activeRenderResolves) {
          resolve();
        }
        this.activeRenderResolves = [];
      }
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
    // Reject queued callers
    this.semaphore.rejectAllQueued(new RendererError('RENDERER_CLOSED', 'BrowserPool is closed.'));

    // Wait for active renders to finish
    if (this.activeRenderCount > 0) {
      await new Promise<void>((resolve) => {
        this.activeRenderResolves.push(resolve);
      });
    }

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
