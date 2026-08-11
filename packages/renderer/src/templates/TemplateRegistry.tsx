import React from 'react';
import {
  RenderViewModel,
  SubjectCardViewModel,
  SearchListViewModel,
  CastCardViewModel,
  CollectionProgressViewModel,
  CalendarViewModel,
  RevisionTimelineViewModel,
  PersonProfileViewModel,
} from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { RendererError } from '../errors.js';
import { SubjectCard } from './SubjectCard.js';
import { SearchListCard } from './SearchListCard.js';
import { CastCard } from './CastCard.js';
import { CollectionProgressCard } from './CollectionProgressCard.js';
import { CalendarCard } from './CalendarCard.js';
import { RevisionTimelineCard } from './RevisionTimelineCard.js';
import { PersonProfileCard } from './PersonProfileCard.js';

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

// Register default 5 cards
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

registerTemplate<PersonProfileViewModel>({
  id: 'person-profile',
  version: 1,
  render: (vm, theme, resolvedImages, width) => (
    <PersonProfileCard viewModel={vm} theme={theme} resolvedImages={resolvedImages} width={width} />
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
