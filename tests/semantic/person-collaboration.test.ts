import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find(
    (item) => item.name === 'bangumi.get_person_collaboration',
  );
  if (!tool) throw new Error('person collaboration tool was not registered');
  return tool;
}

describe('bangumi.get_person_collaboration', () => {
  it('exposes stable-ID ranking and official source evidence through the shared tool', async () => {
    const fetchFn = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20'))
        return json({ id: 20, name: 'Person', career: ['seiyu'] });
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 1, name: '主角', subject_id: 10, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/10/characters')) {
        return json([
          {
            id: 2,
            name: '角色',
            relation: '主角',
            actors: [{ id: 30, name: '合作声优', career: ['seiyu'] }],
          },
        ]);
      }
      return json({ error: 'not found' }, 404);
    };
    const tool = getTool(new HttpClient({ fetchFn }));
    const result = (await tool.execute(
      {
        personId: 20,
        kind: 'voice',
        media: 'anime',
        targetRole: '主',
        maxRelations: 12,
        maxSubjects: 8,
        maxCollaborators: 6,
        maxSharedSubjects: 4,
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
    )) as Record<string, any>;

    expect(result.state).toBe('complete');
    expect(result.collaborators).toEqual([expect.objectContaining({ id: 30, uniqueSubjects: 1 })]);
    expect(result.collaborators[0].sharedSubjects[0]).toMatchObject({
      id: 10,
      targetRoles: ['主角'],
    });
    expect(result.coverage).toMatchObject({
      maxRelations: 12,
      maxSubjects: 8,
      maxCollaborators: 6,
      maxSharedSubjects: 4,
      participantRequests: 1,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'official-v0',
          operation: 'GET /v0/subjects/{subject_id}/characters',
          outcome: 'succeeded',
        }),
      ]),
    );
  });

  it('rejects media, role, and resource values outside the published bounded contract', () => {
    const tool = getTool(new HttpClient({ fetchFn: async () => json({}) }));
    expect(() => tool.input.parse({ personId: 20, media: 'movie' })).toThrow();
    expect(() => tool.input.parse({ personId: 20, targetRole: '' })).toThrow();
    expect(() => tool.input.parse({ personId: 20, maxSubjects: 37 })).toThrow();
    expect(() => tool.input.parse({ personId: 20, maxSharedSubjects: 21 })).toThrow();
  });
});
