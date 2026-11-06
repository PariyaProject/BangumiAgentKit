import { describe, expect, it } from 'vitest';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ToolRegistry } from '@bangumi-agent-kit/tools';

const key = 'synthetic-native-page-key-01234567890123456789';
const row = { id: 20, name: '合成记录', type: 1, created_at: '2026-01-01T00:00:00Z' };
const cases = [
  ['bangumi.list_person_collections', 'persons'],
  ['bangumi.list_character_collections', 'characters'],
] as const;

async function fixture(bound = false, body?: unknown) {
  const storage = new MemoryStorage();
  const principal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'page-fake-bot',
    externalUserId: 'page-fake-external',
  });
  if (bound) {
    const account = await storage.upsertBangumiAccount({
      id: 'page-fake-account',
      bangumiUserId: 990001,
      username: 'page-fake-user',
      nickname: 'Synthetic',
    });
    await storage.bindAccount(principal.id, account.id, true);
    const now = new Date();
    await storage.upsertCredential({
      id: 'page-fake-token',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('page-fake-access', key),
      expiresAt: new Date(now.getTime() + 3600000),
      requestedCapabilities: [],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    });
  }
  const requests: Array<{
    path: string;
    query: Record<string, string>;
    authorization: string | null;
  }> = [];
  const client = new HttpClient({
    fetchFn: async (input, init) => {
      const url = new URL(String(input));
      requests.push({
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        authorization: new Headers(init?.headers).get('authorization'),
      });
      if (
        !/^\/v0\/users\/(?:page-fake-user|public-user)\/collections\/-\/(?:persons|characters)$/u.test(
          url.pathname,
        )
      )
        throw Error('UNEXPECTED_PAGE_FIXTURE_ROUTE');
      return Response.json(body ?? { total: 1, limit: 1, offset: 0, data: [row] });
    },
  });
  return {
    requests,
    registry: new ToolRegistry({
      storage,
      publicHttpClient: client,
      secretKey: key,
      keyVersion: 'v1',
      clientId: 'fake-client',
      clientSecret: 'fake-secret',
      redirectUri: 'http://127.0.0.1/fake',
    }),
    context: {
      principalId: principal.id,
      botInstanceId: 'page-fake-bot',
      conversationId: 'page-fake-conversation',
    },
  };
}

describe('native collection pages through the original Registry identity policy', () => {
  it.each(cases)(
    '%s sends the row cap upstream on the original authenticated client',
    async (name, kind) => {
      const f = await fixture(true);
      const result = await f.registry.executeTool(name, { maxItems: 1 }, f.context);
      expect(f.requests).toEqual([
        {
          path: `/v0/users/page-fake-user/collections/-/${kind}`,
          query: { limit: '1', offset: '0' },
          authorization: 'Bearer page-fake-access',
        },
      ]);
      expect(result).toMatchObject({
        items: [{ id: 20 }],
        limit: 1,
        offset: 0,
        coverage: { observed: 1, returned: 1, maxItems: 1, truncated: false },
        source: { authScope: 'account' },
      });
    },
  );

  it.each(cases)(
    '%s keeps public overrides anonymous and passes an explicit offset',
    async (name, kind) => {
      const f = await fixture(true, { total: 9, limit: 1, offset: 7, data: [row] });
      const result = await f.registry.executeTool(
        name,
        { username: 'public-user', maxItems: 1, offset: 7 },
        f.context,
      );
      expect(f.requests).toEqual([
        {
          path: `/v0/users/public-user/collections/-/${kind}`,
          query: { limit: '1', offset: '7' },
          authorization: null,
        },
      ]);
      expect(result).toMatchObject({
        source: { authScope: 'public' },
        pagination: { nextOffset: 8 },
      });
    },
  );

  it.each(cases)('%s requires binding before any I/O when username is omitted', async (name) => {
    const f = await fixture();
    await expect(f.registry.executeTool(name, { maxItems: 1 }, f.context)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
    expect(f.requests).toEqual([]);
  });

  it.each(cases)('%s rejects a source that ignores the requested native limit', async (name) => {
    const f = await fixture(false, { total: 1, limit: 30, offset: 0, data: [row] });
    await expect(
      f.registry.executeTool(name, { username: 'public-user', maxItems: 1 }, f.context),
    ).rejects.toMatchObject({ code: 'PARSER_ERROR', retryable: false });
    expect(f.requests).toHaveLength(1);
  });

  it.each(cases)('%s defaults to one native page of at most fifty rows', async (name) => {
    const f = await fixture(false, { total: 0, limit: 50, offset: 0, data: [] });
    const result = await f.registry.executeTool(name, { username: 'public-user' }, f.context);
    expect(f.requests.map((r) => r.query)).toEqual([{ limit: '50', offset: '0' }]);
    expect(result).toMatchObject({
      items: [],
      pagination: { hasMore: false, empty: 'collection_empty' },
    });
  });

  it.each(cases)('%s rejects invalid or unknown input without I/O', async (name) => {
    const f = await fixture();
    for (const input of [
      { maxItems: 0 },
      { maxItems: 51 },
      { offset: -1 },
      { offset: 0.5 },
      { offset: Number.MAX_SAFE_INTEGER + 1 },
      { query: { limit: 100 } },
    ]) {
      await expect(
        f.registry.executeTool(name, { username: 'public-user', ...input }, f.context),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(f.requests).toEqual([]);
  });
});
