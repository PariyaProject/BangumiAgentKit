import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type {
  PersonActivityResult,
  SubjectComparisonResult,
  SubjectOverviewResult,
  SubjectStatsIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import type { ToolRegistry } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import {
  MCP_TOOL_TEXT_MAX_UTF8_BYTES,
  presentMcpToolResult,
} from '../../apps/mcp/src/result-presenter.js';

function makePersonActivityResult(): PersonActivityResult {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    subjectId: 40000 + index,
    subjectName: `A long Japanese title ${index} with enough detail for the MCP projection fixture`,
    subjectNameCn: `用于验证有限文字视图的作品 ${index}`,
    subjectType: 'anime' as const,
    platform: 'TV',
    firstAirDate: '2026-04-01',
    month: '2026-04',
    relationKind: 'voice' as const,
    characterName: `角色 ${index}`,
    rawRole: '主角',
    roleFamily: 'main' as const,
    origin: {
      state: 'not_observed' as const,
      metaTags: ['漫画'],
      metaTagsCoverage: {
        state: 'complete' as const,
        observed: 1,
        valid: 1,
        returned: 1,
        omitted: 0,
        malformed: 0,
        textTruncated: 0,
        truncated: false,
      },
    },
  }));

  const byMonth = Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, '0')}`,
    creditRows: index + 1,
    uniqueSubjects: index + 1,
    uniqueCharacters: index + 1,
  }));

  const origin = {
    explicitOriginalSubjects: 2,
    notObservedSubjects: 18,
    unknownSubjects: 0,
  };

  return {
    personId: 13684,
    person: {
      id: 13684,
      name: '水瀬いのり',
      nameCn: '水濑祈',
      type: 1,
      career: ['seiyu'],
      summary: '',
    },
    state: 'partial',
    kind: 'voice',
    media: 'tv',
    window: {
      months: 12,
      start: '2025-10-04',
      end: '2026-10-04',
      monthKeys: byMonth.map((item) => item.month),
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows,
    summary: {
      creditRows: 40,
      uniqueSubjects: 20,
      uniqueCharacters: 10,
      byRole: [
        {
          key: 'main',
          label: '主角',
          creditRows: 40,
          uniqueSubjects: 20,
          uniqueCharacters: 10,
        },
      ],
      byMedia: [
        {
          key: 'anime',
          label: 'TV动画',
          creditRows: 40,
          uniqueSubjects: 20,
          uniqueCharacters: 10,
        },
      ],
      byMonth,
      origin,
    },
    coverage: {
      relationRowsObserved: 80,
      relationRowsSelected: 40,
      relationRowsDroppedAtLimit: 40,
      relationSelectionStrategy: 'deterministic_even_spread',
      sampled: true,
      subjectIdsObserved: 40,
      subjectIdsSelected: 40,
      subjectIdsDroppedAtRelationLimit: 0,
      subjectDetailIdsObserved: 40,
      subjectDetailRequests: 40,
      subjectDetailsSucceeded: 40,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 40,
      rowsReturned: 40,
      outputTruncated: false,
      uniqueSubjects: 20,
      uniqueCharacters: 10,
      missingSubjectIdRows: 0,
      missingDateRows: 0,
      invalidDateRows: 0,
      outsideWindowRows: 0,
      mediaExcludedRows: 0,
      mediaUnknownRows: 0,
      staffRoleExcludedRows: 0,
      staffRoleUnknownRows: 0,
      maxRelations: 40,
      maxSubjectDetails: 40,
      maxRows: 40,
      detailConcurrency: 1,
      responseLimitBytes: 1_048_576,
      truncated: true,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      origin: {
        ...origin,
        subjectsObserved: 20,
        subjectsWithMetaTags: 20,
        subjectsPartial: 0,
        subjectsUnknown: 0,
        tagsObserved: 20,
        tagsValid: 20,
        tagsReturned: 20,
        tagsOmitted: 0,
        malformedTagValues: 0,
        textTruncatedTags: 0,
        truncatedSubjects: 0,
        truncated: false,
        maxTagsPerSubject: 10,
        maxTagCharacters: 80,
        responseLimitBytes: 1_048_576,
      },
    },
    exclusions: [
      {
        reason: 'subject_detail_cap',
        count: 12,
        sampleSubjectIds: Array.from({ length: 40 }, (_, index) => 40000 + index),
      },
    ],
    sourceOperations: [
      { operation: 'getPersonSubjects', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'getSubject', attempted: 40, succeeded: 40, failed: 0 },
      { operation: 'getSubjectStats', attempted: 0, succeeded: 0, failed: 0 },
    ],
    evidence: Array.from({ length: 80 }, (_, index) => ({
      source: index % 2 === 0 ? ('official-v0' as const) : ('derived-s7' as const),
      operation: `operation-${index}-with-verbose-provenance-details`,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      formulaVersion: 'person-activity-comparison-v1',
      description: 'A deliberately verbose evidence description that remains in structuredContent.',
    })),
    limitations: Array.from(
      { length: 10 },
      (_, index) =>
        `Limitation ${index}: the bounded observation does not establish complete career or date coverage.`,
    ),
    warnings: Array.from({ length: 10 }, (_, index) => ({
      code: `WARNING_${index}`,
      state: 'partial' as const,
      message: `Warning ${index}: this bounded result retains raw relation and coverage details.`,
    })),
  };
}

function makeSubjectComparisonStats(
  subjectId: number,
  completionRate: number,
): SubjectStatsIntelligenceResult {
  const completionFormula = {
    id: 'bangumi.subject.completion.v1',
    version: 1,
    inputs: [
      'collection.wish',
      'collection.collect',
      'collection.doing',
      'collection.on_hold',
      'collection.dropped',
    ],
    evidenceStatus: 'empirically_verified' as const,
    description: 'collect / (wish + collect + doing + on_hold + dropped)',
  };
  const derivedSource = {
    class: 'derived-s7' as const,
    operations: ['subject-comparison-statistics'],
    retrievedAt: '2026-10-05T00:00:00.000Z',
  };
  return {
    subjectId,
    state: 'complete',
    rating: {
      state: 'complete',
      population: 100,
      mean: 8.2,
      standardDeviation: 0.8,
      distribution: Array.from({ length: 10 }, (_, index) => ({
        score: index + 1,
        count: index + 1,
        percentage: (index + 1) / 5,
      })),
      formulas: {
        percentages: {
          id: 'rating-percentages-v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'rating bucket count / histogram population × 100',
        },
        histogramMean: {
          id: 'rating-mean-v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'weighted mean over the rating histogram',
        },
        populationStandardDeviation: {
          id: 'rating-sd-v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'population standard deviation over the rating histogram',
        },
      },
    },
    collection: {
      state: 'complete',
      total: 100,
      distribution: [
        { status: 'wish', count: 10, percentage: 10 },
        { status: 'collect', count: 40, percentage: 40 },
        { status: 'doing', count: 20, percentage: 20 },
        { status: 'on_hold', count: 15, percentage: 15 },
        { status: 'dropped', count: 15, percentage: 15 },
      ],
      completionRate,
      completionState: 'complete',
      formulas: {
        percentages: {
          id: 'collection-percentages-v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'collection bucket count / population × 100',
        },
        completion: completionFormula,
      },
    },
    coverage: {
      sourceRequestsAttempted: 2,
      sourceRequestsSucceeded: 2,
      ratingBucketsExpected: 10,
      ratingBucketsObserved: 10,
      collectionBucketsExpected: 5,
      collectionBucketsObserved: 5,
      ratingPopulation: 100,
      collectionPopulation: 100,
      formulasAttempted: 4,
      formulasComplete: 4,
      formulasPartial: 0,
      formulasNotComputable: 0,
      formulasConflict: 0,
    },
    source: {
      official: {
        class: 'official-v0',
        operations: ['getSubject', 'getSubjectStats'],
        retrievedAt: '2026-10-05T00:00:00.000Z',
      },
      derived: derivedSource,
    },
    evidence: [],
    warnings: [],
    limitations: [],
    retrievedAt: '2026-10-05T00:00:00.000Z',
  };
}

function makeSubjectComparisonResult(): SubjectComparisonResult {
  const makeSubject = (
    subjectId: number,
    name: string,
    nameCn: string,
    score: number,
    episodesReported: number,
    totalEpisodesReported: number,
    completionRate: number,
  ): SubjectComparisonResult['subjects'][number] => {
    const officialSource = {
      class: 'official-v0' as const,
      operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/stats'],
      attemptedAt: '2026-10-05T00:00:00.000Z',
      retrievedAt: '2026-10-05T00:00:00.000Z',
    };
    const derivedSource = {
      class: 'derived-s7' as const,
      operations: ['subject-comparison-statistics'],
      attemptedAt: '2026-10-05T00:00:00.000Z',
      retrievedAt: '2026-10-05T00:00:00.000Z',
    };
    return {
      subjectId,
      state: 'complete',
      subject: {
        id: subjectId,
        type: 'anime',
        name,
        nameCn,
        date: '2023-01-01',
        platform: 'TV',
        episodesReported,
        totalEpisodesReported,
      },
      stats: {
        state: 'complete',
        score,
        rank: 10,
        ratingTotal: 100,
        collectionTotal: 100,
      },
      sections: { stats: 'complete', cast: 'partial', staff: 'partial', relations: 'complete' },
      coverage: {
        sourceRequestsAttempted: 8,
        sourceRequestsSucceeded: 8,
        sectionsComplete: 2,
        sectionsPartial: 2,
        sectionsUnavailable: 0,
        sectionsNotComputable: 0,
        truncatedSections: ['cast', 'staff'],
        limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
      },
      source: { official: officialSource, derived: derivedSource },
      statistics: makeSubjectComparisonStats(subjectId, completionRate),
      evidence: [],
      warnings: [],
      limitations: [],
    };
  };
  const subjects: SubjectComparisonResult['subjects'] = [
    makeSubject(400602, '葬送のフリーレン', '葬送的芙莉莲', 8.6, 28, 28, 0.42),
    makeSubject(420628, '薬屋のひとりごと', '药屋少女的呢喃', 7.5, 24, 26, 0.31),
  ];
  const metrics: SubjectComparisonResult['metrics'] = [
    {
      key: 'score',
      label: '官方评分',
      values: [8.6, 7.5],
      delta: -1.1,
      deltaPrecision: 1,
      state: 'complete',
    },
    {
      key: 'episodesReported',
      label: '条目报告话数',
      values: [28, 24],
      delta: -4,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'totalEpisodesReported',
      label: '条目报告总话数',
      values: [28, 26],
      delta: -2,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'collectionCompletionRate',
      label: '观察完成率',
      values: [0.42, 0.31],
      delta: -0.11,
      deltaPrecision: 3,
      state: 'complete',
    },
  ];
  const overlapCoverage = {
    state: 'partial' as const,
    left: {
      state: 'partial' as const,
      rowsObserved: 100,
      rowsReturned: 20,
      uniqueIdsReturned: 20,
      missingIdRows: 0,
      truncated: true,
    },
    right: {
      state: 'partial' as const,
      rowsObserved: 90,
      rowsReturned: 20,
      uniqueIdsReturned: 20,
      missingIdRows: 0,
      truncated: true,
    },
    candidateIds: 40,
    matchedIds: 24,
    returned: 24,
    omitted: 0,
    truncated: true,
  };
  const overlapItems = Array.from({ length: 24 }, (_, index) => ({
    personId: 800000 + index,
    name: `共同人物 ${index}`,
    career: ['seiyu'],
    credits: [],
  }));
  const source = {
    official: {
      class: 'official-v0' as const,
      operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/stats'],
      attemptedAt: '2026-10-05T00:00:00.000Z',
      retrievedAt: '2026-10-05T00:00:00.000Z',
    },
    derived: {
      class: 'derived-s7' as const,
      operations: ['subject-comparison', 'subject-comparison-statistics'],
      attemptedAt: '2026-10-05T00:00:00.000Z',
      retrievedAt: '2026-10-05T00:00:00.000Z',
    },
  };
  return {
    subjectIds: [400602, 420628],
    state: 'partial',
    subjects,
    metrics,
    formulaVersion: 'subject-comparison-v2',
    statisticsFormulaVersion: 'subject-comparison-statistics-v1',
    overlapFormulaVersion: 'subject-comparison-overlap-v1',
    overlaps: {
      cast: { state: 'partial', items: overlapItems, coverage: overlapCoverage },
      staff: { state: 'partial', items: overlapItems, coverage: overlapCoverage },
    },
    coverage: {
      requestedSubjects: 2,
      returnedSubjects: 2,
      subjectsComplete: 2,
      subjectsPartial: 0,
      subjectsUnavailable: 0,
      subjectsNotFound: 0,
      metricsComplete: 4,
      metricsUnknown: 0,
      metricsConflict: 0,
      limits: { maxSubjects: 2, maxCast: 4, maxStaff: 12, maxRelations: 8, maxOverlapItems: 24 },
    },
    source,
    evidence: [
      {
        source: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}',
        attemptedAt: '2026-10-05T00:00:00.000Z',
        retrievedAt: '2026-10-05T00:00:00.000Z',
        subjectIds: [400602, 420628],
      },
      {
        source: 'derived-s7',
        operation: 'subject-comparison-statistics',
        formulaVersion: 'subject-comparison-statistics-v1',
        description: 'Observation formula is sample-verified, not an official API contract.',
        subjectIds: [400602, 420628],
      },
    ],
    warnings: [
      {
        code: 'PARTIAL_OVERLAP',
        state: 'partial',
        message: 'Bounded cast and staff overlap does not establish complete credits.',
      },
    ],
    limitations: [
      'One current snapshot does not establish historical trends or exhaustive credits.',
    ],
  };
}

function makePersonActivityComparison(
  result: PersonActivityResult,
  options: { unavailable?: boolean; highVolume?: boolean } = {},
): NonNullable<PersonActivityResult['comparison']> {
  const unavailable = options.unavailable === true;
  const highVolume = options.highVolume === true;
  const recentState = unavailable ? ('unavailable' as const) : ('partial' as const);
  const previousState = unavailable ? ('unavailable' as const) : ('complete' as const);
  const breakdownCount = highVolume ? 8 : 2;
  const periodSummary = {
    ...result.summary,
    creditRows: unavailable ? 0 : result.summary.creditRows,
    uniqueSubjects: unavailable ? 0 : result.summary.uniqueSubjects,
    uniqueCharacters: unavailable ? 0 : result.summary.uniqueCharacters,
    byRole: Array.from({ length: breakdownCount }, (_, index) => ({
      key: `role-${index}`,
      label: `职位标签 ${index}`,
      creditRows: index + 1,
      uniqueSubjects: index + 1,
      uniqueCharacters: index + 1,
    })),
    byMedia: Array.from({ length: highVolume ? 4 : 2 }, (_, index) => ({
      key: `media-${index}`,
      label: `媒介 ${index}`,
      creditRows: index + 2,
      uniqueSubjects: index + 2,
      uniqueCharacters: index + 1,
    })),
    byMonth: Array.from({ length: highVolume ? 36 : 6 }, (_, index) => ({
      month: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
      creditRows: index + 1,
      uniqueSubjects: index + 1,
      uniqueCharacters: index + 1,
    })),
  };
  const recentCoverage = {
    ...result.coverage,
    rowsEligible: unavailable ? 0 : 20,
    rowsReturned: unavailable ? 0 : 20,
    truncated: !unavailable,
  };
  const previousCoverage = {
    ...recentCoverage,
    truncated: unavailable,
  };
  const exclusions = (
    highVolume
      ? [
          'missing_subject_id',
          'subject_detail_cap',
          'subject_detail_unavailable',
          'missing_date',
          'invalid_date',
          'outside_window',
          'media_excluded',
          'media_unknown',
        ]
      : ['subject_detail_cap']
  ) as PersonActivityResult['exclusions'][number]['reason'][];
  const periodExclusions = exclusions.map((reason, index) => ({
    reason,
    count: index + 1,
    sampleSubjectIds: Array.from({ length: highVolume ? 20 : 1 }, (_, id) => 80000 + id),
  }));
  const recentWindow = {
    ...result.window,
    ...(highVolume
      ? {
          months: 36,
          start: '2023-10-04',
          end: '2026-10-04',
          monthKeys: Array.from({ length: 36 }, (_, index) => `month-${index}`),
        }
      : { start: '2025-10-04', end: '2026-10-04' }),
  };
  const previousWindow = {
    ...recentWindow,
    start: highVolume ? '2020-10-04' : '2024-10-04',
    end: highVolume ? '2023-10-03' : '2025-10-03',
  };
  const recent = {
    window: recentWindow,
    summary: periodSummary,
    state: recentState,
    coverage: recentCoverage,
    exclusions: periodExclusions,
  };
  const previous = {
    window: previousWindow,
    summary: periodSummary,
    state: previousState,
    coverage: previousCoverage,
    exclusions: unavailable ? periodExclusions : [],
  };

  return {
    state: unavailable ? 'unavailable' : 'partial',
    windowMonths: recentWindow.months,
    recent,
    previous,
    delta: unavailable
      ? { state: 'unavailable', creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 }
      : { state: 'partial', creditRows: 4, uniqueSubjects: 3, uniqueCharacters: 2 },
    peak: {
      metric: 'uniqueSubjects',
      state: unavailable ? 'unavailable' : 'partial',
      months: unavailable
        ? []
        : Array.from({ length: highVolume ? 36 : 1 }, (_, index) => ({
            period: 'recent' as const,
            month: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
            creditRows: index + 1,
            uniqueSubjects: index + 1,
            uniqueCharacters: index + 1,
          })),
    },
    sourceOperations: {
      recent: result.sourceOperations,
      previous: result.sourceOperations,
    },
  };
}

function makeSubjectOverviewResult(): SubjectOverviewResult {
  const staffItems = Array.from({ length: 80 }, (_, index) => {
    const groupIndex = Math.floor(index / 8);
    const relation =
      groupIndex === 0 ? '原作' : groupIndex === 1 ? '导演' : `职员原始标签 ${groupIndex}`;
    return {
      id: 50000 + index,
      name: `制作人员 ${index} 的较长显示名称`,
      type: 1,
      career: ['producer'],
      relation,
      rawRelation: relation,
      eps: '',
    };
  });

  const groups = Array.from({ length: 10 }, (_, index) => ({
    relation: index === 0 ? '原作' : index === 1 ? '导演' : `职员原始标签 ${index}`,
    count: 8,
    memberIds: Array.from({ length: 8 }, (_, member) => 50000 + index * 8 + member),
  }));

  const castItems = Array.from({ length: 24 }, (_, index) => ({
    character: {
      id: 60000 + index,
      name: `非常长的角色名称 ${index} チトとユーリの長い説明`,
      type: 1,
      summary: 'A long description is deliberately kept only in structuredContent.',
    },
    relation: index === 0 ? '主角' : '配角',
    actors: [
      {
        id: 70000 + index,
        name: `声优名称 ${index}`,
        career: ['seiyu'],
      },
    ],
    actorCoverage: { observed: 1, returned: 1, truncated: false },
  }));

  return {
    state: 'partial',
    subjectId: 218707,
    subject: {
      id: 218707,
      type: 'anime',
      name: 'Shoujo Shuumatsu Ryokou',
      nameCn: '少女终末旅行',
      summary: 'A'.repeat(2500),
      nsfw: false,
      locked: false,
      date: '2017-10-06',
      platform: 'TV',
      eps: 12,
      totalEpisodes: 12,
    },
    stats: {
      state: 'partial',
      data: {
        score: 8.6,
        rank: 42,
        ratingTotal: 100,
        ratingHistogram: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [String(index + 1), index + 1]),
        ),
        collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
      },
      coverage: { state: 'partial', observed: 100, returned: 1, truncated: true },
    },
    cast: {
      state: 'partial',
      items: castItems,
      coverage: { state: 'partial', observed: 100, returned: 24, truncated: true },
      actorCoverage: { observed: 24, returned: 24, truncated: false },
    },
    staff: {
      state: 'partial',
      items: staffItems,
      groups,
      coverage: { state: 'partial', observed: 100, returned: 80, truncated: true },
    },
    relations: {
      state: 'partial',
      items: Array.from({ length: 30 }, (_, index) => ({
        id: 80000 + index,
        type: 'anime' as const,
        name: `Related Original Title ${index}`,
        nameCn: `关联作品 ${index}`,
        relation: index === 0 ? '续集' : '原作',
      })),
      coverage: { state: 'partial', observed: 90, returned: 30, truncated: true },
    },
    coverage: {
      sourceRequestsAttempted: 5,
      sourceRequestsSucceeded: 5,
      sectionsComplete: 0,
      sectionsPartial: 4,
      sectionsUnavailable: 0,
      sectionsNotComputable: 0,
      truncatedSections: ['cast', 'staff', 'relations'],
      limits: { maxCast: 24, maxStaff: 80, maxRelations: 30 },
      actorLimits: { perCharacter: 4, total: 32 },
    },
    evidence: Array.from({ length: 50 }, (_, index) => ({
      source: index % 2 === 0 ? ('official-v0' as const) : ('derived-s7' as const),
      operation: `source-operation-${index}`,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      formulaVersion: 'subject-overview-composition-v1',
      description: 'A verbose provenance description remains in structuredContent.',
    })),
    limitations: Array.from(
      { length: 10 },
      (_, index) => `Limitation ${index}: the current overview is a bounded sample.`,
    ),
    warnings: Array.from({ length: 10 }, (_, index) => ({
      code: `OVERVIEW_WARNING_${index}`,
      state: 'partial' as const,
      message: `Warning ${index}: this section remains a bounded result.`,
      section: 'staff' as const,
    })),
  };
}

function makeSubjectStaffResult() {
  const rawRelations = [
    '原画',
    '主题歌作曲',
    '动画制作',
    '音响监督',
    '监督',
    '脚本',
    '角色设计',
    '总作画监督',
    '美术监督',
    '摄影监督',
    '剪辑',
    '音响效果',
    '音乐制作',
    '道具设计',
    '色彩设计',
    '制作',
    '插画',
    '设定',
    '企画',
    '编集',
    '背景美术',
    '动画制片人',
  ];
  const productionStaff = Array.from({ length: 100 }, (_, index) => {
    const rawRelation =
      index === 0 ? ` ${rawRelations[0]} ` : rawRelations[index % rawRelations.length]!;
    return {
      id: 90000 + index,
      name: `制作人员${index}-${'声'.repeat(120)}`,
      type: 1,
      career: ['producer'],
      relation: rawRelation.trim() || '未知',
      rawRelation,
      eps: '',
    };
  });
  const groups = rawRelations
    .map((relation) => {
      const memberIds = productionStaff
        .filter((member) => member.relation === relation)
        .map((member) => member.id);
      return { relation, count: memberIds.length, memberIds };
    })
    .sort((left, right) => right.count - left.count || left.relation.localeCompare(right.relation));
  const cast = Array.from({ length: 7 }, (_, index) => ({
    character: {
      id: 80000 + index,
      name: `角色${index}-${'終'.repeat(80)}`,
      type: 1,
      summary: 'A character summary remains available in structuredContent.',
    },
    relation: index === 0 ? '主角' : '配角',
    actors: Array.from({ length: 2 }, (_, actorIndex) => ({
      id: 70000 + index * 2 + actorIndex,
      name: `声优${index}-${actorIndex}-${'声'.repeat(60)}`,
      career: ['seiyu'],
    })),
  }));

  return {
    state: 'partial',
    subjectId: 218707,
    productionStaff,
    cast,
    groups,
    coverage: {
      state: 'partial',
      retrievedAt: '2026-10-04T00:00:00.000Z',
      productionStaff: { observed: 115, returned: 100, truncated: true },
      cast: { observed: 7, returned: 7, truncated: false },
      limit: 200,
    },
    evidence: [
      { source: 'official-v0', operation: 'GET /v0/subjects/{subject_id}/persons' },
      { source: 'official-v0', operation: 'GET /v0/subjects/{subject_id}/characters' },
      { source: 'derived-s7', formulaVersion: 'subject-staff-grouping-v1' },
    ],
    warnings: [
      {
        code: 'OUTPUT_TRUNCATED',
        state: 'partial',
        message: '制作人员或角色声优关系达到显示上限。',
      },
    ],
    capabilityStates: {
      productionStaff: 'partial',
      cast: 'complete',
      recent_activity: 'not_computable',
      workload_trend: 'not_computable',
      historical_growth: 'not_computable',
    },
  };
}

function makeSubjectCastResult() {
  return {
    status: 'ok',
    subjectId: 218707,
    cast: Array.from({ length: 100 }, (_, index) => ({
      character: {
        id: 80000 + index,
        name: `角色${index}-${'終'.repeat(120)}`,
        type: 1,
        summary: `角色简介${'長'.repeat(240)}`,
        images: {
          large: `https://images.example.test/characters/${index}/${'image'.repeat(40)}.jpg`,
        },
      },
      relation: index % 3 === 0 ? '主角' : index % 3 === 1 ? '配角' : '其他',
      actors: Array.from({ length: 2 }, (_, actorIndex) => ({
        id: 70000 + index * 2 + actorIndex,
        name: `声优${index}-${actorIndex}-${'声'.repeat(140)}`,
        career: [`声优${'career'.repeat(40)}`, `演员${'career'.repeat(40)}`],
        image: `https://images.example.test/actors/${index}/${actorIndex}/${'image'.repeat(40)}.jpg`,
      })),
    })),
    observed: 115,
    returned: 100,
    truncated: true,
    schemaDriftRows: 2,
    invalidActorIdRows: 1,
  };
}

