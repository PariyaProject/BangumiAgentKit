import { describe, expect, it, vi } from 'vitest';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import { createRenderPresentationTools } from '@bangumi-agent-kit/tools';

describe('bangumi.render_subject_cohort_comparison', () => {
  it('renders the semantic cohort result through the zero-network card seam', async () => {
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
      id: 'cohort_artifact',
      mimeType: 'image/png' as const,
      width: 640,
      height: 320,
      expiresAt: '2026-08-30T00:00:00.000Z',
    }));
    const renderTools = createRenderPresentationTools(
      { renderCard } as never,
      { saveArtifact } as never,
    );
    const tool = renderTools.find(
      (item) => item.name === 'bangumi.render_subject_cohort_comparison',
    );
    const aggregateTool = renderTools.find(
      (item) => item.name === 'bangumi.render_subject_cohort_aggregation',
    );

    const execute = tool!.execute as unknown as (
      input: unknown,
      context: unknown,
      deps: { providerRegistry: ProviderRegistry },
    ) => Promise<unknown>;
    const result = await execute(
      {
        cohorts: [
          { label: 'A', query: { season: '2026-spring', media: 'anime' } },
          { label: 'B', query: { season: '2026-summer', media: 'anime' } },
        ],
        maxSubjects: 4,
      },
      {},
      { providerRegistry },
    );

    expect(result).toEqual({ artifact: expect.objectContaining({ id: 'cohort_artifact' }) });
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-cohort-comparison', state: 'not_found' }),
    );

    const executeAggregate = aggregateTool!.execute as unknown as (
      input: unknown,
      context: unknown,
      deps: { providerRegistry: ProviderRegistry },
    ) => Promise<unknown>;
    await executeAggregate(
      { cohort: { label: 'Spring', query: { season: '2026-spring', media: 'anime' } } },
      {},
      { providerRegistry },
    );
    expect(renderCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ template: 'subject-cohort-comparison', state: 'not_found' }),
    );
    expect(provider.searchSubjects).toHaveBeenCalledTimes(3);
  });
});
