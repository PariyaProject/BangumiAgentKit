import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import {
  SQLiteStorage,
  MemoryStorage,
  resolveSqlitePath,
  type AccessCredentialRecord,
} from '../../packages/db/src/index.js';
import { encryptToken } from '../../packages/auth/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import {
  createRuntimeDependenciesWithStorage,
  defineTool,
  ToolRegistry,
} from '../../packages/tools/src/index.js';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const mcpEntry = path.join(repoRoot, 'apps', 'mcp', 'dist', 'main.js');
const requireBuilt = process.env.BANGUMI_REQUIRE_BUILT_HOST === '1';
const hasBuiltEntry = fs.existsSync(mcpEntry);

if (requireBuilt && !hasBuiltEntry) {
  throw new Error('Built MCP entry is required. Run `pnpm build` before this integration test.');
}

interface TextContent {
  type?: string;
  text?: string;
}

interface PublicToolError {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
    nextAction?: string;
  };
}

function runtimeEnv(
  dataDir: string,
  homeDir: string,
  identity: {
    externalUserId: string;
    conversationId: string;
  },
  confirmationGrant?: string,
): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH || '',
    HOME: homeDir,
    NODE_ENV: 'test',
  };
  env.BANGUMI_DATA_DIR = dataDir;
  env.BANGUMI_DB_DRIVER = 'sqlite';
  env.BANGUMI_TOKEN_ENCRYPTION_KEY = 'host-integration-key-012345678901234567890';
  env.BANGUMI_MCP_IDENTITY_PROVIDER = 'qq';
  env.BANGUMI_MCP_EXTERNAL_USER_ID = identity.externalUserId;
  env.BANGUMI_MCP_BOT_INSTANCE_ID = 'qq:host-integration-bot';
  env.BANGUMI_MCP_CONVERSATION_ID = identity.conversationId;
  if (confirmationGrant) {
    env.BANGUMI_MCP_CONFIRMATION_GRANT = confirmationGrant;
  }
  return env;
}

async function connectMcp(env: Record<string, string>): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntry],
    cwd: repoRoot,
    env,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'bangumi-host-built-integration', version: '0.1.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

async function callJson(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const first = (result.content as TextContent[] | undefined)?.[0];
  if (!first?.text) {
    throw new Error(`MCP ${name} returned no text content`);
  }
  return {
    result,
    body: JSON.parse(first.text) as Record<string, unknown>,
  };
}

async function seedAuthenticatedFixture(dataDir: string): Promise<{
  storage: SQLiteStorage;
  accountIds: { first: string; second: string; alternateForFirst: string };
}> {
  const storage = await SQLiteStorage.create({ dbPath: resolveSqlitePath(undefined, dataDir) });
  const firstPrincipal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'qq:host-integration-bot',
    externalUserId: 'user-a',
  });
  const secondPrincipal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'qq:host-integration-bot',
    externalUserId: 'user-b',
  });
  const firstAccount = await storage.upsertBangumiAccount({
    id: 'account-host-a',
    bangumiUserId: 910001,
    username: 'host_a',
    nickname: 'Host A',
  });
  const secondAccount = await storage.upsertBangumiAccount({
    id: 'account-host-b',
    bangumiUserId: 910002,
    username: 'host_b',
    nickname: 'Host B',
  });
  const alternateAccount = await storage.upsertBangumiAccount({
    id: 'account-host-a-alternate',
    bangumiUserId: 910003,
    username: 'host_a_alternate',
    nickname: 'Host A Alternate',
  });
  await storage.bindAccount(firstPrincipal.id, firstAccount.id, true);
  await storage.bindAccount(firstPrincipal.id, alternateAccount.id, false);
  await storage.bindAccount(secondPrincipal.id, secondAccount.id, true);
  const now = new Date();
  const encrypted = (token: string) =>
    encryptToken(token, 'host-integration-key-012345678901234567890');
  const credential = (accountId: string, token: string): AccessCredentialRecord => ({
    id: `cred-${accountId}`,
    bangumiAccountId: accountId,
    encryptedAccessToken: encrypted(token),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    requestedCapabilities: [],
    reportedScopes: null,
    scopeEvidence: 'unknown',
    keyVersion: 'v1',
    createdAt: now,
    updatedAt: now,
  });
  await storage.upsertCredential(credential(firstAccount.id, 'fixture-token-a'));
  await storage.upsertCredential(credential(secondAccount.id, 'fixture-token-b'));
  await storage.upsertCredential(credential(alternateAccount.id, 'fixture-token-a-alternate'));
  return {
    storage,
    accountIds: {
      first: firstAccount.id,
      second: secondAccount.id,
      alternateForFirst: alternateAccount.id,
    },
  };
}

const builtSuite = hasBuiltEntry ? describe : describe.skip;

