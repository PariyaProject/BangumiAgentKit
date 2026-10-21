import { describe, expect, it, vi } from 'vitest';
import {
  createRenderPresentationTools,
  getDefaultRenderOptions,
  getPrivateArtifactPrincipal,
  renderAndSaveArtifact,
} from '@bangumi-agent-kit/tools';
import { SubjectService, UserService } from '@bangumi-agent-kit/bangumi-core';
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

describe('render target defaults', () => {
  it('accepts only the two registered themes and keeps chat sizing', () => {
    expect(getDefaultRenderOptions('full', 'bangumi-light', 'unknown', {})).toEqual({
      theme: 'bangumi-light',
    });
    expect(getDefaultRenderOptions('chat', 'bangumi-dark', 'unknown', {})).toEqual({
      width: 360,
      deviceScaleFactor: 2,
      theme: 'bangumi-dark',
    });
    expect(getDefaultRenderOptions('full', 'light', 'unknown', {})).toEqual({});
    expect(getDefaultRenderOptions('chat', 'unknown', 'unknown', {})).toEqual({
      width: 360,
      deviceScaleFactor: 2,
    });
    expect(getDefaultRenderOptions('chat', 'bangumi-light', 'graphic-zine', {})).toEqual({
      width: 360,
      deviceScaleFactor: 2,
      theme: 'bangumi-light',
      designPack: 'graphic-zine',
    });
    expect(getDefaultRenderOptions('full', 'unknown', 'unknown', {})).toEqual({});
  });

  it('reads bounded typography defaults from operator environment settings', () => {
    expect(
      getDefaultRenderOptions('full', 'bangumi-light', 'clean-gallery', {
        BANGUMI_RENDER_FONT_SIZE_SCALE: '0.75',
        BANGUMI_RENDER_BODY_FONT_FAMILY: 'GenSen Rounded, sans-serif',
        BANGUMI_RENDER_BODY_FONT_FILE: 'GenSenRounded2TW-R.otf',
        BANGUMI_RENDER_FONT_DIR: '/opt/bangumi/fonts',
      }),
    ).toMatchObject({
      theme: 'bangumi-light',
      designPack: 'clean-gallery',
      typography: {
        fontSizeScale: 0.75,
        bodyFontFamily: '"GenSen Rounded", sans-serif',
        bodyFontFile: 'GenSenRounded2TW-R.otf',
        fontDirectory: '/opt/bangumi/fonts',
      },
    });
  });

  it('fails fast for invalid operator typography settings', () => {
    expect(() =>
      getDefaultRenderOptions('full', undefined, undefined, {
        BANGUMI_RENDER_FONT_SIZE_SCALE: '0.5',
      }),
    ).toThrow('RENDER_VALIDATION_ERROR');
    expect(() =>
      getDefaultRenderOptions('full', undefined, undefined, {
        BANGUMI_RENDER_BODY_FONT_FILE: '../secret.otf',
        BANGUMI_RENDER_FONT_DIR: '/opt/bangumi/fonts',
      }),
    ).toThrow('RENDER_VALIDATION_ERROR');
  });
});

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

  it('requires collection scope and principal-scopes subject cards containing collection data', async () => {
    const renderService = {
      renderCard: vi.fn(async () => renderResult),
    } as unknown as Pick<RenderService, 'renderCard'>;
    const artifactStore = createArtifactStore();
    const client = {} as never;
    const clientProvider = {
      getOptionalAuthenticatedClient: vi.fn(async () => client),
      requireAuthenticatedClient: vi.fn(async () => ({
        client,
        account: { id: 'synthetic-account', username: 'synthetic-user', nickname: 'Synthetic' },
      })),
    };
    const subjectLookup = vi.spyOn(SubjectService.prototype, 'getSubjectById').mockResolvedValue({
      id: 123,
      name: 'Synthetic English title',
      nameCn: '合成条目',
      type: 'anime',
      date: '2025',
      platform: 'TV',
      summary: 'Synthetic public summary',
      images: { common: '', medium: '', large: '', small: '' },
      tags: [],
      rating: { score: 8.4, rank: 1, total: 10, count: {} },
      collection: { wish: 0, collect: 0, doing: 0, onHold: 0, dropped: 0 },
      totalEpisodes: 12,
    } as never);
    const collectionLookup = vi
      .spyOn(UserService.prototype, 'getUserSubjectCollection')
      .mockResolvedValue({
        found: true,
        collection: {
          status: 'do',
          statusLabel: '在看',
          rating: 9,
          comment: 'synthetic private comment',
          epStatus: 4,
        },
      } as never);
    const context = {
      principalId: 'bangumi-user-alice',
      artifactPrincipalKey: 'qq:bot-1:sender-alice',
      botInstanceId: 'test-bot',
      conversationId: 'test-conversation',
    };
    const tool = createRenderPresentationTools(renderService as never, artifactStore, 'chat').find(
      (candidate) => candidate.name === 'bangumi.render_subject_card',
    ) as unknown as {
      resolvePolicy?: (
        input: { subjectId: number; includeCollection?: boolean },
        context: {
          principalId: string;
          artifactPrincipalKey: string;
          botInstanceId: string;
          conversationId: string;
        },
      ) => unknown;
      execute: (
        input: { subjectId: number; includeCollection?: boolean },
        context: {
          principalId: string;
          artifactPrincipalKey: string;
          botInstanceId: string;
          conversationId: string;
        },
        deps?: unknown,
      ) => Promise<unknown>;
    };

    expect(tool.resolvePolicy?.({ subjectId: 123, includeCollection: true }, context)).toEqual({
      auth: 'required',
      requiredCapabilities: ['read:collection'],
      risk: 'read',
    });
    expect(tool.resolvePolicy?.({ subjectId: 123 }, context)).toEqual({
      auth: 'optional',
      requiredCapabilities: [],
      risk: 'read',
    });

    await expect(
      tool.execute({ subjectId: 123, includeCollection: true }, context, {
        clientProvider,
      } as never),
    ).resolves.toMatchObject({ artifact: { id: 'private-qq:bot-1:sender-alice' } });

    expect(clientProvider.requireAuthenticatedClient).toHaveBeenCalledWith('bangumi-user-alice', [
      'read:collection',
    ]);
    expect(clientProvider.getOptionalAuthenticatedClient).not.toHaveBeenCalled();
    expect(subjectLookup).toHaveBeenCalledWith(123);
    expect(collectionLookup).toHaveBeenCalledWith('me', 123);
    expect(artifactStore.saveArtifact).not.toHaveBeenCalled();
    expect(artifactStore.saveArtifactForPrincipal).toHaveBeenCalledWith(
      'qq:bot-1:sender-alice',
      renderResult.buffer,
      'image/png',
      { width: 640, height: 320 },
    );
    expect(renderService.renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-card', collection: expect.any(Object) }),
      expect.objectContaining({ cache: false, width: 360, deviceScaleFactor: 2 }),
    );
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

  it('passes a requested layout through while keeping private render caching disabled', async () => {
    const renderService = {
      renderCard: vi.fn(async () => renderResult),
    } as unknown as Pick<RenderService, 'renderCard'>;
    const artifactStore = createArtifactStore();
    const layout = { width: 640, deviceScaleFactor: 2 } as const;

    await renderAndSaveArtifact(
      { template: 'subject-overview' },
      renderService,
      artifactStore,
      undefined,
      layout,
    );
    expect(renderService.renderCard).toHaveBeenLastCalledWith(
      { template: 'subject-overview' },
      layout,
    );

    const privateViewModel = { template: 'collection-entity-consistency' };
    await renderAndSaveArtifact(privateViewModel, renderService, artifactStore, 'alice', layout);
    expect(renderService.renderCard).toHaveBeenLastCalledWith(privateViewModel, {
      ...layout,
      cache: false,
    });
  });
});
