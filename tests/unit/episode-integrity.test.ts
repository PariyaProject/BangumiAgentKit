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

function buildClientWithStatuses(subjectStatus: number, episodeStatus: number) {
  const client = new HttpClient({
    fetchFn: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/v0/subjects/123') return response(subjectPayload(), subjectStatus);
      if (url.pathname === '/v0/episodes') {
        return response({ message: 'source unavailable' }, episodeStatus);
      }
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
    expect(result.integrity.dateCoverage.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, quality: 'missing', returned: true }),
        expect.objectContaining({ id: 5, quality: 'invalid', rawAirdate: '2026-02-30' }),
      ]),
    );
    expect(result.integrity.anomalies.logicalAirdateConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'main:ep:2', ids: expect.arrayContaining([2, 3]) }),
      ]),
    );
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

  it('keeps unknown raw types and empty source pages as degraded states', async () => {
    const unknown = await new EpisodeIntegrityService(
      buildClient({
        total: 1,
        limit: 50,
        offset: 0,
        data: [
          {
            id: 9,
            subject_id: 123,
            name: 'Unclassified',
            name_cn: '未分类章节',
            sort: 1,
            ep: 1,
            airdate: '2026-04-01',
            comment: 0,
            duration: '00:24:00',
            desc: 'Description',
          },
        ],
      }),
    ).getEpisodeIntegrity(123, { asOfDate: '2026-04-05' });

    expect(unknown.state).toBe('partial');
    expect(unknown.integrity.counts).toMatchObject({ special: 0, unknown: 1 });
    expect(unknown.integrity.counts.byCategory).toEqual({ unknown: 1 });
    expect(unknown.items[0]).toMatchObject({ category: 'unknown' });
    expect(unknown.items[0]).not.toHaveProperty('rawType');

    const futureType = await new EpisodeIntegrityService(
      buildClient({
        total: 1,
        limit: 50,
        offset: 0,
        data: [episode(10, { type: 7 })],
      }),
    ).getEpisodeIntegrity(123, { asOfDate: '2026-04-05' });
    expect(futureType.items[0]).toMatchObject({ category: 'unknown', rawType: 7 });
    expect(futureType.integrity.counts).toMatchObject({ special: 0, unknown: 1 });
    expect(futureType.coverage.episodeGuide).toMatchObject({ unknownTypeRows: 1 });
    expect(futureType.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_EPISODE_TYPES' })]),
    );

    const malformedType = await new EpisodeIntegrityService(
      buildClient({
        total: 1,
        limit: 50,
        offset: 0,
        data: [episode(11, { type: 'future' })],
      }),
      () => new Date('2040-01-02T03:04:05.000Z'),
    ).getEpisodeIntegrity(123);
    expect(malformedType.state).toBe('partial');
    expect(malformedType.source.attempts[1]).toMatchObject({ state: 'unavailable' });
    expect(malformedType.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_DRIFT' })]),
    );

    const empty = await new EpisodeIntegrityService(
      buildClient({ total: 0, limit: 50, offset: 0, data: [] }),
    ).getEpisodeIntegrity(123, { asOfDate: '2026-04-05' });

    expect(empty.state).toBe('not_computable');
    expect(empty.capabilityStates.airingHistory).toBe('not_computable');
    expect(empty.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EPISODE_INTEGRITY_NOT_COMPUTABLE' }),
      ]),
    );
  });

  it('keeps omitted valid dates separate from returned unknown dates', async () => {
    const result = await new EpisodeIntegrityService(
      buildClient({
        total: 4,
        limit: 50,
        offset: 0,
        data: [
          episode(1, { airdate: '2026-04-01' }),
          episode(2, { airdate: '2026-04-02' }),
          episode(3, { airdate: '2026-04-03' }),
          episode(4, { airdate: '2026-04-04' }),
        ],
      }),
    ).getEpisodeIntegrity(123, { maxEpisodes: 2, asOfDate: '2026-04-04' });

    expect(result.items).toHaveLength(2);
    expect(result.integrity.dateCoverage.populations).toMatchObject({
      observed: { rows: 4, validRows: 4, unknownRows: 0 },
      unique: { rows: 4, validRows: 4, unknownRows: 0 },
      returned: { rows: 2, validRows: 2, unknownRows: 0 },
      omitted: { rows: 2, validRows: 2, unknownRows: 0 },
    });
    expect(result.integrity.dateCoverage.unknownRows).toBe(0);
    expect(result.integrity.dateCoverage.rows.filter((row) => !row.returned)).toHaveLength(2);
  });

  it('analyzes omitted logical conflicts and preserves bounded row-quality scope', async () => {
    const result = await new EpisodeIntegrityService(
      buildClient({
        total: 6,
        limit: 50,
        offset: 0,
        data: [
          episode(1, { airdate: '2026-04-01' }),
          episode(2, { airdate: '2026-04-02' }),
          episode(3, { ep: 3, sort: 3, airdate: '2026-04-05' }),
          episode(4, { ep: 3, sort: 3, airdate: '2026-04-04' }),
          episode(5, { ep: 4, sort: 4, airdate: undefined }),
          episode(6, { ep: 5, sort: 5, airdate: '2026-02-30' }),
        ],
      }),
    ).getEpisodeIntegrity(123, { maxEpisodes: 2, asOfDate: '2026-04-04' });

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.state).toBe('conflict');
    expect(result.integrity.dateCoverage.populations).toMatchObject({
      observed: { rows: 6, missingRows: 1, invalidRows: 1 },
      unique: { rows: 6, missingRows: 1, invalidRows: 1 },
      returned: { rows: 2, missingRows: 0, invalidRows: 0 },
      omitted: { rows: 4, missingRows: 1, invalidRows: 1 },
    });
    expect(result.integrity.anomalies).toMatchObject({
      duplicateLogicalKeys: 1,
      airdateConflictGroups: 1,
      nonMonotonicMainAirdates: 1,
    });
    expect(result.integrity.anomalies.logicalAirdateConflicts).toEqual([
      expect.objectContaining({
        key: 'main:ep:3',
        ids: [3, 4],
        airdates: ['2026-04-05', '2026-04-04'],
        members: [
          expect.objectContaining({ id: 3, unique: true, returned: false, quality: 'valid' }),
          expect.objectContaining({ id: 4, unique: true, returned: false, quality: 'valid' }),
        ],
      }),
    ]);
    expect(result.integrity.dateCoverage.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 5, quality: 'missing', unique: true, returned: false }),
        expect.objectContaining({
          id: 6,
          quality: 'invalid',
          rawAirdate: '2026-02-30',
          unique: true,
          returned: false,
        }),
      ]),
    );

    const boundary = await new EpisodeIntegrityService(
      buildClient({
        total: 8,
        limit: 50,
        offset: 0,
        data: [
          episode(1, { airdate: '2026-04-01' }),
          episode(2, { ep: 2, sort: 2, airdate: '2026-04-05' }),
          episode(3, { ep: 2, sort: 2, airdate: '2026-04-04' }),
          episode(4, { ep: 3, sort: 3, airdate: '2026-04-03' }),
          episode(5, { ep: 4, sort: 4, airdate: '2026-04-02' }),
          episode(5, { ep: 4, sort: 4, airdate: '2026-04-06' }),
          episode(6, { ep: 5, sort: 5, airdate: undefined }),
          episode(7, { ep: 6, sort: 6, airdate: '2026-02-30' }),
        ],
      }),
    ).getEpisodeIntegrity(123, { maxEpisodes: 2, asOfDate: '2026-04-05' });

    expect(boundary.integrity.anomalies).toMatchObject({
      duplicateEpisodeIds: 1,
      duplicateAirdateConflicts: 1,
      duplicateLogicalKeys: 1,
      airdateConflictGroups: 1,
      nonMonotonicMainAirdates: 3,
    });
    expect(boundary.integrity.anomalies.logicalAirdateConflicts[0]).toMatchObject({
      key: 'main:ep:2',
      members: [
        expect.objectContaining({ id: 2, returned: true }),
        expect.objectContaining({ id: 3, returned: false }),
      ],
    });
    expect(boundary.integrity.anomalies.duplicateEpisodeIdsList).toEqual([5]);
    expect(boundary.integrity.anomalies.duplicateAirdateConflictIds).toEqual([5]);
    expect(boundary.integrity.dateCoverage.populations.omitted).toMatchObject({
      rows: 5,
      missingRows: 1,
      invalidRows: 1,
    });
  });

  it('does not use failed or subject retrieval timestamps as the implicit as-of', async () => {
    const successful = await new EpisodeIntegrityService(
      buildClient({ total: 1, limit: 50, offset: 0, data: [episode(1)] }),
      () => new Date('2040-01-02T03:04:05.000Z'),
    ).getEpisodeIntegrity(123);
    const episodeAttempt = successful.source.attempts.find(
      (attempt) => attempt.operation === 'GET /v0/episodes',
    );
    expect(successful.asOf).toMatchObject({
      source: 'retrieval',
      retrievedAt: episodeAttempt?.retrievedAt,
      evaluatedAt: '2040-01-02T03:04:05.000Z',
    });
    expect(successful.asOf.retrievedAt).toBe(
      successful.source.attempts.find((attempt) => attempt.operation === 'GET /v0/episodes')
        ?.retrievedAt,
    );

    const subjectOnly = await new EpisodeIntegrityService(
      buildClientWithStatuses(200, 503),
      () => new Date('2040-01-02T03:04:05.000Z'),
    ).getEpisodeIntegrity(123);
    expect(subjectOnly.asOf).toEqual({
      date: '2040-01-02',
      source: 'evaluation',
      evaluatedAt: '2040-01-02T03:04:05.000Z',
    });
    expect(subjectOnly.asOf).not.toHaveProperty('retrievedAt');
    expect(subjectOnly.source.attempts[0]).toHaveProperty('retrievedAt');
    expect(subjectOnly.source.attempts[1]).not.toHaveProperty('retrievedAt');
    expect(subjectOnly.integrity.dateCoverage.state).toBe('not_computable');

    const bothUnavailable = await new EpisodeIntegrityService(
      buildClientWithStatuses(503, 503),
      () => new Date('2040-01-02T03:04:05.000Z'),
    ).getEpisodeIntegrity(123);
    expect(bothUnavailable.asOf.source).toBe('evaluation');
    expect(bothUnavailable.asOf).not.toHaveProperty('retrievedAt');
    expect(bothUnavailable.integrity.dateCoverage.state).toBe('not_computable');
  });
});
