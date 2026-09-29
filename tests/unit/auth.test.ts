import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import {
  encryptToken,
  decryptToken,
  OAuthStateStore,
  TokenBroker,
  OAuthService,
} from '@bangumi-agent-kit/auth';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

describe('Phase 5: DB, OAuth & Token Security Tests', () => {
  const SECRET_KEY = 'super-secret-key-for-aes-encryption-test';

  it('encrypts and decrypts tokens with AES-256-GCM without exposing plaintext', () => {
    const rawToken = 'bgm_access_token_1234567890';
    const encrypted = encryptToken(rawToken, SECRET_KEY);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toContain(rawToken);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = decryptToken(encrypted, SECRET_KEY);
    expect(decrypted).toBe(rawToken);
  });

  it('OAuthStateStore generates hashed state and enforces single-use', async () => {
    const storage = new MemoryStorage();
    const stateStore = new OAuthStateStore(storage);

    const { state, session } = await stateStore.generateState({
      principalId: 'user_qq_100',
      requestedCapabilities: ['write:collection'],
    });
    expect(state).toBeDefined();
    expect(session.stateHash).not.toBe(state);

    // Consume state 1st time -> OK
    const consumed = await stateStore.consumeState(state);
    expect(consumed.principalId).toBe('user_qq_100');

    // Consume state 2nd time -> ERROR (single-use)
    await expect(stateStore.consumeState(state)).rejects.toThrow('already been used');
  });

  it('TokenBroker enforces account binding and checks credentials', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey: SECRET_KEY });

    // Unbound user -> AUTH_REQUIRED
    await expect(broker.requireAccount('user_unbound')).rejects.toThrow('AUTH_REQUIRED');

    // Bind User A
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'qq_user_a',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc_bangumi_a',
      bangumiUserId: 1234,
      username: 'user_a',
      nickname: 'User A',
    });
    await storage.replaceActiveBinding(principal.id, account.id);

    const encryptedToken = encryptToken('secret_access_token_a', SECRET_KEY);
    await storage.upsertCredential({
      id: 'crd_1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptedToken,
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Bound User A requireAccount -> OK
    const reqAcc = await broker.requireAccount(principal.id);
    expect(reqAcc.username).toBe('user_a');

    // requireAuthenticatedClient -> returns client & account
    const authed = await broker.requireAuthenticatedClient(principal.id);
    expect(authed.account.username).toBe('user_a');
    expect(authed.client).toBeDefined();
  });

  it('optional auth falls back to the public client when identity or binding is absent', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey: SECRET_KEY });
    const publicClient = vi.spyOn(broker, 'getPublicClient');

    const anonymousClient = await broker.getOptionalAuthenticatedClient();
    const unboundClient = await broker.getOptionalAuthenticatedClient('user_unbound');

    expect(anonymousClient).toBeDefined();
    expect(unboundClient).toBeDefined();
    expect(publicClient).toHaveBeenCalledTimes(2);
  });

  it('optional auth preserves expired-credential errors instead of silently downgrading', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey: SECRET_KEY });
    const publicClient = vi.spyOn(broker, 'getPublicClient');
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'qq_user_expired',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc_expired',
      bangumiUserId: 5678,
      username: 'expired_user',
      nickname: 'Expired User',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'cred_expired',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('expired_access_token', SECRET_KEY),
      expiresAt: new Date(Date.now() - 60_000),
      requestedCapabilities: [],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(broker.getOptionalAuthenticatedClient(principal.id)).rejects.toMatchObject({
      code: 'AUTH_EXPIRED',
    });
    expect(publicClient).not.toHaveBeenCalled();
  });

  it('does not create OAuth state or return a placeholder authorize URL without app credentials', async () => {
    vi.stubEnv('BANGUMI_OAUTH_CLIENT_ID', '');
    vi.stubEnv('BANGUMI_OAUTH_CLIENT_SECRET', '');
    try {
      const storage = new MemoryStorage();
      const createOAuthSession = vi.spyOn(storage, 'createOAuthSession');
      const dependencies = createRuntimeDependenciesWithStorage(storage, {
        secretKey: SECRET_KEY,
        redirectUri: 'http://127.0.0.1:3000/oauth/bangumi/callback',
      });
      const registry = new ToolRegistry(dependencies);
      const context = {
        principalId: 'principal-no-oauth-app',
        botInstanceId: 'fixture-bot',
        conversationId: 'fixture-conversation',
      };

      await expect(registry.executeTool('bangumi.auth_status', {}, context)).resolves.toEqual({
        bound: false,
        accountCount: 0,
      });
      await expect(registry.executeTool('bangumi.auth_start', {}, context)).rejects.toMatchObject({
        code: 'OAUTH_NOT_CONFIGURED',
      });
      expect(createOAuthSession).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not consume a pending OAuth state or exchange a code when app credentials are missing', async () => {
    const storage = new MemoryStorage();
    const stateStore = new OAuthStateStore(storage);
    const { state } = await stateStore.generateState({ principalId: 'principal-no-oauth-app' });
    const consumeOAuthSession = vi.spyOn(storage, 'consumeOAuthSession');
    const exchangeAuthorizationCode = vi.fn(async () => ({ access_token: 'should-not-be-used' }));
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 1, username: 'should-not-be-used' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const oauthService = new OAuthService(
      storage,
      {
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://127.0.0.1:3000/oauth/bangumi/callback',
        secretKey: SECRET_KEY,
      },
      new HttpClient({ fetchFn }),
      { exchangeAuthorizationCode } as any,
    );

    await expect(oauthService.handleCallback('fixture-code', state)).rejects.toMatchObject({
      code: 'OAUTH_NOT_CONFIGURED',
    });
    expect(consumeOAuthSession).not.toHaveBeenCalled();
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('TokenBroker disconnect deactivates binding and removes credentials', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey: SECRET_KEY });

    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'qq_user_b',
    });
    await storage.replaceActiveBinding(principal.id, 'acc_b');

    await broker.disconnect(principal.id);
    await expect(broker.requireAccount(principal.id)).rejects.toThrow('AUTH_REQUIRED');
  });

  it('production public and unbound paths start without OAuth credentials', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BANGUMI_OAUTH_CLIENT_ID', '');
    vi.stubEnv('BANGUMI_OAUTH_CLIENT_SECRET', '');
    vi.stubEnv('BANGUMI_OAUTH_REDIRECT_URI', '');
    try {
      const storage = new MemoryStorage();
      const dependencies = createRuntimeDependenciesWithStorage(storage, {
        secretKey: SECRET_KEY,
        publicHttpClient: new HttpClient(),
        artifactStore: {} as any,
        renderService: {} as any,
      });
      const principal = await storage.findOrCreatePrincipal({
        provider: 'qq',
        botInstanceId: 'pariya-test-bot',
        externalUserId: 'unbound-user',
      });

      expect(await dependencies.tokenBroker.getAuthStatus(principal.id)).toEqual({
        bound: false,
        accountCount: 0,
      });
      const startError = await dependencies.oauthService
        .createAuthorizationUrl(principal.id)
        .catch((error: unknown) => error);
      expect(startError).toMatchObject({ code: 'OAUTH_NOT_CONFIGURED' });
      expect(toPublicError(startError)).toMatchObject({
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Bangumi 账号授权暂不可用，服务尚未配置 OAuth 应用。',
        nextAction: '请由服务管理员配置 Bangumi OAuth 客户端 ID、密钥和回调地址后重试。',
      });
      await expect(dependencies.oauthService.handleCallback('code', 'state')).rejects.toMatchObject(
        {
          code: 'OAUTH_NOT_CONFIGURED',
        },
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('expired bound credentials fail locally when OAuth refresh is not configured', async () => {
    const storage = new MemoryStorage();
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'pariya-test-bot',
      externalUserId: 'bound-user',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc_bound_no_oauth',
      bangumiUserId: 1234,
      username: 'bound-user',
      nickname: 'Bound User',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'crd_bound_no_oauth',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('expired-access-token', SECRET_KEY),
      encryptedRefreshToken: encryptToken('refresh-token', SECRET_KEY),
      expiresAt: new Date(Date.now() - 60_000),
      requestedCapabilities: [],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      const broker = new TokenBroker(storage, {
        secretKey: SECRET_KEY,
        clientId: ' ',
        clientSecret: '\t',
        redirectUri: '  ',
      });
      await expect(broker.requireAuthenticatedClient(principal.id)).rejects.toMatchObject({
        code: 'OAUTH_NOT_CONFIGURED',
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('OAuthService handles callback flow and links Bangumi account', async () => {
    const storage = new MemoryStorage();
    const httpClient = new HttpClient();

    // Mock fetch for token exchange and /v0/me
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/oauth/access_token')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'bgm_oauth_token_999',
              expires_in: 604800,
              user_id: 8888,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/v0/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 8888,
              username: 'bgm_test_user',
              nickname: 'Bangumi Tester',
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    vi.stubGlobal('fetch', mockFetch);

    const oauthService = new OAuthService(
      storage,
      {
        clientId: 'bgm_client_123',
        clientSecret: 'bgm_secret_abc',
        redirectUri: 'https://example.com/oauth/callback',
        secretKey: SECRET_KEY,
      },
      httpClient,
    );

    const { state } = await oauthService.createAuthorizationUrl('qq_principal_1');
    expect(state).toBeDefined();

    const authorized = await oauthService.handleCallback('valid_oauth_code', state);
    expect(authorized.username).toBe('bgm_test_user');
    expect(authorized.principalId).toBe('qq_principal_1');

    // Verify token was stored encrypted in Storage
    const cred = await storage.getCredential(authorized.accountId);
    expect(cred).toBeDefined();
    expect(JSON.stringify(cred)).not.toContain('bgm_oauth_token_999');

    // Regression check: requestedCapabilities != reportedScopes
    expect(cred?.reportedScopes).toBeNull();
    expect(cred?.scopeEvidence).toBe('unknown');
    expect(cred?.requestedCapabilities).toEqual(['write:collection']);
  });

  it('OAuth callback handler suppresses raw internal errors and returns safe generic message', async () => {
    const { handleOAuthCallbackRoute } = await import('../../apps/api/src/routes/oauth.js');
    const mockOAuthService = {
      handleCallback: vi
        .fn()
        .mockRejectedValue(new Error('relation access_credentials does not exist')),
    } as any;

    const handler = handleOAuthCallbackRoute(mockOAuthService);
    const res = await handler('code_123', 'state_123');

    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('access_credentials');
    expect(res.body).toContain('内部服务发生错误');
  });
});
