import { describe, expect, it, vi } from 'vitest';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import { createRenderPresentationTools } from '@bangumi-agent-kit/tools';

describe('bangumi.render_query_subjects', () => {
  it('reuses the discovery engine and requests compact explanation by default', async () => {
    const provider = {
      getSubject: vi.fn(async () => ({ state: 'not_found' as const })),
      getSubjectStats: vi.fn(async () => ({ state: 'not_found' as const })),
      searchSubjects: vi.fn(async (request: { limit: number; offset: number }) => ({
        state: 'ok' as const,
        data: {
          items: [
            {
              id: 1,
              type: 2,
              name: 'Example Anime',
              nameCn: '示例动画',
              platform: 'TV',
              date: '2026-07-01',
              score: 8.8,
              rank: 12,
              ratingCount: 9000,
              tags: ['后宫'],
              metaTags: ['原创'],
            },
          ],
          total: 1,
          totalKind: 'estimated' as const,
          limit: request.limit,
          offset: request.offset,
        },
        evidence: {},
      })),
      browseSubjects: vi.fn(async (request: { limit: number; offset: number }) => ({
        state: 'ok' as const,
        data: {
          items: [],
          total: 0,
          totalKind: 'exact' as const,
          limit: request.limit,
          offset: request.offset,
        },
        evidence: {},
      })),
    };
    const providerRegistry = new ProviderRegistry({ v0: provider });
    const renderCard = vi.fn(async (viewModel: unknown) => ({
      buffer: Buffer.from('png'),
      width: 640,
      height: 320,
      template: (viewModel as { template: string }).template,
      templateVersion: 1,
      cacheKey: 'fixture',
      warnings: [],
    }));
    const saveArtifact = vi.fn(async () => ({
      id: 'art_fixture',
      mimeType: 'image/png' as const,
      width: 640,
      height: 320,
      expiresAt: '2026-08-12T00:00:00.000Z',
    }));
    const [tool] = createRenderPresentationTools(
      { renderCard } as never,
      { saveArtifact } as never,
    ).filter((item) => item.name === 'bangumi.render_query_subjects');

    const execute = tool!.execute as unknown as (
      input: { media: 'anime'; concepts: string[] },
      context: { principalId: string; botInstanceId: string; conversationId: string },
      deps: { providerRegistry: ProviderRegistry },
    ) => Promise<unknown>;
    const result = await execute(
      { media: 'anime', concepts: ['后宫'] },
      { principalId: 'test', botInstanceId: 'test', conversationId: 'test' },
      { providerRegistry },
    );

    expect(result).toEqual({ artifact: expect.objectContaining({ id: 'art_fixture' }) });
    expect(provider.searchSubjects).toHaveBeenCalledTimes(1);
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'discovery-results',
        state: 'ok',
        query: expect.objectContaining({
          facets: expect.arrayContaining(['媒介：动画', '概念：后宫']),
        }),
        source: expect.objectContaining({ evidenceCount: 0 }),
      }),
    );
  });

  it('honors explicit explain none without changing the presentation contract', async () => {
    const provider = {
      getSubject: vi.fn(async () => ({ state: 'not_found' as const })),
      getSubjectStats: vi.fn(async () => ({ state: 'not_found' as const })),
      searchSubjects: vi.fn(async (request: { limit: number; offset: number }) => ({
        state: 'ok' as const,
        data: {
          items: [],
          total: 0,
          totalKind: 'estimated' as const,
          limit: request.limit,
          offset: request.offset,
        },
        evidence: {},
      })),
      browseSubjects: vi.fn(async (request: { limit: number; offset: number }) => ({
        state: 'ok' as const,
        data: {
          items: [],
          total: 0,
          totalKind: 'exact' as const,
          limit: request.limit,
          offset: request.offset,
        },
        evidence: {},
      })),
    };
    const providerRegistry = new ProviderRegistry({ v0: provider });
    const renderCard = vi.fn(async () => ({
      buffer: Buffer.from('png'),
      width: 640,
      height: 320,
      template: 'discovery-results' as const,
      templateVersion: 1,
      cacheKey: 'fixture',
      warnings: [],
    }));
    const saveArtifact = vi.fn(async () => ({
      id: 'art_fixture',
      mimeType: 'image/png' as const,
      width: 640,
      height: 320,
      expiresAt: '2026-08-12T00:00:00.000Z',
    }));
    const [tool] = createRenderPresentationTools(
      { renderCard } as never,
      { saveArtifact } as never,
    ).filter((item) => item.name === 'bangumi.render_query_subjects');
    const execute = tool!.execute as unknown as (
      input: { media: 'anime'; explain: 'none' },
      context: { principalId: string; botInstanceId: string; conversationId: string },
      deps: { providerRegistry: ProviderRegistry },
    ) => Promise<unknown>;
    await execute(
      { media: 'anime', explain: 'none' },
      { principalId: 'test', botInstanceId: 'test', conversationId: 'test' },
      { providerRegistry },
    );
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'discovery-results' }),
    );
    expect(provider.searchSubjects).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the provider registry is absent', async () => {
    const [tool] = createRenderPresentationTools(
      { renderCard: vi.fn() } as never,
      { saveArtifact: vi.fn() } as never,
    ).filter((item) => item.name === 'bangumi.render_query_subjects');

    const execute = tool!.execute as unknown as (
      input: { media: 'anime' },
      context: { principalId: string; botInstanceId: string; conversationId: string },
      deps: Record<string, never>,
    ) => Promise<unknown>;
    await expect(
      execute(
        { media: 'anime' },
        { principalId: 'test', botInstanceId: 'test', conversationId: 'test' },
        {},
      ),
    ).rejects.toThrow('ProviderRegistry unavailable');
  });
});
