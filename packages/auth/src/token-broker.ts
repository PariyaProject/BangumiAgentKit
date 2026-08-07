import { Storage, BangumiAccountRecord } from '@bangumi-agent-kit/db';
import { decryptToken, encryptToken } from './token-crypto.js';
import { HttpClient, BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiOAuthClient } from './oauth-client.js';
import { BangumiClientProvider } from './client-provider.js';

export interface TokenBrokerConfig {
  secretKey: string;
  keyVersion?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenUrl?: string;
  refreshSkewSeconds?: number;
}

export interface AuthStatusResult {
  bound: boolean;
  account?: {
    username: string;
    nickname: string;
    avatarUrl?: string;
  };
  credential?: {
    expiresAt: string;
    refreshable: boolean;
  };
}

export class TokenBroker implements BangumiClientProvider {
  private oauthClient: BangumiOAuthClient;

  constructor(
    private storage: Storage,
    private config: TokenBrokerConfig,
    private publicHttpClient: HttpClient = new HttpClient(),
    oauthClient?: BangumiOAuthClient
  ) {
    this.oauthClient = oauthClient || new BangumiOAuthClient();
  }

  async requireAccount(principalId: string): Promise<BangumiAccountRecord> {
    const binding = await this.storage.getActiveBinding(principalId);
    if (!binding) {
      throw new BangumiError(
        'AUTH_REQUIRED',
        '该操作需要先绑定 Bangumi 账号',
        false,
        401,
        '调用 bangumi.auth_start'
      );
    }

    const account = await this.storage.getBangumiAccount(binding.bangumiAccountId);
    if (!account) {
      throw new BangumiError(
        'AUTH_REQUIRED',
        '找不到关联的 Bangumi 账号资料，请重新绑定',
        false,
        401,
        '调用 bangumi.auth_start'
      );
    }

    return account;
  }

  async getAuthStatus(principalId: string): Promise<AuthStatusResult> {
    const binding = await this.storage.getActiveBinding(principalId);
    if (!binding) {
      return { bound: false };
    }

    const account = await this.storage.getBangumiAccount(binding.bangumiAccountId);
    if (!account) {
      return { bound: false };
    }

    const cred = await this.storage.getCredential(account.id);
    if (!cred) {
      return { bound: false };
    }

    return {
      bound: true,
      account: {
        username: account.username,
        nickname: account.nickname,
        avatarUrl: account.avatarUrl,
      },
      credential: {
        expiresAt: cred.expiresAt.toISOString(),
        refreshable: Boolean(cred.encryptedRefreshToken),
      },
    };
  }

  async disconnect(principalId: string): Promise<void> {
    const binding = await this.storage.getActiveBinding(principalId);
    if (binding) {
      await this.storage.deactivateBindings(principalId);
      await this.storage.deleteCredential(binding.bangumiAccountId);
    }
  }

  async getPublicClient(): Promise<GeneratedBangumiOpenApiClient> {
    return new GeneratedBangumiOpenApiClient(this.publicHttpClient);
  }

  async getOptionalAuthenticatedClient(principalId?: string): Promise<GeneratedBangumiOpenApiClient> {
    if (!principalId) {
      return this.getPublicClient();
    }

    try {
      const { client } = await this.requireAuthenticatedClient(principalId);
      return client;
    } catch (err: any) {
      if (err?.code === 'AUTH_REQUIRED' || ((err as any)?.code === 'AUTH_REQUIRED')) {
        return this.getPublicClient();
      }
      throw err;
    }
  }

  async requireAuthenticatedClient(
    principalId: string,
    _requiredCapabilities: string[] = []
  ): Promise<{ account: BangumiAccountRecord; client: GeneratedBangumiOpenApiClient }> {
    const account = await this.requireAccount(principalId);
    const cred = await this.storage.getCredential(account.id);

    if (!cred) {
      throw new BangumiError(
        'AUTH_REQUIRED',
        '未查找到有效授权凭证，请重新绑定',
        false,
        401,
        '调用 bangumi.auth_start'
      );
    }

    const accessToken = await this.resolveAndRefreshToken(cred, account.id);
    const boundHttpClient = this.createBoundHttpClient(accessToken);
    const client = new GeneratedBangumiOpenApiClient(boundHttpClient);

    return { account, client };
  }

