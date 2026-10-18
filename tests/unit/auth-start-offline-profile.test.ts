import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  AUTH_START_EXPECTED_ARGUMENTS,
  AUTH_START_SYNTHETIC_CALLBACK,
  AUTH_START_SYNTHETIC_CLIENT_ID,
  AUTH_START_SYNTHETIC_CLIENT_SECRET,
  AUTH_START_SYNTHETIC_PRINCIPAL,
  AUTH_START_TOOL_NAME,
} from '../../scripts/lib/auth-start-offline-agent-mcp-profile.mjs';

describe('offline synthetic auth_start profile', () => {
  it('creates one temporary OAuth state and URL without provider HTTP, account, credential, or binding writes', async () => {
    const storage = new MemoryStorage();
    const createOAuthSession = vi.spyOn(storage, 'createOAuthSession');
    const upsertBangumiAccount = vi.spyOn(storage, 'upsertBangumiAccount');
    const upsertCredential = vi.spyOn(storage, 'upsertCredential');
    const replaceActiveBinding = vi.spyOn(storage, 'replaceActiveBinding');
    const fetchFn = vi.fn(async () => {
      throw new Error('Offline auth_start fixture must reject HTTP.');
    });
    const dependencies = createRuntimeDependenciesWithStorage(storage, {
      clientId: AUTH_START_SYNTHETIC_CLIENT_ID,
      clientSecret: AUTH_START_SYNTHETIC_CLIENT_SECRET,
      redirectUri: AUTH_START_SYNTHETIC_CALLBACK,
      authorizeUrl: 'https://oauth.invalid/authorize',
      secretKey: 'run95-auth-start-local-test-key-only-0123456789',
      publicHttpClient: new HttpClient({
        baseUrl: 'https://api.bgm.tv',
        fetchFn,
      }),
    });
    const registry = new ToolRegistry(dependencies, { profile: 'full' });

    try {
      const result = (await registry.executeTool(
        AUTH_START_TOOL_NAME,
        AUTH_START_EXPECTED_ARGUMENTS,
        {
          principalId: AUTH_START_SYNTHETIC_PRINCIPAL,
          botInstanceId: 'run95-auth-start-synthetic-bot',
          conversationId: 'run95-auth-start-synthetic-conversation',
        },
      )) as { authorizationUrl: string; expiresAt: string };
      const authorization = new URL(result.authorizationUrl);

      expect(authorization.origin).toBe('https://oauth.invalid');
      expect(authorization.pathname).toBe('/authorize');
      expect(authorization.searchParams.get('client_id')).toBe(AUTH_START_SYNTHETIC_CLIENT_ID);
      expect(authorization.searchParams.get('redirect_uri')).toBe(AUTH_START_SYNTHETIC_CALLBACK);
      expect(authorization.searchParams.get('response_type')).toBe('code');
      expect(authorization.searchParams.get('state')).toMatch(/^[0-9a-f]{48}$/u);
      expect(authorization.searchParams.has('scope')).toBe(false);
      expect(new Set([...authorization.searchParams.keys()])).toEqual(
        new Set(['client_id', 'redirect_uri', 'response_type', 'state']),
      );
      expect(createOAuthSession).toHaveBeenCalledTimes(1);
      expect(createOAuthSession.mock.calls[0]?.[0].requestedCapabilities).toEqual([
        'read:collection',
      ]);
      expect(upsertBangumiAccount).not.toHaveBeenCalled();
      expect(upsertCredential).not.toHaveBeenCalled();
      expect(replaceActiveBinding).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      await registry.close();
      await storage.close();
    }
  });
});
