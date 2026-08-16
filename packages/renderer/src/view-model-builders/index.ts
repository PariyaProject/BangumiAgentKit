import type {
  DomainSubject,
  DomainCalendarDay,
  DomainRelatedCharacter,
  CalendarIntelligenceResult,
  CollectionIntelligenceResult,
  CollectionBacklogResult,
  CollectionScheduleResult,
  CollectionDashboardResult,
  CollectionSeriesResult,
  RevisionIntelligenceResult,
  EpisodeGuideResult,
  PersonActivityProfile,
  PersonActivityResult,
  SubjectSearchResult,
  SeriesWatchOrderResult,
  SubjectOverviewResult,
  SubjectComparisonResult,
  SubjectStatsIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
import type {
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CollectionIntelligenceViewModel,
  CollectionBacklogViewModel,
  CollectionScheduleViewModel,
  CollectionDashboardViewModel,
  CollectionSeriesViewModel,
  CalendarViewModel,
  RevisionTimelineViewModel,
  EpisodeGuideViewModel,
  SearchItemViewModel,
  DiscoveryResultsViewModel,
  DiscoveryResultsItemViewModel,
  CastItemViewModel,
  CalendarDayViewModel,
  PersonProfileCreditViewModel,
  PersonProfileViewModel,
  PersonActivityViewModel,
  SeriesRelationsViewModel,
  SeriesRelationsRelatedViewModel,
  SeriesRelationPathViewModel,
  SubjectOverviewViewModel,
  SubjectComparisonViewModel,
  SubjectStatsViewModel,
} from '../view-models/index.js';

export function truncateText(
  text: string | undefined,
  maxLength: number,
): { text: string; truncated: boolean } {
  if (!text) {
    return { text: '', truncated: false };
  }
  const codePoints = Array.from(text);
  if (codePoints.length <= maxLength) {
    return { text, truncated: false };
  }
  return {
    text: codePoints.slice(0, maxLength).join('') + '...',
    truncated: true,
  };
}

export function buildSubjectCardViewModel(
  subject: DomainSubject & { tags?: string[] },
  options?: {
    collection?: {
      status: string;
      statusLabel?: string;
      rating?: number;
      comment?: string;
      episodeProgress?: string;
    };
    sourceLabel?: string;
    summaryMaxPoints?: number;
  },
): SubjectCardViewModel {
  const summaryLength = options?.summaryMaxPoints ?? 180;
  const truncatedSummary = truncateText(subject.summary, summaryLength).text;

  return {
    template: 'subject-card',
    version: 1,
    subject: {
      id: subject.id,
      name: subject.name,
      nameCn: subject.nameCn || subject.name,
      type: subject.type,
      date: subject.date,
      image: subject.images?.large || subject.images?.common || subject.images?.medium,
      score: subject.score,
      rank: subject.rank,
      summary: truncatedSummary,
      tags: subject.tags,
    },
    collection: options?.collection,
    source: {
      label: options?.sourceLabel || 'Bangumi Agent Kit',
    },
  };
}

const COLLECTION_STATUS_LABELS: Record<string, string> = {
  wish: '想看/想读',
  doing: '进行中',
  done: '已完成',
  on_hold: '搁置',
  dropped: '抛弃',
  unknown: '未知状态',
};

const COLLECTION_TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
  other: '其他',
  unknown: '未知媒介',
};

