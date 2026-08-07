import crypto from 'node:crypto';
import { Storage, OAuthSessionRecord } from '@bangumi-agent-kit/db';

export function hashState(state: string): string {
  return crypto.createHash('sha256').update(state).digest('hex');
}

export interface GenerateStateOptions {
  principalId: string;
  botInstanceId?: string;
  conversationId?: string;
  requestedCapabilities?: string[];
}

export class OAuthStateStore {
  constructor(private storage: Storage) {}

  async generateState(options: GenerateStateOptions): Promise<{ state: string; session: OAuthSessionRecord }> {
    const state = crypto.randomBytes(24).toString('hex');
    const stateHash = hashState(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const session: OAuthSessionRecord = {
      id: `ses_${crypto.randomBytes(8).toString('hex')}`,
      stateHash,
      principalId: options.principalId,
      botInstanceId: options.botInstanceId,
      conversationId: options.conversationId,
      requestedCapabilities: options.requestedCapabilities || ['write:collection'],
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };

    await this.storage.createOAuthSession(session);
    return { state, session };
  }

  async consumeState(state: string): Promise<OAuthSessionRecord> {
    const stateHash = hashState(state);
    return await this.storage.consumeOAuthSession(stateHash);
  }
}
