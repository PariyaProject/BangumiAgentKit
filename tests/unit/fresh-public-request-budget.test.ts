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
});
