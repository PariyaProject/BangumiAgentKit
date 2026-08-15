import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import type { CliFlags } from '../../apps/standalone/src/command-parser.js';
import { Presenter } from '../../apps/standalone/src/presenter.js';
import type { StandaloneHost } from '../../apps/standalone/src/standalone-host.js';

const flags: CliFlags = {
  json: true,
  verbose: false,
  force: false,
  interactive: false,
  help: false,
  profile: 'test',
  online: false,
  auth: false,
  render: false,
};

function context(host: StandaloneHost): StandaloneCommandContext {
  return {
    host,
    flags,
    presenter: new Presenter({ stdout: new PassThrough(), stderr: new PassThrough() }),
    confirm: async () => false,
  };
}

describe('Standalone subject comparison commands', () => {
  it('routes semantic and renderer comparison commands with bounded options', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'partial',
      subjectIds: [123, 456],
      metrics: [],
      artifact: { id: 'comparison-fixture' },
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      ['compare', '123', '456', '--max-cast', '4', '--max-staff', '12', '--max-relations', '6'],
      context(host),
    );
    await registry.execute(
      [
        'render',
        'compare',
        '123',
        '456',
        '--max-cast',
        '3',
        '--max-staff',
        '10',
        '--max-relations',
        '5',
      ],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_comparison',
      { subjectIds: [123, 456], maxCast: 4, maxStaff: 12, maxRelations: 6 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_comparison',
      { subjectIds: [123, 456], maxCast: 3, maxStaff: 10, maxRelations: 5 },
      expect.anything(),
    );
  });

  it('rejects duplicate IDs and out-of-range comparison caps before tool execution', async () => {
    const executeTool = vi.fn();
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await expect(registry.execute(['compare', '123', '123'], context(host))).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('subject ids must be different'),
    });
    await expect(
      registry.execute(['render', 'compare', '123', '456', '--max-cast', '21'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(executeTool).not.toHaveBeenCalled();
  });
});
