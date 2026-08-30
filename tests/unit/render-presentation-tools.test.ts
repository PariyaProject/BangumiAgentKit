import { describe, expect, it, vi } from 'vitest';
import { getPrivateArtifactPrincipal, renderAndSaveArtifact } from '@bangumi-agent-kit/tools';
import type { ArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';

const renderResult = {
  buffer: Buffer.from('png'),
  width: 640,
  height: 320,
  template: 'collection-entity-consistency' as const,
  templateVersion: 1,
  cacheKey: 'fixture',
  warnings: [],
};

function createArtifactStore() {
  return {
    saveArtifact: vi.fn(async () => ({
      id: 'public-artifact',
      mimeType: 'image/png' as const,
    })),
    saveArtifactForPrincipal: vi.fn(async (principalId: string) => ({
      id: `private-${principalId}`,
      mimeType: 'image/png' as const,
    })),
    getArtifactForPrincipal: vi.fn(async () => null),
    resolveFilePathForPrincipal: vi.fn(async () => null),
  } as unknown as ArtifactStore & {
    saveArtifact: ReturnType<typeof vi.fn>;
    saveArtifactForPrincipal: ReturnType<typeof vi.fn>;
  };
}

describe('private render artifact scope', () => {
  it('fails closed for every private collection template without a non-empty principal', () => {
    for (const template of [
      'collection-progress',
      'collection-intelligence',
      'collection-backlog',
      'collection-schedule',
      'collection-dashboard',
      'collection-series',
      'collection-entity-consistency',
    ]) {
      expect(() => getPrivateArtifactPrincipal(template)).toThrow('AUTH_REQUIRED');
      expect(() => getPrivateArtifactPrincipal(template, '   ')).toThrow('AUTH_REQUIRED');
    }
    expect(getPrivateArtifactPrincipal('subject-card')).toBeUndefined();
  });

  it('never falls back to an unscoped artifact or crosses principals', async () => {
    const renderService = {
      renderCard: vi.fn(async () => renderResult),
    } as unknown as Pick<RenderService, 'renderCard'>;
    const artifactStore = createArtifactStore();
    const viewModel = { template: 'collection-entity-consistency' };

    await expect(
      renderAndSaveArtifact(viewModel, renderService, artifactStore),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(renderService.renderCard).not.toHaveBeenCalled();
    expect(artifactStore.saveArtifact).not.toHaveBeenCalled();
    expect(artifactStore.saveArtifactForPrincipal).not.toHaveBeenCalled();

    await renderAndSaveArtifact(viewModel, renderService, artifactStore, 'alice');
    await renderAndSaveArtifact(viewModel, renderService, artifactStore, 'bob');

    expect(artifactStore.saveArtifact).not.toHaveBeenCalled();
    expect(
      artifactStore.saveArtifactForPrincipal.mock.calls.map(([principal]) => principal),
    ).toEqual(['alice', 'bob']);
  });
});
