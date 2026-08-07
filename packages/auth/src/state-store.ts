import crypto from 'node:crypto';
import { DatabaseStore, OAuthSessionRecord } from '@bangumi-agent-kit/db';

export function hashState(state: string): string {
  return crypto.createHash('sha256').update(state).digest('hex');
}

export class OAuthStateStore {
  constructor(private db: DatabaseStore) {}

  generateState(principalId: string, requestedScopes: string[] = ['write:collection']): { state: string; session: OAuthSessionRecord } {
    const state = crypto.randomBytes(24).toString('hex');
    const stateHash = hashState(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const session: OAuthSessionRecord = {
      id: `ses_${crypto.randomBytes(8).toString('hex')}`,
      stateHash,
      principalId,
      requestedScopes,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };

    this.db.oauthSessions.set(session.id, session);
    return { state, session };
  }

  consumeState(state: string): OAuthSessionRecord {
    const stateHash = hashState(state);
    const session = this.db.getOAuthSessionByHash(stateHash);

    if (!session) {
      throw new Error('Invalid OAuth state parameter');
    }

    if (session.usedAt) {
      throw new Error('OAuth state parameter has already been used');
    }

    if (new Date() > session.expiresAt) {
      throw new Error('OAuth state parameter has expired');
    }

    // Mark as used immediately
    session.usedAt = new Date();
    return session;
  }
}
