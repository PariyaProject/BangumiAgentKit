import { describe, expect, it } from 'vitest';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ToolRegistry } from '@bangumi-agent-kit/tools';

const key = 'synthetic-person-collection-wire-key-01234567890';
const person = { id: 20, name: '人物', type: 1, created_at: '2026-01-01T00:00:00Z' };

async function fixture(bound: boolean) {
  const storage = new MemoryStorage();
  const principal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'fake-bot',
    externalUserId: 'fake-user',
  });
  if (bound) {
    const account = await storage.upsertBangumiAccount({
      id: 'fake-account',
      bangumiUserId: 990001,
      username: 'synthetic',
      nickname: 'Synthetic',
    });
    await storage.bindAccount(principal.id, account.id, true);
    const now = new Date();
    await storage.upsertCredential({
      id: 'fake-credential',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('fake-person-token', key),
      expiresAt: new Date(now.getTime() + 3600_000),
      requestedCapabilities: [],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    });
  }
  const requests: Array<{ path: string; authorization: string | null }> = [];
  const publicHttpClient = new HttpClient({
    fetchFn: async (input, init) => {
      const url = new URL(String(input));
      requests.push({
        path: url.pathname,
        authorization: new Headers(init?.headers).get('authorization'),
      });
      if (
        !/^\/v0\/users\/(?:synthetic|public-user)\/collections\/-\/persons(?:\/20)?$/u.test(
          url.pathname,
        ) ||
        url.search
      ) {
        throw Error('UNEXPECTED_FIXTURE_REQUEST');
      }
      const body = url.pathname.endsWith('/20')
        ? person
        : { total: 1, limit: 0, offset: 0, data: [person] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const registry = new ToolRegistry({
    storage,
    publicHttpClient,
    secretKey: key,
    keyVersion: 'v1',
    clientId: 'fake-client',
    clientSecret: 'fake-secret',
    redirectUri: 'http://127.0.0.1/fake',
  });
  return {
    registry,
    requests,
    context: {
      principalId: principal.id,
      botInstanceId: 'fake-bot',
      conversationId: 'fake-conversation',
    },
  };
}

describe('person collection wire through original ToolRegistry and authentication', () => {
  it('uses the original bound client and username without extra profile/detail calls', async () => {
    const { registry, requests, context } = await fixture(true);
    const single = (await registry.executeTool(
      'bangumi.get_person_collection',
      { personId: 20 },
      context,
    )) as Record<string, any>;
    const list = (await registry.executeTool(
      'bangumi.list_person_collections',
      { maxItems: 1 },
      context,
    )) as Record<string, any>;
    expect(single).toMatchObject({
      found: true,
      item: { id: 20 },
      source: { authScope: 'account' },
    });
    expect(single.item).not.toHaveProperty('career');
    expect(list).toMatchObject({
      items: [{ id: 20 }],
      coverage: { observed: 1, returned: 1, truncated: false },
      source: { authScope: 'account' },
    });
    expect(list.items[0]).not.toHaveProperty('career');
    expect(requests).toEqual([
      {
        path: '/v0/users/synthetic/collections/-/persons/20',
        authorization: 'Bearer fake-person-token',
      },
      {
        path: '/v0/users/synthetic/collections/-/persons',
        authorization: 'Bearer fake-person-token',
      },
    ]);
  });

  it('keeps explicit public-user reads anonymous even when an account is bound', async () => {
    const { registry, requests, context } = await fixture(true);
    const result = (await registry.executeTool(
      'bangumi.get_person_collection',
      { personId: 20, username: 'public-user' },
      context,
    )) as Record<string, any>;
    expect(result).toMatchObject({ found: true, source: { authScope: 'public' } });
    expect(requests).toEqual([
      { path: '/v0/users/public-user/collections/-/persons/20', authorization: null },
    ]);
  });

  it('refuses missing binding before any provider request', async () => {
    const { registry, requests, context } = await fixture(false);
    await expect(
      registry.executeTool('bangumi.get_person_collection', { personId: 20 }, context),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(
      registry.executeTool('bangumi.list_person_collections', { maxItems: 1 }, context),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(requests).toEqual([]);
  });
});
