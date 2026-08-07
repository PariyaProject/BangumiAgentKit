import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { hashState, OAuthStateStore } from '@bangumi-agent-kit/auth';

describe('OAuth State Single-Use & Expiry Tests', () => {
  it('creates and consumes state hash exactly once', async () => {
    const storage = new MemoryStorage();
    const stateStore = new OAuthStateStore(storage);

    const { state } = await stateStore.generateState({
      principalId: 'user-1',
      botInstanceId: 'bot-1',
      conversationId: 'conv-1',
    });

    const consumed = await stateStore.consumeState(state);
    expect(consumed.principalId).toBe('user-1');

    await expect(stateStore.consumeState(state)).rejects.toThrow('OAUTH_STATE_REUSED');
  });

  it('rejects expired oauth state', async () => {
    const storage = new MemoryStorage();
    const rawState = 'expired-state-string';
    const stateHash = hashState(rawState);

    const session = {
      id: 'ses_expired',
      stateHash,
      principalId: 'user-1',
      botInstanceId: 'bot-1',
      conversationId: 'conv-1',
      requestedCapabilities: ['write:collection'],
      usedAt: null,
      createdAt: new Date(Date.now() - 1200000),
      expiresAt: new Date(Date.now() - 600000),
    };

    await storage.createOAuthSession(session);

    await expect(storage.consumeOAuthSession(stateHash)).rejects.toThrow('OAUTH_STATE_EXPIRED');
  });
});