async function callMcpToolWithResult(name: string, toolResult: Record<string, unknown>) {
  const registry = {
    getTools: () => [],
    executeTool: async () => toolResult,
  } as unknown as ToolRegistry;
  const app = new BangumiMcpServer({ registry, storage: new MemoryStorage() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.getMcpServer().connect(serverTransport);
  const client = new Client(
    { name: 'result-presenter-test', version: '1.0.0' },
    { capabilities: {} },
  );
  await client.connect(clientTransport);

  try {
    return await client.callTool({ name, arguments: {} });
  } finally {
    await client.close();
    await app.close();
  }
}

describe('MCP tool result presentation', () => {
  it('keeps the existing full pretty JSON text for small and unrelated results', () => {
    const small = { state: 'complete', count: 1 };
    const smallPresentation = presentMcpToolResult('bangumi.get_person_activity', small);
    const unrelatedLarge = { payload: 'x'.repeat(MCP_TOOL_TEXT_MAX_UTF8_BYTES + 10) };
    const unrelatedPresentation = presentMcpToolResult('bangumi.get_subject', unrelatedLarge);

    expect(smallPresentation).toEqual({ text: JSON.stringify(small, null, 2) });
    expect(unrelatedPresentation).toEqual({
      text: JSON.stringify(unrelatedLarge, null, 2),
    });
  });

  it('keeps the text byte bound for pathological long names while retaining full structure', () => {
    const personResult = makePersonActivityResult();
    personResult.person!.name = '水'.repeat(5000);
    const personPresentation = presentMcpToolResult('bangumi.get_person_activity', personResult);
    const personText = JSON.parse(personPresentation.text);

    expect(Buffer.byteLength(personPresentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(personText.person.displayNameTextTruncated).toBe(true);
    expect(personText.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
    expect(personPresentation.structuredContent).toEqual(personResult);

    const overviewResult = makeSubjectOverviewResult();
    overviewResult.subject!.nameCn = '名'.repeat(5000);
    overviewResult.staff.groups[0]!.relation = '原始职位标签'.repeat(1000);
    const overviewPresentation = presentMcpToolResult(
      'bangumi.get_subject_overview',
      overviewResult,
    );
    const overviewText = JSON.parse(overviewPresentation.text);

    expect(Buffer.byteLength(overviewPresentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(overviewText.subject.displayNameTextTruncated).toBe(true);
    expect(overviewText.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
    expect(overviewText.mcpTextProjection.staffGroupsOmittedFromText).toBeGreaterThan(0);
    expect(overviewPresentation.structuredContent).toEqual(overviewResult);
  });

  it('bounds high-volume subject-staff text while preserving raw roles and full structured content', async () => {
    const original = makeSubjectStaffResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_subject_staff',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');
    const includedGroups = parsed.productionStaff.groups as Array<{
      relation: string;
      members: Array<{ id: number; name: string; rawRelation?: string; nameTruncated?: boolean }>;
    }>;

    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(response.structuredContent).toEqual(original);
    expect(parsed).toMatchObject({ state: 'partial', subjectId: 218707 });
    expect(parsed.coverage).toMatchObject({
      productionStaff: { observed: 115, returned: 100, truncated: true },
      cast: { observed: 7, returned: 7, truncated: false },
      limit: 200,
    });
    expect(includedGroups.map((group) => group.relation).sort()).toEqual(
      original.groups.map((group) => group.relation).sort(),
    );
    const originalRow = original.productionStaff[0]!;
    const includedRow = includedGroups
      .flatMap((group) => group.members)
      .find((member) => member.id === originalRow.id);
    expect(includedRow).toMatchObject({
      id: originalRow.id,
      name: expect.any(String),
      rawRelation: originalRow.rawRelation,
      nameTruncated: true,
    });
    expect(parsed.mcpTextProjection).toMatchObject({
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      staffGroupsOmittedFromText: 0,
      staffGroupMembershipsOmittedFromText: expect.any(Number),
      castItemsOmittedFromText: expect.any(Number),
    });
    expect(includedGroups).toHaveLength(22);
    expect(parsed.mcpTextProjection.staffGroupMembershipsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.castItemsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
  });

  it('bounds high-volume subject-cast text while preserving character/actor links and full structure', async () => {
    const original = makeSubjectCastResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_subject_cast',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');
    const includedCast = parsed.cast as Array<{
      character: { id: number; name: string; displayNameTextTruncated?: boolean };
      relation: string;
      actors: Array<{ id: number; name: string; displayNameTextTruncated?: boolean }>;
      actorCount: number;
      actorsOmittedFromText: number;
    }>;

    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(response.structuredContent).toEqual(original);
    expect(parsed).toMatchObject({ status: 'ok', subjectId: 218707 });
    expect(parsed.coverage).toEqual({
      observed: 115,
      returned: 100,
      truncated: true,
      schemaDriftRows: 2,
      invalidActorIdRows: 1,
    });

    const firstSourceRow = original.cast[0]!;
    const firstIncludedRow = includedCast.find(
      (item) => item.character.id === firstSourceRow.character.id,
    );
    expect(firstIncludedRow).toMatchObject({
      character: {
        id: firstSourceRow.character.id,
        name: expect.any(String),
        displayNameTextTruncated: true,
      },
      relation: '主角',
      actorCount: 2,
      actorsOmittedFromText: 1,
      actors: [
        {
          id: firstSourceRow.actors[0]!.id,
          name: expect.any(String),
          displayNameTextTruncated: true,
        },
      ],
    });
    expect(includedCast.length).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection).toMatchObject({
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      castRowsReturned: 100,
      castRowsIncluded: includedCast.length,
      castRowsOmittedFromText: 100 - includedCast.length,
      actorRowsReturned: 200,
      actorRowsIncluded: includedCast.reduce(
        (total: number, item: { actors: unknown[] }) => total + item.actors.length,
        0,
      ),
      actorRowsOmittedFromText: expect.any(Number),
    });
    expect(parsed.mcpTextProjection.castRowsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.actorRowsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
    expect(JSON.stringify(parsed)).not.toContain('角色简介');
    expect(JSON.stringify(parsed)).not.toContain('career');
    expect(JSON.stringify(parsed)).not.toContain('images.example.test');
  });

  it('bounds subject-comparison text while retaining identities, requested metrics, states, and full structure', async () => {
    const original = makeSubjectComparisonResult();
    original.subjects[0].subject!.name = '日'.repeat(5000);
    original.subjects[0].subject!.nameCn = '名'.repeat(5000);
    original.subjects[0].source.official.operations = Array.from(
      { length: 20 },
      (_, index) => `official-operation-${index}-${'x'.repeat(500)}`,
    );
    original.evidence = Array.from({ length: 30 }, (_, index) => ({
      source: index % 2 === 0 ? ('official-v0' as const) : ('derived-s7' as const),
      operation: `operation-${index}-${'o'.repeat(200)}`,
      description: `Evidence description ${index}: ${'detail '.repeat(100)}`,
      subjectIds: [400602, 420628],
    }));
    original.warnings = Array.from({ length: 12 }, (_, index) => ({
      code: `WARNING_${index}`,
      state: 'partial' as const,
      message: `Warning ${index}: ${'coverage detail '.repeat(100)}`,
    }));
    original.limitations = Array.from(
      { length: 12 },
      (_, index) => `Limitation ${index}: ${'bounded comparison detail '.repeat(100)}`,
    );

    const fullJsonBytes = Buffer.byteLength(JSON.stringify(original, null, 2), 'utf8');
    const response = await callMcpToolWithResult(
      'bangumi.get_subject_comparison',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(fullJsonBytes).toBeGreaterThan(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(response.structuredContent).toEqual(original);
    expect(parsed).toMatchObject({
      state: 'partial',
      subjectIds: [400602, 420628],
      coverage: { requestedSubjects: 2, returnedSubjects: 2 },
      source: {
        official: { class: 'official-v0', attemptedAt: '2026-10-05T00:00:00.000Z' },
        derived: { class: 'derived-s7', attemptedAt: '2026-10-05T00:00:00.000Z' },
      },
    });
    expect(parsed.subjects[0].subject).toMatchObject({
      id: 400602,
      name: expect.any(String),
      nameTextTruncated: true,
      nameCnTextTruncated: true,
      episodesReported: 28,
      totalEpisodesReported: 28,
    });
    expect(parsed.subjects[1].subject).toMatchObject({
      id: 420628,
      nameCn: '药屋少女的呢喃',
      episodesReported: 24,
      totalEpisodesReported: 26,
    });
    expect(parsed.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'score',
          values: [8.6, 7.5],
          delta: -1.1,
          state: 'complete',
        }),
        expect.objectContaining({
          key: 'episodesReported',
          values: [28, 24],
          delta: -4,
          state: 'complete',
        }),
        expect.objectContaining({
          key: 'totalEpisodesReported',
          values: [28, 26],
          delta: -2,
          state: 'complete',
        }),
        expect.objectContaining({
          key: 'collectionCompletionRate',
          values: [0.42, 0.31],
          delta: -0.11,
          deltaPrecision: 3,
          state: 'complete',
        }),
      ]),
    );
    expect(parsed.subjects[0].statistics).toMatchObject({
      state: 'complete',
      collection: {
        completionRate: 0.42,
        completionState: 'complete',
        conflictCount: 0,
      },
    });
    expect(parsed.collectionCompletionFormula).toMatchObject({
      evidenceStatus: 'empirically_verified',
      description: 'collect / (wish + collect + doing + on_hold + dropped)',
    });
    expect(parsed.overlaps.cast).toMatchObject({
      state: 'partial',
      sourceReturned: 24,
      sourceOmitted: 0,
      itemsOmittedFromText: 24,
    });
    expect(parsed.mcpTextProjection).toMatchObject({
      version: 'subject-comparison-mcp-text-v1',
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
      structuredContentHasFullResult: true,
      overlapItemsOmittedFromText: 48,
      evidenceRecordsOmittedFromText: expect.any(Number),
      warningRecordsOmittedFromText: expect.any(Number),
    });
    expect(parsed.mcpTextProjection.textViewScope).toContain('not evidence of absence');
    expect(parsed.evidence.length).toBeLessThan(original.evidence.length);
  });

  it('keeps unknown and conflict metrics explicit in the bounded comparison projection', () => {
    const original = makeSubjectComparisonResult();
    original.subjects[0].subject!.name = '日'.repeat(5000);
    original.metrics[0] = {
      ...original.metrics[0]!,
      state: 'conflict',
      delta: null,
      conflicts: [
        {
          side: 'A',
          reason: 'Official candidate values disagree.',
          candidates: [{ source: { class: 'official-v0', provider: 'fixture' }, value: 8.6 }],
        },
      ],
    };
    original.metrics[3] = {
      ...original.metrics[3]!,
      values: [null, 0.31],
      delta: null,
      state: 'unknown',
    };

    const presentation = presentMcpToolResult('bangumi.get_subject_comparison', original);
    const parsed = JSON.parse(presentation.text);

    expect(Buffer.byteLength(presentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(presentation.structuredContent).toEqual(original);
    expect(parsed.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'score',
          values: [8.6, 7.5],
          delta: null,
          state: 'conflict',
          conflicts: [expect.objectContaining({ side: 'A', candidateCount: 1 })],
        }),
        expect.objectContaining({
          key: 'collectionCompletionRate',
          values: [null, 0.31],
          delta: null,
          state: 'unknown',
        }),
      ]),
    );
  });

  it('keeps the minimum comparison fallback bounded for partial A/B conflict candidates', () => {
    const original = makeSubjectComparisonResult();
    const reason = 'Official candidate values disagree.';
    const conflictCandidates = (side: 'subject' | 'stats', value: number) => [
      {
        source: {
          class: 'official-v0',
          provider: side,
          operation: `GET /v0/subjects/${side === 'subject' ? 400602 : 400602}/stats`,
        },
        value,
      },
      {
        source: {
          class: 'official-v0',
          provider: side === 'subject' ? 'subject-mirror' : 'stats-mirror',
          operation: `GET /v0/subjects/${side === 'subject' ? 400602 : 420628}/stats`,
        },
        value: value - 0.2,
      },
    ];
    const scoreConflicts = [
      {
        side: 'A' as const,
        reason,
        subjectValue: 8.6,
        statsValue: 8.4,
        candidates: conflictCandidates('subject', 8.6),
      },
      {
        side: 'B' as const,
        reason,
        subjectValue: 7.5,
        statsValue: 7.3,
        candidates: conflictCandidates('stats', 7.5),
      },
    ];

    original.state = 'partial';
    original.subjects.forEach((subject) => {
      subject.state = 'partial';
      subject.stats.state = 'partial';
      subject.stats.conflicts = {
        score: {
          reason,
          subjectValue: subject.subjectId === 400602 ? 8.6 : 7.5,
          statsValue: subject.subjectId === 400602 ? 8.4 : 7.3,
          candidates: conflictCandidates(
            subject.subjectId === 400602 ? 'subject' : 'stats',
            subject.subjectId === 400602 ? 8.6 : 7.5,
          ),
        },
      };
      subject.sections.stats = 'partial';
      subject.coverage.sectionsComplete -= 1;
      subject.coverage.sectionsPartial += 1;
    });
    original.metrics[0] = {
      ...original.metrics[0]!,
      values: [8.6, 7.5],
      state: 'conflict',
      delta: null,
      conflicts: scoreConflicts,
    };
    original.coverage.subjectsComplete = 0;
    original.coverage.subjectsPartial = 2;
    original.coverage.metricsComplete = 3;
    original.coverage.metricsConflict = 1;

    const presentation = presentMcpToolResult('bangumi.get_subject_comparison', original);
    const parsed = JSON.parse(presentation.text);
    const score = parsed.metrics.find((metric: { key: string }) => metric.key === 'score');

    expect(Buffer.byteLength(presentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(presentation.structuredContent).toEqual(original);
    expect(parsed).toMatchObject({ state: 'partial', subjectIds: [400602, 420628] });
    expect(parsed.subjects.map((subject: { state: string }) => subject.state)).toEqual([
      'partial',
      'partial',
    ]);
    expect(score).toMatchObject({
      key: 'score',
      values: [8.6, 7.5],
      delta: null,
      state: 'conflict',
      conflicts: [
        { side: 'A', candidateCount: 2, conflictDetailsOmittedFromText: true },
        { side: 'B', candidateCount: 2, conflictDetailsOmittedFromText: true },
      ],
    });
    expect(parsed.source.official).toMatchObject({
      class: 'official-v0',
      attemptedAt: '2026-10-05T00:00:00.000Z',
    });
    expect(parsed.mcpTextProjection).toMatchObject({
      structuredContentHasFullResult: true,
      conflictDetailsOmittedFromText: 2,
      maxUtf8Bytes: MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    });
  });

  it('returns bounded person-activity text and the unchanged full structured result through MCP', async () => {
    const original = makePersonActivityResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(response.structuredContent).toEqual(original);
    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.state).toBe('partial');
    expect(parsed.person.nameCn).toBe('水濑祈');
    expect(parsed.window.start).toBe('2025-10-04');
    expect(parsed.summary.uniqueSubjects).toBe(20);
    expect(parsed.coverage.relationRowsDroppedAtLimit).toBe(40);
    expect(parsed.rows.length).toBeGreaterThan(0);
    expect(parsed.rows[0].origin.metaTags).toEqual(['漫画']);
    expect(parsed.mcpTextProjection.rowsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.evidenceRecordsOmittedFromText).toBe(80);
    expect(parsed.exclusions[0]).toEqual({ reason: 'subject_detail_cap', count: 12 });
  });

  it('retains a compact comparison core for high-volume partial windows', async () => {
    const original = makePersonActivityResult();
    original.comparison = makePersonActivityComparison(original, { highVolume: true });
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.comparison.state).toBe('partial');
    expect(parsed.comparison.windowMonths).toBe(36);
    expect(parsed.comparison.recent.state).toBe('partial');
    expect(parsed.comparison.recent.window.start).toBe('2023-10-04');
    expect(parsed.comparison.recent.summary.creditRows).toBe(40);
    expect(parsed.comparison.recent.coverage.rowsEligible).toBe(20);
    expect(parsed.comparison.recent.summary.byRoleOmittedFromText).toBeGreaterThan(0);
    expect(parsed.comparison.recent.summary.byMonthBucketsOmittedFromText).toBe(36);
    expect(parsed.comparison.recent.exclusionsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.comparison.previous.state).toBe('complete');
    expect(parsed.comparison.previous.window.end).toBe('2023-10-03');
    expect(parsed.comparison.delta).toMatchObject({
      state: 'partial',
      creditRows: 4,
      uniqueSubjects: 3,
      uniqueCharacters: 2,
    });
    expect(parsed.comparison.peak).toMatchObject({
      metric: 'uniqueSubjects',
      state: 'partial',
      months: [expect.objectContaining({ period: 'recent' })],
    });
    expect(parsed.comparison.peak.monthsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.comparison.sourceOperationsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.comparison.comparisonListItemsOmittedFromText).toBeGreaterThan(0);
    expect(response.structuredContent).toEqual(original);
  });

  it('retains observed counts, delta, and peak through the minimum partial comparison fallback', async () => {
    const original = makePersonActivityResult();
    original.coverage = {
      ...original.coverage,
      retrievedAt: 'retrieval-time-'.repeat(1000),
    };
    original.comparison = makePersonActivityComparison(original);
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.rows).toBeUndefined();
    expect(parsed.comparison.recent.state).toBe('partial');
    expect(parsed.comparison.recent.summary).toMatchObject({
      creditRows: original.comparison.recent.summary.creditRows,
      uniqueSubjects: original.comparison.recent.summary.uniqueSubjects,
    });
    expect(parsed.comparison.previous.state).toBe('complete');
    expect(parsed.comparison.delta).toMatchObject({
      state: 'partial',
      creditRows: 4,
      uniqueSubjects: 3,
      uniqueCharacters: 2,
    });
    expect(parsed.comparison.peak).toMatchObject({
      metric: 'uniqueSubjects',
      state: 'partial',
      months: [expect.objectContaining({ period: 'recent' })],
    });
    expect(response.structuredContent).toEqual(original);
  });

  it('marks partial comparison delta values omitted when a minimum window has no eligible rows', async () => {
    const original = makePersonActivityResult();
    original.coverage = {
      ...original.coverage,
      retrievedAt: 'retrieval-time-'.repeat(1000),
    };
    original.comparison = makePersonActivityComparison(original);
    original.comparison.recent.coverage = {
      ...original.comparison.recent.coverage,
      rowsEligible: 0,
      rowsReturned: 0,
    };
    original.comparison.delta = { state: 'partial' };
    original.comparison.peak.months = [
      {
        period: 'previous',
        month: '2025-11',
        creditRows: 1,
        uniqueSubjects: 1,
        uniqueCharacters: 1,
      },
    ];
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.rows).toBeUndefined();
    expect(parsed.comparison.recent.state).toBe('partial');
    expect(parsed.comparison.recent.coverage.rowsEligible).toBe(0);
    expect(parsed.comparison.recent.summary.countsOmittedDueToCoverage).toBe(true);
    expect(parsed.comparison.recent.summary.uniqueSubjects).toBeUndefined();
    expect(parsed.comparison.delta).toMatchObject({
      state: 'partial',
      valuesOmittedDueToCoverage: true,
    });
    expect(parsed.comparison.delta.uniqueSubjects).toBeUndefined();
    expect(parsed.comparison.peak).toMatchObject({
      state: 'partial',
      months: [{ period: 'previous' }],
    });
    expect(response.structuredContent).toEqual(original);
  });

  it('summarizes observed windows and omitted values for a partial comparison answer', async () => {
    const original = makePersonActivityResult();
    original.coverage = {
      ...original.coverage,
      retrievedAt: 'retrieval-time-'.repeat(1000),
    };
    original.comparison = makePersonActivityComparison(original);
    original.comparison.windowMonths = 6;
    original.comparison.recent.window = {
      ...original.comparison.recent.window,
      months: 6,
      start: '2026-05-01',
      end: '2026-10-04',
    };
    original.comparison.recent.coverage = {
      ...original.comparison.recent.coverage,
      rowsEligible: 0,
      rowsReturned: 0,
    };
    original.comparison.previous.state = 'partial';
    original.comparison.previous.window = {
      ...original.comparison.previous.window,
      months: 6,
      start: '2025-11-01',
      end: '2026-04-30',
    };
    original.comparison.previous.coverage = {
      ...original.comparison.previous.coverage,
      rowsEligible: 1,
      rowsReturned: 1,
    };
    original.comparison.previous.summary = {
      ...original.comparison.previous.summary,
      uniqueSubjects: 1,
    };
    original.comparison.delta = { state: 'partial' };
    original.comparison.peak.months = [
      {
        period: 'previous',
        month: '2026-04',
        creditRows: 1,
        uniqueSubjects: 1,
        uniqueCharacters: 1,
      },
    ];
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');
    const answerSummary = parsed.comparison.answerSummary as string;

    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.mcpTextProjection.summaryOmittedFromText).toBe(true);
    expect(parsed.person).toMatchObject({ id: 13684, nameCn: '水濑祈' });
    expect(parsed.kind).toBe('voice');
    expect(parsed.media).toBe('tv');
    expect(parsed.rows).toBeUndefined();
    expect(answerSummary).toContain('最近窗口2026-05-01至2026-10-04');
    expect(answerSummary).toContain('作品数未提供');
    expect(answerSummary).toContain('前一窗口2025-11-01至2026-04-30');
    expect(answerSummary).toContain('本次观察1部');
    expect(answerSummary).toContain('差值（partial）覆盖不足，未提供数值');
    expect(answerSummary).toContain('2026-04（前一窗口，观察1部）');
    expect(answerSummary).toContain('不代表真实工作量、完整履历或历史趋势');
    expect(response.structuredContent).toEqual(original);
  });

  it('keeps the final partial-comparison fallback within the byte cap for long multibyte names', async () => {
    const original = makePersonActivityResult();
    original.person!.name = '声'.repeat(120);
    original.person!.nameCn = '名'.repeat(120);
    original.comparison = makePersonActivityComparison(original, { highVolume: true });
    original.comparison.windowMonths = 6;
    original.comparison.recent.state = 'partial';
    original.comparison.recent.window = {
      ...original.comparison.recent.window,
      months: 6,
      start: '2026-05-01',
      end: '2026-10-04',
    };
    original.comparison.recent.coverage = {
      ...original.comparison.recent.coverage,
      rowsEligible: 0,
      rowsReturned: 0,
    };
    original.comparison.previous.state = 'partial';
    original.comparison.previous.window = {
      ...original.comparison.previous.window,
      months: 6,
      start: '2025-11-01',
      end: '2026-04-30',
    };
    original.comparison.previous.coverage = {
      ...original.comparison.previous.coverage,
      rowsEligible: 1,
      rowsReturned: 1,
    };
    original.comparison.previous.summary = {
      ...original.comparison.previous.summary,
      uniqueSubjects: 1,
    };
    original.comparison.delta = { state: 'partial' };
    original.comparison.peak.months = [
      {
        period: 'previous',
        month: '2026-04',
        creditRows: 1,
        uniqueSubjects: 1,
        uniqueCharacters: 1,
      },
    ];

    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.mcpTextProjection.summaryOmittedFromText).toBe(true);
    expect(parsed.person).toMatchObject({
      id: 13684,
      name: '声'.repeat(120),
      nameCn: '名'.repeat(120),
    });
    expect(parsed.kind).toBe('voice');
    expect(parsed.media).toBe('tv');
    expect(parsed.comparison.recent).toMatchObject({
      state: 'partial',
      window: { start: '2026-05-01', end: '2026-10-04' },
      coverage: { rowsEligible: 0, detailsOmittedFromText: true },
      summary: { countsOmittedDueToCoverage: true },
    });
    expect(parsed.comparison.recent.summary.uniqueSubjects).toBeUndefined();
    expect(parsed.comparison.previous).toMatchObject({
      state: 'partial',
      window: { start: '2025-11-01', end: '2026-04-30' },
      coverage: { rowsEligible: 1, detailsOmittedFromText: true },
      summary: { uniqueSubjects: 1, originOmittedFromText: true },
    });
    expect(parsed.comparison.delta).toMatchObject({
      state: 'partial',
      valuesOmittedDueToCoverage: true,
    });
    expect(parsed.comparison.delta.uniqueSubjects).toBeUndefined();
    expect(parsed.comparison.peak.months).toEqual([
      expect.objectContaining({ period: 'previous', month: '2026-04', uniqueSubjects: 1 }),
    ]);
    expect(parsed.comparison.answerSummary).toContain('不代表真实工作量、完整履历或历史趋势');
    expect(parsed.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
    expect(response.structuredContent).toEqual(original);
  });

  it('keeps comparison states in the minimum text fallback without turning unavailable counts into zero', async () => {
    const original = makePersonActivityResult();
    original.state = 'unavailable';
    original.rows = [];
    original.summary = {
      ...original.summary,
      creditRows: 0,
      uniqueSubjects: 0,
      uniqueCharacters: 0,
      byRole: [],
      byMedia: [],
      byMonth: [],
    };
    original.coverage = {
      ...original.coverage,
      rowsEligible: 0,
      rowsReturned: 0,
      truncated: false,
      retrievedAt: 'retrieval-time-'.repeat(1000),
    };
    original.comparison = makePersonActivityComparison(original, { unavailable: true });
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.rows).toBeUndefined();
    expect(parsed.comparison.state).toBe('unavailable');
    expect(parsed.comparison.recent.state).toBe('unavailable');
    expect(parsed.comparison.recent.window.start).toBe('2025-10-04');
    expect(parsed.comparison.recent.summary.countsOmittedDueToCoverage).toBe(true);
    expect(parsed.comparison.recent.summary.creditRows).toBeUndefined();
    expect(parsed.comparison.previous.state).toBe('unavailable');
    expect(parsed.comparison.delta).toMatchObject({
      state: 'unavailable',
      valuesOmittedDueToState: true,
    });
    expect(parsed.comparison.delta.creditRows).toBeUndefined();
    expect(parsed.comparison.peak).toMatchObject({
      metric: 'uniqueSubjects',
      state: 'unavailable',
      months: [],
    });
    expect(parsed.comparison.answerSummary).toContain('差值（unavailable）未提供数值（不等于零）');
    expect(parsed.comparison.answerSummary).not.toContain('差值（unavailable）0部');
    expect(response.structuredContent).toEqual(original);
  });

  it('returns bounded subject-overview text with exact source labels and full structured content', async () => {
    const original = makeSubjectOverviewResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_subject_overview',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(response.structuredContent).toEqual(original);
    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.state).toBe('partial');
    expect(parsed.mcpTextProjection.textViewScope).toContain(
      'partial or truncated coverage is not a complete source list',
    );
    expect(parsed.subject.nameCn).toBe('少女终末旅行');
    expect(parsed.cast.items.length).toBeGreaterThan(0);
    expect(parsed.cast.items[0].relation).toBe('主角');
    expect(parsed.staff.groups[0].relation).toBe('原作');
    expect(parsed.staff.groups[1].relation).toBe('导演');
    expect(parsed.staff.items.length).toBeGreaterThan(0);
    expect(parsed.staff.items[0].relation).toBe('原作');
    expect(parsed.staff.groups[0].count).toBe(parsed.staff.groups[0].memberIds.length);
    expect(parsed.staff.groups[0].sourceCount).toBe(8);
    expect(parsed.staff.groups[0].memberIds).toContain(parsed.staff.items[0].id);
    expect(parsed.relations.items.length).toBeGreaterThan(0);
    expect(parsed.relations.items[0].relation).toBe('续集');
    expect(parsed.staff.coverage.returned).toBe(80);
    expect(parsed.staff.coverage.truncated).toBe(true);
    expect(parsed.mcpTextProjection.staffMembersOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.summaryOmittedFromText).toBe(true);
    expect(parsed.warningsOmittedFromText).toBeGreaterThan(0);
  });
});
