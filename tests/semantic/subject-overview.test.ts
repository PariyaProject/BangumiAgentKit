import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  ProviderRegistry,
  type CapabilityResult,
  type CapabilityState,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import { createReadTools, type ToolContext, type ToolDefinition } from '@bangumi-agent-kit/tools';

const context: ToolContext = {
  principalId: 'subject-overview-test',
  botInstanceId: 'test',
  conversationId: 'test',
};

const subjectPayload = {
  id: 123,
  type: 2,
  name: '少女終末旅行',
  name_cn: '少女终末旅行',
  summary: 'A bounded subject overview fixture.',
  nsfw: false,
  locked: false,
  date: '2017-10-06',
  platform: 'TV',
  images: { common: 'https://example.test/subject.png' },
  eps: 12,
  total_episodes: 12,
  rating: {
    score: 8.6,
    rank: 42,
    total: 100,
    count: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 },
  },
  collection: { wish: 10, collect: 20, doing: 3, on_hold: 4, dropped: 2 },
};

const stats: SubjectStatsData = {
  score: 8.6,
  rank: 42,
  ratingTotal: 100,
  ratingHistogram: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
};

const charactersPayload = [
  {
    id: 1,
    name: 'チト',
    type: 1,
    relation: '主角',
    actors: [{ id: 11, name: '水瀬いのり', career: ['seiyu'], images: {} }],
  },
  {
    id: 2,
    name: 'ユーリ',
    type: 2,
    relation: '主角',
    actors: [{ id: 12, name: '久保ユリカ', career: ['seiyu'], images: {} }],
  },
];

const personsPayload = [
  { id: 21, name: '尾崎隆晴', type: 1, career: ['director'], relation: '导演', images: {} },
  { id: 22, name: '筆安一幸', type: 1, career: ['writer'], relation: '脚本', images: {} },
];

const relationsPayload = [
  {
    id: 201,
    type: 2,
    name: '少女終末旅行 外传',
    name_cn: '少女终末旅行 外传',
    relation: '番外篇',
    images: {},
  },
  {
    id: 202,
    type: 1,
    name: '少女終末旅行 原作',
    name_cn: '少女终末旅行 原作',
    relation: '原作',
    images: {},
  },
];

function getTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find((item) => item.name === 'bangumi.get_subject_overview');
  if (!tool) throw new Error('subject overview tool was not registered');
  return tool;
}

function buildClient(
  options: {
    subjectStatus?: number;
    fail?: string;
    characters?: unknown[];
    persons?: unknown[];
    delays?: Partial<Record<'characters' | 'persons' | 'subjects', number>>;
  } = {},
) {
  const requests: string[] = [];
  const client = new HttpClient({
    fetchFn: async (input) => {
      const url = String(input);
      requests.push(url);
      const delayKey = url.includes('/characters')
        ? 'characters'
        : url.includes('/persons')
          ? 'persons'
          : url.includes('/subjects/123/subjects')
            ? 'subjects'
            : undefined;
      const delay = delayKey ? options.delays?.[delayKey] : undefined;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (options.fail && url.includes(options.fail)) {
        return new Response(JSON.stringify({ error: 'fixture failure' }), { status: 503 });
      }
      if (url.endsWith('/v0/subjects/123')) {
        return new Response(JSON.stringify(subjectPayload), {
          status: options.subjectStatus || 200,
        });
      }
      if (url.endsWith('/v0/subjects/123/characters')) {
        return new Response(JSON.stringify(options.characters || charactersPayload), {
          status: 200,
        });
      }
      if (url.endsWith('/v0/subjects/123/persons')) {
        return new Response(JSON.stringify(options.persons || personsPayload), { status: 200 });
      }
      if (url.endsWith('/v0/subjects/123/subjects')) {
        return new Response(JSON.stringify(relationsPayload), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    },
  });
  return { client, requests };
}

function buildProviderRegistry(state: CapabilityState = 'ok') {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'ok' as const, data: undefined };
      },
      async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
        if (state !== 'ok') return { state };
        return {
          state: 'ok' as const,
          data: stats,
          retrievedAt: '2026-08-14T00:00:00.000Z',
          evidence: {
            'rating.score': [
              {
                source: {
                  class: 'official_v0' as const,
                  provider: 'bangumi',
                  operation: 'getSubjectById',
                },
                retrievedAt: '2026-08-14T00:00:00.000Z',
              },
            ],
          },
        };
      },
    },
  });
}

