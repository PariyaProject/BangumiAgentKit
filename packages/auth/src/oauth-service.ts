import { DatabaseStore } from '@bangumi-agent-kit/db';
import { OAuthStateStore } from './state-store.js';
import { encryptToken } from './token-crypto.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  secretKey: string;
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

  constructor(
    private db: DatabaseStore,
    private config: OAuthConfig,
    private httpClient: HttpClient
  ) {
    this.stateStore = new OAuthStateStore(db);
  }

  createAuthorizationUrl(principalId: string, scopes: string[] = ['write:collection']): { url: string; state: string } {
    const { state } = this.stateStore.generateState(principalId, scopes);
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
    };
  }

  async handleCallback(code: string, state: string): Promise<AuthorizedAccount> {
    // 1. Consume state safely
    const session = this.stateStore.consumeState(state);

    // 2. Exchange code for access_token
    const tokenUrl = this.config.tokenUrl || 'https://bgm.tv/oauth/access_token';
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`OAuth token exchange failed [${tokenRes.status}]: ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number;
    };

    // 3. Verify user identity via /v0/me
    const meData = await this.httpClient.request<any>({
      method: 'GET',
      path: '/v0/me',
      accessToken: tokenData.access_token,
    });

    const accountId = `acc_${meData.id}`;
    const now = new Date();

    // 4. Save Bangumi Account Record
    const accountRecord = {
      id: accountId,
      bangumiUserId: meData.id,
      username: meData.username || String(meData.id),
      nickname: meData.nickname || meData.username || String(meData.id),
      avatarUrl: meData.avatar?.medium || meData.avatar?.large,
      createdAt: now,
      updatedAt: now,
    };
    this.db.bangumiAccounts.set(accountId, accountRecord);

    // 5. Encrypt Tokens and save AccessCredentialRecord
    const encryptedAccess = encryptToken(tokenData.access_token, this.config.secretKey);
    const encryptedRefresh = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token, this.config.secretKey)
      : undefined;

    const expiresAt = new Date(now.getTime() + (tokenData.expires_in || 7 * 86400) * 1000);

    const credRecord = {
      id: `crd_${accountId}`,
      bangumiAccountId: accountId,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      expiresAt,
      scopes: session.requestedScopes,
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    };
    this.db.accessCredentials.set(accountId, credRecord);

    // 6. Bind Principal to Account
    const bindingRecord = {
      id: `bnd_${session.principalId}`,
      principalId: session.principalId,
      bangumiAccountId: accountId,
      isActive: true,
      createdAt: now,
    };
    this.db.accountBindings.set(bindingRecord.id, bindingRecord);

    return {
      accountId,
      username: accountRecord.username,
      nickname: accountRecord.nickname,
      principalId: session.principalId,
    };
  }
}
