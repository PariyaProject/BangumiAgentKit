import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry, createRuntimeDependencies } from '@bangumi-agent-kit/tools';

describe('E. Auth-Before-Confirmation Test', () => {
  it('throws AUTH_REQUIRED before creating any PendingAction when an unbound user calls a destructive operation', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });
    const registry = new ToolRegistry(deps);

    const unboundPrincipalId = 'unbound-user-999';

    // Attempt destructive tool call on unbound principal
    await expect(
      registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 101, action: 'uncollect' },
        { principalId: unboundPrincipalId, botInstanceId: 'bot-1', conversationId: 'conv-1' },
      ),
    ).rejects.toThrow('AUTH_REQUIRED');

    // Verify 0 PendingAction records were created in storage
    const allPendingActions = (storage as any).pendingActions;
    expect(allPendingActions.size).toBe(0);
  });
});
