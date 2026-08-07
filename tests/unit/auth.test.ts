import { describe, it, expect, vi } from 'vitest';
import { DatabaseStore } from '../../packages/db/src/index.js';
import {
  encryptToken,
  decryptToken,
  OAuthStateStore,
  TokenBroker,
  OAuthService,
} from '../../packages/auth/src/index.js';
import { HttpClient, BangumiError } from '../../packages/bangumi-transport/src/index.js';

describe('Phase 5: DB, OAuth & Token Security Tests', () => {
  const SECRET_KEY = 'super-secret-key-for-aes-encryption';

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

  it('OAuthStateStore generates hashed state and enforces single-use', () => {
    const db = new DatabaseStore();
    const stateStore = new OAuthStateStore(db);

    const { state, session } = stateStore.generateState('user_qq_100', ['write:collection']);
    expect(state).toBeDefined();
    expect(session.stateHash).not.toBe(state);

    // Consume state 1st time -> OK
    const consumed = stateStore.consumeState(state);
    expect(consumed.principalId).toBe('user_qq_100');

    // Consume state 2nd time -> ERROR (single-use)
    expect(() => stateStore.consumeState(state)).toThrow('already been used');
  });

  it('TokenBroker enforces account binding and checks required scopes', async () => {
    const db = new DatabaseStore();
    const broker = new TokenBroker(db, SECRET_KEY);

    // Unbound user -> AUTH_REQUIRED
    await expect(broker.requireAccount('user_unbound')).rejects.toThrow(BangumiError);

    // Bind User A
    const principal = db.findOrCreatePrincipal('qq-official', 'bot_1', 'qq_user_a');
    const account = {
      id: 'acc_bangumi_a',
      bangumiUserId: 1234,
      username: 'user_a',
      nickname: 'User A',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.bangumiAccounts.set(account.id, account);
    db.accountBindings.set('bnd_1', {
      id: 'bnd_1',
      principalId: principal.id,
      bangumiAccountId: account.id,
      isActive: true,
      createdAt: new Date(),
    });

    const encryptedToken = encryptToken('secret_access_token_a', SECRET_KEY);
    db.accessCredentials.set(account.id, {
      id: 'crd_1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptedToken,
      expiresAt: new Date(Date.now() + 3600000),
      scopes: ['write:collection'],
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Bound User A requireAccount -> OK
    const reqAcc = await broker.requireAccount(principal.id);
    expect(reqAcc.username).toBe('user_a');

    // Get valid token -> OK
    const token = await broker.getValidAccessToken(account.id, ['write:collection']);
    expect(token).toBe('secret_access_token_a');

    // Missing scope -> PERMISSION_DENIED
    await expect(broker.getValidAccessToken(account.id, ['write:indices'])).rejects.toThrow(
      BangumiError
    );
  });

  it('TokenBroker disconnect deactivates binding and removes credentials', async () => {
    const db = new DatabaseStore();
    const broker = new TokenBroker(db, SECRET_KEY);

    const principal = db.findOrCreatePrincipal('qq-official', 'bot_1', 'qq_user_b');
    db.accountBindings.set('bnd_2', {
      id: 'bnd_2',
      principalId: principal.id,
      bangumiAccountId: 'acc_b',
      isActive: true,
      createdAt: new Date(),
    });

    await broker.disconnect(principal.id);
    await expect(broker.requireAccount(principal.id)).rejects.toThrow(BangumiError);
  });

  it('OAuthService handles callback flow and links Bangumi account', async () => {
    const db = new DatabaseStore();
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
            { status: 200 }
          )
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
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    vi.stubGlobal('fetch', mockFetch);

    const oauthService = new OAuthService(
      db,
      {
        clientId: 'bgm_client_123',
        clientSecret: 'bgm_secret_abc',
        redirectUri: 'https://example.com/oauth/callback',
        secretKey: SECRET_KEY,
      },
      httpClient
    );

    const { state } = oauthService.createAuthorizationUrl('qq_principal_1');
    expect(state).toBeDefined();

    const authorized = await oauthService.handleCallback('valid_oauth_code', state);
    expect(authorized.username).toBe('bgm_test_user');
    expect(authorized.principalId).toBe('qq_principal_1');

    // Verify token was stored encrypted in DB
    const cred = db.getCredentialByAccountId(authorized.accountId);
    expect(cred).toBeDefined();
    expect(JSON.stringify(cred)).not.toContain('bgm_oauth_token_999');
  });
});
