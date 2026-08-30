import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildCollectionEntityConsistencyViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import type { CollectionEntityConsistencyResult } from '@bangumi-agent-kit/bangumi-core';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const result: CollectionEntityConsistencyResult = {
  state: 'complete',
  account: { username: 'bound-user' },
  filters: {},
  matches: [
    {
      subject: {
        id: 100,
        name: 'Subject',
        nameCn: '一个很长的收藏作品标题',
        type: 'anime',
        status: 'done',
        statusLabel: '看过',
      },
      entity: { kind: 'character', id: 10, name: '收藏角色' },
      evidenceKind: 'subject-character',
      relation: '主角',
      source: {
        class: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}/characters',
        subjectId: 100,
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
    },
    {
      subject: {
        id: 100,
        name: 'Subject',
        nameCn: '一个很长的收藏作品标题',
        type: 'anime',
        status: 'done',
        statusLabel: '看过',
      },
      entity: { kind: 'person', id: 20, name: '收藏人物', career: ['声优'] },
      evidenceKind: 'character-actor',
      relation: '主角',
      viaCharacter: { id: 10, name: '收藏角色' },
      source: {
        class: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}/characters',
        subjectId: 100,
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
    },
  ],
  unmatchedInObservedScope: [
    { entity: { kind: 'character', id: 11, name: '未匹配角色' }, scope: 'selected-subject-roots' },
    { entity: { kind: 'person', id: 21, name: '未匹配人物' }, scope: 'selected-subject-roots' },
  ],
  conflicts: [],
  coverage: {
    state: 'complete',
    subjectCollections: {
      operation: 'GET /v0/users/{username}/collections',
      maxPages: 8,
      maxRoots: 24,
      pagesAttempted: 1,
      pagesSucceeded: 1,
      sourceTotal: 1,
      rowsObserved: 1,
      uniqueRootsObserved: 1,
      rootsSelected: 1,
      malformedRows: 0,
      conflictRows: 0,
      conflictingSubjectIds: [],
      duplicateSubjectIds: 0,
      truncated: false,
      stalled: false,
      failed: false,
    },
    entityCollections: {
      characters: {
        operation: 'GET /v0/users/{username}/collections/-/characters',
        state: 'complete',
        maxItems: 50,
        sourceTotal: 2,
        observed: 2,
        returned: 2,
        malformedRows: 0,
        conflictRows: 0,
        conflictingIds: [],
        truncated: false,
        duplicateIds: 0,
      },
      persons: {
        operation: 'GET /v0/users/{username}/collections/-/persons',
        state: 'complete',
        maxItems: 50,
        sourceTotal: 2,
        observed: 2,
        returned: 2,
        malformedRows: 0,
        conflictRows: 0,
        conflictingIds: [],
        truncated: false,
        duplicateIds: 0,
      },
    },
    relations: {
      maxConcurrency: 4,
      maxRowsPerSubject: 80,
      maxResponseBytes: 1_048_576,
      rootsRequested: 1,
      rootsSucceeded: 1,
      rootsFailed: 0,
      sourceRequestsAttempted: 2,
      sourceRequestsSucceeded: 2,
      sourceRequestsFailed: 0,
      rowsObserved: 2,
      rowsReturned: 2,
      rowsDroppedAtLimit: 0,
      schemaDriftRows: 0,
      invalidActorIdRows: 0,
      failedSubjectIds: [],
      skipped: false,
      truncated: false,
    },
    output: {
      maxRows: 60,
      matchesObserved: 2,
      matchesReturned: 2,
      unmatchedObserved: 2,
      unmatchedReturned: 2,
      rowsDroppedAtLimit: 0,
      truncated: false,
    },
  },
  formulaVersion: 'collection-entity-consistency-v1',
  source: {
    class: 'official-v0',
    operations: [
      'GET /v0/users/{username}/collections',
      'GET /v0/users/{username}/collections/-/characters',
      'GET /v0/users/{username}/collections/-/persons',
      'GET /v0/subjects/{subject_id}/characters',
      'GET /v0/subjects/{subject_id}/persons',
    ],
    authScope: 'account',
    retrievedAt: '2026-08-30T00:00:00.000Z',
  },
  operationEvidence: [],
  warnings: [],
  limitations: ['未观察到不等于不存在。'],
};

