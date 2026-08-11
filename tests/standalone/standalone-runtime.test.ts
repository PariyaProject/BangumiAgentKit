import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import { BANGUMI_OAUTH_CALLBACK_PATH } from '../../packages/config/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { MemoryStorage } from '../../packages/db/src/index.js';
import {
  createRuntimeDependenciesWithStorage,
  defineTool,
  ToolRegistry,
} from '../../packages/tools/src/index.js';
import { LocalArtifactStore } from '../../packages/renderer/src/index.js';
import { StandaloneCommandRegistry } from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs, tokenizeCommandLine } from '../../apps/standalone/src/command-parser.js';
import { createStandaloneIdentity } from '../../apps/standalone/src/identity.js';
import { runCli } from '../../apps/standalone/src/cli.js';
import { StandaloneOAuthController } from '../../apps/standalone/src/oauth-controller.js';
import { StandaloneHost } from '../../apps/standalone/src/standalone-host.js';
import { Presenter, sanitizeOutput } from '../../apps/standalone/src/presenter.js';

describe('PR-6R-C standalone runtime', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-standalone-'));
    process.env.BANGUMI_DATA_DIR = tempDir;
    process.env.BANGUMI_TOKEN_ENCRYPTION_KEY = 'standalone-test-key-012345678901234567890123456789';
    process.env.BANGUMI_STANDALONE_OAUTH_PORT = '0';
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function createTestHost(
    options: { registry?: ToolRegistry; artifactStore?: LocalArtifactStore } = {},
  ) {
    const storage = new MemoryStorage();
    const publicHttpClient = new HttpClient({
      fetchFn: async () =>
        new Response(JSON.stringify({ data: [], total: 0, limit: 20, offset: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const artifactStore =
      options.artifactStore ||
      new LocalArtifactStore({ artifactDir: path.join(tempDir, 'artifacts') });
    const dependencies = createRuntimeDependenciesWithStorage(storage, {
      secretKey: process.env.BANGUMI_TOKEN_ENCRYPTION_KEY,
      redirectUri: 'http://127.0.0.1:0/oauth/bangumi/callback',
      publicHttpClient,
      artifactStore,
    });
    return StandaloneHost.create({
      profile: 'default',
      storage,
      dependencies,
      registry: options.registry,
      artifactStore,
      startOAuthServer: false,
    });
  }

  it('ST-01/ST-02/ST-03: profiles persist and isolate principals in one database', async () => {
    const first = await StandaloneHost.create({
      dataDir: tempDir,
      profile: 'alice',
      startOAuthServer: false,
    });
    const aliceId = first.getPrincipalId();
    await first.close();

    const restarted = await StandaloneHost.create({
      dataDir: tempDir,
      profile: 'alice',
      startOAuthServer: false,
    });
    expect(restarted.getPrincipalId()).toBe(aliceId);
    await restarted.close();

    const bob = await StandaloneHost.create({
      dataDir: tempDir,
      profile: 'bob',
      startOAuthServer: false,
    });
    expect(bob.getPrincipalId()).not.toBe(aliceId);
    expect(bob.getIdentity()).toMatchObject({
      provider: 'local',
      botInstanceId: 'standalone',
      externalUserId: 'bob',
      conversationId: 'standalone:bob',
    });
    await bob.close();
  });

  it('ST-04/ST-05/ST-06: commands use ToolRegistry and expose the raw playground', async () => {
    const host = await createTestHost();
    host.getRegistry().registerTool(
      defineTool({
        name: 'bangumi.search_subjects',
        description: 'test search',
        input: z.object({ query: z.string() }),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async (input) => ({
          status: 'exact',
          candidates: [{ id: 218707, name: input.query }],
        }),
      }),
    );
    const registry = new StandaloneCommandRegistry();
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const flags = parseCliArgs(['--json', 'search', 'fixture']).flags;
    const context = {
      host,
      flags,
      presenter,
      confirm: async () => false,
    };
    await expect(registry.execute(['search', 'fixture'], context)).resolves.toMatchObject({
      value: { status: 'exact', candidates: [{ id: 218707 }] },
    });
    await expect(registry.execute(['tool', 'list'], context)).resolves.toMatchObject({
      value: expect.arrayContaining([expect.objectContaining({ name: 'bangumi.search_subjects' })]),
    });
    await expect(
      registry.execute(['tool', 'describe', 'bangumi.search_subjects'], context),
    ).resolves.toMatchObject({
      value: { name: 'bangumi.search_subjects', inputSchema: expect.any(Object) },
    });
    const rawLine = `tool call bangumi.search_subjects '{"query":"少女终末旅行"}'`;
    const rawTokens = tokenizeCommandLine(rawLine);
    expect(rawTokens).toEqual([
      'tool',
      'call',
      'bangumi.search_subjects',
      '{"query":"少女终末旅行"}',
    ]);
    await expect(registry.execute(rawTokens, context)).resolves.toMatchObject({
      value: { candidates: [{ name: '少女终末旅行' }] },
    });
    await host.close();
  });

  it('PR-7E: standalone render calendar dispatches the calendar tool path', async () => {
    const host = await createTestHost();
    let executions = 0;
    host.getRegistry().registerTool(
      defineTool({
        name: 'bangumi.render_calendar',
        description: 'calendar route fixture',
        input: z.object({}),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async () => {
          executions += 1;
          return {
            artifact: {
              id: 'calendar-fixture',
              mimeType: 'image/png',
              width: 640,
              height: 320,
            },
          };
        },
      }),
    );

    const registry = new StandaloneCommandRegistry();
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const context = {
      host,
      flags: parseCliArgs(['--json', 'render', 'calendar']).flags,
      presenter,
      confirm: async () => false,
    };

    await expect(registry.execute(['render', 'calendar'], context)).resolves.toMatchObject({
      value: { artifact: { id: 'calendar-fixture', width: 640 } },
    });
    expect(executions).toBe(1);
    await host.close();
  });

  it('PR-7F: standalone render revision dispatches the bounded timeline tool path', async () => {
    const host = await createTestHost();
    let executions = 0;
    host.getRegistry().registerTool(
      defineTool({
        name: 'bangumi.render_revision_timeline',
        description: 'revision route fixture',
        input: z.object({
          entityType: z.enum(['subject', 'episode', 'character', 'person']),
          entityId: z.number().int().positive(),
        }),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async (input) => {
          executions += 1;
          return {
            artifact: {
              id: `revision-${input.entityType}-${input.entityId}`,
              mimeType: 'image/png',
              width: 640,
              height: 480,
            },
          };
        },
      }),
    );

    const registry = new StandaloneCommandRegistry();
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const context = {
      host,
      flags: parseCliArgs(['--json', 'render', 'revision', 'subject', '218707']).flags,
      presenter,
      confirm: async () => false,
    };

    await expect(
      registry.execute(['render', 'revision', 'subject', '218707'], context),
    ).resolves.toMatchObject({
      value: { artifact: { id: 'revision-subject-218707', width: 640 } },
    });
    expect(executions).toBe(1);
    await host.close();
  });

  it('ST-07/ST-08/ST-13-ST-19: raw and high-level writes preserve validation, identity, and confirmation', async () => {
    let executions = 0;
    const host = await createTestHost();
    host.getRegistry().registerTool(
      defineTool({
        name: 'test.confirmed_write',
        description: 'test write',
        input: z.object({ value: z.string() }),
        auth: 'none',
        scopes: [],
        risk: 'destructive',
        execute: async () => {
          executions += 1;
          return { ok: true };
        },
      }),
    );

    // The registry throws before execution; no write is auto-confirmed.
    await expect(host.executeTool('test.confirmed_write', { value: 'same' })).rejects.toMatchObject(
      {
        code: 'CONFIRMATION_REQUIRED',
      },
    );
    await expect(
      host.getRegistry().executeTool(
        'test.confirmed_write',
        { value: 'same' },
        {
          principalId: host.getPrincipalId(),
          botInstanceId: 'standalone',
          conversationId: 'standalone:default',
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });

    let confirmationId: string | undefined;
    try {
      await host.getRegistry().executeTool(
        'test.confirmed_write',
        { value: 'same' },
        {
          principalId: host.getPrincipalId(),
          botInstanceId: 'standalone',
          conversationId: 'standalone:default',
        },
      );
    } catch (err) {
      confirmationId = String((err as Error).message).match(/cfm_[A-Za-z0-9_-]+/)?.[0];
    }
    expect(confirmationId).toMatch(/^cfm_/);
    await expect(
      host.executeTool('test.confirmed_write', { value: 'changed' }, { confirmationId }),
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_INVALID',
    });
    await expect(
      host.executeTool('test.confirmed_write', { value: 'same' }, { confirmationId }),
    ).resolves.toEqual({ ok: true });
    expect(executions).toBe(1);
    await expect(
      host.executeTool('test.confirmed_write', { value: 'same' }, { confirmationId }),
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_INVALID',
    });
    await host.close();
  });

  it('PR-7B: provider status exposes official readiness and gated sources', async () => {
    const host = await createTestHost();
    const registry = new StandaloneCommandRegistry();
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const context = {
      host,
      flags: parseCliArgs(['--json', 'provider', 'status']).flags,
      presenter,
      confirm: async () => false,
    };

    const result = await registry.execute(['provider', 'status'], context);
    const statuses = result.value as Array<{ id: string; state: string }>;
    expect(statuses).toEqual(
      expect.arrayContaining([
        {
          id: 'official-v0',
          state: 'READY',
          sourceClass: 'official_v0',
          capabilities: ['subject', 'subject_stats'],
        },
        {
          id: 'official-legacy',
          state: 'READY',
          sourceClass: 'official_legacy',
          capabilities: ['calendar'],
        },
        {
          id: 'structured-web',
          state: 'DISABLED',
          sourceClass: 'structured_web',
          capabilities: [],
        },
        { id: 'website-html', state: 'DISABLED', sourceClass: 'website_html', capabilities: [] },
        { id: 'snapshots', state: 'NOT_CONFIGURED', sourceClass: 'snapshot', capabilities: [] },
      ]),
    );
    await host.close();
  });

  it('ST-20/ST-21: presenters redact token-shaped fields from human and JSON output', () => {
    const value = {
      username: 'alice',
      accessToken: 'secret-value',
      nested: { clientSecret: 'secret' },
    };
    const text = JSON.stringify(value);
    expect(text).toContain('secret-value');
    expect(JSON.stringify(sanitizeOutput(value))).not.toContain('secret-value');
  });

  it('AUTH-OUT-01/AUTH-OUT-02: JSON auth login keeps OAuth metadata and no secrets', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutChunks: Buffer[] = [];
    stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));

    const exitCode = await runCli(['--json', 'auth', 'login'], {
      stdout,
      stderr,
    });
    expect(exitCode).toBe(0);
    const output = JSON.parse(Buffer.concat(stdoutChunks).toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(output.authorizationUrl).toMatch(/^https:\/\//u);
    expect(output.authorizationComplete).toBeUndefined();
    expect(JSON.stringify(output)).not.toMatch(/accessToken|refreshToken|clientSecret|password/iu);

    const outputWithSecrets = {
      ...output,
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      clientSecret: 'client-secret',
    };
    const safe = sanitizeOutput(outputWithSecrets) as Record<string, unknown>;
    expect(safe.authorizationUrl).toBe(output.authorizationUrl);
    expect(JSON.stringify(safe)).not.toContain('access-secret');
    expect(JSON.stringify(safe)).not.toContain('refresh-secret');
    expect(JSON.stringify(safe)).not.toContain('client-secret');
  });

  it('AUTH-OUT-03: nested credential and Authorization header fields are recursively redacted', () => {
    const safe = sanitizeOutput({
      authorizationUrl: 'https://bgm.tv/oauth/authorize?state=opaque',
      authorizationComplete: false,
      expiresAt: '2030-01-01T00:00:00.000Z',
      nested: {
        credentials: {
          encryptedAccessToken: 'ciphertext-secret',
          clientSecret: 'client-secret',
        },
        headers: { Authorization: 'Bearer access-secret' },
        ciphertext: 'ciphertext-secret',
        authTag: 'auth-tag-secret',
        iv: 'iv-secret',
      },
    }) as Record<string, any>;

    expect(safe.authorizationUrl).toBe('https://bgm.tv/oauth/authorize?state=opaque');
    expect(safe.authorizationComplete).toBe(false);
    expect(safe.expiresAt).toBe('2030-01-01T00:00:00.000Z');
    expect(safe.nested.credentials).toBe('[REDACTED]');
    expect(safe.nested.headers.Authorization).toBe('[REDACTED]');
    expect(safe.nested.ciphertext).toBe('[REDACTED]');
    expect(safe.nested.authTag).toBe('[REDACTED]');
    expect(safe.nested.iv).toBe('[REDACTED]');
  });

  it('ST-24-ST-26: verified artifacts export without implicit overwrite', async () => {
    const artifactStore = new LocalArtifactStore({ artifactDir: path.join(tempDir, 'artifacts') });
    const host = await createTestHost({ artifactStore });
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x66, 0x69, 0x78, 0x74, 0x75, 0x72, 0x65,
    ]);
    const ref = await artifactStore.saveArtifact(png);
    const outputPath = path.join(tempDir, 'exported.png');
    await expect(host.exportArtifact(ref, outputPath)).resolves.toMatchObject({ path: outputPath });
    await expect(host.exportArtifact(ref, outputPath)).rejects.toMatchObject({ exitCode: 2 });
    await expect(host.exportArtifact(ref, outputPath, true)).resolves.toMatchObject({
      path: outputPath,
    });
    expect(fs.readFileSync(outputPath).subarray(0, 8)).toEqual(png.subarray(0, 8));
    await host.close();
  });

  it('parses quoted REPL input and global CLI flags', () => {
    expect(tokenizeCommandLine('search "少女終末旅行" --limit 5')).toEqual([
      'search',
      '少女終末旅行',
      '--limit',
      '5',
    ]);
    expect(parseCliArgs(['--profile', 'alice', '--json', 'status']).flags).toMatchObject({
      profile: 'alice',
      json: true,
    });
    expect(createStandaloneIdentity('alice')).toMatchObject({ conversationId: 'standalone:alice' });
  });

  it('OAUTH-PORT-01: an occupied OAuth port returns an actionable error', async () => {
    const host = await createTestHost();
    const occupied = net.createServer();
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', () => resolve());
    });
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('occupied port was not allocated');

    const controller = new StandaloneOAuthController({
      dependencies: host.getDependencies(),
      host: '127.0.0.1',
      port: address.port,
      callbackPath: BANGUMI_OAUTH_CALLBACK_PATH,
    });
    try {
      await expect(controller.start()).rejects.toThrow(
        `Standalone OAuth port ${address.port} is already in use`,
      );
    } finally {
      await controller.close();
      await host.close();
      await new Promise<void>((resolve, reject) => {
        occupied.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