describe('Subject Intelligence Overview semantic contract', () => {
  it('composes bounded official-v0 sections with evidence and stable coverage', async () => {
    const { client, requests } = buildClient();
    const result = await getTool(client).execute({ subjectId: 123 }, context, {
      providerRegistry: buildProviderRegistry(),
    });

    expect(result).toMatchObject({
      state: 'complete',
      subjectId: 123,
      subject: { nameCn: '少女终末旅行' },
      stats: { state: 'complete', data: { score: 8.6 } },
      cast: { state: 'complete', coverage: { observed: 2, returned: 2 } },
      staff: { state: 'complete', coverage: { observed: 2, returned: 2 } },
      relations: { state: 'complete', coverage: { observed: 2, returned: 2 } },
      coverage: { sourceRequestsAttempted: 5, sourceRequestsSucceeded: 5 },
    });
    expect((result as { evidence: Array<{ operation: string }> }).evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'GET /v0/subjects/{subject_id}' }),
        expect.objectContaining({ operation: 'GET /v0/subjects/{subject_id}/characters' }),
        expect.objectContaining({ operation: 'GET /v0/subjects/{subject_id}/persons' }),
        expect.objectContaining({ operation: 'GET /v0/subjects/{subject_id}/subjects' }),
      ]),
    );
    expect(requests).toHaveLength(4);
  });

  it('bounds nested actor references and exposes truthful nested coverage', async () => {
    const oversizedActors = Array.from({ length: 1000 }, (_, index) => ({
      id: index + 1000,
      name: `声优 ${index + 1}`,
      career: ['seiyu'],
      images: {},
    }));
    const { client } = buildClient({
      characters: [{ ...charactersPayload[0], actors: oversizedActors }],
    });
    const result = await getTool(client).execute({ subjectId: 123, maxCast: 1 }, context, {});
    const overview = result as {
      cast: {
        items: Array<{ actors: unknown[]; actorCoverage: Record<string, unknown> }>;
        actorCoverage: Record<string, unknown>;
      };
      coverage: { actorLimits: { perCharacter: number; total: number } };
      warnings: Array<{ code: string }>;
    };

    expect(overview.cast.items[0]!.actors).toHaveLength(4);
    expect(overview.cast.items[0]!.actorCoverage).toEqual({
      observed: 1000,
      returned: 4,
      truncated: true,
    });
    expect(overview.cast.actorCoverage).toEqual({ observed: 1000, returned: 4, truncated: true });
    expect(overview.coverage.actorLimits).toEqual({ perCharacter: 4, total: 32 });
    expect(overview.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CAST_ACTOR_OUTPUT_TRUNCATED' })]),
    );
  });

  it('keeps partial sections honest when caps and an upstream section failure apply', async () => {
    const { client } = buildClient({ fail: '/persons' });
    const result = await getTool(client).execute(
      { subjectId: 123, maxCast: 1, maxStaff: 1, maxRelations: 1 },
      context,
      { providerRegistry: undefined },
    );

    expect(result).toMatchObject({
      state: 'partial',
      stats: { state: 'unavailable' },
      cast: { state: 'partial', coverage: { observed: 2, returned: 1, truncated: true } },
      staff: { state: 'unavailable', coverage: { observed: 0, returned: 0 } },
      relations: { state: 'partial', coverage: { observed: 2, returned: 1, truncated: true } },
    });
    expect((result as { stats: unknown }).stats).not.toHaveProperty('data');
    expect((result as { warnings: Array<{ code: string }> }).warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROVIDER_NOT_CONFIGURED' }),
        expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE' }),
        expect.objectContaining({ code: 'CAST_OUTPUT_TRUNCATED' }),
        expect.objectContaining({ code: 'RELATIONS_OUTPUT_TRUNCATED' }),
      ]),
    );
    expect((result as { evidence: Array<Record<string, unknown>> }).evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/subjects/{subject_id}/persons',
          attemptedAt: expect.any(String),
        }),
      ]),
    );
    expect(
      (result as { evidence: Array<Record<string, unknown>> }).evidence.find(
        (item) => item.operation === 'GET /v0/subjects/{subject_id}/persons',
      ),
    ).not.toHaveProperty('retrievedAt');
  });

  it('fails closed on a missing root subject and enforces input caps', async () => {
    const { client, requests } = buildClient({ subjectStatus: 404 });
    const tool = getTool(client);
    expect(tool.input.safeParse({ subjectId: 123, maxCast: 21 }).success).toBe(false);

    const result = await tool.execute({ subjectId: 123 }, context, {
      providerRegistry: buildProviderRegistry(),
    });
    expect(result).toMatchObject({ state: 'not_found', subjectId: 123 });
    expect(
      (result as { coverage: { sourceRequestsAttempted: number } }).coverage
        .sourceRequestsAttempted,
    ).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it.each([
    'unavailable',
    'upstream_error',
    'auth_required',
    'permission_denied',
    'not_found',
    'not_computable',
    'unsupported',
  ] as const)(
    'maps stats provider state %s without false success or retrieval evidence',
    async (state) => {
      const { client } = buildClient();
      const result = await getTool(client).execute({ subjectId: 123 }, context, {
        providerRegistry: buildProviderRegistry(state),
      });
      const overview = result as {
        stats: { state: string };
        coverage: { sourceRequestsSucceeded: number };
        evidence: Array<Record<string, unknown>>;
      };
      const statsEvidence = overview.evidence.find((item) =>
        String(item.operation).includes('rating/collection'),
      );

      expect(overview.stats.state).toBe(
        state === 'not_computable' || state === 'unsupported' ? 'not_computable' : 'unavailable',
      );
      expect(overview.coverage.sourceRequestsSucceeded).toBe(4);
      expect(statsEvidence).toEqual(expect.objectContaining({ attemptedAt: expect.any(String) }));
      expect(statsEvidence).not.toHaveProperty('retrievedAt');
    },
  );

  it('records attempt and retrieval evidence around delayed section operations', async () => {
    const { client } = buildClient({ delays: { characters: 35, persons: 5, subjects: 15 } });
    const result = await getTool(client).execute({ subjectId: 123 }, context, {
      providerRegistry: buildProviderRegistry(),
    });
    const evidence = (result as { evidence: Array<Record<string, unknown>> }).evidence;
    for (const operation of [
      'GET /v0/subjects/{subject_id}',
      'GET /v0/subjects/{subject_id}/characters',
      'GET /v0/subjects/{subject_id}/persons',
      'GET /v0/subjects/{subject_id}/subjects',
    ]) {
      const item = evidence.find((entry) => entry.operation === operation);
      expect(item).toEqual(
        expect.objectContaining({
          attemptedAt: expect.any(String),
          retrievedAt: expect.any(String),
        }),
      );
      expect(new Date(String(item?.retrievedAt)).getTime()).toBeGreaterThanOrEqual(
        new Date(String(item?.attemptedAt)).getTime(),
      );
    }
  });

  it('groups staff by the retained raw official relation label', async () => {
    const { client } = buildClient({
      persons: [
        { ...personsPayload[0], relation: '导演 ' },
        { ...personsPayload[1], relation: '导演' },
      ],
    });
    const result = await getTool(client).execute({ subjectId: 123 }, context, {});
    const groups = (result as { staff: { groups: Array<{ relation: string }> } }).staff.groups;
    expect(groups.map((group) => group.relation)).toEqual(
      expect.arrayContaining(['导演 ', '导演']),
    );
  });
});