describe('collection entity consistency renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders positive links, observed-scope gaps, coverage, and no image assets', () => {
    const viewModel = buildCollectionEntityConsistencyViewModel(result, {
      maxMatches: 3,
      maxUnmatched: 1,
    });

    expect(viewModel.template).toBe('collection-entity-consistency');
    expect(viewModel.presentation).toMatchObject({
      state: 'partial',
      matches: { available: 2, rendered: 2, omitted: 0 },
      unmatched: { available: 2, rendered: 1, omitted: 1 },
    });
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('收藏角色/人物一致性观察');
    expect(html).toContain('已确认的正向关联');
    expect(html).toContain('观察范围内未匹配');
    expect(html).toContain('角色→声优');
    expect(html).toContain('未观察到不等于不存在');
    expect(html).toContain('RENDERER_OUTPUT_TRUNCATED');
  });

  it('keeps degraded state visible when no positive relation is computable', () => {
    const degraded = buildCollectionEntityConsistencyViewModel({
      ...result,
      state: 'not_computable',
      matches: [],
      unmatchedInObservedScope: [],
      coverage: {
        ...result.coverage,
        state: 'not_computable',
        relations: {
          ...result.coverage.relations,
          sourceRequestsSucceeded: 0,
          sourceRequestsFailed: 2,
          failedSubjectIds: [100],
          truncated: true,
        },
        output: {
          ...result.coverage.output,
          matchesObserved: 0,
          matchesReturned: 0,
          unmatchedObserved: 0,
          unmatchedReturned: 0,
        },
      },
      warnings: [
        {
          code: 'COLLECTION_RELATION_COVERAGE_PARTIAL',
          state: 'not_computable',
          message: '关系来源不可用。',
        },
      ],
    });
    const html = renderHtmlTemplate(degraded, 'bangumi-dark', {}, 640);

    expect(html).toContain('当前无法计算');
    expect(html).toContain('没有已确认的正向关联');
    expect(html).toContain('COLLECTION_RELATION_COVERAGE_PARTIAL');
  });

  it('renders every coverage state as a real 640px and 960px PNG', async () => {
    const states: CollectionEntityConsistencyResult['state'][] = [
      'complete',
      'partial',
      'not_computable',
      'unavailable',
    ];

    for (const state of states) {
      const stateResult: CollectionEntityConsistencyResult =
        state === 'complete'
          ? result
          : {
              ...result,
              state,
              matches: [],
              unmatchedInObservedScope: [],
              coverage: {
                ...result.coverage,
                state,
                relations: {
                  ...result.coverage.relations,
                  sourceRequestsSucceeded: 0,
                  sourceRequestsFailed: 2,
                  failedSubjectIds: [100],
                  truncated: true,
                },
                output: {
                  ...result.coverage.output,
                  matchesObserved: 0,
                  matchesReturned: 0,
                  unmatchedObserved: 0,
                  unmatchedReturned: 0,
                },
              },
              warnings: [
                {
                  code: `COLLECTION_${state.toUpperCase()}_FIXTURE`,
                  state,
                  message: `fixture state ${state}`,
                },
              ],
            };
      const viewModel = buildCollectionEntityConsistencyViewModel(stateResult);

      for (const width of [640, 960]) {
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
          cache: false,
        });
        expect(rendered.template).toBe('collection-entity-consistency');
        expect(rendered.width).toBe(width);
        expect(rendered.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
        expect(rendered.buffer.length).toBeGreaterThan(1000);
      }
    }
  });
});
