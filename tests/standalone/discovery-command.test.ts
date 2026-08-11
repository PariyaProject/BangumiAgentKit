import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import { tokenizeCommandLine, type CliFlags } from '../../apps/standalone/src/command-parser.js';
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
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  return {
    host,
    flags,
    presenter: new Presenter({ stdout, stderr }),
    confirm: async () => false,
  };
}

describe('Standalone discovery and raw tool playground', () => {
  it('maps discover flags to the shared query_subjects engine', async () => {
    const executeTool = vi.fn().mockResolvedValue({ state: 'ok', items: [], coverage: {} });
    const host = { executeTool } as unknown as StandaloneHost;
    await new StandaloneCommandRegistry().execute(
      [
        'discover',
        '--media',
        'anime',
        '--season',
        '2026-summer',
        '--concept',
        '后宫',
        '--all',
        '--explain',
      ],
      context(host),
    );
    expect(executeTool).toHaveBeenCalledWith(
      'bangumi.query_subjects',
      expect.objectContaining({
        media: 'anime',
        season: '2026-summer',
        concepts: ['后宫'],
        resultMode: 'all',
        explain: 'full',
        limit: 100,
      }),
      expect.anything(),
    );
  });

  it('PR-7D: person, staff, and person renderer commands route to semantic tools', async () => {
    const executeTool = vi.fn().mockResolvedValue({ state: 'ok' });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(['person', '10868'], context(host));
    await registry.execute(['staff', '226998'], context(host));
    await registry.execute(['render', 'person', '10868'], context(host));

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_person_profile',
      { personId: 10868 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.get_subject_staff',
      { subjectId: 226998 },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      3,
      'bangumi.render_person_profile',
      { personId: 10868 },
      expect.anything(),
    );
  });

  it('preserves the documented single-quoted raw JSON form and executes it through ToolRegistry', async () => {
    const tokens = tokenizeCommandLine(
      `tool call bangumi.search_subjects '{"query":"少女终末旅行"}'`,
    );
    expect(tokens).toEqual(['tool', 'call', 'bangumi.search_subjects', '{"query":"少女终末旅行"}']);
    const input = JSON.parse(tokens[3]!);
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 1, type: 2, name: 'Shoujo', name_cn: '少女终末旅行' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const deps = createRuntimeDependenciesWithStorage(new MemoryStorage(), {
      secretKey: 'test-secret-key-123456789012345678901234',
      publicHttpClient: new HttpClient({ fetchFn }),
    });
    const registry = new ToolRegistry(deps);
    const result = await registry.executeTool('bangumi.search_subjects', input, {
      principalId: 'test-principal',
      botInstanceId: 'test-bot',
      conversationId: 'test-conversation',
    });
    expect(result).toMatchObject({
      status: 'exact',
      candidates: [{ nameCn: '少女终末旅行' }],
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
