import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone person activity presenter', () => {
  it('exposes origin groups, source coverage, and the positive-only limitation', () => {
    const output = formatHuman({
      personId: 20,
      state: 'partial',
      person: { id: 20, name: 'Person', nameCn: '人物' },
      kind: 'staff',
      media: 'tv',
      window: { start: '2026-03-01', end: '2026-08-15' },
      rows: [
        {
          subjectId: 1,
          subjectName: 'Subject',
          subjectNameCn: '作品一',
          firstAirDate: '2026-05-10',
          relationKind: 'staff',
          roleFamily: '制作人员',
          origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
        },
        {
          subjectId: 2,
          subjectName: 'Subject 2',
          subjectNameCn: '作品二',
          firstAirDate: '2026-06-10',
          relationKind: 'staff',
          roleFamily: '制作人员',
          origin: { state: 'not_observed', metaTags: ['漫画'] },
        },
      ],
      summary: {
        origin: { explicitOriginalSubjects: 1, notObservedSubjects: 1, unknownSubjects: 0 },
      },
      coverage: {
        relationRowsObserved: 2,
        relationRowsSelected: 2,
        subjectIdsObserved: 2,
        subjectIdsSelected: 2,
        subjectDetailsSucceeded: 2,
        subjectDetailRequests: 2,
        rowsReturned: 2,
        rowsEligible: 2,
        origin: {
          subjectsObserved: 2,
          explicitOriginalSubjects: 1,
          notObservedSubjects: 1,
          unknownSubjects: 0,
        },
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
      sourceOperations: [
        {
          operation: 'GET /v0/subjects/{subject_id}',
          attempted: 2,
          succeeded: 2,
          failed: 0,
        },
      ],
      evidence: [
        {
          source: 'derived-s7',
          operation: 'person-activity-origin-observation',
          formulaVersion: 'person-activity-origin-v1',
        },
      ],
      limitations: ['未观察到原创标签不等于改编。'],
      warnings: [],
    });

    expect(output).toContain('人物 activity · 状态: 部分');
    expect(output).toContain('作品来源观察（官方 v0 subject.meta_tags）');
    expect(output).toContain('明确原创 1');
    expect(output).toContain('未观察到原创标签 1');
    expect(output).toContain('未观察到“原创”标签不等于“改编”');
    expect(output).toContain('来源与检索：official-v0 · 2026-08-30');
    expect(output).toContain('官方 meta_tags：原创、奇幻');
    expect(output).toContain('person-activity-origin-v1');
    expect(output).not.toContain('[object Object]');
  });
});
