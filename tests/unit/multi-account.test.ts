import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SQLiteStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken, resolveTokenEncryptionConfig } from '@bangumi-agent-kit/auth';
import { ToolRegistry, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('PR-6B: Multi-Account & Principal Isolation Tests', () => {
  it('M01-M13: Complete Multi-Account Lifecycle & Isolation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-multi-account-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const storage = await SQLiteStorage.create({ dbPath });
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encConfig = resolveTokenEncryptionConfig({ secretKey: key });

    const mockHttpClient = {
      async request<T>() {
        return { status: 200, statusText: 'OK', headers: {}, data: {} } as unknown as T;
      },
    } as unknown as HttpClient;

    const config = { secretKey: key };
    const broker = new TokenBroker(storage, config, mockHttpClient);

    // Create Principal A and Principal B
    const principalA = await storage.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'qq:bot1',
      externalUserId: 'user-A',
    });

    const principalB = await storage.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'qq:bot1',
      externalUserId: 'user-B',
    });

    // Create Bangumi Account A1 and Account B1
    const accountA1 = await storage.upsertBangumiAccount({
      id: 'bgm-account-A1',
      bangumiUserId: 1001,
      username: 'user_a1',
      nickname: 'User A1',
    });

    const accountB1 = await storage.upsertBangumiAccount({
      id: 'bgm-account-B1',
      bangumiUserId: 2001,
      username: 'user_b1',
      nickname: 'User B1',
    });

    // Add credentials for A1 and B1
    const now = new Date();
    await storage.upsertCredential({
      id: 'cred-a1',
      bangumiAccountId: accountA1.id,
      encryptedAccessToken: encryptToken('token_a1', encConfig.keyring, 'v1'),
      expiresAt: new Date(now.getTime() + 3600000),
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    });

    await storage.upsertCredential({
      id: 'cred-b1',
      bangumiAccountId: accountB1.id,
      encryptedAccessToken: encryptToken('token_b1', encConfig.keyring, 'v1'),
      expiresAt: new Date(now.getTime() + 3600000),
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    });

    // M01: Principal A binds Account A1
    await storage.bindAccount(principalA.id, accountA1.id, true);

    // M02: Principal B binds Account B1
    await storage.bindAccount(principalB.id, accountB1.id, true);

    // M03: Principal A active account is A1, Principal B active account is B1
    const activeA = await storage.getActiveBinding(principalA.id);
    const activeB = await storage.getActiveBinding(principalB.id);
    expect(activeA?.bangumiAccountId).toBe(accountA1.id);
    expect(activeB?.bangumiAccountId).toBe(accountB1.id);

    // M04: Principal A binds Account A2
    const accountA2 = await storage.upsertBangumiAccount({
      id: 'bgm-account-A2',
      bangumiUserId: 1002,
      username: 'user_a2',
      nickname: 'User A2',
    });
    await storage.bindAccount(principalA.id, accountA2.id, true);

    // M05: Account A2 becomes active by default
    const newActiveA = await storage.getActiveBinding(principalA.id);
    expect(newActiveA?.bangumiAccountId).toBe(accountA2.id);

    // M06: Account A1 remains listed but inactive
    const listA = await broker.listAccounts(principalA.id);
    expect(listA).toHaveLength(2);
    expect(listA.find((acc) => acc.accountId === accountA2.id)?.active).toBe(true);
    expect(listA.find((acc) => acc.accountId === accountA1.id)?.active).toBe(false);

    // M07: Switch A2 -> A1
    await broker.switchAccount(principalA.id, accountA1.id);
    const switchedActiveA = await storage.getActiveBinding(principalA.id);
    expect(switchedActiveA?.bangumiAccountId).toBe(accountA1.id);

    // M08: TokenBroker requires A1 account after switch
    const requiredAcc = await broker.requireAccount(principalA.id);
    expect(requiredAcc.id).toBe(accountA1.id);

    // M09: Switch to B1 account by Principal A fails with PERMISSION_DENIED
    await expect(broker.switchAccount(principalA.id, accountB1.id)).rejects.toThrow(
      '未绑定至当前用户',
    );

    // M10: Remove inactive account (A2)
    await broker.removeAccount(principalA.id, accountA2.id);
    const listAfterRemove = await broker.listAccounts(principalA.id);
    expect(listAfterRemove).toHaveLength(1);
    expect(listAfterRemove[0]?.accountId).toBe(accountA1.id);
    expect(listAfterRemove[0]?.active).toBe(true);

    // M11: Remove active account (A1)
    await broker.removeAccount(principalA.id, accountA1.id);
    const activeAfterRemoveAll = await storage.getActiveBinding(principalA.id);
    expect(activeAfterRemoveAll).toBeNull();

    // M12: auth_status reflects no active account
    const statusA = await broker.getAuthStatus(principalA.id);
    expect(statusA.bound).toBe(false);
    expect(statusA.accountCount).toBe(0);

    // M13: Tool execution never exposes tokens
    const deps = createRuntimeDependencies({ storage, secretKey: key });
    const registry = new ToolRegistry(deps);
    const listToolResult = await registry.executeTool(
      'bangumi.auth_list_accounts',
      {},
      { principalId: principalB.id, botInstanceId: 'bot1', conversationId: 'c1' },
    );
    const strResult = JSON.stringify(listToolResult);
    expect(strResult).not.toContain('token');
    expect(strResult).not.toContain('ciphertext');

    await storage.close();
  });

  it('6B-09: Cross-process SQLite account binding sync test', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-crossproc-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    // Connection A (simulating API/OAuth process)
    const storageA = await SQLiteStorage.create({ dbPath });

    const principal = await storageA.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'bot-cp',
      externalUserId: 'user-cp',
    });

    const account = await storageA.upsertBangumiAccount({
      id: 'bgm-cp-1',
      bangumiUserId: 9999,
      username: 'crossproc',
      nickname: 'Cross Process',
    });

    await storageA.bindAccount(principal.id, account.id, true);

    // Connection B (simulating fresh MCP process)
    const storageB = await SQLiteStorage.create({ dbPath });
    const activeFromB = await storageB.getActiveBinding(principal.id);

    expect(activeFromB).not.toBeNull();
    expect(activeFromB?.bangumiAccountId).toBe(account.id);
    expect(activeFromB?.isActive).toBe(true);

    await storageA.close();
    await storageB.close();
  });
});
