import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone collection series presenter', () => {
  it('shows bounded groups, relation evidence, coverage, and warnings without comments', () => {
    const output = formatHuman({
      state: 'partial',
      groups: [
        {
          groupId: 'series-1',
          state: 'conflict',
          items: [
            { subjectId: 1, subjectNameCn: '第一部', status: 'doing', statusLabel: '在看' },
            { subjectId: 2, subjectNameCn: '第二部', status: 'wish', statusLabel: '想看' },
          ],
          edges: [
            {
              fromSubjectId: 1,
              toSubjectId: 2,
              fromNameCn: '第一部',
              toNameCn: '第二部',
              relation: '续集',
              observedCount: 2,
              conflict: true,
            },
          ],
          hiddenItemCount: 1,
        },
      ],
      ungrouped: [
        { subjectId: 3, subjectNameCn: '未归组条目', status: 'done', statusLabel: '看过' },
      ],
      summary: {
        eligibleAnimeItems: 3,
        groupedItems: 2,
        ungroupedItems: 1,
        relationEdges: 1,
      },
      coverage: {
        collection: { uniqueRows: 3, requestedMaxItems: 100, truncated: false },
        relations: { succeededSubjects: 2, requestedSubjects: 3 },
        output: { returnedGroups: 1, returnedEdges: 1 },
      },
      excludedRelations: {
        sourceRelations: 4,
        stableRelations: 1,
        excludedRelations: 2,
        unknownRelations: 1,
      },
      warnings: [{ code: 'RELATION_SUBJECT_CAP', message: '关系根条目达到上限' }],
      limitations: ['这是当前账号的有界直接关系观察，不是 canonical watch order。'],
      comment: 'private comment must not be shown',
    });

    expect(output).toContain('收藏系列组 · 状态: partial');
    expect(output).toContain('第一部');
    expect(output).toContain('—续集→');
    expect(output).toContain('覆盖: 收藏 3/100');
    expect(output).toContain('RELATION_SUBJECT_CAP');
    expect(output).not.toContain('private comment');
    expect(output).not.toContain('[object Object]');
  });
});
