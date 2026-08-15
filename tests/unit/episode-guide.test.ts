import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH,
  EpisodeGuideService,
} from '@bangumi-agent-kit/bangumi-core';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function subjectPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    type: 2,
    name: 'Subject Original',
    name_cn: '条目中文名',
    date: '2026-04-01',
    platform: 'TV',
    eps: 12,
    total_episodes: 12,
    ...overrides,
  };
}

function episode(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 0,
    name: `Episode ${id}`,
    name_cn: `第 ${id} 集`,
    sort: id,
    ep: id,
    airdate: '2026-04-01',
    comment: id * 2,
    duration: '00:24:00',
    desc: `Description ${id}`,
    ...overrides,
  };
}

function buildClient(options: {
  subject?: unknown;
  episodes?: unknown;
  subjectStatus?: number;
  episodesStatus?: number;
}) {
  const requests: string[] = [];
  const client = new HttpClient({
    fetchFn: async (input) => {
      const url = new URL(String(input));
      requests.push(url.toString());
      if (url.pathname === '/v0/subjects/123') {
        return response(options.subject ?? subjectPayload(), options.subjectStatus ?? 200);
      }
      if (url.pathname === '/v0/episodes') {
        return response(
          options.episodes ?? { total: 1, limit: 50, offset: 0, data: [episode(1)] },
          options.episodesStatus ?? 200,
        );
      }
      return response({ message: 'not found' }, 404);
    },
  });
  return { client, requests };
}

describe('EpisodeGuideService', () => {
  it('composes a complete guide with deterministic category/episode ordering and evidence', async () => {
    const { client, requests } = buildClient({
      episodes: {
        total: 3,
        limit: 50,
        offset: 0,
        data: [
          episode(3, { type: 1, sort: 1, ep: undefined, name_cn: 'SP' }),
          episode(2, { type: 0, sort: 2, ep: 2 }),
          episode(1, { type: 0, sort: 1, ep: 1 }),
        ],
      },
    });

    const result = await new EpisodeGuideService(client).getEpisodeGuide(123);

    expect(result.state).toBe('complete');
    expect(result.subject).toMatchObject({ id: 123, nameCn: '条目中文名', type: 'anime' });
    expect(result.items.map((item) => [item.category, item.id])).toEqual([
      ['main', 1],
      ['main', 2],
      ['sp', 3],
    ]);
    expect(result.summary).toMatchObject({
      returned: 3,
      withAirdate: 3,
      withDuration: 3,
      withDescription: 3,
      withDiscussionCount: 3,
      empty: false,
    });
    expect(result.coverage).toMatchObject({
      sourceTotal: 3,
      totalKind: 'exact',
      observedRows: 3,
      uniqueRows: 3,
      returnedRows: 3,
      truncated: false,
      duplicateRows: 0,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'official_v0' }),
        expect.objectContaining({
          source: 'derived',
          formulaVersion: 'episode-guide-v1',
        }),
      ]),
    );
    expect(requests.some((url) => url.includes('/v0/subjects/123'))).toBe(true);
    expect(requests.some((url) => url.includes('/v0/episodes'))).toBe(true);
  });

  it('keeps missing fields, duplicate IDs, source truncation, and long descriptions explicit', async () => {
    const { client } = buildClient({
      episodes: {
        total: 4,
        limit: 2,
        offset: 0,
        data: [
          episode(1, {
            airdate: undefined,
            duration: undefined,
            desc: 'x'.repeat(EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH + 40),
          }),
          episode(1),
          episode(2, { airdate: 'not-a-date', comment: undefined }),
        ],
      },
    });

    const result = await new EpisodeGuideService(client).getEpisodeGuide(123, {
      maxEpisodes: 2,
    });

    expect(result.state).toBe('partial');
    expect(result.items).toHaveLength(2);
    expect(result.coverage).toMatchObject({
      observedRows: 3,
      uniqueRows: 2,
      returnedRows: 2,
      sourceTotal: 4,
      truncated: true,
      duplicateRows: 1,
    });
    expect(result.coverage.missingFields).toEqual(
      expect.objectContaining({
        'episode.airdate': 1,
        'episode.duration': 1,
        'episode.discussionCount': 1,
      }),
    );
    expect(result.coverage.truncatedFields).toEqual(
      expect.objectContaining({ 'episode.description': 1 }),
    );
    expect(result.coverage.invalidFields).toEqual(
      expect.objectContaining({ 'episode.airdate': 1 }),
    );
    expect(result.items.find((item) => item.id === 2)?.airdate).toBeUndefined();
    expect(result.items[0]?.description).toHaveLength(EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'OUTPUT_TRUNCATED',
        'DUPLICATE_EPISODE_ROWS',
        'MISSING_FIELDS',
        'FIELD_TRUNCATED',
        'INVALID_FIELDS',
      ]),
    );
  });

  it('treats a successful empty page as empty complete data, not as not-found', async () => {
    const { client } = buildClient({ episodes: { total: 0, limit: 50, offset: 0, data: [] } });

    const result = await new EpisodeGuideService(client).getEpisodeGuide(123, {
      includeDescriptions: false,
    });

    expect(result.state).toBe('complete');
    expect(result.items).toEqual([]);
    expect(result.summary.empty).toBe(true);
    expect(result.capabilityStates).toEqual({
      episodeProgress: 'not_computable',
      watchOrder: 'not_computable',
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NO_EPISODES_OBSERVED' })]),
    );
  });

  it('distinguishes not-found, malformed source, and unavailable source states', async () => {
    const notFound = await new EpisodeGuideService(
      buildClient({ subjectStatus: 404, episodesStatus: 404 }).client,
    ).getEpisodeGuide(123);
    expect(notFound.state).toBe('not_found');
    expect(notFound.error?.code).toBe('NOT_FOUND');

    const malformed = await new EpisodeGuideService(
      buildClient({ episodes: { total: 1, data: [{ id: 1, type: 'bad' }] } }).client,
    ).getEpisodeGuide(123);
    expect(malformed.state).toBe('partial');
    expect(malformed.error?.code).toBe('PARSER_ERROR');
    expect(malformed.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_DRIFT' })]),
    );

    const unavailable = await new EpisodeGuideService(
      buildClient({ subjectStatus: 503, episodesStatus: 503 }).client,
    ).getEpisodeGuide(123);
    expect(unavailable.state).toBe('unavailable');
    expect(unavailable.items).toEqual([]);
    expect(unavailable.error?.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
