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
  EpisodeGuideViewModel,
  PersonProfileViewModel,
  PersonActivityViewModel,
  SeriesRelationsViewModel,
  SubjectOverviewViewModel,
  SubjectComparisonViewModel,
  CollectionIntelligenceViewModel,
  CollectionBacklogViewModel,
  CollectionScheduleViewModel,
  CollectionDashboardViewModel,
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
import { EpisodeGuideCard } from './EpisodeGuideCard.js';
import { PersonProfileCard } from './PersonProfileCard.js';
import { PersonActivityCard } from './PersonActivityCard.js';
import { SeriesRelationsCard } from './SeriesRelationsCard.js';
import { SubjectOverviewCard } from './SubjectOverviewCard.js';
import { SubjectComparisonCard } from './SubjectComparisonCard.js';
import { CollectionIntelligenceCard } from './CollectionIntelligenceCard.js';
import { CollectionBacklogCard } from './CollectionBacklogCard.js';
import { CollectionScheduleCard } from './CollectionScheduleCard.js';
import { CollectionDashboardCard } from './CollectionDashboardCard.js';

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

registerTemplate<EpisodeGuideViewModel>({
  id: 'episode-guide',
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <EpisodeGuideCard viewModel={vm} theme={theme} width={width} />
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
  version: 1,
  render: (vm, theme, _resolvedImages, width) => (
    <SubjectComparisonCard viewModel={vm} theme={theme} width={width} />
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
