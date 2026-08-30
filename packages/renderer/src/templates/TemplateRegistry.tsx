import React from 'react';
import {
  RenderViewModel,
  SubjectCardViewModel,
  SearchListViewModel,
  DiscoveryResultsViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  RevisionTimelineViewModel,
  SubjectLatestRevisionViewModel,
  EpisodeGuideViewModel,
  EpisodeIntegrityViewModel,
  PersonProfileViewModel,
  PersonActivityViewModel,
  PersonCollaborationViewModel,
  SeriesRelationsViewModel,
  SubjectOverviewViewModel,
  SubjectComparisonViewModel,
  SubjectCohortComparisonViewModel,
  SubjectOverlapViewModel,
  SubjectStatsViewModel,
  SubjectIdentityViewModel,
  SubjectStatsHistoryViewModel,
  CollectionIntelligenceViewModel,
  CollectionBacklogViewModel,
  CollectionScheduleViewModel,
  CollectionDashboardViewModel,
  CollectionSeriesViewModel,
  CollectionEntityConsistencyViewModel,
} from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { RendererError } from '../errors.js';
import { SubjectCard } from './SubjectCard.js';
import { SearchListCard } from './SearchListCard.js';
import { DiscoveryResultsCard } from './DiscoveryResultsCard.js';
import { CastCard } from './CastCard.js';
import { CollectionProgressCard } from './CollectionProgressCard.js';
import { CalendarCard } from './CalendarCard.js';
import { RevisionTimelineCard } from './RevisionTimelineCard.js';
import { SubjectLatestRevisionCard } from './SubjectLatestRevisionCard.js';
import { EpisodeGuideCard } from './EpisodeGuideCard.js';
import { EpisodeIntegrityCard } from './EpisodeIntegrityCard.js';
import { PersonProfileCard } from './PersonProfileCard.js';
import { PersonActivityCard } from './PersonActivityCard.js';
import { PersonCollaborationCard } from './PersonCollaborationCard.js';
import { SeriesRelationsCard } from './SeriesRelationsCard.js';
import { SubjectOverviewCard } from './SubjectOverviewCard.js';
import { SubjectComparisonCard } from './SubjectComparisonCard.js';
import { SubjectCohortComparisonCard } from './SubjectCohortComparisonCard.js';
import { SubjectOverlapCard } from './SubjectOverlapCard.js';
import { SubjectStatsCard } from './SubjectStatsCard.js';
import { SubjectIdentityCard } from './SubjectIdentityCard.js';
import { SubjectStatsHistoryCard } from './SubjectStatsHistoryCard.js';
import { CollectionIntelligenceCard } from './CollectionIntelligenceCard.js';
import { CollectionBacklogCard } from './CollectionBacklogCard.js';
import { CollectionScheduleCard } from './CollectionScheduleCard.js';
import { CollectionDashboardCard } from './CollectionDashboardCard.js';
import { CollectionSeriesCard } from './CollectionSeriesCard.js';
import { CollectionEntityConsistencyCard } from './CollectionEntityConsistencyCard.js';

export interface CardTemplate<T extends RenderViewModel = RenderViewModel> {
  id: T['template'];
  version: number;
  render(
    viewModel: T,
    theme: ThemeTokens,
    resolvedImages?: Record<string, string>,
    width?: number,
  ): React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const templates: Map<string, CardTemplate<any>> = new Map();

export function registerTemplate<T extends RenderViewModel>(template: CardTemplate<T>): void {
  templates.set(template.id, template);
}

function normalizeSubjectComparisonViewModel(
  viewModel: SubjectComparisonViewModel,
): SubjectComparisonViewModel {
  return viewModel.version === 1 ? { ...viewModel, version: 2 } : viewModel;
}

// Register the default card templates.
registerTemplate<SubjectCardViewModel>({
  id: 'subject-card',
  version: 1,
  render: (vm, theme, resolvedImages) => (
    <SubjectCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} />
  ),
});

