import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import type {
  AssetHttpTransport,
  AssetNetworkResolver,
} from '../../packages/renderer/src/internal/index.js';
import { fetchAndProcessImage, sharp } from '../../packages/renderer/src/internal/index.js';
import {
  BudgetedAssetHttpTransport,
  createBudgetedPublicFetch,
  PublicRequestBudget,
} from '../../scripts/lib/fresh-public-request-budget.js';

describe('fresh public probe request budget', () => {
  it('counts API and renderer asset redirects under one shared ceiling', async () => {
    const budget = new PublicRequestBudget(4);
    const apiUrls: string[] = [];
    const countedFetch = createBudgetedPublicFetch(budget, async (input) => {
      const url = String(input);
      apiUrls.push(url);
      if (apiUrls.length === 1) {
        return new Response(null, { status: 302, headers: { location: '/v0/final' } });
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const apiResponse = await countedFetch('https://api.example.test/v0/start');
    expect(apiResponse.status).toBe(200);
    expect(apiUrls).toEqual([
      'https://api.example.test/v0/start',
      'https://api.example.test/v0/final',
    ]);

    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 12, g: 34, b: 56, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const assetUrls: string[] = [];
    const delegate: AssetHttpTransport = {
      async request(url) {
        assetUrls.push(url);
        if (assetUrls.length === 1) {
          return {
            status: 302,
            headers: { location: '/images/final.png' } as Record<string, string>,
            buffer: Buffer.alloc(0),
            url,
          };
        }
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>,
          buffer: png,
          url,
        };
      },
    };
    const resolver: AssetNetworkResolver = {
      async resolve() {
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };
    await fetchAndProcessImage(
      'https://images.example.test/start.png',
      new BudgetedAssetHttpTransport(budget, delegate),
      resolver,
    );

    expect(assetUrls).toEqual([
      'https://images.example.test/start.png',
      'https://images.example.test/images/final.png',
    ]);
    expect(budget.snapshot()).toEqual({
      bangumiApi: 2,
      rendererAsset: 2,
      total: 4,
      budgetBlocked: false,
    });
  });

  it('blocks the next asset redirect before it can exceed the combined ceiling', async () => {
    const budget = new PublicRequestBudget(3);
    const apiFetch = createBudgetedPublicFetch(budget, async (input) => {
      const url = String(input);
      return url.endsWith('/start')
        ? new Response(null, { status: 302, headers: { location: '/final' } })
        : new Response('{}', { status: 200 });
    });
    await apiFetch('https://api.example.test/start');

    const delegate: AssetHttpTransport = {
      request: vi.fn(async (url) => ({
        status: 302,
        headers: { location: '/next.png' },
        buffer: Buffer.alloc(0),
        url,
      })),
    };
    const resolver: AssetNetworkResolver = {
      async resolve() {
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };
    await expect(
      fetchAndProcessImage(
        'https://images.example.test/start.png',
        new BudgetedAssetHttpTransport(budget, delegate),
        resolver,
      ),
    ).rejects.toThrow('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');

    expect(delegate.request).toHaveBeenCalledTimes(1);
    expect(budget.snapshot()).toEqual({
      bangumiApi: 2,
      rendererAsset: 1,
      total: 3,
      budgetBlocked: true,
    });
  });

  it('counts HttpClient automatic read-only retries under the shared API budget', async () => {
    const budget = new PublicRequestBudget(4);
    let attempts = 0;
    const fetchFn = createBudgetedPublicFetch(budget, async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({ message: 'temporary upstream error' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = new HttpClient({ fetchFn });

    await expect(client.request({ method: 'GET', path: '/v0/persons/13684' })).resolves.toEqual({});

    expect(attempts).toBe(2);
    expect(budget.snapshot()).toEqual({
      bangumiApi: 2,
      rendererAsset: 0,
      total: 2,
      budgetBlocked: false,
    });
  });

  it('enforces each tool scope and blocks every later scope before dispatch after a breach', async () => {
    const budget = new PublicRequestBudget(6, 1);
    const dispatchedUrls: string[] = [];
    const countedFetch = createBudgetedPublicFetch(budget, async (input) => {
      dispatchedUrls.push(String(input));
      return new Response('{}', { status: 200 });
    });

    await expect(
      budget.withScope('tool-a', async () => {
        await countedFetch('https://api.example.test/tool-a/first');
        await countedFetch('https://api.example.test/tool-a/over-cap');
      }),
    ).rejects.toThrow('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');

    await expect(
      budget.withScope('tool-b', async () =>
        countedFetch('https://api.example.test/tool-b/blocked'),
      ),
    ).rejects.toThrow('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');

    expect(dispatchedUrls).toEqual(['https://api.example.test/tool-a/first']);
    expect(budget.snapshotScope('tool-a')).toEqual({ bangumiApi: 1, rendererAsset: 0, total: 1 });
    expect(budget.snapshotScope('tool-b')).toEqual({ bangumiApi: 0, rendererAsset: 0, total: 0 });
    expect(budget.snapshot()).toEqual({
      bangumiApi: 1,
      rendererAsset: 0,
      total: 1,
      budgetBlocked: true,
    });
  });

  it('requires a tool scope whenever a per-scope ceiling is configured', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const countedFetch = createBudgetedPublicFetch(budget, fetchImpl);

    await expect(countedFetch('https://api.example.test/out-of-scope')).rejects.toThrow(
      'PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED',
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual({
      bangumiApi: 0,
      rendererAsset: 0,
      total: 0,
      budgetBlocked: true,
    });
  });

  it('blocks overlapping tool scopes instead of misattributing their requests', async () => {
    const budget = new PublicRequestBudget(8, 4);
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const countedFetch = createBudgetedPublicFetch(budget, fetchImpl);

    await expect(
      budget.withScope('tool-a', async () =>
        budget.withScope('tool-b', async () => countedFetch('https://api.example.test/tool-b')),
      ),
    ).rejects.toThrow('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual({
      bangumiApi: 0,
      rendererAsset: 0,
      total: 0,
      budgetBlocked: true,
    });
  });

  it('applies one tool ceiling across its API request and renderer asset redirects', async () => {
    const budget = new PublicRequestBudget(6, 2);
    const apiFetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const countedApiFetch = createBudgetedPublicFetch(budget, apiFetch);
    const assetRequest = vi.fn(async (url: string) => ({
      status: 302,
      headers: { location: '/next.png' },
      buffer: Buffer.alloc(0),
      url,
    }));
    const resolver: AssetNetworkResolver = {
      async resolve() {
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };

    await expect(
      budget.withScope('render-tool', async () => {
        await countedApiFetch('https://api.example.test/v0/subjects');
        await fetchAndProcessImage(
          'https://images.example.test/start.png',
          new BudgetedAssetHttpTransport(budget, { request: assetRequest }),
          resolver,
        );
      }),
    ).rejects.toThrow('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(assetRequest).toHaveBeenCalledTimes(1);
    expect(budget.snapshotScope('render-tool')).toEqual({
      bangumiApi: 1,
      rendererAsset: 1,
      total: 2,
    });
    expect(budget.snapshot().budgetBlocked).toBe(true);
  });
});