export function buildCollectionIntelligenceViewModel(
  result: CollectionIntelligenceResult,
  options: {
    sourceLabel?: string;
    maxTags?: number;
    maxRecentUpdates?: number;
  } = {},
): CollectionIntelligenceViewModel {
  const maxTags = Math.min(12, Math.max(0, Math.trunc(options.maxTags ?? 8)));
  const maxRecentUpdates = Math.min(10, Math.max(0, Math.trunc(options.maxRecentUpdates ?? 8)));
  const statusCounts = Object.entries(result.data.statusCounts).map(([status, count]) => ({
    status,
    label: COLLECTION_STATUS_LABELS[status] || '未知状态',
    count,
  }));
  const subjectTypeCounts = Object.entries(result.data.subjectTypeCounts)
    .map(([type, count]) => ({ type, label: COLLECTION_TYPE_LABELS[type] || type, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const tags = result.data.tags.top.slice(0, maxTags);
  const latestObservedUpdates = result.data.latestObservedUpdates.slice(0, maxRecentUpdates);
  const omittedTags = result.data.tags.top.length - tags.length;
  const omittedRecentUpdates =
    result.data.latestObservedUpdates.length - latestObservedUpdates.length;
  const formulaEvidence = result.evidence.find((item) => item.source === 'derived');
  const retrievedAt = result.source.retrievedAt;

  return {
    template: 'collection-intelligence',
    version: 1,
    state: result.state,
    statusCounts,
    subjectTypeCounts,
    backlog: result.data.backlog,
    ratings: result.data.ratings,
    progress: result.data.progress,
    tags: { ...result.data.tags, top: tags },
    latestObservedUpdates,
    presentation: {
      state: omittedTags > 0 || omittedRecentUpdates > 0 ? 'partial' : 'complete',
      tags: {
        available: result.data.tags.top.length,
        rendered: tags.length,
        omitted: omittedTags,
      },
      recentUpdates: {
        available: result.data.latestObservedUpdates.length,
        rendered: latestObservedUpdates.length,
        omitted: omittedRecentUpdates,
      },
    },
    coverage: {
      ...result.coverage,
      renderedStatusCount: statusCounts.length,
      renderedTagCount: tags.length,
      renderedRecentCount: latestObservedUpdates.length,
    },
    evidence: {
      operation: result.source.operation,
      formulaVersion: formulaEvidence?.formulaVersion,
      authScope: result.source.authScope,
      retrievedAt,
    },
    warnings: result.warnings,
    limitations: result.limitations,
    source: {
      label: options.sourceLabel || 'Bangumi v0 · 当前账号收藏',
      retrievedAt,
    },
  };
}

export function buildCollectionBacklogViewModel(
  result: CollectionBacklogResult,
  options: { sourceLabel?: string; maxItems?: number } = {},
): CollectionBacklogViewModel {
  const maxItems = Math.min(20, Math.max(0, Math.trunc(options.maxItems ?? 12)));
  const items = result.data.items.slice(0, maxItems);
  const omittedItems = Math.max(0, result.data.items.length - items.length);
  const formulaEvidence = result.evidence.find((item) => item.source === 'derived');
  const retrievedAt = result.source.retrievedAt;

  return {
    template: 'collection-backlog',
    version: 1,
    state: result.state,
    items,
    summary: result.data.summary,
    coverage: {
      ...result.coverage,
      renderedItems: items.length,
      omittedItems,
    },
    source: {
      ...result.source,
      label: options.sourceLabel || 'Bangumi v0 · 当前账号 backlog',
    },
    evidence: {
      operations: result.source.operations,
      formulaVersion: formulaEvidence?.formulaVersion,
      authScope: result.source.authScope,
      retrievedAt,
    },
    warnings: result.warnings,
    limitations: result.limitations,
    error: result.error,
  };
}

export function buildCollectionScheduleViewModel(
  result: CollectionScheduleResult,
  options: { sourceLabel?: string; maxItems?: number; maxUnmatched?: number } = {},
): CollectionScheduleViewModel {
  const maxItems = Math.min(20, Math.max(0, Math.trunc(options.maxItems ?? 12)));
  const maxUnmatched = Math.min(8, Math.max(0, Math.trunc(options.maxUnmatched ?? 4)));
  const items = result.data.items.slice(0, maxItems);
  const unmatchedCalendar = result.data.unmatchedCalendar.slice(0, maxUnmatched);
  const unmatchedCollection = result.data.unmatchedCollection.slice(0, maxUnmatched);
  const renderedRows = items.length + unmatchedCalendar.length + unmatchedCollection.length;
  const omittedRows = Math.max(0, result.coverage.join.returnedRows - renderedRows);
  const formulaEvidence = result.evidence.find((item) => item.source === 'derived');
  const retrievedAt = [result.source.collection.retrievedAt, result.source.calendar.retrievedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    template: 'collection-schedule',
    version: 1,
    state: result.state,
    filters: result.filters,
    items,
    unmatchedCalendar,
    unmatchedCollection,
    summary: result.data.summary,
    coverage: {
      ...result.coverage,
      renderedItems: items.length,
      renderedUnmatchedCalendar: unmatchedCalendar.length,
      renderedUnmatchedCollection: unmatchedCollection.length,
      omittedRows,
    },
    source: {
      ...result.source,
      label: options.sourceLabel || 'Bangumi legacy 日历 · 当前账号 v0 收藏',
    },
    evidence: {
      operations: ['GET /calendar', 'GET /v0/users/{username}/collections'],
      formulaVersion: formulaEvidence?.formulaVersion,
      authScope: 'account',
      retrievedAt,
    },
    warnings: result.warnings,
    limitations: result.limitations,
    error: result.error,
  };
}

export function buildCollectionDashboardViewModel(
  result: CollectionDashboardResult,
): CollectionDashboardViewModel {
  const intelligence = result.data.sections.intelligence;
  const backlog = result.data.sections.backlog;
  const schedule = result.data.sections.schedule;
  const intelligenceViewModel = intelligence.result
    ? buildCollectionIntelligenceViewModel(intelligence.result, {
        maxTags: 5,
        maxRecentUpdates: 4,
      })
    : undefined;
  const backlogViewModel = backlog.result
    ? buildCollectionBacklogViewModel(backlog.result, { maxItems: 4 })
    : undefined;
  const scheduleViewModel = schedule.result
    ? buildCollectionScheduleViewModel(schedule.result, { maxItems: 4, maxUnmatched: 2 })
    : undefined;
  const presentation = {
    intelligence: {
      available: intelligence.result?.data.latestObservedUpdates.length ?? 0,
      rendered: intelligenceViewModel?.latestObservedUpdates.length ?? 0,
      omitted: Math.max(
        0,
        (intelligence.result?.data.latestObservedUpdates.length ?? 0) -
          (intelligenceViewModel?.latestObservedUpdates.length ?? 0),
      ),
    },
    backlog: {
      available: backlog.result?.data.items.length ?? 0,
      rendered: backlogViewModel?.items.length ?? 0,
      omitted: Math.max(
        0,
        (backlog.result?.data.items.length ?? 0) - (backlogViewModel?.items.length ?? 0),
      ),
    },
    schedule: {
      available:
        (schedule.result?.data.items.length ?? 0) +
        (schedule.result?.data.unmatchedCalendar.length ?? 0) +
        (schedule.result?.data.unmatchedCollection.length ?? 0),
      rendered:
        (scheduleViewModel?.items.length ?? 0) +
        (scheduleViewModel?.unmatchedCalendar.length ?? 0) +
        (scheduleViewModel?.unmatchedCollection.length ?? 0),
      omitted: Math.max(
        0,
        (schedule.result?.data.items.length ?? 0) +
          (schedule.result?.data.unmatchedCalendar.length ?? 0) +
          (schedule.result?.data.unmatchedCollection.length ?? 0) -
          ((scheduleViewModel?.items.length ?? 0) +
            (scheduleViewModel?.unmatchedCalendar.length ?? 0) +
            (scheduleViewModel?.unmatchedCollection.length ?? 0)),
      ),
    },
  };
  const hasOmissions = Object.values(presentation).some((section) => section.omitted > 0);

  return {
    template: 'collection-dashboard',
    version: 1,
    state: result.state,
    sections: {
      intelligence: {
        state: intelligence.state,
        result: intelligenceViewModel,
        error: intelligence.error,
      },
      backlog: {
        state: backlog.state,
        result: backlogViewModel,
        error: backlog.error,
      },
      schedule: {
        state: schedule.state,
        result: scheduleViewModel,
        error: schedule.error,
      },
    },
    coverage: result.coverage,
    source: result.source,
    evidence: result.evidence,
    warnings: result.warnings,
    limitations: result.limitations,
    filters: schedule.result?.filters.statuses || [],
    presentation: {
      state: hasOmissions ? 'partial' : 'complete',
      ...presentation,
    },
  };
}

export function buildCollectionSeriesViewModel(
  result: CollectionSeriesResult,
  options: {
    sourceLabel?: string;
    maxGroups?: number;
    maxItemsPerGroup?: number;
    maxEdgesPerGroup?: number;
    maxUngrouped?: number;
  } = {},
): CollectionSeriesViewModel {
  const maxGroups = Math.min(10, Math.max(1, Math.trunc(options.maxGroups ?? 8)));
  const maxItemsPerGroup = Math.min(10, Math.max(1, Math.trunc(options.maxItemsPerGroup ?? 8)));
  const maxEdgesPerGroup = Math.min(16, Math.max(1, Math.trunc(options.maxEdgesPerGroup ?? 12)));
  const maxUngrouped = Math.min(12, Math.max(0, Math.trunc(options.maxUngrouped ?? 8)));
  const groups = result.groups.slice(0, maxGroups).map((group) => {
    const items = group.items.slice(0, maxItemsPerGroup);
    const edges = group.edges.slice(0, maxEdgesPerGroup);
    return {
      ...group,
      items,
      edges,
      hiddenItemCount:
        group.hiddenItemCount +
        Math.max(0, group.items.length - items.length) +
        Math.max(0, group.edges.length - edges.length),
    };
  });
  const ungrouped = result.ungrouped.slice(0, maxUngrouped);
  const renderedItems = groups.reduce((total, group) => total + group.items.length, 0);
  const renderedEdges = groups.reduce((total, group) => total + group.edges.length, 0);
  const availableGroups = result.groups.length + result.coverage.output.hiddenGroupCount;
  const availableItems = Math.max(
    result.summary.eligibleAnimeItems - result.summary.ungroupedItems,
    result.summary.groupedItems,
  );
  const availableEdges = result.summary.relationEdges;

  return {
    template: 'collection-series',
    version: 1,
    state: result.state,
    groups,
    ungrouped,
    summary: result.summary,
    coverage: result.coverage,
    excludedRelations: result.excludedRelations,
    source: {
      ...result.source,
      label: options.sourceLabel || 'Bangumi v0 · 当前账号收藏系列关系',
    },
    evidence: result.evidence,
    warnings: result.warnings,
    limitations: result.limitations,
    presentation: {
      groups: {
        available: availableGroups,
        rendered: groups.length,
        omitted: Math.max(0, availableGroups - groups.length),
      },
      items: {
        available: availableItems,
        rendered: renderedItems,
        omitted: Math.max(0, availableItems - renderedItems),
      },
      edges: {
        available: availableEdges,
        rendered: renderedEdges,
        omitted: Math.max(0, availableEdges - renderedEdges),
      },
      ungrouped: {
        available: result.ungrouped.length,
        rendered: ungrouped.length,
        omitted: Math.max(0, result.ungrouped.length - ungrouped.length),
      },
    },
    error: result.error,
  };
}

function imageFromRecord(images?: Record<string, string>): string | undefined {
  return images?.large || images?.common || images?.medium || images?.small || images?.grid;
}

export function buildSubjectOverviewViewModel(
  result: SubjectOverviewResult,
  options: {
    sourceLabel?: string;
    maxCast?: number;
    maxStaffGroups?: number;
    maxRelations?: number;
  } = {},
): SubjectOverviewViewModel {
  const subject = result.subject;
  const maxCast = options.maxCast ?? 6;
  const maxStaffGroups = options.maxStaffGroups ?? 6;
  const maxRelations = options.maxRelations ?? 8;
  const castItems = result.cast.items.slice(0, maxCast).map((item) => ({
    character: {
      id: item.character.id,
      name: item.character.name,
      image: imageFromRecord(item.character.images),
    },
    relation: item.relation || '关系未知',
    actors: item.actors.slice(0, 3).map((actor) => ({
      id: actor.id,
      name: actor.name,
      image: actor.image,
    })),
  }));
  const staffById = new Map(result.staff.items.map((item) => [item.id, item]));
  const staffGroups = result.staff.groups.slice(0, maxStaffGroups).map((group) => ({
    relation: group.relation || '职位未知',
    count: group.count,
    members: group.memberIds.slice(0, 4).flatMap((id) => {
      const member = staffById.get(id);
      return member
        ? [{ id: member.id, name: member.name, image: imageFromRecord(member.images) }]
        : [];
    }),
  }));
  const renderedStaffMembers = staffGroups.reduce(
    (count, group) => count + group.members.length,
    0,
  );
  const relationItems = result.relations.items.slice(0, maxRelations).map((item) => ({
    id: item.id,
    name: item.name,
    nameCn: item.nameCn,
    type: item.type,
    relation: item.relation || '关系未知',
    image: imageFromRecord(item.images),
  }));
  const stats = result.stats.data;
  const histogram = stats
    ? Object.entries(stats.ratingHistogram)
        .map(([score, count]) => ({ score: Number(score), count }))
        .filter((item) => Number.isFinite(item.score))
        .sort((left, right) => left.score - right.score)
    : [];
  const operations = Array.from(new Set(result.evidence.map((item) => item.operation)));
  const retrievedAt = result.evidence
    .map((item) => item.retrievedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    template: 'subject-overview',
    version: 1,
    state: result.state,
    subject: {
      id: result.subjectId,
      name: subject?.name || `Subject ${result.subjectId}`,
      nameCn: subject?.nameCn,
      type: subject?.type || 'unknown',
      date: subject?.date,
      platform: subject?.platform,
      image: imageFromRecord(subject?.images),
      score: subject?.score,
      rank: subject?.rank,
      summary: truncateText(subject?.summary, 260).text || undefined,
      eps: subject?.eps,
      totalEpisodes: subject?.totalEpisodes,
    },
    stats: {
      state: result.stats.state,
      score: stats?.score,
      rank: stats?.rank,
      ratingTotal: stats?.ratingTotal,
      histogram,
      collection: stats?.collection,
      coverage: {
        observed: result.stats.coverage.observed,
        returned: result.stats.coverage.returned,
        truncated: result.stats.coverage.truncated,
      },
    },
    cast: {
      state: result.cast.state,
      items: castItems,
      hiddenCount: Math.max(0, result.cast.items.length - castItems.length) || undefined,
      coverage: {
        observed: result.cast.coverage.observed,
        returned: result.cast.coverage.returned,
        truncated: result.cast.coverage.truncated,
      },
      actorCoverage: result.cast.actorCoverage,
    },
    staff: {
      state: result.staff.state,
      groups: staffGroups,
      hiddenCount: Math.max(0, result.staff.items.length - renderedStaffMembers) || undefined,
      coverage: {
        observed: result.staff.coverage.observed,
        returned: result.staff.coverage.returned,
        truncated: result.staff.coverage.truncated,
      },
    },
    relations: {
      state: result.relations.state,
      items: relationItems,
      hiddenCount: Math.max(0, result.relations.items.length - relationItems.length) || undefined,
      coverage: {
        observed: result.relations.coverage.observed,
        returned: result.relations.coverage.returned,
        truncated: result.relations.coverage.truncated,
      },
    },
    coverage: result.coverage,
    evidence: { operations, count: result.evidence.length, retrievedAt },
    warnings: result.warnings.map(({ code, state, message }) => ({ code, state, message })),
    limitations: result.limitations,
    source: { label: options.sourceLabel || 'Bangumi 官方来源', retrievedAt },
  };
}

export function buildSubjectComparisonViewModel(
  result: SubjectComparisonResult,
  options: { maxMetrics?: number } = {},
): SubjectComparisonViewModel {
  const maxMetrics = Number.isFinite(options.maxMetrics)
    ? Math.min(result.metrics.length, Math.max(1, Math.trunc(options.maxMetrics as number)))
    : result.metrics.length;
  const metrics = result.metrics.slice(0, maxMetrics);
  return {
    template: 'subject-comparison',
    version: 1,
    state: result.state,
    subjectIds: result.subjectIds,
    subjects: result.subjects,
    metrics,
    formulaVersion: result.formulaVersion,
    overlapFormulaVersion: result.overlapFormulaVersion,
    overlaps: result.overlaps,
    coverage: {
      ...result.coverage,
      renderedMetrics: metrics.length,
      omittedMetrics: result.metrics.length - metrics.length,
    },
    source: result.source,
    evidence: result.evidence,
    warnings: result.warnings,
    limitations: result.limitations,
  };
}

export function buildSubjectStatsViewModel(
  result: SubjectStatsIntelligenceResult,
): SubjectStatsViewModel {
  return {
    template: 'subject-stats',
    version: 1,
    subjectId: result.subjectId,
    state: result.state,
    raw: result.raw,
    rating: result.rating,
    collection: result.collection,
    coverage: result.coverage,
    source: result.source,
    evidence: result.evidence,
    warnings: result.warnings,
    limitations: result.limitations,
    retrievedAt: result.retrievedAt,
  };
}

export function buildSearchListViewModel(
  input: { query: string; total: number; items: DomainSubject[] } | SubjectSearchResult,
  queryOverride?: string,
  maxItems = 10,
): SearchListViewModel {
  const query = 'query' in input ? input.query : queryOverride || '';
  const rawItems = input.items || [];
  const cappedItems = rawItems.slice(0, maxItems);
  const hasMore = rawItems.length > maxItems || input.total > maxItems;

  const items: SearchItemViewModel[] = cappedItems.map((item) => ({
    id: item.id,
    name: item.name,
    nameCn: item.nameCn || item.name,
    type: item.type,
    date: item.date,
    score: item.score,
    rank: item.rank,
    image: item.images?.common || item.images?.medium || item.images?.small,
  }));

  return {
    template: 'search-list',
    version: 1,
    query,
    total: input.total,
    items,
    hasMore,
  };
}

interface DiscoveryQueryInputLike {
  keyword?: string;
  media?: string | readonly string[];
  categories?: string | readonly string[];
  year?: number;
  month?: number;
  season?: string;
  from?: string;
  to?: string;
  tags?: readonly string[];
  metaTags?: readonly string[];
  excludeMetaTags?: readonly string[];
  concepts?: readonly string[];
  rating?: { min?: number; max?: number };
  ratingCount?: { min?: number; max?: number };
  rank?: { min?: number; max?: number };
  collectionCount?: { min?: number; max?: number };
  nsfw?: string | boolean;
  sort?: string;
  order?: string;
  resultMode?: string;
  limit?: number;
  explain?: string;
}

interface DiscoveryPlanFilterLike {
  field: string;
  operator: string;
  value: unknown;
}

interface DiscoveryResultLike {
  state: string;
  items: Array<{
    id: number;
    name: string;
    nameCn?: string;
    displayName?: string;
    media: string;
    category?: string;
    date?: string;
    score?: number;
    rank?: number;
    ratingCount?: number;
    collectionTotal?: number;
    image?: string;
  }>;
  plan: {
    operation: string;
    quality: string;
    pushdown: DiscoveryPlanFilterLike[];
    postFilters: DiscoveryPlanFilterLike[];
    derivedFilters: DiscoveryPlanFilterLike[];
    unsupported: DiscoveryPlanFilterLike[];
    limitations: string[];
  };
  coverage: {
    state: 'complete' | 'partial' | 'unknown' | 'not_applicable';
    requested?: number;
    scanned?: number;
    matched?: number;
    returned?: number;
    pagesScanned?: number;
    totalKind?: string;
    upstreamExhausted?: boolean;
    budgetExceeded?: boolean;
    outputCap?: number;
    hydrationsAttempted?: number;
    hydrationsSucceeded?: number;
    hydrationsFailed?: number;
    hydrationsUnresolved?: number;
    hydrationBudgetExceeded?: boolean;
    reason?: string;
  };
  warnings: Array<{ code: string; message: string; state?: string }>;
  limitations?: string[];
  evidence: Array<{
    source?: { class?: string; operation?: string; experimental?: boolean };
    retrievedAt?: string;
  }>;
  explanation?: { limitations?: string[] };
}

const DISCOVERY_MEDIA_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
};

const DISCOVERY_CATEGORY_LABELS: Record<string, string> = {
  tv: 'TV',
  ova: 'OVA',
  movie: '剧场版',
  web: '网络动画',
};

const DISCOVERY_FIELD_LABELS: Record<string, string> = {
  keyword: '关键词',
  media: '媒介',
  categories: '分类',
  year: '年份',
  month: '月份',
  dateRange: '日期',
  tags: '标签',
  metaTags: '元标签',
  excludeMetaTags: '排除元标签',
  concepts: '概念',
  rating: '评分',
  ratingCount: '评分人数',
  rank: '排名',
  collectionCount: '收藏人数',
  nsfw: 'NSFW',
  order: '顺序',
  'sort:relevance': '排序·匹配度',
  'sort:heat': '排序·热度',
  'sort:rank': '排序·排名',
  'sort:score': '排序·评分',
  'sort:date': '排序·日期',
};

const DISCOVERY_OPERATOR_LABELS: Record<string, string> = {
  eq: '等于',
  in: '属于',
  contains_all: '包含全部',
  contains_any: '包含任一',
  gte: '至少',
  lte: '至多',
  lt: '小于',
  range: '范围',
};

const DISCOVERY_SORT_LABELS: Record<string, string> = {
  relevance: '匹配度',
  heat: '热度',
  rank: '排名',
  score: '评分',
  date: '日期',
};

const DISCOVERY_ORDER_LABELS: Record<string, string> = {
  asc: '升序',
  desc: '降序',
};

const DISCOVERY_MAX_FACETS = 12;
const DISCOVERY_MAX_VALUES_PER_FACET = 6;
const DISCOVERY_MAX_FACET_VALUE_LENGTH = 32;
const DISCOVERY_MAX_FACET_LENGTH = 128;
const DISCOVERY_MAX_PLAN_FILTERS_PER_GROUP = 8;
const DISCOVERY_MAX_PLAN_FILTER_LENGTH = 128;
export const DISCOVERY_MAX_RENDERED_ITEMS = 12;

function asList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

function boundedFacet(value: string): string {
  return truncateText(value, DISCOVERY_MAX_FACET_LENGTH).text;
}

function boundedValuesLabel(values: readonly string[]): string {
  const normalized = values
    .slice(0, DISCOVERY_MAX_VALUES_PER_FACET)
    .map((item) => truncateText(item, DISCOVERY_MAX_FACET_VALUE_LENGTH).text);
  const visible: string[] = [];

  for (const value of normalized) {
    const omittedAfter = Math.max(0, values.length - visible.length - 1);
    const candidate = [
      ...visible,
      value,
      ...(omittedAfter > 0 ? [`另有 ${omittedAfter} 项`] : []),
    ].join('、');
    if (Array.from(candidate).length > DISCOVERY_MAX_FACET_LENGTH) break;
    visible.push(value);
  }

  const omitted = Math.max(0, values.length - visible.length);
  return boundedFacet([...visible, ...(omitted > 0 ? [`另有 ${omitted} 项`] : [])].join('、'));
}

function labelList(
  value: string | readonly string[] | undefined,
  labels: Record<string, string>,
): string {
  return boundedValuesLabel(asList(value).map((item) => labels[item] || item));
}

function boundedListLabel(value: readonly string[]): string {
  return boundedValuesLabel(value);
}

function boundedPlanLabels(values: string[]): string[] {
  const visible = values
    .slice(0, DISCOVERY_MAX_PLAN_FILTERS_PER_GROUP)
    .map((value) => truncateText(value, DISCOVERY_MAX_PLAN_FILTER_LENGTH).text);
  const omitted = Math.max(0, values.length - visible.length);
  if (omitted > 0) visible.push(`另有 ${omitted} 项计划条件未展开`);
  return visible;
}

function rangeLabel(value: { min?: number; max?: number } | undefined): string | undefined {
  if (!value) return undefined;
  if (value.min !== undefined && value.max !== undefined) return `${value.min}–${value.max}`;
  if (value.min !== undefined) return `≥${value.min}`;
  if (value.max !== undefined) return `≤${value.max}`;
  return undefined;
}

function queryFacets(input: DiscoveryQueryInputLike): string[] {
  const facets: string[] = [];
  if (input.keyword) facets.push(`关键词：${boundedFacet(input.keyword)}`);
  if (input.media) facets.push(`媒介：${labelList(input.media, DISCOVERY_MEDIA_LABELS)}`);
  if (input.categories) {
    facets.push(`分类：${labelList(input.categories, DISCOVERY_CATEGORY_LABELS)}`);
  }
  if (input.season) facets.push(`季度：${boundedFacet(input.season)}`);
  else if (input.year !== undefined && input.month !== undefined) {
    facets.push(`日期：${input.year}-${String(input.month).padStart(2, '0')}`);
  } else if (input.year !== undefined) facets.push(`年份：${input.year}`);
  if (input.from || input.to) {
    facets.push(`日期：${input.from || '起始未知'} 至 ${input.to || '结束未知'}`);
  }
  if (input.tags && input.tags.length > 0) facets.push(`标签：${boundedListLabel(input.tags)}`);
  if (input.metaTags && input.metaTags.length > 0) {
    facets.push(`元标签：${boundedListLabel(input.metaTags)}`);
  }
  if (input.excludeMetaTags && input.excludeMetaTags.length > 0) {
    facets.push(`排除：${boundedListLabel(input.excludeMetaTags)}`);
  }
  if (input.concepts && input.concepts.length > 0) {
    facets.push(`概念：${boundedListLabel(input.concepts)}`);
  }
  for (const [label, value] of [
    ['评分', rangeLabel(input.rating)],
    ['评分人数', rangeLabel(input.ratingCount)],
    ['排名', rangeLabel(input.rank)],
    ['收藏人数', rangeLabel(input.collectionCount)],
  ] as const) {
    if (value) facets.push(`${label}：${value}`);
  }
  if (input.nsfw !== undefined) {
    facets.push(
      `NSFW：${typeof input.nsfw === 'boolean' ? (input.nsfw ? '包含' : '排除') : input.nsfw}`,
    );
  }
  if (input.sort) {
    facets.push(
      `排序：${DISCOVERY_SORT_LABELS[input.sort] || input.sort}${
        input.order ? ` / ${DISCOVERY_ORDER_LABELS[input.order] || input.order}` : ''
      }`,
    );
  }
  if (input.resultMode) facets.push(`模式：${input.resultMode === 'all' ? '尽量完整' : 'Top'}`);
  if (input.limit !== undefined) facets.push(`上限：${input.limit}`);
  const bounded = facets.slice(0, DISCOVERY_MAX_FACETS);
  const omitted = Math.max(0, facets.length - bounded.length);
  if (omitted > 0) bounded[DISCOVERY_MAX_FACETS - 1] = `另有 ${omitted} 个查询条件未展开`;
  return bounded.map(boundedFacet);
}

function filterValueLabel(value: unknown, field?: string): string {
  const labels =
    field === 'media'
      ? DISCOVERY_MEDIA_LABELS
      : field === 'categories'
        ? DISCOVERY_CATEGORY_LABELS
        : field?.startsWith('sort:')
          ? DISCOVERY_SORT_LABELS
          : field === 'order'
            ? DISCOVERY_ORDER_LABELS
            : undefined;
  const mapValue = (item: unknown): string => {
    if (item === undefined || item === null) return '未知';
    const stringValue = String(item);
    return labels?.[stringValue] || stringValue;
  };

  if (Array.isArray(value)) return boundedListLabel(value.map(mapValue));
  if (value && typeof value === 'object') {
    const range = value as { min?: number; max?: number; from?: string; to?: string };
    if (range.from !== undefined || range.to !== undefined) {
      return boundedFacet(`${range.from || '起始未知'} 至 ${range.to || '结束未知'}`);
    }
    return boundedFacet(rangeLabel(range) || '范围已指定');
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  return boundedFacet(mapValue(value));
}

function filterLabel(filter: DiscoveryPlanFilterLike): string {
  const field = DISCOVERY_FIELD_LABELS[filter.field] || '其他条件';
  const operator = DISCOVERY_OPERATOR_LABELS[filter.operator] || '条件';
  return truncateText(
    `${field} ${operator} ${filterValueLabel(filter.value, filter.field)}`,
    DISCOVERY_MAX_PLAN_FILTER_LENGTH,
  ).text;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function stateValue(value: string): DiscoveryResultsViewModel['state'] {
  const allowed: DiscoveryResultsViewModel['state'][] = [
    'ok',
    'partial',
    'stale',
    'conflict',
    'auth_required',
    'permission_denied',
    'unavailable',
    'not_computable',
    'unsupported',
    'not_found',
    'upstream_error',
  ];
  return allowed.includes(value as DiscoveryResultsViewModel['state'])
    ? (value as DiscoveryResultsViewModel['state'])
    : 'upstream_error';
}

function totalKindValue(
  value: string | undefined,
): DiscoveryResultsViewModel['coverage']['totalKind'] {
  return value === 'exact' || value === 'estimated' ? value : 'unknown';
}

export function buildDiscoveryResultsViewModel(
  result: DiscoveryResultLike,
  input: DiscoveryQueryInputLike = {},
  maxItems = DISCOVERY_MAX_RENDERED_ITEMS,
): DiscoveryResultsViewModel {
  const rawItems = result.items || [];
  const facets = queryFacets(input);
  const itemCap = Number.isFinite(maxItems)
    ? Math.min(DISCOVERY_MAX_RENDERED_ITEMS, Math.max(1, Math.floor(maxItems)))
    : DISCOVERY_MAX_RENDERED_ITEMS;
  const cappedItems: DiscoveryResultsItemViewModel[] = rawItems.slice(0, itemCap).map((item) => ({
    id: item.id,
    name: item.name,
    nameCn: item.nameCn || item.displayName || item.name,
    media: DISCOVERY_MEDIA_LABELS[item.media] || item.media,
    category: item.category ? DISCOVERY_CATEGORY_LABELS[item.category] || item.category : undefined,
    date: item.date,
    score: item.score,
    rank: item.rank,
    ratingCount: item.ratingCount,
    collectionTotal: item.collectionTotal,
    image: item.image,
  }));
  const coverage = result.coverage;
  const returned = coverage.returned ?? rawItems.length;
  const matched = coverage.matched ?? returned;
  const observed = coverage.scanned ?? 0;
  const hiddenCount = Math.max(0, rawItems.length - cappedItems.length);
  const observedNotReturnedCount = Math.max(0, matched - returned);
  const evidenceOperations = result.evidence
    .map((item) => item.source?.operation)
    .filter((value): value is string => Boolean(value));
  const operations = uniqueStrings(evidenceOperations);
  const evidenceRetrievedAt = result.evidence
    .map((item) => item.retrievedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const experimental = result.evidence.some((item) => item.source?.experimental);
  const limitations = uniqueStrings([
    ...(result.plan.limitations || []),
    ...(result.explanation?.limitations || []),
    ...(result.limitations || []),
  ]);
  const queryLabel = input.keyword ? `搜索：${boundedFacet(input.keyword)}` : '受控条目发现';

  return {
    template: 'discovery-results',
    version: 1,
    state: stateValue(result.state),
    query: {
      label: queryLabel,
      facets: facets.length > 0 ? facets : ['未指定额外条件'],
    },
    items: cappedItems,
    hiddenCount: hiddenCount > 0 ? hiddenCount : undefined,
    observedNotReturnedCount: observedNotReturnedCount > 0 ? observedNotReturnedCount : undefined,
    plan: {
      operation: result.plan.operation,
      quality: result.plan.quality,
      pushdown: boundedPlanLabels(result.plan.pushdown.map(filterLabel)),
      postFilters: boundedPlanLabels(result.plan.postFilters.map(filterLabel)),
      derivedFilters: boundedPlanLabels(result.plan.derivedFilters.map(filterLabel)),
      unsupportedFilters: boundedPlanLabels((result.plan.unsupported || []).map(filterLabel)),
      limitations,
    },
    coverage: {
      state: coverage.state,
      requested: coverage.requested ?? input.limit ?? 0,
      observed,
      scanned: observed,
      matched,
      returned,
      rendered: cappedItems.length,
      pagesScanned: coverage.pagesScanned ?? 0,
      totalKind: totalKindValue(coverage.totalKind),
      upstreamExhausted: coverage.upstreamExhausted ?? false,
      budgetExceeded: coverage.budgetExceeded ?? false,
      outputCap: coverage.outputCap,
      hydrationsAttempted: coverage.hydrationsAttempted ?? 0,
      hydrationsSucceeded: coverage.hydrationsSucceeded ?? 0,
      hydrationsFailed: coverage.hydrationsFailed ?? 0,
      hydrationsUnresolved: coverage.hydrationsUnresolved ?? 0,
      hydrationBudgetExceeded: coverage.hydrationBudgetExceeded ?? false,
      reason: coverage.reason,
    },
    source: {
      label: 'Bangumi 官方来源',
      operations,
      evidenceCount: result.evidence.length,
      retrievedAt: evidenceRetrievedAt,
      ...(experimental ? { experimental: true } : {}),
    },
    warnings: result.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      state: warning.state,
    })),
    limitations,
  };
}

const SERIES_RELATION_TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
  other: '其他',
};

const SERIES_MAX_RENDERED_PATHS = 8;
const SERIES_MAX_RENDERED_EDGES = 64;

function seriesTypeLabel(type: string): string {
  return SERIES_RELATION_TYPE_LABELS[type] || type;
}

function seriesPathViewModel(
  path: SeriesWatchOrderResult['edges'][number],
): SeriesRelationPathViewModel {
  return {
    fromId: path.fromId,
    toId: path.toId,
    depth: path.depth,
    relation: path.relation,
    relationKind: path.relationKind,
    pathIds: path.pathIds.slice(0, SERIES_MAX_RENDERED_PATHS + 1),
    pathKinds: path.pathKinds.slice(0, SERIES_MAX_RENDERED_PATHS),
    direct: path.direct,
  };
}

function seriesRelatedViewModel(
  item: SeriesWatchOrderResult['related'][number],
): SeriesRelationsRelatedViewModel {
  return {
    id: item.id,
    name: item.name,
    nameCn: item.nameCn || item.name,
    type: seriesTypeLabel(item.type),
    date: item.date,
    image: item.image,
    relationLabels: item.relationLabels,
    relationKinds: item.relationKinds,
    relationPaths: item.relationPaths.slice(0, SERIES_MAX_RENDERED_PATHS).map(seriesPathViewModel),
    depth: item.depth,
    includedInWatchOrder: item.includedInWatchOrder,
    ...(item.exclusionReason ? { exclusionReason: item.exclusionReason } : {}),
  };
}

export function buildSeriesRelationsViewModel(
  result: SeriesWatchOrderResult,
): SeriesRelationsViewModel {
  const relatedLimit = Math.max(1, result.coverage.relatedLimit);
  const related = result.related.slice(0, relatedLimit).map(seriesRelatedViewModel);
  const steps = result.watchOrder.slice(0, result.coverage.maxNodes + 1).map((item) => ({
    ...seriesRelatedViewModel({
      ...item,
      depth: item.derivedDepth ? item.derivedDepth - 1 : 0,
      includedInWatchOrder: true,
    }),
    position: item.position,
    isRoot: item.isRoot,
    placement: item.placement,
    placementReason: item.placementReason,
    ...(item.derivedDepth === undefined ? {} : { derivedDepth: item.derivedDepth }),
  }));
  const edges = result.edges.slice(0, SERIES_MAX_RENDERED_EDGES).map(seriesPathViewModel);
  const samples = result.excluded.samples.slice(0, 12).map((sample) => ({
    id: sample.id,
    name: sample.name,
    nameCn: sample.nameCn || sample.name,
    type: seriesTypeLabel(sample.type),
    relationLabels: sample.relationLabels,
    relationKinds: sample.relationKinds,
    relationPaths: sample.relationPaths
      .slice(0, SERIES_MAX_RENDERED_PATHS)
      .map(seriesPathViewModel),
    depth: sample.relationPaths[0]?.depth ?? 0,
    includedInWatchOrder: false,
    exclusionReason: sample.reason,
  }));
  const sourceOperations = [
    ...new Set(
      result.evidence.sources.map((source) =>
        source.operation === 'getSubjectById' ? '条目详情' : '条目关系',
      ),
    ),
  ];

  return {
    template: 'series-relations',
    version: 1,
    state:
      result.capabilityStates.watchOrder === 'not_computable' ? 'not_computable' : result.state,
    subjectId: result.subjectId,
    root: {
      id: result.root.id,
      name: result.root.name,
      nameCn: result.root.nameCn || result.root.name,
      type: seriesTypeLabel(result.root.type),
      date: result.root.date,
      image: result.root.image,
    },
    steps,
    related,
    edges,
    excluded: {
      count: result.excluded.count,
      byReason: result.excluded.byReason.map((item) => ({
        reason: item.reason,
        count: item.count,
      })),
      samples,
    },
    coverage: { ...result.coverage },
    evidence: {
      operations: sourceOperations,
      evidenceCount: result.evidence.sources.length,
      derivation: result.evidence.derivation,
      retrievedAt: result.evidence.retrievedAt,
    },
    warnings: result.warnings,
    limitations: result.limitations,
  };
}

export function buildCastCardViewModel(
  subject: { id: number; name: string; nameCn?: string },
  castItems: DomainRelatedCharacter[],
  maxItems = 20,
): CastCardViewModel {
  const capped = castItems.slice(0, maxItems);
  const hiddenCount = Math.max(0, castItems.length - maxItems);

  const items: CastItemViewModel[] = capped.map((item) => ({
    character: {
      id: item.character.id,
      name: item.character.name,
      image:
        item.character.images?.grid ||
        item.character.images?.small ||
        item.character.images?.medium,
    },
    relation: item.relation || '未知',
    actors: (item.actors || []).map((actor) => ({
      id: actor.id,
      name: actor.name,
      image: actor.image,
    })),
  }));

  return {
    template: 'cast-card',
    version: 1,
    subject: {
      id: subject.id,
      name: subject.name,
      nameCn: subject.nameCn || subject.name,
    },
    items,
    hiddenCount: hiddenCount > 0 ? hiddenCount : undefined,
  };
}

export function buildCollectionProgressViewModel(
  subject: { id: number; name: string; nameCn?: string; image?: string },
  collection: {
    status: string;
    statusLabel: string;
    watchedEpisodes: number;
    totalEpisodes?: number;
    rating?: number;
    comment?: string;
  },
): CollectionProgressViewModel {
  let progressPercentage: number | undefined;
  if (collection.totalEpisodes && collection.totalEpisodes > 0) {
    progressPercentage = Math.min(
      100,
      Math.round((collection.watchedEpisodes / collection.totalEpisodes) * 100),
    );
  }

  const truncatedComment = truncateText(collection.comment, 120).text;

  return {
    template: 'collection-progress',
    version: 1,
    subject: {
      id: subject.id,
      name: subject.name,
      nameCn: subject.nameCn || subject.name,
      image: subject.image,
    },
    status: collection.status,
    statusLabel: collection.statusLabel,
    watchedEpisodes: collection.watchedEpisodes,
    totalEpisodes: collection.totalEpisodes,
    rating: collection.rating,
    comment: truncatedComment || undefined,
    progressPercentage,
  };
}

export function buildCalendarViewModel(
  calendarDays: DomainCalendarDay[],
  maxPerDay = 8,
): CalendarViewModel {
  const days: CalendarDayViewModel[] = calendarDays.map((day) => {
    const rawItems = day.items || [];
    const cappedItems = rawItems.slice(0, maxPerDay);
    const overflowCount = Math.max(0, rawItems.length - maxPerDay);

    return {
      weekdayCn: day.weekday.cn || day.weekday.en || day.weekday.ja,
      observed: rawItems.length,
      returned: cappedItems.length,
      items: cappedItems.map((item) => ({
        id: item.id,
        name: item.name,
        nameCn: item.nameCn || item.name,
        image: item.images?.medium || item.images?.small || item.images?.grid,
        airDate: item.airDate || undefined,
        type: item.type,
        typeLabel: item.typeLabel,
        score: item.score,
        rank: item.rank,
        collectionDoing: item.collectionDoing,
      })),
      overflowCount: overflowCount > 0 ? overflowCount : undefined,
    };
  });

  return {
    template: 'calendar',
    version: 1,
    days,
  };
}

export function buildCalendarIntelligenceViewModel(
  result: CalendarIntelligenceResult,
): CalendarViewModel {
  const days: CalendarViewModel['days'] = result.days.map((day) => ({
    weekdayCn: day.weekday.cn || day.weekday.en || day.weekday.ja,
    observed: day.observed,
    returned: day.returned,
    items: day.items.map((item) => ({
      id: item.id,
      name: item.name,
      nameCn: item.nameCnProvided === false ? undefined : item.nameCn || item.name,
      nameCnProvided: item.nameCnProvided,
      image: item.images?.medium || item.images?.small || item.images?.grid,
      airDate: item.airDate || undefined,
      type: item.type,
      typeLabel: item.typeLabel,
      score: item.score,
      rank: item.rank,
      collectionDoing: item.collectionDoing,
    })),
    overflowCount: day.overflowCount || undefined,
  }));
  const rendered = days.reduce((count, day) => count + day.items.length, 0);

  return {
    template: 'calendar',
    version: 1,
    days,
    state: result.state,
    coverage: {
      ...result.coverage,
      rendered,
    },
    source: {
      label: 'Bangumi official legacy calendar',
      retrievedAt: result.source.retrievedAt,
    },
    limitations: result.limitations,
    warnings: result.warnings,
  };
}

export function buildRevisionTimelineViewModel(
  result: RevisionIntelligenceResult,
): RevisionTimelineViewModel {
  return {
    template: 'revision-timeline',
    version: 1,
    state: result.state,
    entityType: result.entityType,
    entityId: result.entityId,
    items: result.items,
    coverage: {
      ...result.coverage,
      rendered: result.items.length,
    },
    capabilityStates: result.capabilityStates,
    source: {
      label: 'Bangumi official v0 revision history',
      operation: result.source.operation,
      retrievedAt: result.source.retrievedAt,
      attemptedAt: result.source.attemptedAt,
    },
    limitations: result.limitations,
    warnings: result.warnings,
  };
}

export function buildEpisodeGuideViewModel(
  result: EpisodeGuideResult,
  options: { maxItems?: number } = {},
): EpisodeGuideViewModel {
  const requestedMax = options.maxItems ?? 18;
  const maxItems = Number.isFinite(requestedMax)
    ? Math.min(24, Math.max(1, Math.trunc(requestedMax)))
    : 18;
  const items = result.items.slice(0, maxItems);
  const renderedOmitted = Math.max(0, result.items.length - items.length);
  const warnings = [...result.warnings];
  if (renderedOmitted > 0) {
    warnings.push({
      code: 'RENDERER_OUTPUT_TRUNCATED',
      state: 'partial',
      message: `渲染器对章节列表应用安全显示上限；省略 ${renderedOmitted} 条已返回章节，完整结果请使用 JSON。`,
    });
  }
  const state = renderedOmitted > 0 && result.state !== 'not_found' ? 'partial' : result.state;
  return {
    template: 'episode-guide',
    version: 1,
    subjectId: result.subjectId,
    state,
    subject: result.subject,
    filters: result.filters,
    items,
    summary: result.summary,
    coverage: {
      ...result.coverage,
      state,
      renderedRows: items.length,
      renderedOmitted,
    },
    capabilityStates: result.capabilityStates,
    source: result.source,
    evidence: result.evidence,
    limitations: result.limitations,
    warnings,
    error: result.error,
  };
}

const NOT_COMPUTABLE_LABELS: Record<string, string> = {
  recent_activity: '最近活动',
  voice_actor_workload_window: '声优工作量时间窗口',
  historical_growth: '历史增长趋势',
  collaboration_count: '合作人数与共同作品',
};

export function buildPersonProfileViewModel(
  profile: PersonActivityProfile,
  options: {
    sourceLabel?: string;
    retrievedAt?: string;
    maxSubjectCredits?: number;
    maxCharacterCredits?: number;
    summaryMaxLength?: number;
    limitations?: string[];
    notComputable?: string[];
  } = {},
): PersonProfileViewModel {
  const maxSubjectCredits = options.maxSubjectCredits ?? 8;
  const maxCharacterCredits = options.maxCharacterCredits ?? 8;
  const summary = truncateText(profile.person.summary, options.summaryMaxLength ?? 240);
  const subjectCredits = profile.subjects.items
    .slice(0, maxSubjectCredits)
    .map((subject): PersonProfileCreditViewModel => ({
      id: subject.id,
      name: subject.name,
      nameCn: subject.nameCn,
      role: subject.staffRole,
      eps: subject.eps,
    }));
  const characterCredits = profile.characters.items
    .slice(0, maxCharacterCredits)
    .map((character): PersonProfileCreditViewModel => ({
      id: character.id,
      name: character.name,
      role: character.staff,
      subjectName: character.subjectName,
      subjectNameCn: character.subjectNameCn,
    }));
  const identityMissingFields = [
    profile.person.gender ? undefined : 'person.gender',
    profile.person.birthYear === undefined ? 'person.birth_year' : undefined,
    profile.person.bloodType === undefined ? 'person.blood_type' : undefined,
  ].filter((field): field is string => field !== undefined);
  const birthDate = [
    profile.person.birthYear,
    profile.person.birthMonth,
    profile.person.birthDay,
  ].some((part) => part !== undefined)
    ? [profile.person.birthYear, profile.person.birthMonth, profile.person.birthDay]
        .map((part, index) => (part === undefined ? (index === 0 ? '????' : '??') : String(part)))
        .join('-')
    : undefined;
  const observed = profile.subjects.observed + profile.characters.observed;
  const returned = profile.subjects.returned + profile.characters.returned;
  const rendered = subjectCredits.length + characterCredits.length;
  const notComputable = options.notComputable || [
    'recent_activity',
    'voice_actor_workload_window',
    'historical_growth',
    'collaboration_count',
  ];

  return {
    template: 'person-profile',
    version: 1,
    state:
      profile.subjects.truncated || profile.characters.truncated || identityMissingFields.length > 0
        ? 'partial'
        : 'complete',
    person: {
      id: profile.person.id,
      name: profile.person.name,
      nameCn: profile.person.nameCn,
      image:
        profile.person.images?.large ||
        profile.person.images?.medium ||
        profile.person.images?.small,
      typeLabel: profile.person.typeLabel,
      aliases: profile.person.aliases,
      career: profile.person.career,
      summary: summary.text,
      summaryTruncated: summary.truncated,
      gender: profile.person.gender,
      bloodType: profile.person.bloodType,
      birthDate,
      identityMissingFields,
    },
    summary: {
      uniqueSubjects: profile.summary.uniqueSubjects,
      subjectCredits: profile.summary.subjectCredits,
      uniqueCharacters: profile.summary.uniqueCharacters,
      characterCredits: profile.summary.characterCredits,
      characterSubjects: profile.summary.characterSubjects,
    },
    mediaBreakdown: profile.summary.subjectMedia,
    characterMediaBreakdown: profile.summary.characterMedia,
    roleBreakdown: profile.summary.subjectRoles,
    characterRoleBreakdown: profile.summary.characterRoles,
    subjectCredits,
    characterCredits,
    hiddenSubjectCredits:
      Math.max(0, profile.subjects.returned - subjectCredits.length) || undefined,
    hiddenCharacterCredits:
      Math.max(0, profile.characters.returned - characterCredits.length) || undefined,
    unobservedSubjectCredits:
      Math.max(0, profile.subjects.observed - profile.subjects.returned) || undefined,
    unobservedCharacterCredits:
      Math.max(0, profile.characters.observed - profile.characters.returned) || undefined,
    coverage: {
      state:
        profile.subjects.truncated ||
        profile.characters.truncated ||
        identityMissingFields.length > 0
          ? 'partial'
          : 'complete',
      observed,
      returned,
      rendered,
      unobserved: Math.max(0, observed - returned),
    },
    limitations: options.limitations || [
      '关系接口没有作品日期，因此不能从此卡片推断最近活动或时间窗口工作量。',
      '没有历史快照，因此不显示增长或趋势结论。',
      '关系明细按官方接口返回顺序展示，仅作为样本，不代表最新或优先级排序。',
    ],
    warnings: [
      ...(identityMissingFields.length > 0
        ? [
            {
              code: 'MISSING_IDENTITY_FIELDS',
              state: 'partial' as const,
              message: `身份字段缺失：${identityMissingFields.join(', ')}`,
            },
          ]
        : []),
      {
        code: 'NOT_COMPUTABLE',
        state: 'not_computable' as const,
        message: `不可计算：${notComputable
          .map((item) => NOT_COMPUTABLE_LABELS[item] || item)
          .join('、')}`,
      },
    ],
    source: {
      label: options.sourceLabel || 'Bangumi v0 · PersonProfile',
      retrievedAt: options.retrievedAt,
    },
  };
}

const PERSON_ACTIVITY_KIND_LABELS: Record<PersonActivityResult['kind'], string> = {
  voice: '声优关系',
  staff: '制作人员关系',
  all: '声优与制作人员关系',
};

const PERSON_ACTIVITY_MEDIA_LABELS: Record<PersonActivityResult['media'], string> = {
  anime: '全部动画',
  tv: '可判断为 TV 的动画',
  all: '全部媒介',
};

const PERSON_ACTIVITY_REASON_LABELS: Record<string, string> = {
  missing_subject_id: '关系缺少条目 ID',
  subject_detail_cap: '作品详情预算上限',
  subject_detail_unavailable: '作品详情不可用',
  missing_date: '缺少作品首播日期',
  invalid_date: '作品首播日期无效',
  outside_window: '不在时间窗内',
  media_excluded: '媒介筛选排除',
  media_unknown: '平台字段不足以判断 TV',
};

const PERSON_ACTIVITY_ROLE_LABELS: Record<string, string> = {
  main: '主役',
  support: '配角',
  staff: '制作人员',
  unknown: '未知',
};

export function buildPersonActivityViewModel(
  result: PersonActivityResult,
  options: { sourceLabel?: string; maxRows?: number } = {},
): PersonActivityViewModel {
  const maxRows = Math.min(24, Math.max(1, Math.trunc(options.maxRows ?? 18)));
  const visibleRows = result.rows.slice(0, maxRows);
  const person = result.person;
  return {
    template: 'person-activity',
    version: 1,
    state: result.state,
    person: {
      id: result.personId,
      name: person?.name || '未知人物',
      nameCn: person?.nameCn,
      career: person?.career || [],
    },
    kind: result.kind,
    media: result.media,
    window: {
      months: result.window.months,
      start: result.window.start,
      end: result.window.end,
      monthKeys: result.window.monthKeys,
    },
    rows: visibleRows.map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      subjectNameCn: row.subjectNameCn,
      subjectType: row.subjectType,
      platform: row.platform,
      firstAirDate: row.firstAirDate,
      month: row.month,
      relationLabel: row.relationKind === 'voice' ? '声优' : '制作人员',
      relationId: row.relationId,
      characterName: row.characterName,
      rawRole: row.rawRole,
      roleFamily: PERSON_ACTIVITY_ROLE_LABELS[row.roleFamily] || row.roleFamily,
    })),
    hiddenRows: Math.max(0, result.rows.length - visibleRows.length),
    summary: {
      creditRows: result.summary.creditRows,
      uniqueSubjects: result.summary.uniqueSubjects,
      uniqueCharacters: result.summary.uniqueCharacters,
      byRole: result.summary.byRole.map((item) => ({
        label: PERSON_ACTIVITY_ROLE_LABELS[item.key] || item.label,
        creditRows: item.creditRows,
        uniqueSubjects: item.uniqueSubjects,
        uniqueCharacters: item.uniqueCharacters,
      })),
      byMedia: result.summary.byMedia.map((item) => ({
        label: item.label,
        creditRows: item.creditRows,
        uniqueSubjects: item.uniqueSubjects,
        uniqueCharacters: item.uniqueCharacters,
      })),
      byMonth: result.summary.byMonth,
    },
    coverage: {
      relationRowsObserved: result.coverage.relationRowsObserved,
      relationRowsSelected: result.coverage.relationRowsSelected,
      relationRowsDroppedAtLimit: result.coverage.relationRowsDroppedAtLimit,
      relationSelectionStrategy: result.coverage.relationSelectionStrategy,
      sampled: result.coverage.sampled,
      subjectIdsObserved: result.coverage.subjectIdsObserved,
      subjectIdsSelected: result.coverage.subjectIdsSelected,
      subjectIdsDroppedAtRelationLimit: result.coverage.subjectIdsDroppedAtRelationLimit,
      subjectDetailIdsObserved: result.coverage.subjectDetailIdsObserved,
      subjectDetailRequests: result.coverage.subjectDetailRequests,
      subjectDetailsSucceeded: result.coverage.subjectDetailsSucceeded,
      subjectDetailsFailed: result.coverage.subjectDetailsFailed,
      subjectDetailIdsDroppedAtLimit: result.coverage.subjectDetailIdsDroppedAtLimit,
      rowsEligible: result.coverage.rowsEligible,
      rowsReturned: result.coverage.rowsReturned,
      outputTruncated: result.coverage.outputTruncated,
      missingSubjectIdRows: result.coverage.missingSubjectIdRows,
      missingDateRows: result.coverage.missingDateRows,
      invalidDateRows: result.coverage.invalidDateRows,
      outsideWindowRows: result.coverage.outsideWindowRows,
      mediaExcludedRows: result.coverage.mediaExcludedRows,
      mediaUnknownRows: result.coverage.mediaUnknownRows,
      maxRelations: result.coverage.maxRelations,
      maxSubjectDetails: result.coverage.maxSubjectDetails,
      maxRows: result.coverage.maxRows,
      detailConcurrency: result.coverage.detailConcurrency,
      truncated: result.coverage.truncated,
    },
    exclusions: result.exclusions.map((item) => ({
      reason: PERSON_ACTIVITY_REASON_LABELS[item.reason] || item.reason,
      count: item.count,
      sampleSubjectIds: item.sampleSubjectIds,
    })),
    sourceOperations: result.sourceOperations,
    limitations: result.limitations,
    warnings: result.warnings,
    source: {
      label:
        options.sourceLabel ||
        `Bangumi v0 · ${PERSON_ACTIVITY_KIND_LABELS[result.kind]} · ${PERSON_ACTIVITY_MEDIA_LABELS[result.media]}`,
      retrievedAt: result.coverage.retrievedAt,
    },
  };
}
