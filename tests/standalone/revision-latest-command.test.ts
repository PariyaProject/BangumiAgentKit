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

const result = {
  state: 'partial',
  subjectId: 41529,
  selection: { strategy: 'offset-zero-source-order', limit: 1, offset: 0, revisionId: 1567985 },
  list: {
    state: 'partial',
    observed: 1,
    returned: 1,
    total: 21,
    totalKind: 'exact',
    truncated: true,
  },
  revision: {
    id: 1567985,
    type: 1,
    summary: '内容扩充',
    createdAt: '2025-06-08T00:00:00Z',
    creator: { nickname: '编辑者' },
  },
  detail: {
    state: 'complete',
    payload: {
      state: 'complete',
      observedFields: 1,
      returnedFields: 1,
      omittedFields: 0,
      truncatedFields: 0,
      fields: [{ key: 'name_cn', value: '少女终末旅行', truncated: false }],
    },
  },
  source: {
    class: 'official-v0',
    operations: [
      { operation: 'GET /v0/revisions/subjects' },
      { operation: 'GET /v0/revisions/subjects/1567985' },
    ],
  },
  evidence: [{ source: 'official-v0', operation: 'GET /v0/revisions/subjects' }],
  warnings: [
    { code: 'SOURCE_ORDER_BOUNDED', state: 'partial', message: '源排序未保证。' },
    { code: 'EXACT_DIFF_UNSUPPORTED', state: 'partial', message: '精确差异不可计算。' },
  ],
  limitations: ['只选择一条源顺序记录。', '不重建 before/after 差异。'],
};

describe('Standalone latest revision command', () => {
  it('routes the semantic command and renderer alias with a bounded subject id', async () => {
    const executeTool = vi.fn().mockImplementation(async (name: string) => {
      if (name === 'bangumi.get_latest_subject_revision') return result;
      return { artifact: { id: 'latest-revision-fixture', width: 640 } };
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(['revision-latest', '41529'], context(host));
    await registry.execute(['render', 'latest-revision', '41529'], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_latest_subject_revision',
      { subjectId: 41529 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_latest_subject_revision',
      { subjectId: 41529 },
      expect.anything(),
    );
    await expect(registry.execute(['revision-latest', '0'], context(host))).rejects.toMatchObject({
      exitCode: 2,
    });
  });

  it('documents the command in help and presents explicit bounded evidence', async () => {
    const registry = new StandaloneCommandRegistry();
    const host = {} as StandaloneHost;
    const help = await registry.execute(['help'], context(host));
    expect(help.value).toContain('revision-latest <subjectId>');
    expect(help.value).toContain('render subject|subject-identity|revision-latest');

    const human = formatHuman({
      ...result,
      detail: {
        ...result.detail,
        payload: {
          ...result.detail.payload,
          fields: Array.from({ length: 32 }, (_, index) => ({
            key: `字段-${index}`,
            value: '长值'.repeat(2_000),
            truncated: true,
          })),
          observedFields: 32,
          returnedFields: 32,
        },
      },
    });

    expect(human).toContain('条目最新修订证据');
    expect(human).toContain('offset=0');
    expect(human).toContain('before/after');
    expect(human).toContain('GET /v0/revisions/subjects/1567985');
    expect(human.length).toBeLessThan(24_000);
    expect(human.split('\n').length).toBeLessThanOrEqual(80);
  });
});
