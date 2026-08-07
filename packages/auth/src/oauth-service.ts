import { Storage, BangumiAccountRecord } from '@bangumi-agent-kit/db';
import { OAuthStateStore } from './state-store.js';
import {
  encryptToken,
  TokenEncryptionConfig,
  resolveTokenEncryptionConfig,
} from './token-crypto.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { BangumiOAuthClient } from './oauth-client.js';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryption?: TokenEncryptionConfig;
  secretKey?: string;
  keyVersion?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
}

export interface AuthorizedAccount {
  accountId: string;
  username: string;
  nickname: string;
  principalId: string;
}

export class OAuthService {
  private stateStore: OAuthStateStore;
  private oauthClient: BangumiOAuthClient;
  private tokenEncryption: TokenEncryptionConfig;

  constructor(
    private storage: Storage,
    private config: OAuthConfig,
    private httpClient: HttpClient,
    oauthClient?: BangumiOAuthClient
  ) {
    this.stateStore = new OAuthStateStore(storage);
    this.oauthClient = oauthClient || new BangumiOAuthClient();
    this.tokenEncryption = resolveTokenEncryptionConfig({
      tokenEncryption: config.tokenEncryption,
      secretKey: config.secretKey,
      keyVersion: config.keyVersion,
    });
  }

  async createAuthorizationUrl(
    principalId: string,
    botInstanceId?: string,
    conversationId?: string,
    requestedCapabilities: string[] = ['write:collection']
  ): Promise<{ url: string; state: string; expiresAt: Date }> {
    const { state, session } = await this.stateStore.generateState({
      principalId,
      botInstanceId,
      conversationId,
      requestedCapabilities,
    });
    const authUrl = this.config.authorizeUrl || 'https://bgm.tv/oauth/authorize';

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      state,
    });

    return {
      url: `${authUrl}?${params.toString()}`,
      state,
      expiresAt: session.expiresAt,
    };
  }

  async handleCallback(code: string, state: string): Promise<AuthorizedAccount> {
    // 1. Consume state safely & atomically
    const session = await this.stateStore.consumeState(state);

    // 2. Exchange code for access_token
    const tokenData = await this.oauthClient.exchangeAuthorizationCode(
      code,
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
      this.config.tokenUrl
    );

    // 3. Verify user identity via /v0/me
    const meData = await this.httpClient.request<any>({
      method: 'GET',
      path: '/v0/me',
      accessToken: tokenData.access_token,
    });

    const accountId = `acc_${meData.id}`;
    const now = new Date();

    // 4. Upsert Bangumi Account Record
    const accountRecord: BangumiAccountRecord = await this.storage.upsertBangumiAccount({
      id: accountId,
      bangumiUserId: meData.id,
      username: meData.username || String(meData.id),
      nickname: meData.nickname || meData.username || String(meData.id),
      avatarUrl: meData.avatar?.medium || meData.avatar?.large,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Encrypt Tokens and save AccessCredentialRecord
    const { keyring, activeKeyVersion } = this.tokenEncryption;
    const encryptedAccess = encryptToken(tokenData.access_token, keyring, activeKeyVersion);
    const encryptedRefresh = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token, keyring, activeKeyVersion)
      : undefined;

    const expiresAt = new Date(now.getTime() + (tokenData.expires_in || 7 * 86400) * 1000);
    const reportedScopes = tokenData.scope ? tokenData.scope.split(' ') : null;

    const credRecord = {
      id: `crd_${accountId}`,
      bangumiAccountId: accountId,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      expiresAt,
      requestedCapabilities: session.requestedCapabilities,
      reportedScopes,
      scopeEvidence: (tokenData.scope ? 'reported' : 'unknown') as 'reported' | 'unknown',
      keyVersion: activeKeyVersion,
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.upsertCredential(credRecord);

    // 6. Bind Principal to Account
    await this.storage.replaceActiveBinding(session.principalId, accountId);

    return {
      accountId,
      username: accountRecord.username,
      nickname: accountRecord.nickname,
      principalId: session.principalId,
    };
  }
}
