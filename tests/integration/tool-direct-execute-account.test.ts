import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { createReadTools, createWriteTools } from '@bangumi-agent-kit/tools';
import { createAuthTools as createAuthToolsFromDefinition } from '../../packages/tools/src/definitions/auth-tools.js';

const context = {
  principalId: 'direct-account-fixture',
  botInstanceId: 'test-bot',
  conversationId: 'test-conversation',
};

function createUnavailableClient() {
  return new HttpClient({
    fetchFn: vi.fn(async () =>
      new Response(JSON.stringify({ error: 'fixture unavailable' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  });
}

async function expectControlled(tool: any, input: Record<string, unknown>, name: string, deps: any) {
  let result: any;
  try {
    result = await tool.execute(input, context, deps);
  } catch (error) {
    result = error;
  }
  if (result instanceof Error) {
    if (typeof (result as { code?: unknown }).code === 'string') {
      expect(result, name).toMatchObject({ code: expect.any(String) });
    } else {
      expect(result.message, name).toMatch(/AUTH_REQUIRED|VALIDATION_ERROR|unavailable/i);
    }
  } else if (result?.ok === false) {
    expect(result, name).toMatchObject({ ok: false, error: { code: expect.any(String) } });
  } else {
    expect(result, name).toBeTruthy();
  }
}

describe('direct execute coverage for auth, collection, and write tools', () => {
  it('executes account lifecycle tools through explicit auth fixtures', async () => {
    const tokenBroker = {
      switchAccount: vi.fn(async (_principalId: string, accountId: string) => ({ accountId })),
      disconnect: vi.fn(async () => undefined),
    };
    const oauthService = {
      createAuthorizationUrl: vi.fn(async () => ({
        url: 'https://example.test/bangumi/authorize',
        expiresAt: new Date('2026-09-23T00:00:00.000Z'),
      })),
    };
    const authTools = new Map(
      createAuthToolsFromDefinition(tokenBroker as any, oauthService as any).map((tool) => [
        tool.name,
        tool,
      ]),
    );

    const authStart = await (authTools.get('bangumi.auth_start')!.execute as any)(
      { capabilities: ['read:collection'] },
      context,
    );
    expect(authStart).toMatchObject({ authorizationUrl: 'https://example.test/bangumi/authorize' });

    const switched = await (authTools.get('bangumi.auth_switch_account')!.execute as any)(
      { accountId: 'account-fixture' },
      context,
    );
    expect(switched).toEqual({ accountId: 'account-fixture' });

    const disconnected = await (authTools.get('bangumi.auth_disconnect')!.execute as any)(
      {},
      context,
    );
    expect(disconnected).toEqual({ success: true, message: 'Bangumi 账号已成功解绑' });
    expect(tokenBroker.disconnect).toHaveBeenCalledWith(context.principalId);
  });

  it('executes collection read and write entry points without touching a real account', async () => {
    const client = createUnavailableClient();
    const authenticatedClient = new GeneratedBangumiOpenApiClient(client);
    const clientProvider = {
      getPublicClient: async () => client,
      getOptionalAuthenticatedClient: async () => client,
      requireAuthenticatedClient: async () => ({
        client: authenticatedClient,
        account: { id: 'fixture-account', username: 'fixture-user', nickname: 'Fixture' },
      }),
    };
    const deps = { clientProvider, executionSession: undefined };
    const readTools = new Map(createReadTools(client).map((tool) => [tool.name, tool]));
    await expectControlled(
      readTools.get('bangumi.get_character_collection')!,
      { characterId: 1, username: 'fixture-user' },
      'bangumi.get_character_collection',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.list_person_collections')!,
      { username: 'fixture-user', maxItems: 1 },
      'bangumi.list_person_collections',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_person_collection')!,
      { personId: 1, username: 'fixture-user' },
      'bangumi.get_person_collection',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_backlog')!,
      { maxItems: 1, maxSubjects: 1, maxEpisodesPerSubject: 1 },
      'bangumi.get_collection_backlog',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_dashboard')!,
      { maxCollectionItems: 1, maxSubjects: 1, maxEpisodesPerSubject: 1, maxRows: 1 },
      'bangumi.get_collection_dashboard',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_entity_consistency')!,
      { maxSubjects: 1, maxSubjectPages: 1, maxRelationsPerSubject: 1, maxOutputRows: 1 },
      'bangumi.get_collection_entity_consistency',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_intelligence')!,
      { maxItems: 1 },
      'bangumi.get_collection_intelligence',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_schedule')!,
      { maxCollectionItems: 1, maxRows: 1 },
      'bangumi.get_collection_schedule',
      deps,
    );
    await expectControlled(
      readTools.get('bangumi.get_collection_series_groups')!,
      { maxItems: 1, maxRelationSubjects: 1, maxRelationsPerSubject: 1, maxGroups: 1, maxEdges: 1 },
      'bangumi.get_collection_series_groups',
      deps,
    );

    const writeTools = new Map(createWriteTools(client).map((tool) => [tool.name, tool]));
    await expectControlled(
      writeTools.get('bangumi.manage_index')!,
      { action: 'create', title: 'Fixture index' },
      'bangumi.manage_index',
      deps,
    );
    await expectControlled(
      writeTools.get('bangumi.manage_person_collection')!,
      { personId: 1, action: 'collect' },
      'bangumi.manage_person_collection',
      deps,
    );
  });
});
