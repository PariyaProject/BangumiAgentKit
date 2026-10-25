import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  createRuntimeDependenciesWithStorage,
  ToolRegistry,
  type AuthenticatedExecutionSession,
} from '@bangumi-agent-kit/tools';
import type { ArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';

const subjectId = 991402;
const secretKey = 'synthetic-collection-session-regression-key';
const accounts = [
  {
    username: 'fixture-alice',
    token: 'synthetic-token-alice',
    comment: 'SYNTHETIC_ALICE_ONLY',
    rate: 9,
  },
  { username: 'fixture-bob', token: 'synthetic-token-bob', comment: 'SYNTHETIC_BOB_ONLY', rate: 6 },
  { username: 'me', token: 'synthetic-token-literal-me', comment: 'SYNTHETIC_ME_ONLY', rate: 1 },
];
const tools = [
  { name: 'bangumi.render_collection_progress', input: { subjectId } },
  { name: 'bangumi.render_subject_card', input: { subjectId, includeCollection: true } },
];
const stores: MemoryStorage[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((storage) => storage.close()));
  vi.restoreAllMocks();
});

async function fixture(username = 'fixture-alice', bound = true) {
  const storage = new MemoryStorage();
  stores.push(storage);
  const principal = await storage.findOrCreatePrincipal({
    provider: 'synthetic',
    botInstanceId: 'fixture-bot',
    externalUserId: 'fixture-owner',
  });
  for (const [index, account] of accounts.entries()) {
    await storage.upsertBangumiAccount({
      id: account.username,
      bangumiUserId: index + 100,
      username: account.username,
      nickname: 'Synthetic account',
    });
    await storage.upsertCredential({
      id: 'credential-' + account.username,
      bangumiAccountId: account.username,
      encryptedAccessToken: encryptToken(account.token, secretKey),
      expiresAt: new Date(Date.now() + 3600_000),
      requestedCapabilities: ['read:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  if (bound) await storage.replaceActiveBinding(principal.id, username);
  const requests: { path: string; authorization: string | null; method: string }[] = [];
  let collectionStatus = 200;
  const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      path: url.pathname,
      authorization: new Headers(init?.headers).get('authorization'),
      method: init?.method || 'GET',
    });
    if (url.origin !== 'https://api.bgm.tv') return Response.json({}, { status: 400 });
    if (url.pathname === `/v0/subjects/${subjectId}`) {
      return Response.json({
        id: subjectId,
        type: 2,
        name: 'Synthetic subject',
        name_cn: '合成条目',
        summary: 'Synthetic public summary',
        eps: 12,
        total_episodes: 12,
        images: {},
        tags: [],
        rating: { score: 8, rank: 1, total: 2, count: {} },
        collection: {},
        infobox: [],
      });
    }
    const owner = accounts.find(
      (account) => url.pathname === `/v0/users/${account.username}/collections/${subjectId}`,
    );
    if (owner && collectionStatus === 200) {
      return Response.json({
        subject_id: subjectId,
        subject_type: 2,
        type: 3,
        rate: owner.rate,
        ep_status: 4,
        comment: owner.comment,
        subject: { id: subjectId, type: 2, name: 'Synthetic subject', eps: 12 },
      });
    }
    return Response.json({}, { status: collectionStatus === 200 ? 400 : collectionStatus });
  });
  // Rendering/storage are deliberately mocked: these tests prove account data
  // routing and private scope, not PNG pixels or real-account acceptance.
  const renderCard = vi.fn(async (_viewModel: unknown, _options?: unknown) => ({
    buffer: Buffer.from('synthetic-render-result'),
    width: 720,
    height: 1000,
    template: 'subject-card' as const,
    templateVersion: 1,
    cacheKey: 'synthetic',
    warnings: [],
  }));
  const artifact = { id: 'synthetic-artifact', mimeType: 'image/png' as const };
  const artifactStore = {
    saveArtifact: vi.fn(async () => artifact),
    saveArtifactForPrincipal: vi.fn(async () => artifact),
    getArtifactForPrincipal: vi.fn(),
    resolveFilePathForPrincipal: vi.fn(),
  };
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey,
    publicHttpClient: new HttpClient({ fetchFn }),
    renderService: { renderCard } as unknown as RenderService,
    artifactStore: artifactStore as unknown as ArtifactStore,
  });
  const registry = new ToolRegistry(deps, { profile: 'full', renderTarget: 'chat' });
  const context = {
    principalId: principal.id,
    artifactPrincipalKey: 'synthetic:bot:owner',
    botInstanceId: 'fixture-bot',
    conversationId: 'fixture-chat',
  };
  return {
    storage,
    deps,
    registry,
    context,
    requests,
    fetchFn,
    renderCard,
    artifactStore,
    setCollectionStatus: (status: number) => {
      collectionStatus = status;
    },
  };
}

