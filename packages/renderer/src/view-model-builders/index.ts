import type {
  DomainSubject,
  DomainCalendarDay,
  DomainRelatedCharacter,
  PersonActivityProfile,
  SubjectSearchResult,
} from '@bangumi-agent-kit/bangumi-core';
import type {
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  SearchItemViewModel,
  CastItemViewModel,
  CalendarDayViewModel,
  PersonProfileCreditViewModel,
  PersonProfileViewModel,
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
      weekdayCn: day.weekday.cn || day.weekday.en,
      items: cappedItems.map((item) => ({
        id: item.id,
        name: item.name,
        nameCn: item.nameCn || item.name,
        image: item.images?.medium || item.images?.small || item.images?.grid,
        score: item.score,
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

export function buildPersonProfileViewModel(
  profile: PersonActivityProfile,
  options: {
    sourceLabel?: string;
    retrievedAt?: string;
    maxSubjectCredits?: number;
    maxCharacterCredits?: number;
    limitations?: string[];
  } = {},
): PersonProfileViewModel {
  const maxSubjectCredits = options.maxSubjectCredits ?? 8;
  const maxCharacterCredits = options.maxCharacterCredits ?? 8;
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

  return {
    template: 'person-profile',
    version: 1,
    person: {
      id: profile.person.id,
      name: profile.person.name,
      image:
        profile.person.images?.large ||
        profile.person.images?.medium ||
        profile.person.images?.small,
      career: profile.person.career,
    },
    summary: {
      uniqueSubjects: profile.summary.uniqueSubjects,
      subjectCredits: profile.summary.subjectCredits,
      uniqueCharacters: profile.summary.uniqueCharacters,
      characterCredits: profile.summary.characterCredits,
      characterSubjects: profile.summary.characterSubjects,
    },
    mediaBreakdown: profile.summary.subjectMedia,
    roleBreakdown: profile.summary.subjectRoles,
    characterRoleBreakdown: profile.summary.characterRoles,
    subjectCredits,
    characterCredits,
    hiddenSubjectCredits:
      Math.max(0, profile.subjects.returned - subjectCredits.length) || undefined,
    hiddenCharacterCredits:
      Math.max(0, profile.characters.returned - characterCredits.length) || undefined,
    coverage: {
      state: profile.subjects.truncated || profile.characters.truncated ? 'partial' : 'complete',
      observed: profile.subjects.observed + profile.characters.observed,
      returned: profile.subjects.returned + profile.characters.returned,
    },
    limitations: options.limitations || [
      '关系接口没有作品日期，因此不能从此卡片推断最近活动或时间窗口工作量。',
      '没有历史快照，因此不显示增长或趋势结论。',
    ],
    source: {
      label: options.sourceLabel || 'Bangumi v0 · PersonProfile',
      retrievedAt: options.retrievedAt,
    },
  };
}
