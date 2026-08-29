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

describe('Standalone subject overlap commands', () => {
  it('dispatches bounded semantic and renderer routes with multiple subject IDs', async () => {
    const executeTool = vi.fn().mockResolvedValue({
      state: 'partial',
      subjectIds: [101, 102, 103],
      subjects: [],
      pairs: [],
      kind: 'cast',
      castRole: 'main',
      artifact: { id: 'overlap-fixture' },
    });
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await registry.execute(
      [
        'overlap',
        '101',
        '102',
        '103',
        '--kind',
        'cast',
        '--cast-role',
        'main',
        '--max-pairs',
        '6',
        '--max-people',
        '10',
      ],
      context(host),
    );
    await registry.execute(
      ['render', 'overlap', '101', '102', '--kind', 'staff', '--max-staff', '20'],
      context(host),
    );

    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_subject_overlap',
      {
        subjectIds: [101, 102, 103],
        kind: 'cast',
        castRole: 'main',
        maxPairs: 6,
        maxPeople: 10,
      },
      expect.anything(),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_subject_overlap',
      { subjectIds: [101, 102], kind: 'staff', maxStaff: 20 },
      expect.anything(),
    );
  });

  it('rejects invalid subject counts, duplicate IDs, and overlap options', async () => {
    const executeTool = vi.fn();
    const host = { executeTool } as unknown as StandaloneHost;
    const registry = new StandaloneCommandRegistry();

    await expect(registry.execute(['overlap', '101'], context(host))).rejects.toMatchObject({
      exitCode: 2,
    });
    await expect(registry.execute(['overlap', '101', '101'], context(host))).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('must be different'),
    });
    await expect(
      registry.execute(['overlap', '101', '102', '--cast-role', 'support'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(['render', 'overlap', '101', '102', '--max-people', '25'], context(host)),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it('presents pair coverage, ratios, role evidence, and limits', () => {
    const output = formatHuman({
      state: 'partial',
      subjectIds: [101, 102],
      kind: 'cast',
      castRole: 'main',
      subjects: [
        {
          subjectId: 101,
          state: 'complete',
          subject: { nameCn: '作品一' },
          coverage: { cast: { returned: 2, observed: 2 }, staff: { returned: 1, observed: 1 } },
        },
        {
          subjectId: 102,
          state: 'complete',
          subject: { nameCn: '作品二' },
          coverage: { cast: { returned: 2, observed: 2 }, staff: { returned: 1, observed: 1 } },
        },
      ],
      pairs: [
        {
          pairId: '101:102',
          leftSubjectId: 101,
          rightSubjectId: 102,
          rank: 1,
          rankScore: 1,
          rankBasis: 'cast_matched_ids',
          cast: {
            state: 'complete',
            coverage: {
              state: 'complete',
              left: { subjectId: 101, rowsReturned: 2, rowsObserved: 2 },
              right: { subjectId: 102, rowsReturned: 2, rowsObserved: 2 },
              matchedIds: 1,
              unionIds: 3,
              overlapRate: 1 / 3,
              returned: 1,
              omitted: 0,
            },
            items: [
              {
                personId: 900,
                name: '共同主役',
                credits: [
                  { subjectId: 101, characters: [{ name: '角色一', relation: '主角' }] },
                  { subjectId: 102, characters: [{ name: '角色二', relation: '主役' }] },
                ],
              },
            ],
          },
        },
      ],
      coverage: {
        returnedSubjects: 2,
        requestedSubjects: 2,
        returnedPairs: 1,
        requestedPairs: 1,
        omittedPairs: 0,
        truncated: false,
        limits: { maxCast: 24, maxStaff: 48, maxPairs: 28, maxPeople: 24 },
      },
      source: {
        official: { operations: ['GET /v0/subjects/{subject_id}'], retrievedAt: '2026-08-29' },
        derived: { operations: ['subject-overlap-composition'], retrievedAt: '2026-08-29' },
      },
      warnings: [],
      limitations: ['不代表完整演职员表。'],
    });
    expect(output).toContain('条目关系重合');
    expect(output).toContain('重合 33.3%');
    expect(output).toContain('共同主役');
    expect(output).toContain('不代表完整演职员表');
  });
});
