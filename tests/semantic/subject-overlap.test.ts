import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import type { SubjectOverlapResult } from '@bangumi-agent-kit/bangumi-core';
import { createReadTools, type ToolContext, type ToolDefinition } from '@bangumi-agent-kit/tools';

const context: ToolContext = {
  principalId: 'subject-overlap-test',
  botInstanceId: 'test',
  conversationId: 'test',
};

const subjectIds = [101, 102, 103] as const;

const subjects = Object.fromEntries(
  subjectIds.map((id) => [
    id,
    {
      id,
      type: 2,
      name: `Subject ${id}`,
      name_cn: `条目 ${id}`,
      summary: `Fixture ${id}`,
      nsfw: false,
      locked: false,
      date: `202${id - 100}-01-01`,
      platform: 'TV',
      eps: 12,
      total_episodes: 12,
      rating: { score: 8, rank: id, total: 100 },
      collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
    },
  ]),
);

const characters: Record<number, unknown[]> = {
  101: [
    {
      id: 1001,
      name: '主角 101',
      type: 1,
      relation: '主角',
      actors: [
        { id: 900, name: '共同主役', career: ['seiyuu'], images: {} },
        { id: 901, name: '独有配角', career: ['seiyuu'], images: {} },
      ],
    },
  ],
  102: [
    {
      id: 1002,
      name: '主角 102',
      type: 1,
      relation: '主役',
      actors: [{ id: 900, name: '共同主役', career: ['seiyuu'], images: {} }],
    },
    {
      id: 1003,
      name: '另一主角 102',
      type: 1,
      relation: '主角',
      actors: [{ id: 902, name: '另一共同主役', career: ['seiyuu'], images: {} }],
    },
  ],
  103: [
    {
      id: 1004,
      name: '主角 103',
      type: 1,
      relation: '主角',
      actors: [{ id: 902, name: '另一共同主役', career: ['seiyuu'], images: {} }],
    },
    {
      id: 1005,
      name: '未分类角色 103',
      type: 1,
      relation: '客串',
      actors: [{ id: 903, name: '未知角色声优', career: ['seiyuu'], images: {} }],
    },
  ],
};

const persons: Record<number, unknown[]> = {
  101: [
    { id: 910, name: '共同导演', type: 1, career: ['director'], relation: '导演', images: {} },
    { id: 911, name: '独有脚本', type: 1, career: ['writer'], relation: '脚本', images: {} },
  ],
  102: [
    { id: 910, name: '共同导演', type: 1, career: ['director'], relation: '导演', images: {} },
    { id: 912, name: '另一共同脚本', type: 1, career: ['writer'], relation: '脚本', images: {} },
  ],
  103: [
    { id: 912, name: '另一共同脚本', type: 1, career: ['writer'], relation: '脚本', images: {} },
    { id: 913, name: '独有音乐', type: 1, career: ['music'], relation: '音乐', images: {} },
  ],
};

function buildClient(): HttpClient {
  return new HttpClient({
    fetchFn: async (input) => {
      const url = String(input);
      const match = url.match(/\/v0\/subjects\/(\d+)(?:\/([^/?]+))?$/u);
      const subjectId = match ? Number(match[1]) : undefined;
      const endpoint = match?.[2];
      if (!subjectId || !subjects[subjectId]) {
        return new Response(JSON.stringify({ error: 'missing fixture' }), { status: 404 });
      }
      if (!endpoint) return new Response(JSON.stringify(subjects[subjectId]), { status: 200 });
      if (endpoint === 'characters') {
        return new Response(JSON.stringify(characters[subjectId]), { status: 200 });
      }
      if (endpoint === 'persons') {
        return new Response(JSON.stringify(persons[subjectId]), { status: 200 });
      }
      if (endpoint === 'subjects') return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ error: 'unknown fixture endpoint' }), { status: 404 });
    },
  });
}

function getTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find((item) => item.name === 'bangumi.get_subject_overlap');
  if (!tool) throw new Error('subject overlap tool was not registered');
  return tool;
}

describe('bangumi.get_subject_overlap', () => {
  it('ranks bounded cast pairs and computes complete observed overlap ratios', async () => {
    const tool = getTool(buildClient());
    expect(tool.input.safeParse({ subjectIds: [101] }).success).toBe(false);
    expect(tool.input.safeParse({ subjectIds: [101, 101] }).success).toBe(false);
    expect(
      tool.input.safeParse({ subjectIds: Array.from({ length: 9 }, (_, i) => i + 1) }).success,
    ).toBe(false);

    const result = (await tool.execute(
      { subjectIds: [...subjectIds], kind: 'cast', castRole: 'main', maxCast: 4, maxPeople: 10 },
      context,
    )) as SubjectOverlapResult;

    expect(result).toMatchObject({
      state: 'partial',
      kind: 'cast',
      castRole: 'main',
      subjectIds: [101, 102, 103],
      formulaVersion: 'subject-overlap-v1',
      coverage: { requestedSubjects: 3, requestedPairs: 3, returnedPairs: 3 },
    });
    const first = result.pairs.find((pair) => pair.pairId === '101:102');
    expect(first).toMatchObject({
      rankScore: 1,
      cast: {
        state: 'complete',
        coverage: { candidateIds: 3, matchedIds: 1, unionIds: 3, overlapRate: 1 / 3 },
        items: [{ personId: 900, matchBasis: 'recognized_main_role' }],
      },
    });
    const partial = result.pairs.find((pair) => pair.pairId === '102:103');
    expect(partial?.cast).toMatchObject({ state: 'partial' });
    expect(partial?.cast?.coverage.overlapRate).toBeUndefined();
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          operation: 'subject-overlap-composition',
          formulaVersion: 'subject-overlap-v1',
          subjectIds: [101, 102, 103],
        }),
      ]),
    );
  });

  it('preserves staff evidence and ranks staff intersections independently', async () => {
    const result = (await getTool(buildClient()).execute(
      { subjectIds: [...subjectIds], kind: 'staff', maxStaff: 4, maxPeople: 10 },
      context,
    )) as SubjectOverlapResult;
    const first = result.pairs.find((pair) => pair.pairId === '101:102');
    expect(first).toMatchObject({
      rankScore: 1,
      staff: {
        state: 'complete',
        coverage: { candidateIds: 3, matchedIds: 1, unionIds: 3, overlapRate: 1 / 3 },
        items: [
          {
            personId: 910,
            credits: [
              { subjectId: 101, rawRelations: ['导演'] },
              { subjectId: 102, rawRelations: ['导演'] },
            ],
          },
        ],
      },
    });
    expect(first?.cast).toBeUndefined();
  });

  it('keeps all-cast overlap complete when an unclassified role is retained', async () => {
    const result = (await getTool(buildClient()).execute(
      { subjectIds: [101, 103], kind: 'cast', castRole: 'all', maxCast: 4, maxPeople: 10 },
      context,
    )) as SubjectOverlapResult;
    expect(result.state).toBe('complete');
    expect(result.warnings).toEqual([]);
    expect(result.pairs[0]).toMatchObject({
      cast: {
        state: 'complete',
        coverage: { matchedIds: 0, unionIds: 4, overlapRate: 0 },
      },
    });
  });

  it('marks the result partial when the pair output is bounded', async () => {
    const result = (await getTool(buildClient()).execute(
      { subjectIds: [...subjectIds], kind: 'staff', maxPairs: 1 },
      context,
    )) as SubjectOverlapResult;
    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({ requestedPairs: 3, returnedPairs: 1, omittedPairs: 2 });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PAIR_LIMIT_REACHED' })]),
    );
  });
});
