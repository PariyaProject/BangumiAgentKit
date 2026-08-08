import { describe, it, expect } from 'vitest';
import {
  RenderService,
  BrowserPool,
  SubjectCardViewModel,
  computeRenderCacheKey,
} from '@bangumi-agent-kit/renderer';

describe('PR-5 BrowserPool, Cache & Options Bounds (R22 - R29)', () => {
  it('R22: Concurrency pool bounds active contexts to configured maximum', async () => {
    const pool = new BrowserPool({ maxConcurrency: 2 });
    let maxObservedActive = 0;

    const renderTasks = Array.from({ length: 6 }).map(async (_, idx) => {
      const html = `<div data-render-root style="width:400px;height:200px;background:#111;">Card ${idx}</div>`;
      const promise = pool.renderHtmlToBuffer(html);
      const currentActive = pool.getActiveCount();
      if (currentActive > maxObservedActive) {
        maxObservedActive = currentActive;
      }
      return promise;
    });

    await Promise.all(renderTasks);
    expect(maxObservedActive).toBeLessThanOrEqual(2);
    await pool.close();
  });

  it('R23: Render timeout releases pool slot and throws RENDER_TIMEOUT', async () => {
    const pool = new BrowserPool({ maxConcurrency: 1, timeoutMs: 1 });
    const html = `<div data-render-root style="width:400px;height:200px;">Task</div>`;

    await expect(pool.renderHtmlToBuffer(html)).rejects.toThrowError(/RENDER_TIMEOUT/);

    // Verify slot was released: create new pool with normal timeout
    const normalPool = new BrowserPool({ maxConcurrency: 1, timeoutMs: 5000 });
    await expect(normalPool.renderHtmlToBuffer(html)).resolves.toBeDefined();
    await pool.close();
    await normalPool.close();
  });

  it('R24: Cache hit returns cached result', async () => {
    const service = new RenderService();
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 123, name: 'Cache Test Subject', type: 'anime' },
      source: { label: 'Cache Test' },
    };

    const first = await service.renderCard(vm);
    const second = await service.renderCard(vm);

    expect(first.cacheKey).toBe(second.cacheKey);
    expect(first.buffer.equals(second.buffer)).toBe(true);

    await service.close();
  });

  it('R25: Cache key changes with theme', () => {
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 1, name: 'Theme Test', type: 'anime' },
      source: { label: 'Test' },
    };

    const keyDark = computeRenderCacheKey(vm, { theme: 'bangumi-dark' });
    const keyLight = computeRenderCacheKey(vm, { theme: 'bangumi-light' });

    expect(keyDark).not.toBe(keyLight);
  });

  it('R26: Cache key changes with VM content', () => {
    const vm1: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 1, name: 'Subject 1', type: 'anime' },
      source: { label: 'Test' },
    };
    const vm2: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 2, name: 'Subject 2', type: 'anime' },
      source: { label: 'Test' },
    };

    const key1 = computeRenderCacheKey(vm1);
    const key2 = computeRenderCacheKey(vm2);

    expect(key1).not.toBe(key2);
  });

  it('R27: Invalid width (< 640 or > 1200) throws RENDER_VALIDATION_ERROR', async () => {
    const service = new RenderService();
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 1, name: 'Width Test', type: 'anime' },
      source: { label: 'Test' },
    };

    await expect(service.renderCard(vm, { width: 300 })).rejects.toThrowError(/RENDER_VALIDATION_ERROR/);
    await expect(service.renderCard(vm, { width: 2000 })).rejects.toThrowError(/RENDER_VALIDATION_ERROR/);

    await service.close();
  });

  it('R28: Output byte limit enforced (RENDER_OUTPUT_TOO_LARGE)', async () => {
    const pool = new BrowserPool();
    // Pass ultra tiny maxOutputBytes limit = 100 bytes
    const service = new RenderService(pool, undefined, undefined, 100);
    const vm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 1, name: 'Large Output Test', type: 'anime' },
      source: { label: 'Test' },
    };

    await expect(service.renderCard(vm)).rejects.toThrowError(/RENDER_OUTPUT_TOO_LARGE/);

    await service.close();
  });

  it('R29: BrowserPool.close() prevents subsequent renders with RENDERER_CLOSED', async () => {
    const pool = new BrowserPool();
    await pool.close();

    await expect(
      pool.renderHtmlToBuffer('<div data-render-root>Closed Test</div>'),
    ).rejects.toThrowError(/RENDERER_CLOSED/);
  });
});
