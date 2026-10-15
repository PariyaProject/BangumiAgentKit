import { describe, expect, it, vi } from 'vitest';
import { PublicRequestBudget } from '../../scripts/lib/fresh-public-request-budget.js';
import { createBudgetedPublicSearchFetchV2 } from '../../scripts/lib/fresh-public-request-search-fetch-v2.js';

const SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects';
const SEARCH_HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
};

describe('fresh public search POST fetch v2', () => {
  it('counts the exact anonymous read-only search POST body under the current tool scope', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const body = JSON.stringify({ keyword: '', sort: 'date', filter: { air_date: '2020-02' } });
    const fetchImpl = vi.fn(async (input, init) => {
      expect(String(input)).toBe(SEARCH_URL);
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(body);
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('manual');
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const fetchFn = createBudgetedPublicSearchFetchV2(budget, fetchImpl);

    const response = await budget.withScope('bangumi.aggregate_subject_cohort', async () =>
      fetchFn(SEARCH_URL, { method: 'POST', headers: SEARCH_HEADERS, body }),
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(budget.snapshotScope('bangumi.aggregate_subject_cohort')).toEqual({
      bangumiApi: 1,
      rendererAsset: 0,
      total: 1,
    });
  });

  it('counts each same-route 307 search redirect before dispatching the next hop', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const urls: string[] = [];
    const body = JSON.stringify({ keyword: '', sort: 'date' });
    const fetchFn = createBudgetedPublicSearchFetchV2(budget, async (input, init) => {
      urls.push(String(input));
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(body);
      return urls.length === 1
        ? new Response(null, { status: 307, headers: { location: SEARCH_URL } })
        : new Response('{}', { status: 200 });
    });

    const response = await budget.withScope('bangumi.compare_subject_cohorts', async () =>
      fetchFn(SEARCH_URL, { method: 'POST', headers: SEARCH_HEADERS, body }),
    );

    expect(response.status).toBe(200);
    expect(urls).toEqual([SEARCH_URL, SEARCH_URL]);
    expect(budget.snapshot()).toMatchObject({ bangumiApi: 2, total: 2, budgetBlocked: false });
  });

  it('rejects every non-search POST and credential-bearing request before network dispatch', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const fetchFn = createBudgetedPublicSearchFetchV2(budget, fetchImpl);

    await expect(
      fetchFn('https://api.bgm.tv/v0/subjects/1/collect', {
        method: 'POST',
        headers: SEARCH_HEADERS,
        body: '{}',
      }),
    ).rejects.toThrow('The only permitted public POST');
    for (const header of ['authorization', 'cookie', 'x-user-token']) {
      await expect(
        fetchFn(SEARCH_URL, {
          method: 'POST',
          headers: { ...SEARCH_HEADERS, [header]: 'not-used' },
          body: '{}',
        }),
      ).rejects.toThrow('does not permit credentials');
    }

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(budget.snapshot().total).toBe(0);
  });

  it('rejects a cross-origin search redirect without dispatching the target', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, { status: 307, headers: { location: 'https://example.com/collect' } }),
    );
    const fetchFn = createBudgetedPublicSearchFetchV2(budget, fetchImpl);

    await expect(
      budget.withScope('bangumi.query_subjects', async () =>
        fetchFn(SEARCH_URL, { method: 'POST', headers: SEARCH_HEADERS, body: '{}' }),
      ),
    ).rejects.toThrow('refused an unsupported API redirect');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(budget.snapshotScope('bangumi.query_subjects')).toEqual({
      bangumiApi: 1,
      rendererAsset: 0,
      total: 1,
    });
  });

  it('rejects an HTTP downgrade redirect to api.bgm.tv before dispatching it', async () => {
    const budget = new PublicRequestBudget(4, 2);
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 307,
          headers: { location: 'http://api.bgm.tv/v0/search/subjects' },
        }),
    );
    const fetchFn = createBudgetedPublicSearchFetchV2(budget, fetchImpl);

    await expect(
      budget.withScope('bangumi.query_subjects', async () =>
        fetchFn(SEARCH_URL, { method: 'POST', headers: SEARCH_HEADERS, body: '{}' }),
      ),
    ).rejects.toThrow('refused an unsupported API redirect');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(budget.snapshotScope('bangumi.query_subjects')).toEqual({
      bangumiApi: 1,
      rendererAsset: 0,
      total: 1,
    });
  });
});
