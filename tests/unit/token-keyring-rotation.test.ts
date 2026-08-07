import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import {
  TokenBroker,
  OAuthService,
  TokenKeyring,
  encryptToken,
  decryptToken,
  resolveTokenEncryptionConfig,
  BangumiOAuthClient,
} from '@bangumi-agent-kit/auth';
import { HttpClient, BangumiError } from '@bangumi-agent-kit/bangumi-transport';

describe('TokenKeyring Rotation Tests', () => {
  const KEY_V1 = 'old_secret_key_v1_1234567890';
  const KEY_V2 = 'new_secret_key_v2_1234567890';

  it('A. v1 credential readable while active key = v2', async () => {
    const storage = new MemoryStorage();
    const keyring = new TokenKeyring({
      v1: KEY_V1,
      v2: KEY_V2,
    });
    const tokenEncryption = { keyring, activeKeyVersion: 'v2' };

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'user-a',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'acc_a',
      bangumiUserId: 1001,
      username: 'user_a',
      nickname: 'User A',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Encrypted using old v1 key
    const encryptedAccess = encryptToken('access-token-v1-secret', keyring, 'v1');
    const encryptedRefresh = encryptToken('refresh-token-v1-secret', keyring, 'v1');

    await storage.upsertCredential({
      id: 'crd_acc_a',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockHttpClient = new HttpClient();
    vi.spyOn(mockHttpClient, 'request').mockResolvedValue({ id: 1001, username: 'user_a' } as any);

    const broker = new TokenBroker(
      storage,
      { tokenEncryption },
      mockHttpClient
    );

    const result = await broker.requireAuthenticatedClient(principal.id, ['read']);
    expect(result.account.id).toBe('acc_a');
    await result.client.getSubjectById({ subjectId: 1 });
    expect(mockHttpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-token-v1-secret',
      })
    );
  });

  it('B. v2 new credential created on OAuth bind', async () => {
    const storage = new MemoryStorage();
    const keyring = new TokenKeyring({
      v1: KEY_V1,
      v2: KEY_V2,
    });
    const tokenEncryption = { keyring, activeKeyVersion: 'v2' };

    const mockHttpClient = new HttpClient();
    vi.spyOn(mockHttpClient, 'request').mockResolvedValue({
      id: 2002,
      username: 'user_b',
      nickname: 'User B',
    } as any);

    const mockOAuthClient = new BangumiOAuthClient();
    vi.spyOn(mockOAuthClient, 'exchangeAuthorizationCode').mockResolvedValue({
      access_token: 'new-access-token-v2',
      refresh_token: 'new-refresh-token-v2',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read write',
    });

    const oauthService = new OAuthService(
      storage,
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
        tokenEncryption,
      },
      mockHttpClient,
      mockOAuthClient
    );

    const authUrl = await oauthService.createAuthorizationUrl('principal-b');
    const authResult = await oauthService.handleCallback('mock-code', authUrl.state);

    expect(authResult.accountId).toBe('acc_2002');

    const cred = await storage.getCredential('acc_2002');
    expect(cred).not.toBeNull();
    expect(cred!.keyVersion).toBe('v2');
    expect(cred!.encryptedAccessToken.keyVersion).toBe('v2');
    expect(cred!.encryptedRefreshToken?.keyVersion).toBe('v2');

    // Verify it decrypts with v2 key
    const decryptedAccess = decryptToken(cred!.encryptedAccessToken, keyring);
    expect(decryptedAccess).toBe('new-access-token-v2');
  });

  it('C. Lazy rotation on refresh from v1 to v2', async () => {
    const storage = new MemoryStorage();
    const keyring = new TokenKeyring({
      v1: KEY_V1,
      v2: KEY_V2,
    });
    const tokenEncryption = { keyring, activeKeyVersion: 'v2' };

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'user-c',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'acc_c',
      bangumiUserId: 3003,
      username: 'user_c',
      nickname: 'User C',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Expired v1 credential
    const oldEncryptedAccess = encryptToken('expired-v1-access', keyring, 'v1');
    const oldEncryptedRefresh = encryptToken('valid-v1-refresh', keyring, 'v1');

    await storage.upsertCredential({
      id: 'crd_acc_c',
      bangumiAccountId: account.id,
      encryptedAccessToken: oldEncryptedAccess,
      encryptedRefreshToken: oldEncryptedRefresh,
      expiresAt: new Date(Date.now() - 1000), // Expired
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockOAuthClient = new BangumiOAuthClient();
    vi.spyOn(mockOAuthClient, 'refreshToken').mockResolvedValue({
      access_token: 'refreshed-v2-access',
      refresh_token: 'refreshed-v2-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read',
    });

    const mockHttpClient = new HttpClient();
    vi.spyOn(mockHttpClient, 'request').mockResolvedValue({ id: 3003, username: 'user_c' } as any);

    const broker = new TokenBroker(
      storage,
      {
        tokenEncryption,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
      },
      mockHttpClient,
      mockOAuthClient
    );

    await broker.requireAuthenticatedClient(principal.id, ['read']);

    expect(mockOAuthClient.refreshToken).toHaveBeenCalledWith(
      'valid-v1-refresh',
      'client-id',
      'client-secret',
      'http://localhost/callback',
      undefined
    );

    const updatedCred = await storage.getCredential(account.id);
    expect(updatedCred).not.toBeNull();
    expect(updatedCred!.keyVersion).toBe('v2');
    expect(updatedCred!.encryptedAccessToken.keyVersion).toBe('v2');
    expect(updatedCred!.encryptedRefreshToken?.keyVersion).toBe('v2');

    expect(decryptToken(updatedCred!.encryptedAccessToken, keyring)).toBe('refreshed-v2-access');
    expect(decryptToken(updatedCred!.encryptedRefreshToken!, keyring)).toBe('refreshed-v2-refresh');
  });

  it('D. Unknown key version fails with KEY_VERSION_UNAVAILABLE without fallback', async () => {
    const storage = new MemoryStorage();
    const keyring = new TokenKeyring({
      v1: KEY_V1,
      v2: KEY_V2,
    });
    const tokenEncryption = { keyring, activeKeyVersion: 'v2' };

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'user-d',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'acc_d',
      bangumiUserId: 4004,
      username: 'user_d',
      nickname: 'User D',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Unknown version v99
    const unknownEncryptedAccess = {
      ciphertext: 'abcd',
      iv: '123456789012345678901234',
      authTag: '1234567890123456',
      keyVersion: 'v99',
    };

    await storage.upsertCredential({
      id: 'crd_acc_d',
      bangumiAccountId: account.id,
      encryptedAccessToken: unknownEncryptedAccess,
      encryptedRefreshToken: unknownEncryptedAccess,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v99',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const broker = new TokenBroker(
      storage,
      { tokenEncryption },
      new HttpClient()
    );

    let thrownError: any = null;
    try {
      await broker.requireAuthenticatedClient(principal.id, ['read']);
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(BangumiError);
    expect(thrownError.code).toBe('KEY_VERSION_UNAVAILABLE');
    expect(thrownError.message).toContain('v99');
  });

  it('E. Legacy single-key environment configuration compatibility', () => {
    const config = resolveTokenEncryptionConfig(
      {},
      {
        BANGUMI_TOKEN_ENCRYPTION_KEY: KEY_V1,
      }
    );

    expect(config.activeKeyVersion).toBe('v1');
    expect(config.keyring.resolve('v1')).toBe(KEY_V1);

    const encrypted = encryptToken('hello-legacy', config.keyring, config.activeKeyVersion);
    expect(encrypted.keyVersion).toBe('v1');
    expect(decryptToken(encrypted, config.keyring)).toBe('hello-legacy');
  });

  it('F. Multi-key JSON environment configuration', () => {
    const config = resolveTokenEncryptionConfig(
      {},
      {
        BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON: JSON.stringify({
          v1: KEY_V1,
          v2: KEY_V2,
        }),
        BANGUMI_TOKEN_ACTIVE_KEY_VERSION: 'v2',
      }
    );

    expect(config.activeKeyVersion).toBe('v2');
    expect(config.keyring.resolve('v1')).toBe(KEY_V1);
    expect(config.keyring.resolve('v2')).toBe(KEY_V2);

    const encrypted = encryptToken('hello-multi', config.keyring, config.activeKeyVersion);
    expect(encrypted.keyVersion).toBe('v2');
    expect(decryptToken(encrypted, config.keyring)).toBe('hello-multi');
  });

  it('G. Fail-fast if active key version is missing in keyring', () => {
    expect(() => {
      resolveTokenEncryptionConfig(
        {},
        {
          BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON: JSON.stringify({
            v1: KEY_V1,
          }),
          BANGUMI_TOKEN_ACTIVE_KEY_VERSION: 'v2', // v2 does not exist
        }
      );
    }).toThrow(BangumiError);
  });
});
