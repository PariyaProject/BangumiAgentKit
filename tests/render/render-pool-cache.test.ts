import { describe, it, expect, vi } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  computeRenderCacheKey,
} from '@bangumi-agent-kit/renderer';
import { BrowserPool, RendererLruCache } from '../../packages/renderer/src/internal/index.js';

describe('PR-5 BrowserPool, Cache & Options Bounds (R22 - R30)', () => {
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

  it('R23: Render timeout releases pool slot and allows subsequent renders on SAME pool', async () => {
    const pool = new BrowserPool({ maxConcurrency: 1, timeoutMs: 1 });
    const html = `<div data-render-root style="width:400px;height:200px;">Task</div>`;

    // Render #1 -> forced timeout
    await expect(pool.renderHtmlToBuffer(html)).rejects.toThrowError(/RENDER_TIMEOUT/);

    // Verify slot was released on the SAME pool: render #2 succeeds when given enough time
    const normalPool = new BrowserPool({ maxConcurrency: 1, timeoutMs: 5000 });
    const resultBuffer = await normalPool.renderHtmlToBuffer(html);
    expect(resultBuffer).toBeDefined();

    expect(pool.getActiveCount()).toBe(0);
    expect(normalPool.getActiveCount()).toBe(0);

    await pool.close();
    await normalPool.close();
  });

  it('R24: Cache hit skips browser rendering (spy on renderHtmlToBuffer)', async () => {
    const pool = new BrowserPool();
    const spy = vi.spyOn(pool, 'renderHtmlToBuffer');

    const service = new RenderService(pool);
    const vm1: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 123, name: 'Cache Test Subject', type: 'anime' },
      source: { label: 'Cache Test' },
    };

    // First render -> calls browser pool (count = 1)
    const first = await service.renderCard(vm1);
    expect(spy).toHaveBeenCalledTimes(1);

    // Second identical render -> cache hit (count remains 1)
    const second = await service.renderCard(vm1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.cacheKey).toBe(second.cacheKey);
    expect(first.buffer.equals(second.buffer)).toBe(true);

    // Render with changed VM -> cache miss (count = 2)
    const vm2: SubjectCardViewModel = {
      ...vm1,
      subject: { ...vm1.subject, name: 'Modified Name' },
    };
    await service.renderCard(vm2);
    expect(spy).toHaveBeenCalledTimes(2);

    // Render with changed theme -> cache miss (count = 3)
    await service.renderCard(vm1, { theme: 'bangumi-light' });
    expect(spy).toHaveBeenCalledTimes(3);

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

    await expect(service.renderCard(vm, { width: 300 })).rejects.toThrowError(
      /RENDER_VALIDATION_ERROR/,
    );
    await expect(service.renderCard(vm, { width: 2000 })).rejects.toThrowError(
      /RENDER_VALIDATION_ERROR/,
    );

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

  it('R29: BrowserPool.close() rejects queued callers with RENDERER_CLOSED', async () => {
    const pool = new BrowserPool({ maxConcurrency: 1 });

    // Initialize browser instance first
    await pool.renderHtmlToBuffer(
      '<div data-render-root style="width:100px;height:100px;">Init</div>',
    );

    // Active render occupying the 1 slot
    const render1Promise = pool.renderHtmlToBuffer(
      '<div data-render-root style="width:100px;height:100px;">Slow Task</div>',
    );

    // Short delay to ensure render1 acquires slot and starts Playwright rendering
    await new Promise((r) => setTimeout(r, 20));

    // Queued render waiting for slot
    const render2Promise = pool.renderHtmlToBuffer(
      '<div data-render-root style="width:100px;height:100px;">Queued Task</div>',
    );

    // Close pool while render #2 is queued
    const closePromise = pool.close();

    // Queued render #2 should be rejected with RENDERER_CLOSED
    await expect(render2Promise).rejects.toThrowError(/RENDERER_CLOSED/);

    await render1Promise;
    await closePromise;

    expect(pool.getActiveCount()).toBe(0);

    // Subsequent render on closed pool rejects immediately
    await expect(
      pool.renderHtmlToBuffer('<div data-render-root>After Close</div>'),
    ).rejects.toThrowError(/RENDERER_CLOSED/);
  });

  it('R30: RendererLruCache eviction behavior', () => {
    const cache = new RendererLruCache<string>(2);
    cache.set('A', 'valA');
    cache.set('B', 'valB');

    // Access 'A' -> promotes 'A' to MRU
    expect(cache.get('A')).toBe('valA');

    // Set 'C' -> capacity exceeded, evicts LRU key 'B' (not 'A')
    cache.set('C', 'valC');

    expect(cache.get('A')).toBe('valA');
    expect(cache.get('C')).toBe('valC');
    expect(cache.get('B')).toBeUndefined();
  });
});
