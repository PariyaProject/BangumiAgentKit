import { describe, expect, it } from 'vitest';
import { UserService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

// Synthetic values, shape derived from pinned official web/res/collection.go.
const person = { id: 20, name: '人物', type: 1, images: {}, created_at: '2026-01-01T00:00:00Z' };

function service(body: unknown, status = 200) {
  const requests: string[] = [];
  const client = new HttpClient({
    fetchFn: async (input) => {
      requests.push(new URL(String(input)).pathname);
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  return { service: new UserService(client), requests };
}

describe('official person collection wire metadata', () => {
  it('keeps a single valid collection with unknown career and no detail hydration', async () => {
    const fixture = service(person);
    const result = await fixture.service.getUserPersonCollection('synthetic', 20);
    expect(result).toMatchObject({
      found: true,
      item: { id: 20, name: '人物', type: 1, createdAt: person.created_at },
    });
    expect(result.item?.career).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result)).item).not.toHaveProperty('career');
    expect(fixture.requests).toEqual(['/v0/users/synthetic/collections/-/persons/20']);
  });

  it.each([{ career: [] }, { career: ['seiyu', 'future-role'] }])(
    'preserves supplied raw career $career',
    async ({ career }) => {
      const fixture = service({ ...person, career });
      const result = await fixture.service.getUserPersonCollection('synthetic', 20);
      expect(result.item?.career).toEqual(career);
      expect(result.item?.career).not.toBe(career);
      expect(fixture.requests).toHaveLength(1);
    },
  );

  it('retains missing, empty and known career rows in a list', async () => {
    const fixture = service({
      total: 3,
      limit: 0,
      offset: 0,
      data: [
        person,
        { ...person, id: 21, career: [] },
        { ...person, id: 22, career: ['future-role'] },
      ],
    });
    const result = await fixture.service.getUserPersonCollections('synthetic', { maxItems: 3 });
    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.career)).toEqual([undefined, [], ['future-role']]);
    expect(result).toMatchObject({ observed: 3, returned: 3, invalidRows: 0, truncated: false });
    expect(fixture.requests).toEqual(['/v0/users/synthetic/collections/-/persons']);
  });

  it.each([null, 'seiyu', 1, {}, [1]].map((career) => ({ career })))(
    'rejects malformed supplied career $career in a single response',
    async ({ career }) => {
      const fixture = service({ ...person, career });
      await expect(fixture.service.getUserPersonCollection('synthetic', 20)).rejects.toMatchObject({
        code: 'PARSER_ERROR',
        retryable: false,
      });
      expect(fixture.requests).toHaveLength(1);
    },
  );

  it('retains valid missing-career rows while counting malformed list rows', async () => {
    const fixture = service({
      total: 2,
      limit: 0,
      offset: 0,
      data: [person, { ...person, id: 21, career: 'seiyu' }],
    });
    const result = await fixture.service.getUserPersonCollections('synthetic');
    expect(result.items.map((item) => item.id)).toEqual([20]);
    expect(result).toMatchObject({ observed: 2, returned: 1, invalidRows: 1, truncated: true });
  });

  it('rejects a different returned identity without treating it as not found', async () => {
    const fixture = service({ ...person, id: 21, career: [] });
    await expect(fixture.service.getUserPersonCollection('synthetic', 20)).rejects.toMatchObject({
      code: 'PARSER_ERROR',
    });
  });

  it('keeps a genuine 404 as a bounded found:false result', async () => {
    const fixture = service({ error: 'not found' }, 404);
    expect(await fixture.service.getUserPersonCollection('synthetic', 20)).toEqual({
      found: false,
    });
    expect(fixture.requests).toHaveLength(1);
  });
});
