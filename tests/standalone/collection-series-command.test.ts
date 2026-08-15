import { describe, expect, it } from 'vitest';
import { StandaloneCommandRegistry } from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs } from '../../apps/standalone/src/command-parser.js';
import { Presenter } from '../../apps/standalone/src/presenter.js';

describe('Standalone collection series commands', () => {
  it('dispatches bounded semantic and render inputs and advertises the routes', async () => {
    let semanticInput: Record<string, unknown> | undefined;
    let renderInput: Record<string, unknown> | undefined;
    const host = {
      executeTool: async (name: string, input: Record<string, unknown>) => {
        if (name === 'bangumi.get_collection_series_groups') {
          semanticInput = input;
          return { state: 'complete' };
        }
        if (name === 'bangumi.render_collection_series_groups') {
          renderInput = input;
          return { artifact: { id: 'series-fixture' } };
        }
        throw new Error('unexpected tool ' + name);
      },
    };
    const presenter = new Presenter({ stdout: process.stdout, stderr: process.stderr });
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(
        [
          'collection',
          'series',
          '--max-items',
          '10',
          '--max-relation-subjects',
          '4',
          '--max-relations-per-subject',
          '8',
          '--max-groups',
          '3',
          '--max-edges',
          '12',
          '--status',
          'wish,done',
        ],
        {
          host: host as never,
          flags: parseCliArgs(['--json', 'collection', 'series']).flags,
          presenter,
          confirm: async () => false,
        },
      ),
    ).resolves.toMatchObject({ value: { state: 'complete' } });
    expect(semanticInput).toEqual({
      maxItems: 10,
      maxRelationSubjects: 4,
      maxRelationsPerSubject: 8,
      maxGroups: 3,
      maxEdges: 12,
      statuses: ['wish', 'done'],
    });

    await expect(
      registry.execute(['render', 'collection-series', '--max-items', '7', '--max-edges', '9'], {
        host: host as never,
        flags: parseCliArgs(['--json', 'render', 'collection-series']).flags,
        presenter,
        confirm: async () => false,
      }),
    ).resolves.toMatchObject({ value: { artifact: { id: 'series-fixture' } } });
    expect(renderInput).toEqual({ maxItems: 7, maxEdges: 9 });

    await expect(
      registry.execute(['help'], {
        host: host as never,
        flags: parseCliArgs(['--json', 'help']).flags,
        presenter,
        confirm: async () => false,
      }),
    ).resolves.toMatchObject({
      value: expect.stringContaining('collection series'),
    });
  });
});
