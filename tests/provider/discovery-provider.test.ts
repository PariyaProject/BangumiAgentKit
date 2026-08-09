import { describe, expect, it, vi } from 'vitest';
import {
  OfficialV0Provider,
  type SubjectDiscoveryBrowseRequest,
  type SubjectDiscoverySearchRequest,
} from '@bangumi-agent-kit/provider-core';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('official v0 discovery adapter', () => {
  it('keeps generated transport behind the provider discovery boundary', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 20,
          offset: 0,
          data: [
            {
              id: 123,
              type: 2,
              name: '少女終末旅行',
              name_cn: '少女终末旅行',
              date: '2017-10-06',
              platform: 'TV',
              nsfw: false,
              rating: { score: 8.2, rank: 42, total: 100 },
              collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
              tags: [{ name: '后宫' }],
              meta_tags: ['原创'],
              images: { medium: 'https://example.test/medium.jpg' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const provider = new OfficialV0Provider(
      new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn })),
    );
    const request: SubjectDiscoverySearchRequest = {
      keyword: '',
      limit: 20,
      offset: 0,
      sort: 'heat',
      filter: {
        type: [2],
        airDate: ['>=2026-07-01', '<2026-10-01'],
        metaTags: ['原创', '-剧场版'],
        ratingCount: ['>=5000'],
      },
    };
    const result = await provider.searchSubjects(request);
    expect(result.state).toBe('ok');
    expect(result.data?.totalKind).toBe('estimated');
    expect(result.data?.items[0]).toMatchObject({
      id: 123,
      tags: ['后宫'],
      metaTags: ['原创'],
      collection: { collect: 2, onHold: 4 },
    });
    expect(result.evidence?.['items[123].id']?.[0]?.source.operation).toBe('searchSubjects');
    expect(result.evidence?.['items[123].id']?.[0]?.source.experimental).toBe(true);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      keyword: '',
      sort: 'heat',
      filter: {
        type: [2],
        air_date: ['>=2026-07-01', '<2026-10-01'],
        meta_tags: ['原创', '-剧场版'],
        rating_count: ['>=5000'],
      },
    });
  });

  it('marks database-count browse totals as exact', async () => {
    const provider = new OfficialV0Provider({
      getSubjectById: vi.fn(),
      getSubjects: vi.fn().mockResolvedValue({
        total: 1,
        limit: 20,
        offset: 0,
        data: [{ id: 321, type: 2, name: 'Browse subject', name_cn: '浏览条目', platform: 'TV', tags: [], meta_tags: [] }],
      }),
    } as never);
    const request: SubjectDiscoveryBrowseRequest = { type: 2, limit: 20, offset: 0, sort: 'date' };
    const result = await provider.browseSubjects(request);
    expect(result.state).toBe('ok');
    expect(result.data?.totalKind).toBe('exact');
  });
});
