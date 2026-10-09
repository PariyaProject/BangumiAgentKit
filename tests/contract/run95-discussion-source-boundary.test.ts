import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface CatalogEntry {
  name: string;
  description: string;
}

interface FrontierRecord {
  id: string;
  status: string;
  source_refs: string[];
  next_action: string;
}

describe('Run #95 weekly discussion source boundary', () => {
  it('keeps G11 and G21 partial and out of accepted tool coverage', () => {
    const catalog = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/tool-catalog.json'), 'utf8'),
    ) as CatalogEntry[];
    const ledger = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/product/frontier-ledger.json'), 'utf8'),
    ) as { records: FrontierRecord[] };
    const reportPath = 'docs/research/run95-g11-g21-public-source-boundary-2026-10-09.md';
    const report = readFileSync(resolve(process.cwd(), reportPath), 'utf8');
    const g11 = ledger.records.find((record) => record.id === 'G11');
    const g21 = ledger.records.find((record) => record.id === 'G21');

    expect(g11?.status).toBe('PARTIAL');
    expect(g11?.source_refs).toContain(reportPath);
    expect(g11?.next_action).toMatch(/claim no discussion ranking or Agent\/MCP coverage/iu);
    expect(g21?.status).toBe('PARTIAL');
    expect(g21?.source_refs).toContain(reportPath);
    expect(g21?.next_action).toMatch(/claim no topic\/reply counts or Agent\/MCP coverage/iu);

    const chapterScopedTools = new Set([
      'bangumi.get_episode_guide',
      'bangumi.render_episode_guide',
    ]);
    const heatTool = catalog.find((entry) => entry.name === 'bangumi.query_subjects');
    expect(heatTool?.description).toContain('heat 表示当前收藏人数，不是讨论热度或历史趋势');
    for (const name of chapterScopedTools) {
      const entry = catalog.find((candidate) => candidate.name === name);
      expect(entry?.description).toContain('章节指南');
      expect(entry?.description).toContain('讨论数');
      expect(entry?.description).not.toMatch(/话题|主题|回复|replyCount/iu);
    }

    const subjectDiscussionClaims = catalog.filter(({ name, description }) => {
      if (chapterScopedTools.has(name)) return false;
      const searchableDescription =
        name === 'bangumi.query_subjects'
          ? description.replace('heat 表示当前收藏人数，不是讨论热度或历史趋势', '')
          : description;
      const searchable = `${name} ${searchableDescription}`;
      const hasSubjectScope = /subject|entry|work|条目|作品/iu.test(searchable);
      const hasCommunityMetric = /topic|reply|discussion|话题|主题|回复|讨论/iu.test(searchable);
      return hasSubjectScope && hasCommunityMetric;
    });
    expect(subjectDiscussionClaims).toEqual([]);

    expect(report).toContain(
      'No Bangumi runtime, topic, reply, community, account, OAuth, QQ, or TIM request was made.',
    );
    expect(report).toContain('This does not mean either user question is answered');
  });
});
