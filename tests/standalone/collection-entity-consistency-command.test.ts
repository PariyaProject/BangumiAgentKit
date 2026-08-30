import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs } from '../../apps/standalone/src/command-parser.js';
import { Presenter } from '../../apps/standalone/src/presenter.js';

function context(executeTool: ReturnType<typeof vi.fn>): StandaloneCommandContext {
  return {
    host: { executeTool } as never,
    flags: parseCliArgs(['--json', 'collection', 'consistency']).flags,
    presenter: new Presenter({ stdout: process.stdout, stderr: process.stderr }),
    confirm: async () => false,
  };
}

describe('Standalone collection consistency commands', () => {
  it('routes bounded semantic and render options and advertises the route', async () => {
    const executeTool = vi.fn().mockImplementation(async (name: string) => {
      if (name === 'bangumi.get_collection_entity_consistency') return { state: 'complete' };
      if (name === 'bangumi.render_collection_entity_consistency') {
        return { artifact: { id: 'consistency-fixture' } };
      }
      throw new Error(`unexpected tool ${name}`);
    });
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(
        [
          'collection',
          'consistency',
          '--subject-type',
          'anime',
          '--status',
          'done',
          '--max-subjects',
          '12',
          '--max-pages',
          '3',
          '--max-relations',
          '20',
          '--max-output',
          '30',
        ],
        context(executeTool),
      ),
    ).resolves.toMatchObject({ value: { state: 'complete' } });
    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_collection_entity_consistency',
      {
        subjectType: 'anime',
        status: 'done',
        maxSubjects: 12,
        maxSubjectPages: 3,
        maxRelationsPerSubject: 20,
        maxOutputRows: 30,
      },
      expect.anything(),
    );

    await expect(
      registry.execute(
        ['render', 'collection-consistency', '--max-pages', '2', '--max-output', '10'],
        context(executeTool),
      ),
    ).resolves.toMatchObject({ value: { artifact: { id: 'consistency-fixture' } } });
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_collection_entity_consistency',
      { maxSubjectPages: 2, maxOutputRows: 10 },
      expect.anything(),
    );

    await expect(registry.execute(['help'], context(executeTool))).resolves.toMatchObject({
      value: expect.stringContaining('collection consistency'),
    });
  });

  it('rejects unsupported consistency options before tool execution', async () => {
    const executeTool = vi.fn();
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(['collection', 'consistency', '--max-pages', '9'], context(executeTool)),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(
        ['collection', 'consistency', '--subject-type', 'movie'],
        context(executeTool),
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(
        ['collection', 'consistency', '--username', 'someone-else'],
        context(executeTool),
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(executeTool).not.toHaveBeenCalled();
  });
});
