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
      filters: { category: 'main', includeDescriptions: false },
      summary: { returned: 2, withAirdate: 1, withDuration: 2 },
      coverage: {
        requestedMaxEpisodes: 2,
        observedRows: 4,
        returnedRows: 2,
        totalKind: 'exact',
        sourceTotal: 4,
        renderedOmitted: 2,
        missingFields: { 'episode.airdate': 1 },
        overReturnedRows: 2,
        sourceLimitMismatch: true,
      },
      items: [
        { id: 1, ep: 1, nameCn: '第一集', airdate: '2026-08-01', duration: '00:24:00' },
        { id: 2, ep: 2, nameCn: '第二集' },
      ],
      warnings: [{ code: 'MISSING_FIELDS', message: '有字段缺失。' }],
    });
    expect(output).toContain('章节指南');
    expect(output).toContain('类别 main');
    expect(output).toContain('读取上限 2');
    expect(output).toContain('覆盖');
    expect(output).toContain('第一集');
    expect(output).toContain('缺失字段');
  });

  it('routes and presents episode integrity with an explicit UTC as-of date', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'partial',
      subjectId: 123,
      subject: { nameCn: '中文条目' },
      asOf: { date: '2026-08-30', source: 'explicit' },
      integrity: {
        counts: { main: 2, special: 1, airedMain: 1, futureMain: 1 },
        dateCoverage: {
          asOfDate: '2026-08-30',
          validRows: 2,
          airedRows: 1,
          futureRows: 1,
          missingRows: 1,
          invalidRows: 1,
        },
        anomalies: {
          duplicateEpisodeIds: 0,
          duplicateLogicalKeys: 1,
          airdateConflictGroups: 1,
          nonMonotonicMainAirdates: 0,
        },
        checks: {
          reportedVsDatabase: { state: 'consistent', left: 2, right: 2 },
          reportedVsObservedMain: { state: 'partial', left: 2, right: 2 },
          reportedVsAiredMain: { state: 'different', left: 2, right: 1 },
        },
      },
      coverage: {
        episodeGuide: {
          observedRows: 3,
          uniqueRows: 3,
          returnedRows: 3,
          truncated: false,
        },
      },
      items: [
        { id: 1, ep: 1, nameCn: '第一集', airdate: '2026-08-01' },
        { id: 2, ep: 2, nameCn: '第二集', airdate: '2026-09-01' },
      ],
      warnings: [{ code: 'EPISODE_INTEGRITY_PARTIAL', message: '日期质量不完整。' }],
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      ['episode-integrity', '123', '--max-episodes', '8', '--as-of-date', '2026-08-30'],
      context(host),
    );
    await registry.execute(
      ['render', 'episode-integrity', '123', '--as-of-date', '2026-08-30'],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_episode_integrity',
      { subjectId: 123, maxEpisodes: 8, asOfDate: '2026-08-30' },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_episode_integrity',
      { subjectId: 123, asOfDate: '2026-08-30' },
      expect.anything(),
    );

    const output = formatHuman(
      executeTool.mock.results[0]?.value ? await executeTool.mock.results[0].value : {},
    );
    expect(output).toContain('章节完整性');
    expect(output).toContain('已播正篇');
    expect(output).toContain('日期冲突组');
    expect(output).toContain('UTC as-of');
  });
});
