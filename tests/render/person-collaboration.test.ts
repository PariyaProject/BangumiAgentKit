import { describe, expect, it } from 'vitest';
import { chromium } from '../../packages/renderer/node_modules/playwright/index.js';
import { buildPersonCollaborationViewModel, renderHtmlTemplate } from '@bangumi-agent-kit/renderer';
import type { PersonCollaborationResult } from '@bangumi-agent-kit/bangumi-core';

const result: PersonCollaborationResult = {
  personId: 20,
  state: 'partial',
  person: {
    id: 20,
    name: 'Person',
    nameCn: '人物',
    type: 1,
    typeLabel: '个人',
    career: ['seiyu'],
    summary: '',
  },
  kind: 'all',
  media: 'anime',
  targetRole: '主角',
  collaborators: [
    {
      id: 2,
      name: 'Collaborator',
      nameCn: '合作人物',
      career: ['seiyu'],
      uniqueSubjects: 2,
      creditRows: 3,
      relationKinds: ['voice'],
      roleLabels: [],
      sharedSubjects: [
        {
          id: 101,
          name: 'Subject One',
          nameCn: '作品一',
          type: 'anime',
          relationKinds: ['voice'],
          targetRoles: ['主角'],
          collaboratorRoles: [],
        },
      ],
      sharedSubjectsOmitted: 1,
    },
  ],
  coverage: {
    relationRowsObserved: 4,
    relationRowsMatchingFilters: 3,
    relationRowsSelected: 3,
    relationRowsDroppedAtLimit: 1,
    relationSelectionStrategy: 'deterministic_even_spread',
    sampled: true,
    subjectIdsObserved: 3,
    subjectIdsSelected: 2,
    subjectIdsDroppedAtRelationLimit: 1,
    subjectIdsDroppedAtSubjectLimit: 0,
    relationRowsDroppedAtSourceLimit: 0,
    malformedRelationRows: 0,
    fanoutRowsDroppedAtSourceLimit: 0,
    participantRowsDroppedAtSourceLimit: 0,
    participantRequests: 2,
    participantRequestsSucceeded: 1,
    participantRequestsFailed: 1,
    participantRequestsSkippedForRoleFilter: 0,
    participantRowsObserved: 4,
    participantRowsReturned: 3,
    malformedParticipantRows: 0,
    selfRowsExcluded: 1,
    collaboratorRoleExcludedRows: 0,
    collaboratorRoleUnavailableRows: 0,
    collaboratorsObserved: 2,
    collaboratorsReturned: 1,
    collaboratorIdsDroppedAtLimit: 1,
    sharedSubjectRowsObserved: 3,
    sharedSubjectRowsReturned: 1,
    sharedSubjectRowsOmittedAtLimit: 2,
    maxRelations: 3,
    maxSubjects: 2,
    maxCollaborators: 1,
    maxSharedSubjects: 1,
    fanoutConcurrency: 4,
    mediaExcludedRows: 0,
    mediaUnknownRows: 0,
    targetRoleExcludedRows: 0,
    missingSubjectIdRows: 0,
    missingSubjectTypeRows: 0,
    truncated: true,
    retrievedAt: '2026-08-15T00:00:00.000Z',
  },
  exclusions: [{ reason: 'collaborator_output_cap', count: 1, sampleSubjectIds: [102] }],
  sourceOperations: [
    {
      operation: 'GET /v0/persons/{person_id}',
      attempted: 1,
      succeeded: 1,
      failed: 0,
      outcomes: [{ state: 'succeeded', retrievedAt: '2026-08-15T00:00:00.000Z' }],
    },
  ],
  evidence: [
    {
      source: 'official-v0',
      operation: 'GET /v0/persons/{person_id}',
      retrievedAt: '2026-08-15T00:00:00.000Z',
      outcome: 'succeeded',
    },
    {
      source: 'derived-s7',
      operation: 'person-collaboration-composition',
      retrievedAt: '2026-08-15T00:00:01.000Z',
      formulaVersion: 'person-collaboration-v1',
      description: '按稳定人物 ID 和作品 ID 去重的官方共同作品观察。',
    },
  ],
  limitations: ['只表示官方 v0 共同作品观察，不表示完整行业关系。'],
  warnings: [{ code: 'RELATION_LIMIT_REACHED', state: 'partial', message: '已达到关系边界。' }],
};

describe('Person collaboration renderer', () => {
  it('keeps ranking, raw labels, evidence limits, and degraded warnings visible', () => {
    const viewModel = buildPersonCollaborationViewModel(result, { maxCollaborators: 1 });
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('共同作品数排名');
    expect(html).toContain('合作人物');
    expect(html).toContain('Subject 101');
    expect(html).toContain('作品一');
    expect(html).toContain('另有 1 部共同作品因证据显示上限未列出');
    expect(html).toContain('已达到关系边界');
    expect(html).toContain('官方 v0 共同作品观察');
    expect(html).toContain('证据与来源路径');
    expect(html).toContain('person-collaboration-v1');
  });

  it('keeps the narrow card root within its declared width for long labels and degraded evidence', async () => {
    const collaborator = result.collaborators[0];
    if (!collaborator) throw new Error('fixture collaborator is required');
    const longResult: PersonCollaborationResult = {
      ...result,
      person: {
        ...result.person!,
        name: 'A'.repeat(1400),
        nameCn: '长'.repeat(700),
      },
      targetRole: 'A'.repeat(80),
      collaboratorRole: 'B'.repeat(80),
      collaborators: [
        {
          ...collaborator,
          name: 'B'.repeat(1400),
          nameCn: '长'.repeat(700),
          sharedSubjects: [
            {
              ...collaborator.sharedSubjects[0]!,
              name: 'C'.repeat(1200),
              nameCn: '长'.repeat(600),
              targetRoles: ['D'.repeat(500)],
              collaboratorRoles: ['E'.repeat(500)],
            },
          ],
        },
      ],
      limitations: ['F'.repeat(1400)],
    };
    const viewModel = buildPersonCollaborationViewModel(longResult, { maxCollaborators: 1 });
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 2400 } });
      await page.setContent(html);
      const geometry = await page.locator('[data-render-root]').evaluate((element) => {
        const root = element as unknown as { clientWidth: number; scrollWidth: number };
        return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
      });
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    } finally {
      await browser.close();
    }
  });
});
