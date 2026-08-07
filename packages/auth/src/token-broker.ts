import { DatabaseStore, BangumiAccountRecord } from '@bangumi-agent-kit/db';
import { decryptToken } from './token-crypto.js';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

export class TokenBroker {
  constructor(
    private db: DatabaseStore,
    private secretKey: string
  ) {}

  async requireAccount(principalId: string): Promise<BangumiAccountRecord> {
    const binding = this.db.getActiveBinding(principalId);
    if (!binding) {
      throw new BangumiError(
        'AUTH_REQUIRED',
        '该操作需要先绑定 Bangumi 账号',
        false,
        401,
        '调用 bangumi.auth_start'
      );
    }

    const account = this.db.bangumiAccounts.get(binding.bangumiAccountId);
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

  async getValidAccessToken(accountId: string, requiredScopes: string[] = []): Promise<string> {
    const cred = this.db.getCredentialByAccountId(accountId);
    if (!cred) {
      throw new BangumiError(
        'AUTH_REQUIRED',
        '未查找到有效授权凭证，请重新绑定',
        false,
        401,
        '调用 bangumi.auth_start'
      );
    }

    // Check required scopes
    for (const scope of requiredScopes) {
      if (!cred.scopes.includes(scope)) {
        throw new BangumiError(
          'PERMISSION_DENIED',
          `授权凭证缺少所需的权限范围: ${scope}。请重新授权。`,
          false,
          403,
          '调用 bangumi.auth_start'
        );
      }
    }

    const accessToken = decryptToken(cred.encryptedAccessToken, this.secretKey);
    return accessToken;
  }

  async disconnect(principalId: string): Promise<void> {
    const binding = this.db.getActiveBinding(principalId);
    if (binding) {
      binding.isActive = false;
      this.db.accessCredentials.delete(binding.bangumiAccountId);
    }
  }
}