  private async resolveAndRefreshToken(cred: any, accountId: string): Promise<string> {
    const now = new Date();
    const skewSeconds = this.config.refreshSkewSeconds ?? Number(process.env.BANGUMI_TOKEN_REFRESH_SKEW_SECONDS || 300);
    const skewMs = skewSeconds * 1000;

    if (now.getTime() + skewMs < cred.expiresAt.getTime()) {
      return decryptToken(cred.encryptedAccessToken, this.config.secretKey);
    }

    return await this.storage.withCredentialLock(accountId, async () => {
      const latestCred = await this.storage.getCredential(accountId);
      if (!latestCred) {
        throw new BangumiError('AUTH_EXPIRED', '授权凭证已被删除', false, 401, '调用 bangumi.auth_start');
      }

      const lockNow = new Date();
      if (lockNow.getTime() + skewMs < latestCred.expiresAt.getTime()) {
        return decryptToken(latestCred.encryptedAccessToken, this.config.secretKey);
      }

      if (!latestCred.encryptedRefreshToken) {
        throw new BangumiError(
          'AUTH_EXPIRED',
          '授权凭证已过期且无法自动刷新，请重新绑定',
          false,
          401,
          '调用 bangumi.auth_start'
        );
      }

      let oldRefreshToken: string;
      try {
        oldRefreshToken = decryptToken(latestCred.encryptedRefreshToken, this.config.secretKey);
      } catch {
        throw new BangumiError(
          'AUTH_EXPIRED',
          '无法解密 Refresh Token，请重新绑定',
          false,
          401,
          '调用 bangumi.auth_start'
        );
      }

      if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri) {
        throw new BangumiError(
          'AUTH_EXPIRED',
          '服务未配置 OAuth Client ID / Secret，无法进行 Token 自动刷新',
          false,
          500
        );
      }

      let refreshedData;
      try {
        refreshedData = await this.oauthClient.refreshToken(
          oldRefreshToken,
          this.config.clientId,
          this.config.clientSecret,
          this.config.redirectUri,
          this.config.tokenUrl
        );
      } catch (err: unknown) {
        if (err instanceof BangumiError) {
          throw err;
        }
        throw new BangumiError(
          'AUTH_EXPIRED',
          'Bangumi 授权刷新失败，请重新绑定账号',
          false,
          401,
          '调用 bangumi.auth_start'
        );
      }

      const keyVersion = this.config.keyVersion || latestCred.keyVersion || 'v1';
      const newEncryptedAccess = encryptToken(refreshedData.access_token, this.config.secretKey, keyVersion);
      const newEncryptedRefresh = refreshedData.refresh_token
        ? encryptToken(refreshedData.refresh_token, this.config.secretKey, keyVersion)
        : latestCred.encryptedRefreshToken;

      const newExpiresAt = new Date(lockNow.getTime() + (refreshedData.expires_in || 7 * 86400) * 1000);

      const updatedRecord = {
        ...latestCred,
        encryptedAccessToken: newEncryptedAccess,
        encryptedRefreshToken: newEncryptedRefresh,
        expiresAt: newExpiresAt,
        updatedAt: lockNow,
      };

      await this.storage.upsertCredential(updatedRecord);
      return refreshedData.access_token;
    });
  }

  private createBoundHttpClient(accessToken: string): HttpClient {
    const transport = this.publicHttpClient;
    return new Proxy(transport, {
      get(target, prop, receiver) {
        if (prop === 'request') {
          return async (options: any) => {
            return await target.request({
              ...options,
              accessToken: options.accessToken || accessToken,
            });
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}
