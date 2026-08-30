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
  const tool = createReadTools(client).find((item) => item.name === 'bangumi.get_person_activity');
  if (!tool) throw new Error('person activity tool was not registered');
  return tool;
}

describe('bangumi.get_person_activity', () => {
  it('exposes bounded, evidence-bearing activity output through the shared tool', async () => {
    const fetchFn = async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20'))
        return json({ id: 20, name: 'Person', career: ['seiyu'] });
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([{ id: 1, name: '角色', subject_id: 10, subject_type: 2, staff: '主角' }]);
      }
      if (url.endsWith('/v0/subjects/10')) {
        return json({
          id: 10,
          type: 2,
          name: 'Subject',
          name_cn: '条目',
          date: '2026-07-01',
          platform: 'TV',
          meta_tags: ['原创', '奇幻'],
        });
      }
      return json({ error: 'not found' }, 404);
    };
    const tool = getTool(new HttpClient({ fetchFn }));
    const result = (await tool.execute(
      {
        personId: 20,
        kind: 'voice',
        media: 'tv',
        windowMonths: 6,
        maxRelations: 12,
        maxSubjectDetails: 8,
        maxRows: 6,
        comparePreviousWindow: true,
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
    )) as Record<string, any>;

    expect(result.state).toBe('complete');
    expect(result.summary).toMatchObject({
      uniqueSubjects: 1,
      uniqueCharacters: 1,
      origin: { explicitOriginalSubjects: 1, notObservedSubjects: 0, unknownSubjects: 0 },
    });
    expect(result.rows[0]).toMatchObject({
      origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
    });
    expect(result.comparison).toMatchObject({
      windowMonths: 6,
      delta: expect.objectContaining({ creditRows: expect.any(Number) }),
    });
    expect(result.coverage).toMatchObject({
      maxRelations: 12,
      maxSubjectDetails: 8,
      maxRows: 6,
      responseLimitBytes: 1048576,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          formulaVersion: 'person-activity-window-v1',
        }),
        expect.objectContaining({
          operation: 'person-activity-origin-observation',
          formulaVersion: 'person-activity-origin-v1',
        }),
      ]),
    );
    expect(result.limitations.join(' ')).toContain('first_air_date');
    expect(result.limitations.join(' ')).toContain('未观察到该标签不等于改编');
    expect(result.limitations.join(' ')).toContain(
      '每个官方 v0 人物、人物关系和作品详情响应最多读取',
    );
  });

  it('rejects authority values outside the published bounds', () => {
    const tool = getTool(new HttpClient({ fetchFn: async () => json({}) }));
    expect(() => tool.input.parse({ personId: 20, maxRelations: 121 })).toThrow();
    expect(() => tool.input.parse({ personId: 20, windowMonths: 9 })).toThrow();
    expect(() =>
      tool.input.parse({ personId: 20, staffRole: 'director', kind: 'voice' }),
    ).toThrow();
    expect(() => tool.input.parse({ personId: 20, media: 'movie' })).toThrow();
    expect(() =>
      tool.input.parse({ personId: 20, staffRole: 'director', windowMonths: 36 }),
    ).not.toThrow();
  });

  it('defaults a role-filtered query to staff and preserves the 36-month contract', async () => {
    const fetchFn = async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json({ id: 20, name: 'Person' });
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([{ id: 10, name: 'Subject', staff: '导演' }]);
      }
      if (url.endsWith('/v0/subjects/10')) {
        return json({
          id: 10,
          type: 2,
          name: 'Subject',
          name_cn: '条目',
          date: '2026-07-01',
          platform: 'TV',
        });
      }
      return json({ error: 'not found' }, 404);
    };
    const tool = getTool(new HttpClient({ fetchFn }));
    const result = (await tool.execute(
      { personId: 20, staffRole: 'director', windowMonths: 36, media: 'tv' },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
    )) as Record<string, any>;

    expect(result).toMatchObject({
      kind: 'staff',
      staffRole: 'director',
      window: { months: 36 },
      rows: [{ subjectId: 10, rawRole: '导演' }],
    });
  });
});
