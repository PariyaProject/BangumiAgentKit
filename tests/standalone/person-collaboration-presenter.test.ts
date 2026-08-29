import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone person collaboration presenter', () => {
  it('preserves source paths, outcomes, coverage, and derivation evidence', () => {
    const output = formatHuman({
      personId: 20,
      state: 'partial',
      person: { id: 20, name: 'Person', nameCn: '人物' },
      kind: 'all',
      media: 'all',
      collaborators: [
        {
          id: 2,
          name: 'Collaborator',
          uniqueSubjects: 1,
          relationLabels: ['声优'],
          sharedSubjects: [{ id: 1, name: 'Subject', nameCn: '作品一' }],
          sharedSubjectsOmitted: 2,
        },
      ],
      coverage: {
        relationRowsObserved: 4,
        relationRowsSelected: 3,
        subjectIdsObserved: 3,
        subjectIdsSelected: 2,
        participantRequests: 2,
        participantRequestsSucceeded: 1,
        participantRowsObserved: 4,
        participantRowsReturned: 1,
        relationRowsDroppedAtSourceLimit: 1,
        fanoutRowsDroppedAtSourceLimit: 0,
        participantRowsDroppedAtSourceLimit: 0,
        sharedSubjectRowsOmittedAtLimit: 2,
        truncated: true,
      },
      sourceOperations: [
        {
          operation: 'GET /v0/persons/{person_id}/characters',
          attempted: 1,
          succeeded: 0,
          failed: 1,
          rowsOmitted: 1,
          outcomes: [
            {
              state: 'failed',
              errorCode: 'UPSTREAM_UNAVAILABLE',
              retrievedAt: '2026-08-29T00:00:00.000Z',
              rowsOmitted: 1,
            },
          ],
        },
      ],
      evidence: [
        {
          source: 'derived-s7',
          operation: 'person-collaboration-composition',
          formulaVersion: 'person-collaboration-v1',
          description: '按稳定 ID 去重的共同作品观察。',
          retrievedAt: '2026-08-29T00:00:01.000Z',
        },
      ],
      warnings: [{ code: 'RELATION_SOURCE_PARTIAL', message: '关系源部分失败。' }],
      limitations: ['结果仅代表有界官方观察。'],
    });

    expect(output).toContain('人物合作网络 · 状态: 部分');
    expect(output).toContain('GET /v0/persons/{person_id}/characters');
    expect(output).toContain('UPSTREAM_UNAVAILABLE');
    expect(output).toContain('person-collaboration-v1');
    expect(output).toContain('关系响应省略 1');
    expect(output).not.toContain('[object Object]');
  });
});
