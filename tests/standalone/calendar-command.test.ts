import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs } from '../../apps/standalone/src/command-parser.js';
import { Presenter } from '../../apps/standalone/src/presenter.js';
import type { StandaloneHost } from '../../apps/standalone/src/standalone-host.js';

function context(host: StandaloneHost): StandaloneCommandContext {
  return {
    host,
    flags: parseCliArgs(['--json', 'calendar']).flags,
    presenter: new Presenter({ stdout: process.stdout, stderr: process.stderr }),
    confirm: async () => false,
  };
}

describe('Standalone calendar commands', () => {
  it('routes bounded semantic and render inputs and advertises the contract', async () => {
    const executeTool = vi.fn().mockImplementation(async (name: string) => {
      if (name === 'bangumi.get_calendar_intelligence') return { state: 'complete' };
      if (name === 'bangumi.render_calendar') return { artifact: { id: 'calendar-fixture' } };
      throw new Error(`unexpected tool ${name}`);
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      ['calendar', '--weekday', '2', '--max-per-day', '4', '--max-total', '10'],
      context(host),
    );
    await registry.execute(
      ['render', 'calendar', '--weekday', '7', '--max-per-day', '2', '--max-total', '5'],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_calendar_intelligence',
      { weekday: 2, maxPerDay: 4, maxTotal: 10 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_calendar',
      { weekday: 7, maxPerDay: 2, maxTotal: 5 },
      expect.anything(),
    );

    await expect(registry.execute(['help'], context(host))).resolves.toMatchObject({
      value: expect.stringContaining('calendar [--weekday 1..7] [--max-per-day 1..8]'),
    });
  });

  it('rejects out-of-range, duplicate, and unknown calendar options', async () => {
    const host = { executeTool: vi.fn() } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(['calendar', '--weekday', '8'], context(host)),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('weekday must be an integer'),
    });
    await expect(
      registry.execute(['calendar', '--max-total', '2', '--max-total', '3'], context(host)),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('may only be specified once'),
    });
    await expect(
      registry.execute(['calendar', '--unknown', '3'], context(host)),
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('unknown calendar argument'),
    });
  });
});
