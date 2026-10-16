import { afterEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
// @ts-expect-error Agent/MCP registry is JavaScript and exercised by runtime integration here.
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertM07ManageIndexUnboundProfile,
  M07_MANAGE_INDEX_EXPECTED_ARGUMENTS,
  M07_MANAGE_INDEX_PROFILE_ID,
  sameArguments,
} from '../../scripts/lib/m07-manage-index-unbound-profile.mjs';
// @ts-expect-error M07 server is JavaScript and must be exercised through its real ToolRegistry gate.
import { evaluateM07ManageIndexGate } from '../../apps/mcp/codex-m07-manage-index-auth-gate-mcp-server.mjs';

const TEST_SECRET = 'run95-m07-local-test-key-0123456789abcdef';
const registries: ToolRegistry[] = [];
const storages: MemoryStorage[] = [];

afterEach(async () => {
  await Promise.all(registries.splice(0).map((registry) => registry.close()));
  await Promise.all(storages.splice(0).map((storage) => storage.close()));
});

describe('M07 manage_index unbound Agent/MCP profile', () => {
  it('registers one exact create action for the matrix-only profile', () => {
    const profile = getAgentMcpProfileById(M07_MANAGE_INDEX_PROFILE_ID);
    expect(profile).toBeTruthy();
    expect(assertM07ManageIndexUnboundProfile(profile)).toBe(true);
    expect(sameArguments(M07_MANAGE_INDEX_EXPECTED_ARGUMENTS)).toBe(true);
    expect(
      sameArguments({ ...M07_MANAGE_INDEX_EXPECTED_ARGUMENTS, _confirmationId: 'cfm_wrong' }),
    ).toBe(false);
    expect(
      sameArguments({ ...M07_MANAGE_INDEX_EXPECTED_ARGUMENTS, title: 'different action' }),
    ).toBe(false);
  });

  it('receives AUTH_REQUIRED from the real ToolRegistry before HTTP or write execution', async () => {
    const storage = new MemoryStorage();
    storages.push(storage);
    const principal = await storage.findOrCreatePrincipal({
      provider: 'local-mcp',
      botInstanceId: 'run95-m07-local-mcp',
      externalUserId: 'run95-m07-unbound-principal',
    });
    const requests: string[] = [];
    const publicHttpClient = new HttpClient({
      fetchFn: async (url) => {
        requests.push(String(url));
        throw new Error('Unexpected M07 offline fixture HTTP request.');
      },
    });
    const dependencies = createRuntimeDependenciesWithStorage(storage, {
      clientId: 'run95-m07.invalid',
      clientSecret: 'run95-m07.invalid',
      redirectUri: 'http://127.0.0.1/run95-m07-callback',
      secretKey: TEST_SECRET,
      publicHttpClient,
    });
    const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
    registries.push(registry);

    const result = await evaluateM07ManageIndexGate({
      registry,
      context: {
        principalId: principal.id,
        botInstanceId: 'run95-m07-local-mcp',
        conversationId: 'run95-m07-auth-gate',
      },
      httpRequestCount: () => requests.length,
    });

    expect(result).toEqual({
      state: 'AUTH_REQUIRED',
      httpRequestCount: 0,
      writeActionReached: false,
    });
    expect(requests).toEqual([]);
    expect(await storage.listBindings(principal.id)).toEqual([]);
  });
});