function assertOwner(f: Awaited<ReturnType<typeof fixture>>, username: string) {
  const account = accounts.find((candidate) => candidate.username === username)!;
  expect(f.requests).toEqual([
    { path: `/v0/subjects/${subjectId}`, authorization: `Bearer ${account.token}`, method: 'GET' },
    {
      path: `/v0/users/${username}/collections/${subjectId}`,
      authorization: `Bearer ${account.token}`,
      method: 'GET',
    },
  ]);
  const rendered = JSON.stringify(f.renderCard.mock.calls[0]?.[0]);
  expect(rendered).toContain(account.comment);
  for (const other of accounts.filter((candidate) => candidate !== account))
    expect(rendered).not.toContain(other.comment);
  expect(f.renderCard).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({ cache: false }),
  );
  expect(f.artifactStore.saveArtifact).not.toHaveBeenCalled();
  expect(f.artifactStore.saveArtifactForPrincipal).toHaveBeenCalledWith(
    f.context.artifactPrincipalKey,
    expect.any(Buffer),
    'image/png',
    { width: 720, height: 1000 },
  );
}

for (const tool of tools) {
  describe(tool.name + ' bound collection identity', () => {
    it.each(['fixture-alice', 'fixture-bob'])(
      'keeps captured %s when binding changes before Registry execution',
      async (username) => {
        const f = await fixture(username);
        const resolve = f.deps.clientProvider.requireAuthenticatedClient.bind(
          f.deps.clientProvider,
        );
        const auth = vi
          .spyOn(f.deps.clientProvider, 'requireAuthenticatedClient')
          .mockImplementation(async (...args) => {
            const session = await resolve(...args);
            await f.storage.replaceActiveBinding(
              f.context.principalId,
              username === 'fixture-alice' ? 'fixture-bob' : 'fixture-alice',
            );
            return session;
          });
        await f.registry.executeTool(tool.name, tool.input, f.context);
        expect(auth).toHaveBeenCalledExactlyOnceWith(f.context.principalId, ['read:collection']);
        assertOwner(f, username);
      },
    );

    it('resolves a direct-call binding once and keeps its client/username across a switch', async () => {
      const f = await fixture();
      const resolve = f.deps.clientProvider.requireAuthenticatedClient.bind(f.deps.clientProvider);
      const auth = vi
        .spyOn(f.deps.clientProvider, 'requireAuthenticatedClient')
        .mockImplementation(async (...args) => {
          const session = await resolve(...args);
          await f.storage.replaceActiveBinding(f.context.principalId, 'fixture-bob');
          return session;
        });
      await f.registry.getTool(tool.name)!.execute(tool.input, f.context, f.deps);
      expect(auth).toHaveBeenCalledExactlyOnceWith(f.context.principalId, ['read:collection']);
      assertOwner(f, 'fixture-alice');
    });

    it('uses a captured session without requiring a provider', async () => {
      const f = await fixture('fixture-bob');
      const executionSession = await f.deps.clientProvider.requireAuthenticatedClient(
        f.context.principalId,
        ['read:collection'],
      );
      await f.registry.getTool(tool.name)!.execute(tool.input, f.context, { executionSession });
      assertOwner(f, 'fixture-bob');
    });

    it('accepts me only as the actual bound username, without treating it as an alias', async () => {
      const f = await fixture('me');
      const auth = vi.spyOn(f.deps.clientProvider, 'requireAuthenticatedClient');
      await f.registry.executeTool(tool.name, tool.input, f.context);
      expect(auth).toHaveBeenCalledTimes(1);
      assertOwner(f, 'me');
    });

    it.each([undefined, '', '   ', ' fixture-alice ', 123])(
      'rejects captured invalid username %s without a second resolution or any read',
      async (username) => {
        const f = await fixture();
        const session = await f.deps.clientProvider.requireAuthenticatedClient(
          f.context.principalId,
          ['read:collection'],
        );
        const auth = vi.spyOn(f.deps.clientProvider, 'requireAuthenticatedClient');
        const executionSession = {
          ...session,
          account: { ...session.account, username },
        } as unknown as AuthenticatedExecutionSession;
        await expect(
          f.registry
            .getTool(tool.name)!
            .execute(tool.input, f.context, { ...f.deps, executionSession }),
        ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
        expect(auth).not.toHaveBeenCalled();
        expect(f.fetchFn).not.toHaveBeenCalled();
        expect(f.renderCard).not.toHaveBeenCalled();
      },
    );

    it('does not upgrade an incomplete captured optional session by re-resolving another account', async () => {
      const f = await fixture();
      const { client } = await f.deps.clientProvider.requireAuthenticatedClient(
        f.context.principalId,
        ['read:collection'],
      );
      const auth = vi.spyOn(f.deps.clientProvider, 'requireAuthenticatedClient');
      await expect(
        f.registry
          .getTool(tool.name)!
          .execute(tool.input, f.context, { ...f.deps, executionSession: { client } }),
      ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(auth).not.toHaveBeenCalled();
      expect(f.fetchFn).not.toHaveBeenCalled();
    });

    it.each([null, { account: { username: 'fixture-alice' } }])(
      'rejects a malformed captured session without a provider fallback',
      async (captured) => {
        const f = await fixture();
        const auth = vi.spyOn(f.deps.clientProvider, 'requireAuthenticatedClient');
        await expect(
          f.registry.getTool(tool.name)!.execute(tool.input, f.context, {
            ...f.deps,
            executionSession: captured as unknown as AuthenticatedExecutionSession,
          }),
        ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
        expect(auth).not.toHaveBeenCalled();
        expect(f.fetchFn).not.toHaveBeenCalled();
      },
    );

    it('requires a principal before a captured private session can make any request', async () => {
      const f = await fixture();
      const executionSession = await f.deps.clientProvider.requireAuthenticatedClient(
        f.context.principalId,
        ['read:collection'],
      );
      await expect(
        f.registry.getTool(tool.name)!.execute(
          tool.input,
          { ...f.context, principalId: '' },
          {
            executionSession,
          },
        ),
      ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(f.fetchFn).not.toHaveBeenCalled();
      expect(f.renderCard).not.toHaveBeenCalled();
    });

    it('fails without a direct-call session or provider before making any request', async () => {
      const f = await fixture();
      await expect(
        f.registry.getTool(tool.name)!.execute(tool.input, f.context, {}),
      ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(f.fetchFn).not.toHaveBeenCalled();
    });

    it('rejects a fallback session lacking username before any request or render', async () => {
      const f = await fixture();
      const session = await f.deps.clientProvider.requireAuthenticatedClient(
        f.context.principalId,
        ['read:collection'],
      );
      const auth = vi
        .spyOn(f.deps.clientProvider, 'requireAuthenticatedClient')
        .mockResolvedValue({ ...session, account: { ...session.account, username: '' } });
      await expect(
        f.registry.getTool(tool.name)!.execute(tool.input, f.context, f.deps),
      ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(auth).toHaveBeenCalledTimes(1);
      expect(f.fetchFn).not.toHaveBeenCalled();
      expect(f.renderCard).not.toHaveBeenCalled();
    });

    it('keeps the unbound Registry rejection before transport', async () => {
      const f = await fixture('fixture-alice', false);
      await expect(f.registry.executeTool(tool.name, tool.input, f.context)).rejects.toMatchObject({
        code: 'AUTH_REQUIRED',
      });
      expect(f.fetchFn).not.toHaveBeenCalled();
      expect(f.renderCard).not.toHaveBeenCalled();
    });
  });
}

describe('public/optional subject-card behavior', () => {
  it('renders public data without resolving or reading a collection', async () => {
    const f = await fixture('fixture-alice', false);
    const auth = vi.spyOn(f.deps.clientProvider, 'requireAuthenticatedClient');
    await f.registry.executeTool('bangumi.render_subject_card', { subjectId }, f.context);
    expect(auth).not.toHaveBeenCalled();
    expect(f.requests).toEqual([
      { path: `/v0/subjects/${subjectId}`, authorization: null, method: 'GET' },
    ]);
    expect(f.artifactStore.saveArtifact).toHaveBeenCalledTimes(1);
    expect(f.artifactStore.saveArtifactForPrincipal).not.toHaveBeenCalled();
  });

  it('preserves optional collection-not-found degradation after a valid bound identity', async () => {
    const f = await fixture();
    f.setCollectionStatus(404);
    await f.registry.executeTool(
      'bangumi.render_subject_card',
      { subjectId, includeCollection: true },
      f.context,
    );
    expect(f.requests[1]?.path).toBe(`/v0/users/fixture-alice/collections/${subjectId}`);
    expect(f.artifactStore.saveArtifact).toHaveBeenCalledTimes(1);
    expect(f.renderCard).toHaveBeenCalledWith(
      expect.not.objectContaining({ collection: expect.anything() }),
      expect.anything(),
    );
  });

  it('keeps required progress-not-found as an error without rendering', async () => {
    const f = await fixture();
    f.setCollectionStatus(404);
    await expect(
      f.registry.executeTool('bangumi.render_collection_progress', { subjectId }, f.context),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.renderCard).not.toHaveBeenCalled();
  });
});