builtSuite('PR-6R-B built MCP host integration', () => {
  it('resolves trusted external QQ identities through real MCP stdio', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-host-mcp-identity-'));
    const dataDir = path.join(tempDir, 'data');
    const homeDir = path.join(tempDir, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    try {
      const clientA = await connectMcp(
        runtimeEnv(dataDir, homeDir, {
          externalUserId: 'user-a',
          conversationId: 'qq:host-integration-bot:group:group-1:user:user-a',
        }),
      );
      const statusA = await callJson(clientA, 'bangumi.auth_status');
      expect(statusA.result.isError).toBeUndefined();
      expect(statusA.body).toMatchObject({ bound: false, accountCount: 0 });
      await clientA.close();

      const clientB = await connectMcp(
        runtimeEnv(dataDir, homeDir, {
          externalUserId: 'user-b',
          conversationId: 'qq:host-integration-bot:group:group-1:user:user-b',
        }),
      );
      const statusB = await callJson(clientB, 'bangumi.auth_status');
      expect(statusB.result.isError).toBeUndefined();
      expect(statusB.body).toMatchObject({ bound: false, accountCount: 0 });
      await clientB.close();

      const storage = await SQLiteStorage.create({
        dbPath: resolveSqlitePath(undefined, dataDir),
      });
      const principalA = await storage.findOrCreatePrincipal({
        provider: 'qq',
        botInstanceId: 'qq:host-integration-bot',
        externalUserId: 'user-a',
      });
      const principalAAgain = await storage.findOrCreatePrincipal({
        provider: 'qq',
        botInstanceId: 'qq:host-integration-bot',
        externalUserId: 'user-a',
      });
      const principalB = await storage.findOrCreatePrincipal({
        provider: 'qq',
        botInstanceId: 'qq:host-integration-bot',
        externalUserId: 'user-b',
      });
      expect(principalA.id).toMatch(/^prc_/);
      expect(principalAAgain.id).toBe(principalA.id);
      expect(principalB.id).not.toBe(principalA.id);
      await storage.close();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enforces confirmation and identity binding through real MCP stdio', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-host-mcp-confirm-'));
    const dataDir = path.join(tempDir, 'data');
    const homeDir = path.join(tempDir, 'home');
    fs.mkdirSync(homeDir, { recursive: true });
    let fixture: Awaited<ReturnType<typeof seedAuthenticatedFixture>> | undefined;

    try {
      fixture = await seedAuthenticatedFixture(dataDir);
      const clientA = await connectMcp(
        runtimeEnv(dataDir, homeDir, {
          externalUserId: 'user-a',
          conversationId: 'qq:host-integration-bot:group:group-1:user:user-a',
        }),
      );
      const tools = await clientA.listTools();
      const disconnect = tools.tools.find((tool) => tool.name === 'bangumi.auth_disconnect');
      expect(disconnect?.inputSchema).toMatchObject({
        properties: { _confirmationId: { pattern: '^cfm_[A-Za-z0-9_-]+$' } },
      });

      const accounts = await callJson(clientA, 'bangumi.auth_list_accounts');
      expect(accounts.body).toHaveLength(2);
      const switched = await callJson(clientA, 'bangumi.auth_switch_account', {
        accountId: fixture.accountIds.alternateForFirst,
      });
      expect(switched.body).toMatchObject({
        success: true,
        activeAccountId: fixture.accountIds.alternateForFirst,
      });
      const alternateStatus = await callJson(clientA, 'bangumi.auth_status');
      expect(alternateStatus.body).toMatchObject({
        account: { username: 'host_a_alternate' },
      });
      const switchedBack = await callJson(clientA, 'bangumi.auth_switch_account', {
        accountId: fixture.accountIds.first,
      });
      expect(switchedBack.body).toMatchObject({
        success: true,
        activeAccountId: fixture.accountIds.first,
      });

      const first = await callJson(clientA, 'bangumi.auth_disconnect');
      expect(first.result.isError).toBe(true);
      const firstError = first.body as PublicToolError;
      expect(firstError.error?.code).toBe('CONFIRMATION_REQUIRED');
      const nextAction = firstError.error?.nextAction || '';
      const confirmationId = nextAction.match(/cfm_[A-Za-z0-9_-]+/)?.[0];
      expect(confirmationId).toMatch(/^cfm_/);

      const rememberedWithoutGrant = await callJson(clientA, 'bangumi.auth_disconnect', {
        _confirmationId: confirmationId,
      });
      expect(rememberedWithoutGrant.result.isError).toBe(true);
      expect((rememberedWithoutGrant.body as PublicToolError).error?.code).toBe(
        'CONFIRMATION_INVALID',
      );

      const clientB = await connectMcp(
        runtimeEnv(
          dataDir,
          homeDir,
          {
            externalUserId: 'user-b',
            conversationId: 'qq:host-integration-bot:group:group-1:user:user-b',
          },
          confirmationId,
        ),
      );
      const wrongAccount = await callJson(clientB, 'bangumi.auth_switch_account', {
        accountId: fixture.accountIds.alternateForFirst,
      });
      expect(wrongAccount.result.isError).toBe(true);
      expect((wrongAccount.body as PublicToolError).error?.code).toBe('PERMISSION_DENIED');
      const wrongIdentity = await callJson(clientB, 'bangumi.auth_disconnect', {
        _confirmationId: confirmationId,
      });
      expect(wrongIdentity.result.isError).toBe(true);
      expect((wrongIdentity.body as PublicToolError).error?.code).toBe('CONFIRMATION_INVALID');
      await clientB.close();

      const mismatchClient = await connectMcp(
        runtimeEnv(
          dataDir,
          homeDir,
          {
            externalUserId: 'user-a',
            conversationId: 'qq:host-integration-bot:group:group-1:user:user-a',
          },
          'cfm_mismatch',
        ),
      );
      const mismatchedGrant = await callJson(mismatchClient, 'bangumi.auth_disconnect', {
        _confirmationId: confirmationId,
      });
      expect(mismatchedGrant.result.isError).toBe(true);
      expect((mismatchedGrant.body as PublicToolError).error?.code).toBe('CONFIRMATION_INVALID');
      await mismatchClient.close();

      await clientA.close();
      const confirmedClient = await connectMcp(
        runtimeEnv(
          dataDir,
          homeDir,
          {
            externalUserId: 'user-a',
            conversationId: 'qq:host-integration-bot:group:group-1:user:user-a',
          },
          confirmationId,
        ),
      );
      const confirmed = await callJson(confirmedClient, 'bangumi.auth_disconnect', {
        _confirmationId: confirmationId,
      });
      expect(confirmed.result.isError).toBeUndefined();
      expect(confirmed.body).toMatchObject({ success: true });

      const afterSuccess = await fixture.storage.getCredential(fixture.accountIds.first);
      const otherAccount = await fixture.storage.getCredential(fixture.accountIds.second);
      expect(afterSuccess).toBeNull();
      expect(otherAccount).not.toBeNull();

      const replay = await callJson(confirmedClient, 'bangumi.auth_disconnect', {
        _confirmationId: confirmationId,
      });
      expect(replay.result.isError).toBe(true);
      expect((replay.body as PublicToolError).error?.code).toBe('AUTH_REQUIRED');
      await confirmedClient.close();
    } finally {
      await fixture?.storage.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('PR-6R-B MCP artifact contract', () => {
  it('returns only an ArtifactRef over real MCP protocol and resolves it by ID', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-host-mcp-artifact-'));
    const artifactDir = path.join(tempDir, 'artifacts');
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactId = 'art_protocol_fixture';
    const artifactPath = path.join(artifactDir, `${artifactId}.png`);
    fs.writeFileSync(
      artifactPath,
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('fixture'),
      ]),
    );
    fs.writeFileSync(
      path.join(artifactDir, `${artifactId}.json`),
      JSON.stringify({
        id: artifactId,
        mimeType: 'image/png',
        filePath: '/must-not-be-trusted/outside.png',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    );

    const storage = new MemoryStorage();
    const dependencies = createRuntimeDependenciesWithStorage(storage);
    const registry = new ToolRegistry(dependencies);
    registry.registerTool(
      defineTool({
        name: 'bangumi.render_subject_card',
        description: 'deterministic render fixture',
        input: z.object({ subjectId: z.number() }),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async () => ({
          artifact: {
            id: artifactId,
            mimeType: 'image/png',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          },
        }),
      }),
    );
    const mcpApp = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: {
        resolveContext: async () => ({
          principalId: 'prc_artifact_fixture',
          botInstanceId: 'qq:artifact-fixture',
          conversationId: 'qq:artifact-fixture:private:user',
        }),
      },
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: 'artifact-contract-client', version: '0.1.0' },
      { capabilities: {} },
    );

    try {
      await mcpApp.getMcpServer().connect(serverTransport);
      await client.connect(clientTransport);
      const result = await callJson(client, 'bangumi.render_subject_card', { subjectId: 226998 });
      expect(result.result.isError).toBeUndefined();
      expect(result.body).toEqual({
        artifact: {
          id: artifactId,
          mimeType: 'image/png',
          expiresAt: expect.any(String),
        },
      });
      expect(JSON.stringify(result.body)).not.toContain(artifactDir);
      expect(JSON.stringify(result.body)).not.toContain('filePath');
      expect(fs.readFileSync(artifactPath).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    } finally {
      await client.close();
      await mcpApp.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
