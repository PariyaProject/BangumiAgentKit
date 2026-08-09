import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
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
});
