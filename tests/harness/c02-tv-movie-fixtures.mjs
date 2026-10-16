import {
  C02_DELTA_RULE,
  C02_LIMITATIONS,
  C02_OFFICIAL_V0_OPERATIONS,
} from '../../scripts/lib/c02-tv-movie-comparison-evidence.mjs';

// Synthetic unit fixture only; these values are not live C02 evidence.

export const C02_COMPARISON_RESULT = {
  subjectIds: [1940, 1941],
  state: 'complete',
  subjects: [
    {
      subjectId: 1940,
      state: 'complete',
      subject: {
        id: 1940,
        type: 'TV',
        name: 'カードキャプターさくら',
        nameCn: '魔卡少女樱',
        episodesReported: 70,
      },
      stats: { state: 'complete', score: 7.2, collectionTotal: 10000 },
    },
    {
      subjectId: 1941,
      state: 'complete',
      subject: {
        id: 1941,
        type: 'movie',
        name: '劇場版 カードキャプターさくら',
        nameCn: '魔卡少女樱 香港之旅',
        episodesReported: 1,
      },
      stats: { state: 'complete', score: 7.5, collectionTotal: 2000 },
    },
  ],
  metrics: [
    { key: 'episodesReported', values: [70, 1], delta: -69, deltaPrecision: 0, state: 'complete' },
    {
      key: 'totalEpisodesReported',
      values: [70, 1],
      delta: -69,
      deltaPrecision: 0,
      state: 'complete',
    },
    { key: 'score', values: [7.2, 7.5], delta: 0.3, deltaPrecision: 1, state: 'complete' },
    { key: 'rank', values: [350, 320], delta: -30, deltaPrecision: 0, state: 'complete' },
    {
      key: 'ratingTotal',
      values: [8000, 1500],
      delta: -6500,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'collectionTotal',
      values: [10000, 2000],
      delta: -8000,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'ratingPopulation',
      values: [8000, 1500],
      delta: -6500,
      deltaPrecision: 0,
      state: 'complete',
    },
    { key: 'ratingMean', values: [7.4, 7.5], delta: 0.1, deltaPrecision: 1, state: 'complete' },
    {
      key: 'ratingStandardDeviation',
      values: [1.15, 1.25],
      delta: 0.1,
      deltaPrecision: 2,
      state: 'complete',
    },
    {
      key: 'collectionPopulation',
      values: [12000, 3500],
      delta: -8500,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'collectionCompletionRate',
      values: [0.68, 0.72],
      delta: 0.04,
      deltaPrecision: 3,
      state: 'complete',
    },
  ],
  overlaps: { cast: { state: 'complete' }, staff: { state: 'complete' } },
  formulaVersion: 'subject-comparison-v2',
  coverage: {
    requestedSubjects: 2,
    returnedSubjects: 2,
    subjectsComplete: 2,
    subjectsPartial: 0,
    subjectsUnavailable: 0,
    subjectsNotFound: 0,
    metricsComplete: 11,
    metricsUnknown: 0,
    metricsConflict: 0,
    limits: { maxSubjects: 2, maxCast: 1, maxStaff: 1, maxRelations: 1, maxOverlapItems: 24 },
  },
  source: {
    official: {
      class: 'official-v0',
      operations: [...C02_OFFICIAL_V0_OPERATIONS],
      attemptedAt: '2026-10-16T10:00:00.000Z',
      retrievedAt: '2026-10-16T10:00:01.000Z',
    },
  },
  warnings: [],
};

export const C02_ANSWER = JSON.stringify({
  schemaVersion: 1,
  subjectIds: [1940, 1941],
  subjects: [
    { subjectId: 1940, name: 'カードキャプターさくら' },
    { subjectId: 1941, name: '劇場版 カードキャプターさくら' },
  ],
  metrics: [
    { key: 'episodesReported', values: [70, 1], delta: -69, state: 'complete' },
    { key: 'score', values: [7.2, 7.5], delta: 0.3, state: 'complete' },
    { key: 'collectionTotal', values: [10000, 2000], delta: -8000, state: 'complete' },
  ],
  deltaRule: C02_DELTA_RULE,
  limitations: C02_LIMITATIONS,
});

export const C02_EVENTS = {
  processExitCode: 0,
  eventStreamParsed: true,
  turnCompleted: true,
  codexMcpToolEventCount: 1,
  codexErrorItemCount: 0,
  nonMcpToolEventCount: 0,
  nonMcpToolTypes: [],
  shellToolCallCount: 0,
  mcpServerNames: ['bgk_c02_one_tool'],
  allowedCallCount: 1,
  deniedCallCount: 0,
};
