import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  EPISODE_INTEGRITY_FORMULA_VERSION,
  EpisodeIntegrityService,
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
    eps: 3,
    total_episodes: 3,
    ...overrides,
  };
}

function episode(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject_id: 123,
    type: 0,
    name: 'Episode ' + id,
    name_cn: '第 ' + id + ' 集',
    sort: id,
    ep: id,
    airdate: '2026-04-01',
    comment: id,
    duration: '00:24:00',
    desc: 'Description ' + id,
    ...overrides,
  };
}

function buildClient(episodes: unknown, subject: unknown = subjectPayload()) {
  const client = new HttpClient({
    fetchFn: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/v0/subjects/123') return response(subject);
      if (url.pathname === '/v0/episodes') return response(episodes);
      return response({ message: 'not found' }, 404);
    },
  });
  return client;
}

describe('EpisodeIntegrityService', () => {
  it('computes bounded counts and UTC aired status without inferring watch state', async () => {
    const result = await new EpisodeIntegrityService(
      buildClient({
        total: 4,
        limit: 50,
        offset: 0,
        data: [
          episode(1, { airdate: '2026-04-01' }),
          episode(2, { airdate: '2026-04-05' }),
          episode(3, { airdate: '2026-04-10' }),
          episode(4, { type: 1, ep: undefined, sort: 1, airdate: '2026-04-02' }),
        ],
      }),
    ).getEpisodeIntegrity(123, { asOfDate: '2026-04-05' });

    expect(result.state).toBe('complete');
    expect(result.asOf).toEqual(
      expect.objectContaining({ date: '2026-04-05', source: 'explicit' }),
    );
    expect(result.integrity.counts).toMatchObject({
      observedRows: 4,
      uniqueRows: 4,
      returnedRows: 4,
      main: 3,
      special: 1,
      airedMain: 2,
      futureMain: 1,
      mainWithValidAirdate: 3,
      mainWithUnknownAirdate: 0,
      byCategory: { main: 3, sp: 1 },
    });
    expect(result.integrity.dateCoverage).toMatchObject({
      validRows: 4,
      airedRows: 3,
      futureRows: 1,
      missingRows: 0,
      invalidRows: 0,
    });
    expect(result.integrity.checks).toMatchObject({
      reportedVsDatabase: { state: 'consistent', left: 3, right: 3, difference: 0 },
      reportedVsObservedMain: { state: 'consistent', left: 3, right: 3 },
      databaseVsObservedMain: { state: 'consistent', left: 3, right: 3 },
      reportedVsAiredMain: { state: 'different', left: 3, right: 2, difference: 1 },
    });
    expect(result.capabilityStates).toEqual({
      episodeProgress: 'not_computable',
      watchOrder: 'not_computable',
      airingHistory: 'not_computable',
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived',
          formulaVersion: EPISODE_INTEGRITY_FORMULA_VERSION,
        }),
      ]),
    );
  });

  it('keeps duplicate, missing, invalid, and logical airdate conflicts explicit', async () => {
    const result = await new EpisodeIntegrityService(
      buildClient({
        total: 6,
        limit: 50,
        offset: 0,
        data: [
          episode(1, { airdate: undefined }),
          episode(2, { ep: 2, sort: 2, airdate: '2026-04-03' }),
          episode(3, { ep: 2, sort: 2, airdate: '2026-04-04' }),
          episode(4, { airdate: '2026-04-05' }),
          episode(4, { airdate: '2026-04-06' }),
          episode(5, { airdate: '2026-02-30' }),
        ],
      }),
    ).getEpisodeIntegrity(123, { asOfDate: '2026-04-05' });

    expect(result.state).toBe('conflict');
    expect(result.integrity.anomalies).toMatchObject({
      duplicateEpisodeIds: 1,
      duplicateAirdateConflicts: 1,
      duplicateLogicalKeys: 1,
      airdateConflictGroups: 1,
      missingAirdates: 1,
      invalidAirdates: 1,
    });
    expect(result.integrity.dateCoverage).toMatchObject({
      missingRows: 1,
      invalidRows: 1,
    });
    expect(result.integrity.checks.reportedVsDatabase.state).toBe('consistent');
    expect(result.coverage.integrity.denominator).toBe('source_exact');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EPISODE_INTEGRITY_CONFLICT', state: 'conflict' }),
      ]),
    );
  });

  it('marks category-filtered comparisons partial instead of treating the subset as complete', async () => {
    const result = await new EpisodeIntegrityService(
      buildClient({
        total: 2,
        limit: 50,
        offset: 0,
        data: [episode(1), episode(2)],
      }),
    ).getEpisodeIntegrity(123, { category: 'main', asOfDate: '2026-04-05' });

    expect(result.state).toBe('partial');
    expect(result.coverage.integrity.comparisons).toBe('partial');
    expect(result.integrity.checks.reportedVsObservedMain.state).toBe('not_computable');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EPISODE_INTEGRITY_PARTIAL', state: 'partial' }),
      ]),
    );
  });
});
