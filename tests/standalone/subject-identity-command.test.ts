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

describe('Standalone subject identity command', () => {
  it('routes semantic and renderer identity reads by known subject id', async () => {
    const executeTool = vi.fn().mockResolvedValue({ state: 'partial', subjectId: 41529 });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(['subject-identity', '41529'], context(host));
    await registry.execute(['render', 'identity', '41529'], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_identity',
      { subjectId: 41529 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_identity',
      { subjectId: 41529 },
      expect.anything(),
    );
  });

  it('presents identity, alias unknownness, coverage, and bounded limitations', () => {
    const human = formatHuman({
      subjectId: 41529,
      state: 'partial',
      data: {
        id: 41529,
        type: 2,
        typeLabel: 'anime',
        name: '少女終末旅行',
        nameCn: '',
        platform: 'TV',
        eps: 12,
        totalEpisodes: 12,
        images: { common: 'https://example.test/image.png' },
        infobox: {
          state: 'complete',
          aliases: { state: 'unknown', values: [], sourceKeys: [], sourceRowIndexes: [] },
          rows: [{ key: '原作', value: 'つくみず' }],
          coverage: {
            state: 'complete',
            observedRows: 1,
            returnedRows: 1,
            malformedRows: 0,
            omittedRows: 0,
            nestedValuesObserved: 0,
            nestedValuesReturned: 0,
            nestedValuesOmitted: 0,
          },
        },
      },
      coverage: {
        sourceRequestsAttempted: 1,
        sourceRequestsSucceeded: 1,
        responseLimitBytes: 1_048_576,
        fields: { returned: ['id', 'name'], missing: ['name_cn'] },
        infobox: { observedRows: 1, returnedRows: 1, omittedRows: 0 },
      },
      evidence: [{ source: 'official-v0', operation: 'getSubjectById', fieldPath: 'name' }],
      warnings: [{ code: 'ALIAS_UNKNOWN', state: 'partial', message: '不是没有别名。' }],
      limitations: ['缺少别名行不代表没有别名。', '只读取一次当前官方 v0。'],
      retrievedAt: '2026-08-30T00:00:00.000Z',
    });

    expect(human).toContain('条目身份与元数据');
    expect(human).toContain('别名: 未知');
    expect(human).toContain('覆盖: 官方请求 1/1 成功');
    expect(human).toContain('图片链接: 1 个（仅链接，未下载）');
    expect(human).not.toContain('https://example.test');
  });
});
