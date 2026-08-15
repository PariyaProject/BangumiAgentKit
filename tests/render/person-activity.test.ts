import { describe, expect, it } from 'vitest';
import {
  RenderService,
  buildPersonActivityViewModel,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import type { PersonActivityResult } from '@bangumi-agent-kit/bangumi-core';

const result: PersonActivityResult = {
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
  kind: 'voice',
  media: 'tv',
  window: {
    months: 6,
    start: '2026-03-01',
    end: '2026-08-15',
    monthKeys: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  },
  rows: Array.from({ length: 22 }, (_, index) => ({
    subjectId: index + 1,
    subjectName: `Long Subject Name ${index + 1}`,
    subjectNameCn: '一个用于验证窄宽度换行和层级的超长中文条目标题',
    subjectType: 'anime' as const,
    platform: 'TV',
    firstAirDate: `2026-0${(index % 6) + 3}-10`,
    month: `2026-0${(index % 6) + 3}`,
    relationKind: 'voice' as const,
    relationId: index + 100,
    characterName: `角色 ${index + 1}`,
    rawRole: index % 2 === 0 ? '主角' : '配角',
    roleFamily: index % 2 === 0 ? ('main' as const) : ('support' as const),
  })),
  summary: {
    creditRows: 22,
    uniqueSubjects: 22,
    uniqueCharacters: 22,
    byRole: [
      { key: 'main', label: '主役', creditRows: 11, uniqueSubjects: 11, uniqueCharacters: 11 },
      { key: 'support', label: '配角', creditRows: 11, uniqueSubjects: 11, uniqueCharacters: 11 },
    ],
    byMedia: [
      { key: 'anime', label: 'anime', creditRows: 22, uniqueSubjects: 22, uniqueCharacters: 22 },
    ],
    byMonth: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((month) => ({
      month,
      creditRows: 3,
      uniqueSubjects: 3,
      uniqueCharacters: 3,
    })),
  },
  coverage: {
    relationRowsObserved: 24,
    relationRowsSelected: 22,
    relationRowsDroppedAtLimit: 2,
    relationSelectionStrategy: 'deterministic_even_spread',
    sampled: true,
    subjectIdsObserved: 22,
    subjectIdsSelected: 22,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: 22,
    subjectDetailRequests: 22,
    subjectDetailsSucceeded: 22,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: 22,
    rowsReturned: 22,
    outputTruncated: false,
    uniqueSubjects: 22,
    uniqueCharacters: 22,
    missingSubjectIdRows: 0,
    missingDateRows: 1,
    invalidDateRows: 0,
    outsideWindowRows: 1,
    mediaExcludedRows: 0,
    mediaUnknownRows: 1,
    maxRelations: 24,
    maxSubjectDetails: 24,
    maxRows: 40,
    detailConcurrency: 4,
    truncated: true,
    retrievedAt: '2026-08-15T00:00:00.000Z',
  },
  exclusions: [
    { reason: 'missing_date', count: 1, sampleSubjectIds: [90] },
    { reason: 'media_unknown', count: 1, sampleSubjectIds: [91] },
  ],
  sourceOperations: [
    { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/persons/{person_id}/characters', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/subjects/{subject_id}', attempted: 22, succeeded: 22, failed: 0 },
  ],
  evidence: [],
  limitations: [
    '时间窗按官方作品 first_air_date 的日期归属，不代表实际配音时间。',
    '没有历史快照，不能计算增长或趋势。',
  ],
  warnings: [
    { code: 'MISSING_ACTIVITY_DATE', state: 'partial', message: '有关系缺少可用日期。' },
    { code: 'ROLE_UNKNOWN', state: 'partial', message: '有关系无法分类。' },
  ],
};

describe('Person activity renderer', () => {
  it('keeps window, evidence limits, exclusions, and rows readable at narrow width', async () => {
    const viewModel = buildPersonActivityViewModel(result, { maxRows: 12 });
    expect(viewModel.hiddenRows).toBe(10);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('2026-03-01');
    expect(html).toContain('另有 10 条窗口内关系因展示上限未显示');
    expect(html).toContain('缺少作品首播日期');
    expect(html).toContain('first_air_date');

    const failedPersonViewModel = buildPersonActivityViewModel(
      { ...result, personId: 99, person: undefined },
      { maxRows: 1 },
    );
    const failedPersonHtml = renderHtmlTemplate(failedPersonViewModel, 'bangumi-dark', {}, 640);
    expect(failedPersonHtml).toContain('Person ID 99');
    expect(failedPersonHtml).not.toContain('Person ID 0');

    const service = new RenderService();
    try {
      const rendered = await service.renderCard(viewModel, { width: 640, deviceScaleFactor: 1 });
      expect(rendered.template).toBe('person-activity');
      expect(rendered.width).toBe(640);
      expect(rendered.height).toBeGreaterThan(500);
      expect(
        rendered.buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      ).toBe(true);
    } finally {
      await service.close();
    }
  });
});