registerTemplate<SearchListViewModel>({
  id: 'search-list',
  version: 1,
  render: (vm, theme, resolvedImages) => (
    <SearchListCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} />
  ),
});

registerTemplate<DiscoveryResultsViewModel>({
  id: 'discovery-results',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <DiscoveryResultsCard
      viewModel={vm}
      theme={theme}
      resolvedImages={resolvedImages}
      width={width}
    />
  ),
});

registerTemplate<CastCardViewModel>({
  id: 'cast-card',
  version: 1,
  render: (vm, theme, resolvedImages) => (
    <CastCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} />
  ),
});

registerTemplate<CollectionProgressViewModel>({
  id: 'collection-progress',
  version: 1,
  render: (vm, theme, resolvedImages) => (
    <CollectionProgressCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} />
  ),
});

registerTemplate<CalendarViewModel>({
  id: 'calendar',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <CalendarCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} width={width} />
  ),
});

registerTemplate<RevisionTimelineViewModel>({
  id: 'revision-timeline',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <RevisionTimelineCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SubjectLatestRevisionViewModel>({
  id: 'subject-latest-revision',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectLatestRevisionCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<EpisodeGuideViewModel>({
  id: 'episode-guide',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <EpisodeGuideCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<EpisodeIntegrityViewModel>({
  id: 'episode-integrity',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <EpisodeIntegrityCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<PersonProfileViewModel>({
  id: 'person-profile',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <PersonProfileCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} width={width} />
  ),
});

registerTemplate<PersonActivityViewModel>({
  id: 'person-activity',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <PersonActivityCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<PersonCollaborationViewModel>({
  id: 'person-collaboration',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <PersonCollaborationCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SeriesRelationsViewModel>({
  id: 'series-relations',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <SeriesRelationsCard
      viewModel={vm}
      theme={theme}
      resolvedImages={resolvedImages}
      width={width}
    />
  ),
});

registerTemplate<SubjectOverviewViewModel>({
  id: 'subject-overview',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <SubjectOverviewCard
      viewModel={vm}
      theme={theme}
      resolvedImages={resolvedImages}
      width={width}
    />
  ),
});

registerTemplate<SubjectComparisonViewModel>({
  id: 'subject-comparison',
  version: 2,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectComparisonCard
      viewModel={normalizeSubjectComparisonViewModel(vm)}
      theme={theme}
      width={width}
    />
  ),
});

registerTemplate<SubjectCohortComparisonViewModel>({
  id: 'subject-cohort-comparison',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectCohortComparisonCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SubjectOverlapViewModel>({
  id: 'subject-overlap',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectOverlapCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SubjectStatsViewModel>({
  id: 'subject-stats',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectStatsCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SubjectIdentityViewModel>({
  id: 'subject-identity',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectIdentityCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<SubjectStatsHistoryViewModel>({
  id: 'subject-stats-history',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectStatsHistoryCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionIntelligenceViewModel>({
  id: 'collection-intelligence',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionIntelligenceCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionBacklogViewModel>({
  id: 'collection-backlog',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionBacklogCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionScheduleViewModel>({
  id: 'collection-schedule',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionScheduleCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionDashboardViewModel>({
  id: 'collection-dashboard',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionDashboardCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionSeriesViewModel>({
  id: 'collection-series',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionSeriesCard viewModel={vm} theme={theme} width={width} />
  ),
});

registerTemplate<CollectionEntityConsistencyViewModel>({
  id: 'collection-entity-consistency',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <CollectionEntityConsistencyCard viewModel={vm} theme={theme} width={width} />
  ),
});

export function getTemplate(templateId: string): CardTemplate {
  const t = templates.get(templateId);
  if (!t) {
    throw new RendererError(
      'RENDER_TEMPLATE_NOT_FOUND',
      `Template "${templateId}" is not registered.`,
    );
  }
  return t;
}
