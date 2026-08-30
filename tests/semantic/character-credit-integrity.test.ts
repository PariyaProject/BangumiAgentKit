import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function findTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find(
    (candidate) => candidate.name === 'bangumi.get_character_credit_integrity',
  );
  if (!tool) throw new Error('character credit integrity tool was not registered');
  return tool;
}

describe('bangumi.get_character_credit_integrity', () => {
  it('is a bounded public read tool with stable-ID collision semantics', async () => {
    const paths: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith('/characters/100')) {
        return json({ id: 100, name: '角色', type: 1, summary: '简介', locked: false, stat: {} });
      }
      if (path.endsWith('/characters/100/subjects')) {
        return json([
          { id: 10, type: 2, name: '同名作品', name_cn: '同名作品', staff: '主角', eps: '1' },
          { id: 11, type: 2, name: '同名作品', name_cn: '同名作品', staff: '配角', eps: '2' },
        ]);
      }
      if (path.endsWith('/characters/100/persons')) {
        return json([
          {
            id: 20,
            name: '同名人物',
            type: 1,
            subject_id: 10,
            subject_type: 2,
            subject_name: '同名作品',
            subject_name_cn: '同名作品',
            staff: '声优',
          },
          {
            id: 21,
            name: '同名人物',
            type: 1,
            subject_id: 11,
            subject_type: 2,
            subject_name: '同名作品',
            subject_name_cn: '同名作品',
            staff: '声优',
          },
        ]);
      }
      return json({ message: 'unexpected' }, 500);
    };
    const client = new HttpClient({ fetchFn });
    const tool = findTool(client);

    expect(tool.auth).toBe('none');
    expect(tool.scopes).toEqual([]);
    expect(tool.input.safeParse({ characterId: 100, maxSubjects: 2, maxPersons: 2 }).success).toBe(
      true,
    );
    expect(tool.input.safeParse({ characterId: 100, maxSubjects: 65 }).success).toBe(false);
    expect(tool.input.safeParse({ characterId: 100, username: 'someone-else' }).success).toBe(
      false,
    );

    const result = (await tool.execute(
      { characterId: 100, maxSubjects: 1, maxPersons: 1 },
      { principalId: 'reader', botInstanceId: 'bot', conversationId: 'conversation' },
    )) as Record<string, any>;

    expect(result).toMatchObject({
      character: { id: 100, name: '角色' },
      coverage: {
        output: { maxSubjects: 1, maxPersons: 1, returnedSubjects: 1, returnedPersons: 1 },
      },
    });
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'same_name_distinct_ids', entity: 'subject' }),
        expect.objectContaining({ kind: 'same_name_distinct_ids', entity: 'person' }),
      ]),
    );
    expect(paths).toHaveLength(3);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/v0/characters/100',
        '/v0/characters/100/subjects',
        '/v0/characters/100/persons',
      ]),
    );
  });
});
