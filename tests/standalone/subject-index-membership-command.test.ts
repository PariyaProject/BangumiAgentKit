import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import type { CliFlags } from '../../apps/standalone/src/command-parser.js';
import { formatHuman, Presenter } from '../../apps/standalone/src/presenter.js';
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

describe('Standalone subject index membership command', () => {
  it('routes bounded semantic and render inputs', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'complete',
      artifact: { id: 'membership-fixture' },
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      [
        'subject-index-membership',
        '41529',
        '--index',
        '77',
        '--index',
        '88',
        '--page-size',
        '2',
        '--max-pages',
        '3',
        '--max-rows',
        '5',
      ],
      context(host),
    );
    await registry.execute(
      ['render', 'subject-index-membership', '41529', '--index', '77', '--max-pages', '2'],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_index_membership',
      { subjectId: 41529, indexIds: [77, 88], pageSize: 2, maxPages: 3, maxRows: 5 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_index_membership',
      { subjectId: 41529, indexIds: [77], maxPages: 2 },
      expect.anything(),
    );
  });

  it('presents observed-scope semantics and coverage', () => {
    const human = formatHuman({
      subjectId: 41529,
      state: 'partial',
      indexes: [
        {
          indexId: 77,
          state: 'partial',
          membership: 'unknown',
          matches: [],
          coverage: {
            pagesSucceeded: 1,
            pagesAttempted: 1,
            rowsReturned: 50,
            truncated: true,
            completionReason: 'page_cap',
          },
        },
      ],
      summary: { requested: 1, matched: 0, notMatchedInObservedScope: 0, unknown: 1 },
      coverage: {
        indexesComplete: 0,
        indexesPartial: 1,
        indexesUnavailable: 0,
        requestsSucceeded: 1,
        requestsAttempted: 1,
        responseLimitBytes: 1_048_576,
      },
      source: { operations: ['GET /v0/indices/{index_id}/subjects'] },
      warnings: [],
      limitations: ['只扫描调用方提供的 indexIds。'],
    });

    expect(human).toContain('条目目录归属观察');
    expect(human).toContain('未知（未完整扫描）');
    expect(human).toContain('未匹配不是所有目录中的全局否定');
    expect(human).toContain('响应上限 1048576 bytes');
  });
});
