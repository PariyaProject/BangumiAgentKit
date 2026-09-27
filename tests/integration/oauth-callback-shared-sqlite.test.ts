import { createServer, type Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BANGUMI_OAUTH_CALLBACK_PATH } from '@bangumi-agent-kit/config';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { SQLiteStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependenciesWithStorage } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import {
  reserveTcpPort,
  StandaloneOAuthController,
} from '../../apps/standalone/src/oauth-controller.js';

const CLIENT_ID = 'synthetic-oauth-client-id';
const CLIENT_SECRET = 'synthetic-oauth-client-secret';
const TOKEN_ENCRYPTION_KEY = 'synthetic-token-encryption-key-for-tests';
const ACCESS_TOKEN = 'synthetic-access-token-never-persist-plaintext';

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('OAuth fixture server did not bind a TCP port'));
        return;
      }
      resolve((address as AddressInfo).port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('OAuth callback across MCP SQLite and local callback server', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds an unbound MCP principal through the loopback callback and survives new storage connections', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-oauth-callback-'));
    const dbPath = path.join(tempDir, 'shared.sqlite');
    let tokenRequests = 0;
    let profileRequests = 0;
    let tokenForm: URLSearchParams | undefined;
    let profileAuthorization: string | null = null;

    const mockProvider = createServer((request, response) => {
      if (request.url === '/oauth/access_token' && request.method === 'POST') {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
        request.on('end', () => {
          tokenRequests += 1;
          tokenForm = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              access_token: ACCESS_TOKEN,
              refresh_token: 'synthetic-refresh-token',
              expires_in: 3600,
              scope: 'read write',
              token_type: 'Bearer',
            }),
          );
        });
        return;
      }

      if (request.url === '/v0/me' && request.method === 'GET') {
        profileRequests += 1;
        profileAuthorization = request.headers.authorization || null;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            id: 42424242,
            username: 'synthetic-bangumi-user',
            nickname: 'Synthetic User',
            avatar: { medium: 'https://example.invalid/avatar.png' },
          }),
        );
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'fixture route not found' }));
    });

    let mockPort = 0;
    let callbackPort = 0;
    let callbackStorage: Awaited<ReturnType<typeof SQLiteStorage.create>> | undefined;
    let mcpStorage: Awaited<ReturnType<typeof SQLiteStorage.create>> | undefined;
    let verifyStorage: Awaited<ReturnType<typeof SQLiteStorage.create>> | undefined;
    let callback: StandaloneOAuthController | undefined;
    let mcp: BangumiMcpServer | undefined;
    let verifier: BangumiMcpServer | undefined;

    try {
      mockPort = await listen(mockProvider);
      callbackPort = await reserveTcpPort('127.0.0.1');
      const mockBaseUrl = `http://127.0.0.1:${mockPort}`;
      const callbackUrl = `http://127.0.0.1:${callbackPort}${BANGUMI_OAUTH_CALLBACK_PATH}`;
      const publicHttpClient = new HttpClient({ baseUrl: mockBaseUrl });

      vi.stubEnv('BANGUMI_OAUTH_CLIENT_ID', CLIENT_ID);
      vi.stubEnv('BANGUMI_OAUTH_CLIENT_SECRET', CLIENT_SECRET);
      vi.stubEnv('BANGUMI_OAUTH_TOKEN_URL', `${mockBaseUrl}/oauth/access_token`);
      vi.stubEnv('BANGUMI_OAUTH_AUTHORIZE_URL', `${mockBaseUrl}/oauth/authorize`);
      vi.stubEnv('BANGUMI_TOKEN_ENCRYPTION_KEY', TOKEN_ENCRYPTION_KEY);
      vi.stubEnv('BANGUMI_ARTIFACT_DIR', path.join(tempDir, 'artifacts'));

      callbackStorage = await SQLiteStorage.create({ dbPath });
      const callbackDependencies = createRuntimeDependenciesWithStorage(callbackStorage, {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: callbackUrl,
        tokenUrl: `${mockBaseUrl}/oauth/access_token`,
        authorizeUrl: `${mockBaseUrl}/oauth/authorize`,
        secretKey: TOKEN_ENCRYPTION_KEY,
        publicHttpClient,
      });
      callback = new StandaloneOAuthController({
        dependencies: callbackDependencies,
        host: '127.0.0.1',
        port: callbackPort,
        callbackPath: BANGUMI_OAUTH_CALLBACK_PATH,
      });
      const callbackStatus = await callback.start();
      expect(callbackStatus.callbackUrl).toBe(callbackUrl);

      // This connection represents the per-turn MCP process. Its SQLite file is
      // shared with the separately running loopback callback service.
      mcpStorage = await SQLiteStorage.create({ dbPath });
      const principal = await mcpStorage.findOrCreatePrincipal({
        provider: 'qq',
        botInstanceId: 'pariya-qq:synthetic-bot',
        externalUserId: 'synthetic-qq-user',
      });
      const mcpDependencies = createRuntimeDependenciesWithStorage(mcpStorage, {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: callbackUrl,
        tokenUrl: `${mockBaseUrl}/oauth/access_token`,
        authorizeUrl: `${mockBaseUrl}/oauth/authorize`,
        secretKey: TOKEN_ENCRYPTION_KEY,
        publicHttpClient,
      });
      mcp = new BangumiMcpServer({ dependencies: mcpDependencies, profile: 'full' });
      const context = {
        principalId: principal.id,
        botInstanceId: 'pariya-qq:synthetic-bot',
        conversationId: 'pariya-qq:private:synthetic-qq-user',
      };

      const before = (await mcp.getRegistry().executeTool('bangumi.auth_status', {}, context)) as {
        bound: boolean;
        accountCount: number;
      };
      expect(before).toMatchObject({ bound: false, accountCount: 0 });

      const started = (await mcp.getRegistry().executeTool('bangumi.auth_start', {}, context)) as {
        authorizationUrl: string;
        expiresAt: string;
      };
      const authorization = new URL(started.authorizationUrl);
      const state = authorization.searchParams.get('state');
      expect(authorization.origin).toBe(mockBaseUrl);
      expect(authorization.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(authorization.searchParams.get('redirect_uri')).toBe(callbackUrl);
      expect(state).toMatch(/^[a-f0-9]{48}$/u);
      await mcp.close();
      mcp = undefined;
      mcpStorage = undefined;

      // The real browser returns to the separate loopback API after consent.
      const completedUrl = new URL(callbackUrl);
      completedUrl.searchParams.set('code', 'synthetic-one-time-code');
      completedUrl.searchParams.set('state', state!);
      const completed = await fetch(completedUrl);
      const completionHtml = await completed.text();
      expect(completed.status).toBe(200);
      expect(completionHtml).toContain('Bangumi 账号绑定成功');
      expect(completionHtml).toContain('Synthetic User');
      expect(completionHtml).not.toContain(state!);
      expect(completionHtml).not.toContain(ACCESS_TOKEN);

      const replay = await fetch(completedUrl);
      expect(replay.status).toBe(400);
      expect(tokenRequests).toBe(1);
      expect(profileRequests).toBe(1);
      expect(tokenForm?.get('grant_type')).toBe('authorization_code');
      expect(tokenForm?.get('client_id')).toBe(CLIENT_ID);
      expect(tokenForm?.get('client_secret')).toBe(CLIENT_SECRET);
      expect(tokenForm?.get('code')).toBe('synthetic-one-time-code');
      expect(tokenForm?.get('redirect_uri')).toBe(callbackUrl);
      expect(profileAuthorization).toBe(`Bearer ${ACCESS_TOKEN}`);

      await callback.close();
      callback = undefined;
      await callbackStorage.close();
      callbackStorage = undefined;

      // A fresh MCP storage connection, like the next isolated runner turn,
      // sees the binding written by the callback process.
      verifyStorage = await SQLiteStorage.create({ dbPath });
      const verifyDependencies = createRuntimeDependenciesWithStorage(verifyStorage, {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: callbackUrl,
        tokenUrl: `${mockBaseUrl}/oauth/access_token`,
        authorizeUrl: `${mockBaseUrl}/oauth/authorize`,
        secretKey: TOKEN_ENCRYPTION_KEY,
        publicHttpClient,
      });
      verifier = new BangumiMcpServer({ dependencies: verifyDependencies, profile: 'full' });
      const after = (await verifier
        .getRegistry()
        .executeTool('bangumi.auth_status', {}, context)) as {
        bound: boolean;
        accountCount: number;
        account: { username: string; nickname: string };
      };
      expect(after).toMatchObject({
        bound: true,
        accountCount: 1,
        account: { username: 'synthetic-bangumi-user', nickname: 'Synthetic User' },
      });
      const binding = await verifyStorage.getActiveBinding(principal.id);
      expect(binding).not.toBeNull();
      const credential = await verifyStorage.getCredential(binding!.bangumiAccountId);
      expect(credential).not.toBeNull();
      expect(JSON.stringify(credential!.encryptedAccessToken)).not.toContain(ACCESS_TOKEN);
    } finally {
      await verifier?.close();
      await mcp?.close();
      await callback?.close();
      await verifyStorage?.close();
      await callbackStorage?.close();
      await mcpStorage?.close();
      await close(mockProvider);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
