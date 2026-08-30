import { describe, expect, it, vi } from 'vitest';
import {
  StandaloneCommandRegistry,
  type StandaloneCommandContext,
} from '../../apps/standalone/src/command-registry.js';
import { parseCliArgs } from '../../apps/standalone/src/command-parser.js';
import { formatHuman, Presenter } from '../../apps/standalone/src/presenter.js';

function context(executeTool: ReturnType<typeof vi.fn>): StandaloneCommandContext {
  return {
    host: { executeTool } as never,
    flags: parseCliArgs(['--json', 'character-integrity', '100']).flags,
    presenter: new Presenter({ stdout: process.stdout, stderr: process.stderr }),
    confirm: async () => false,
  };
}

describe('Standalone character integrity commands', () => {
  it('routes semantic and render commands with bounded options', async () => {
    const executeTool = vi.fn().mockImplementation(async (name: string) => {
      if (name === 'bangumi.get_character_credit_integrity') return { state: 'complete' };
      if (name === 'bangumi.render_character_credit_integrity') {
        return { artifact: { id: 'character-integrity-fixture' } };
      }
      throw new Error(`unexpected tool ${name}`);
    });
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(
        ['character-integrity', '100', '--max-subjects', '12', '--max-persons', '8'],
        context(executeTool),
      ),
    ).resolves.toMatchObject({ value: { state: 'complete' } });
    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      'bangumi.get_character_credit_integrity',
      { characterId: 100, maxSubjects: 12, maxPersons: 8 },
      expect.anything(),
    );

    await expect(
      registry.execute(
        ['render', 'character-credits', '100', '--max-subjects', '4'],
        context(executeTool),
      ),
    ).resolves.toMatchObject({ value: { artifact: { id: 'character-integrity-fixture' } } });
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      'bangumi.render_character_credit_integrity',
      { characterId: 100, maxSubjects: 4 },
      expect.anything(),
    );

    await expect(registry.execute(['help'], context(executeTool))).resolves.toMatchObject({
      value: expect.stringContaining('character-integrity'),
    });
  });

  it('rejects unknown or out-of-range character integrity options', async () => {
    const executeTool = vi.fn();
    const registry = new StandaloneCommandRegistry();

    await expect(
      registry.execute(['character-integrity', '100', '--max-persons', '65'], context(executeTool)),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(
      registry.execute(
        ['character-integrity', '100', '--username', 'someone-else'],
        context(executeTool),
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('reports standalone nested omissions and duplicate relation evidence', () => {
    const output = formatHuman({
      state: 'complete',
      character: { id: 100, name: '角色' },
      subjectCredits: [{ id: 10, nameCn: '作品', name: '作品', staff: '主角', duplicateRows: 0 }],
      personCredits: [
        {
          id: 20,
          name: 'CV',
          duplicateRows: 5,
          duplicateRelationRows: 1,
          subjects: Array.from({ length: 6 }, (_, index) => ({
            subjectId: index + 10,
            subjectName: `作品${index}`,
            subjectNameCn: `作品${index}`,
          })),
          subjectsOmitted: 0,
        },
      ],
      risks: [],
      coverage: {
        subjects: { returnedRows: 1, uniqueIdsObserved: 1 },
        persons: { returnedRows: 1, uniqueIdsObserved: 1 },
        output: { risksReturned: 0, risksOmitted: 0, truncated: false },
      },
      operationEvidence: [],
    });

    expect(output).toContain('显示: 部分');
    expect(output).toContain('CV作品关系省略 2');
    expect(output).toContain('同作品关系重复 1');
  });

  it('counts relations belonging to people hidden by the presentation cap', () => {
    const personCredits = Array.from({ length: 13 }, (_, personIndex) => ({
      id: 200 + personIndex,
      name: `CV ${personIndex}`,
      duplicateRows: 0,
      duplicateRelationRows: 0,
      subjects: Array.from({ length: personIndex === 12 ? 3 : 1 }, (_, subjectIndex) => ({
        subjectId: 1_000 + personIndex * 10 + subjectIndex,
        subjectName: `作品 ${personIndex}-${subjectIndex}`,
        subjectNameCn: `作品 ${personIndex}-${subjectIndex}`,
      })),
      subjectsOmitted: 0,
    }));
    const output = formatHuman({
      state: 'complete',
      character: { id: 100, name: '角色' },
      subjectCredits: [],
      personCredits,
      risks: [],
      coverage: {
        subjects: { returnedRows: 0, uniqueIdsObserved: 0 },
        persons: { returnedRows: 13, uniqueIdsObserved: 13 },
        output: {
          returnedPersons: 13,
          returnedPersonSubjectCredits: 15,
          omittedPersonSubjectCredits: 0,
          risksReturned: 0,
          risksOmitted: 0,
          truncated: false,
        },
      },
      operationEvidence: [],
    });

    expect(output).toContain('显示: 部分');
    expect(output).toContain('人物省略 3');
    expect(output).toContain('CV作品关系省略 5');
  });
});
