import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import type { CliFlags } from '../../apps/standalone/src/command-parser.js';
import { Presenter, formatHuman } from '../../apps/standalone/src/presenter.js';
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

describe('Standalone episode guide commands', () => {
  it('routes semantic and renderer commands with bounded options', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'complete',
      subjectId: 123,
      summary: { returned: 1, withAirdate: 1, withDuration: 1 },
      coverage: { observedRows: 1, returnedRows: 1, totalKind: 'exact', sourceTotal: 1 },
      items: [{ id: 1, ep: 1, nameCn: '第一集', airdate: '2026-08-01', duration: '00:24:00' }],
      warnings: [],
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      ['episode-guide', '123', '--category', 'main', '--max-episodes', '12', '--no-descriptions'],
      context(host),
    );
    await registry.execute(
      ['render', 'episode-guide', '123', '--category', 'sp', '--max-episodes', '8'],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_episode_guide',
      { subjectId: 123, category: 'main', maxEpisodes: 12, includeDescriptions: false },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_episode_guide',
      { subjectId: 123, category: 'sp', maxEpisodes: 8 },
      expect.anything(),
    );
  });

  it('presents bounded episode coverage instead of dumping the full raw object', () => {
    const output = formatHuman({
      state: 'partial',
      subjectId: 123,
      subject: { nameCn: '中文条目' },
      summary: { returned: 2, withAirdate: 1, withDuration: 2 },
      coverage: {
        observedRows: 4,
        returnedRows: 2,
        totalKind: 'exact',
        sourceTotal: 4,
        renderedOmitted: 2,
        missingFields: { 'episode.airdate': 1 },
      },
      items: [
        { id: 1, ep: 1, nameCn: '第一集', airdate: '2026-08-01', duration: '00:24:00' },
        { id: 2, ep: 2, nameCn: '第二集' },
      ],
      warnings: [{ code: 'MISSING_FIELDS', message: '有字段缺失。' }],
    });
    expect(output).toContain('章节指南');
    expect(output).toContain('覆盖');
    expect(output).toContain('第一集');
    expect(output).toContain('缺失字段');
  });
});
