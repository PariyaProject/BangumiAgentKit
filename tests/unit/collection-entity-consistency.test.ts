import { describe, expect, it } from 'vitest';
import {
  CollectionEntityConsistencyService,
  type CollectionEntityConsistencyResult,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function subjectCollection(
  items: Array<Record<string, unknown>>,
  total = items.length,
): Record<string, unknown> {
  return { total, limit: 50, offset: 0, data: items };
}

function subjectRow(id: number, name = `作品${id}`): Record<string, unknown> {
  return {
    subject_id: id,
    subject_type: 2,
    type: 2,
    subject: { id, type: 2, name, name_cn: `${name}中文` },
  };
}

function characterRow(
  id: number,
  actorIds: number[] = [],
  relation = '主角',
): Record<string, unknown> {
  return {
    id,
    name: `角色${id}`,
    type: 1,
    summary: 'summary',
    relation,
    actors: actorIds.map((actorId) => ({ id: actorId, name: `人物${actorId}`, career: ['声优'] })),
  };
}

function personRow(id: number, relation = '制作'): Record<string, unknown> {
  return {
    id,
    name: `人物${id}`,
    type: 1,
    career: ['声优'],
    relation,
    eps: '',
  };
}

function buildFetch(
  options: {
    subjectRows?: Array<Record<string, unknown>>;
    subjectTotal?: number;
    characterRows?: Array<Record<string, unknown>>;
    personRows?: Array<Record<string, unknown>>;
    relationStatus?: number;
    characterCollections?: Array<Record<string, unknown>>;
    personCollections?: Array<Record<string, unknown>>;
  } = {},
): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/collections/-/characters')) {
      return json({
        total: options.characterCollections?.length ?? 0,
        limit: 0,
        offset: 0,
        data: options.characterCollections ?? [],
      });
    }
    if (url.pathname.endsWith('/collections/-/persons')) {
      return json({
        total: options.personCollections?.length ?? 0,
        limit: 0,
        offset: 0,
        data: options.personCollections ?? [],
      });
    }
    if (url.pathname.endsWith('/collections')) {
      return json(subjectCollection(options.subjectRows ?? [], options.subjectTotal));
    }
    if (url.pathname.endsWith('/characters')) {
      return json(options.characterRows ?? [], options.relationStatus ?? 200);
    }
    if (url.pathname.endsWith('/persons')) {
      return json(options.personRows ?? [], options.relationStatus ?? 200);
    }
    return json({ error: 'not found' }, 404);
  };
}

function runService(
  fetchFn: typeof fetch,
  options: Parameters<CollectionEntityConsistencyService['getCollectionEntityConsistency']>[1] = {},
) {
  return new CollectionEntityConsistencyService(
    new HttpClient({ fetchFn }),
  ).getCollectionEntityConsistency('bound-user', options);
}

