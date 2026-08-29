import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { MemoryStorage } from '../../packages/db/src/index.js';
import {
  createRuntimeDependenciesWithStorage,
  defineTool,
} from '../../packages/tools/src/index.js';
import { LocalArtifactStore } from '../../packages/renderer/src/index.js';
import { StandaloneCommandRegistry } from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs } from '../../apps/standalone/src/command-parser.js';
import { StandaloneHost } from '../../apps/standalone/src/standalone-host.js';
import { Presenter } from '../../apps/standalone/src/presenter.js';

describe('standalone person collaboration commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-collaboration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function createHost(): Promise<StandaloneHost> {
    const storage = new MemoryStorage();
    const artifactStore = new LocalArtifactStore({ artifactDir: path.join(tempDir, 'artifacts') });
    const dependencies = createRuntimeDependenciesWithStorage(storage, {
      secretKey: 'standalone-collaboration-test-key-012345678901234567890123456789',
      redirectUri: 'http://127.0.0.1:0/oauth/bangumi/callback',
      artifactStore,
    });
    return await StandaloneHost.create({
      profile: 'default',
      storage,
      dependencies,
      artifactStore,
      startOAuthServer: false,
    });
  }

  it('dispatches bounded collaboration read and render routes with parsed filters', async () => {
    let readInput: Record<string, unknown> | undefined;
    let renderInput: Record<string, unknown> | undefined;
    const host = await createHost();
    host.getRegistry().registerTool(
      defineTool({
        name: 'bangumi.get_person_collaboration',
        description: 'collaboration read fixture',
        input: z.object({}).passthrough(),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async (input) => {
          readInput = input;
          return { state: 'complete', collaborators: [] };
        },
      }),
    );
    host.getRegistry().registerTool(
      defineTool({
        name: 'bangumi.render_person_collaboration',
        description: 'collaboration render fixture',
        input: z.object({}).passthrough(),
        auth: 'none',
        scopes: [],
        risk: 'read',
        execute: async (input) => {
          renderInput = input;
          return {
            artifact: {
              id: 'collaboration-fixture',
              mimeType: 'image/png',
              width: 640,
              height: 480,
            },
          };
        },
      }),
    );
    const commandRegistry = new StandaloneCommandRegistry();
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const readArgs = [
      'collaborators',
      '20',
      '--kind',
      'staff',
      '--media',
      'all',
      '--target-role',
      '导演',
      '--collaborator-role',
      '编剧',
      '--max-subjects',
      '3',
      '--max-shared-subjects',
      '7',
    ];
    const context = {
      host,
      flags: parseCliArgs(['--json', ...readArgs]).flags,
      presenter,
      confirm: async () => false,
    };

    await expect(commandRegistry.execute(readArgs, context)).resolves.toMatchObject({
      value: { state: 'complete' },
    });
    expect(readInput).toEqual({
      personId: 20,
      kind: 'staff',
      media: 'all',
      targetRole: '导演',
      collaboratorRole: '编剧',
      maxSubjects: 3,
      maxSharedSubjects: 7,
    });

    const renderArgs = [
      'render',
      'collaboration',
      '20',
      '--kind',
      'voice',
      '--max-collaborators',
      '5',
    ];
    const renderContext = {
      ...context,
      flags: parseCliArgs(['--json', ...renderArgs]).flags,
    };
    await expect(commandRegistry.execute(renderArgs, renderContext)).resolves.toMatchObject({
      value: { artifact: { id: 'collaboration-fixture' } },
    });
    expect(renderInput).toEqual({ personId: 20, kind: 'voice', maxCollaborators: 5 });
    await host.close();
  });
});