describe('CollectionEntityConsistencyService', () => {
  it('joins direct character/person credits and nested character actors by stable ID', async () => {
    const result = await runService(
      buildFetch({
        subjectRows: [subjectRow(100)],
        characterCollections: [
          { id: 10, name: '收藏角色10', type: 1, created_at: '2026-01-01T00:00:00Z' },
          { id: 11, name: '收藏角色11', type: 1, created_at: '2026-01-01T00:00:00Z' },
        ],
        personCollections: [
          {
            id: 20,
            name: '收藏人物20',
            type: 1,
            career: ['声优'],
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 21,
            name: '收藏人物21',
            type: 1,
            career: ['声优'],
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        characterRows: [characterRow(10, [20])],
        personRows: [personRow(20, '制作')],
      }),
    );

    expect(result.state).toBe('complete');
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceKind: 'subject-character',
          entity: expect.objectContaining({ kind: 'character', id: 10 }),
        }),
        expect.objectContaining({
          evidenceKind: 'character-actor',
          entity: expect.objectContaining({ kind: 'person', id: 20 }),
          viaCharacter: { id: 10, name: '角色10' },
        }),
        expect.objectContaining({
          evidenceKind: 'subject-person',
          entity: expect.objectContaining({ kind: 'person', id: 20 }),
        }),
      ]),
    );
    expect(result.unmatchedInObservedScope).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: expect.objectContaining({ kind: 'character', id: 11 }) }),
        expect.objectContaining({ entity: expect.objectContaining({ kind: 'person', id: 21 }) }),
      ]),
    );
    expect(result.coverage).toMatchObject({
      state: 'complete',
      subjectCollections: { rootsSelected: 1, uniqueRootsObserved: 1 },
      relations: {
        sourceRequestsAttempted: 2,
        sourceRequestsSucceeded: 2,
        maxConcurrency: 4,
      },
    });
    expect(result.matches.every((match) => match.source.class === 'official-v0')).toBe(true);
  });

  it('retains positive matches but suppresses negative claims when roots or relation rows are partial', async () => {
    const result = await runService(
      buildFetch({
        subjectRows: [subjectRow(100), subjectRow(101), subjectRow(102), subjectRow(103)],
        subjectTotal: 4,
        characterCollections: [
          { id: 10, name: '收藏角色10', type: 1, created_at: '2026-01-01T00:00:00Z' },
          { id: 11, name: '收藏角色11', type: 1, created_at: '2026-01-01T00:00:00Z' },
        ],
        personCollections: [],
        characterRows: [characterRow(10), characterRow(11)],
        personRows: [],
      }),
      { maxSubjects: 2, maxRelationsPerSubject: 1 },
    );

    expect(result.state).toBe('partial');
    expect(result.matches).toHaveLength(2);
    expect(result.matches.every((match) => match.entity.id === 10)).toBe(true);
    expect(result.unmatchedInObservedScope).toEqual([]);
    expect(result.coverage).toMatchObject({
      subjectCollections: { rootsSelected: 2, uniqueRootsObserved: 4, truncated: true },
      relations: { truncated: true, rowsDroppedAtLimit: 2 },
    });
    expect(result.limitations.join(' ')).toContain('未观察到不等于不存在');
  });

  it('reports relation failure as not computable without fabricating empty matches', async () => {
    const result = await runService(
      buildFetch({
        subjectRows: [subjectRow(100)],
        characterCollections: [
          { id: 10, name: '收藏角色10', type: 1, created_at: '2026-01-01T00:00:00Z' },
        ],
        personCollections: [],
        relationStatus: 503,
      }),
    );

    expect(result.state).toBe('not_computable');
    expect(result.matches).toEqual([]);
    expect(result.unmatchedInObservedScope).toEqual([]);
    expect(result.coverage.relations.sourceRequestsFailed).toBe(2);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COLLECTION_RELATION_COVERAGE_PARTIAL' }),
      ]),
    );
  });

  it('returns a complete empty result without relation fan-out when both entity lists are empty', async () => {
    const calls: string[] = [];
    const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      return buildFetch({ subjectRows: [subjectRow(100)] })(input, init);
    };
    const result = await runService(fetchFn);

    expect(result.state).toBe('complete');
    expect(result.matches).toEqual([]);
    expect(result.unmatchedInObservedScope).toEqual([]);
    expect(result.coverage.relations.skipped).toBe(true);
    expect(calls.some((url) => url.includes('/subjects/100/'))).toBe(false);
  });

  it('keeps total relation request concurrency at four across character and person sources', async () => {
    let active = 0;
    let maximum = 0;
    const baseFetch = buildFetch({
      subjectRows: [subjectRow(100), subjectRow(101), subjectRow(102), subjectRow(103)],
      characterCollections: [
        { id: 10, name: '收藏角色10', type: 1, created_at: '2026-01-01T00:00:00Z' },
      ],
      personCollections: [
        {
          id: 20,
          name: '收藏人物20',
          type: 1,
          career: ['声优'],
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      characterRows: [characterRow(10)],
      personRows: [personRow(20)],
    });
    const fetchFn: typeof fetch = async (input, init) => {
      const pathname = new URL(String(input)).pathname;
      const isRelation = pathname.includes('/subjects/');
      if (isRelation) {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      try {
        return await baseFetch(input, init);
      } finally {
        if (isRelation) active -= 1;
      }
    };

    const result = await runService(fetchFn, { maxSubjects: 4 });

    expect(result.state).toBe('complete');
    expect(result.coverage.relations.sourceRequestsAttempted).toBe(8);
    expect(maximum).toBeLessThanOrEqual(4);
  });
});

const _resultTypeCheck: CollectionEntityConsistencyResult | undefined = undefined;
void _resultTypeCheck;
