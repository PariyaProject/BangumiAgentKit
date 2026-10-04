import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { PersonActivityResult, SubjectOverviewResult } from '@bangumi-agent-kit/bangumi-core';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import type { ToolRegistry } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import {
  MCP_TOOL_TEXT_MAX_UTF8_BYTES,
  presentMcpToolResult,
} from '../../apps/mcp/src/result-presenter.js';

function makePersonActivityResult(): PersonActivityResult {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    subjectId: 40000 + index,
    subjectName: `A long Japanese title ${index} with enough detail for the MCP projection fixture`,
    subjectNameCn: `用于验证有限文字视图的作品 ${index}`,
    subjectType: 'anime' as const,
    platform: 'TV',
    firstAirDate: '2026-04-01',
    month: '2026-04',
    relationKind: 'voice' as const,
    characterName: `角色 ${index}`,
    rawRole: '主角',
    roleFamily: 'main' as const,
    origin: {
      state: 'not_observed' as const,
      metaTags: ['漫画'],
      metaTagsCoverage: {
        state: 'complete' as const,
        observed: 1,
        valid: 1,
        returned: 1,
        omitted: 0,
        malformed: 0,
        textTruncated: 0,
        truncated: false,
      },
    },
  }));

  const byMonth = Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, '0')}`,
    creditRows: index + 1,
    uniqueSubjects: index + 1,
    uniqueCharacters: index + 1,
  }));

  const origin = {
    explicitOriginalSubjects: 2,
    notObservedSubjects: 18,
    unknownSubjects: 0,
  };

  return {
    personId: 13684,
    person: {
      id: 13684,
      name: '水瀬いのり',
      nameCn: '水濑祈',
      type: 1,
      career: ['seiyu'],
      summary: '',
    },
    state: 'partial',
    kind: 'voice',
    media: 'tv',
    window: {
      months: 12,
      start: '2025-10-04',
      end: '2026-10-04',
      monthKeys: byMonth.map((item) => item.month),
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows,
    summary: {
      creditRows: 40,
      uniqueSubjects: 20,
      uniqueCharacters: 10,
      byRole: [
        {
          key: 'main',
          label: '主角',
          creditRows: 40,
          uniqueSubjects: 20,
          uniqueCharacters: 10,
        },
      ],
      byMedia: [
        {
          key: 'anime',
          label: 'TV动画',
          creditRows: 40,
          uniqueSubjects: 20,
          uniqueCharacters: 10,
        },
      ],
      byMonth,
      origin,
    },
    coverage: {
      relationRowsObserved: 80,
      relationRowsSelected: 40,
      relationRowsDroppedAtLimit: 40,
      relationSelectionStrategy: 'deterministic_even_spread',
      sampled: true,
      subjectIdsObserved: 40,
      subjectIdsSelected: 40,
      subjectIdsDroppedAtRelationLimit: 0,
      subjectDetailIdsObserved: 40,
      subjectDetailRequests: 40,
      subjectDetailsSucceeded: 40,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 40,
      rowsReturned: 40,
      outputTruncated: false,
      uniqueSubjects: 20,
      uniqueCharacters: 10,
      missingSubjectIdRows: 0,
      missingDateRows: 0,
      invalidDateRows: 0,
      outsideWindowRows: 0,
      mediaExcludedRows: 0,
      mediaUnknownRows: 0,
      staffRoleExcludedRows: 0,
      staffRoleUnknownRows: 0,
      maxRelations: 40,
      maxSubjectDetails: 40,
      maxRows: 40,
      detailConcurrency: 1,
      responseLimitBytes: 1_048_576,
      truncated: true,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      origin: {
        ...origin,
        subjectsObserved: 20,
        subjectsWithMetaTags: 20,
        subjectsPartial: 0,
        subjectsUnknown: 0,
        tagsObserved: 20,
        tagsValid: 20,
        tagsReturned: 20,
        tagsOmitted: 0,
        malformedTagValues: 0,
        textTruncatedTags: 0,
        truncatedSubjects: 0,
        truncated: false,
        maxTagsPerSubject: 10,
        maxTagCharacters: 80,
        responseLimitBytes: 1_048_576,
      },
    },
    exclusions: [
      {
        reason: 'subject_detail_cap',
        count: 12,
        sampleSubjectIds: Array.from({ length: 40 }, (_, index) => 40000 + index),
      },
    ],
    sourceOperations: [
      { operation: 'getPersonSubjects', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'getSubject', attempted: 40, succeeded: 40, failed: 0 },
      { operation: 'getSubjectStats', attempted: 0, succeeded: 0, failed: 0 },
    ],
    evidence: Array.from({ length: 80 }, (_, index) => ({
      source: index % 2 === 0 ? ('official-v0' as const) : ('derived-s7' as const),
      operation: `operation-${index}-with-verbose-provenance-details`,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      formulaVersion: 'person-activity-comparison-v1',
      description: 'A deliberately verbose evidence description that remains in structuredContent.',
    })),
    limitations: Array.from(
      { length: 10 },
      (_, index) =>
        `Limitation ${index}: the bounded observation does not establish complete career or date coverage.`,
    ),
    warnings: Array.from({ length: 10 }, (_, index) => ({
      code: `WARNING_${index}`,
      state: 'partial' as const,
      message: `Warning ${index}: this bounded result retains raw relation and coverage details.`,
    })),
  };
}

function makeSubjectOverviewResult(): SubjectOverviewResult {
  const staffItems = Array.from({ length: 80 }, (_, index) => {
    const groupIndex = Math.floor(index / 8);
    const relation =
      groupIndex === 0 ? '原作' : groupIndex === 1 ? '导演' : `职员原始标签 ${groupIndex}`;
    return {
      id: 50000 + index,
      name: `制作人员 ${index} 的较长显示名称`,
      type: 1,
      career: ['producer'],
      relation,
      rawRelation: relation,
      eps: '',
    };
  });

  const groups = Array.from({ length: 10 }, (_, index) => ({
    relation: index === 0 ? '原作' : index === 1 ? '导演' : `职员原始标签 ${index}`,
    count: 8,
    memberIds: Array.from({ length: 8 }, (_, member) => 50000 + index * 8 + member),
  }));

  const castItems = Array.from({ length: 24 }, (_, index) => ({
    character: {
      id: 60000 + index,
      name: `非常长的角色名称 ${index} チトとユーリの長い説明`,
      type: 1,
      summary: 'A long description is deliberately kept only in structuredContent.',
    },
    relation: index === 0 ? '主角' : '配角',
    actors: [
      {
        id: 70000 + index,
        name: `声优名称 ${index}`,
        career: ['seiyu'],
      },
    ],
    actorCoverage: { observed: 1, returned: 1, truncated: false },
  }));

  return {
    state: 'partial',
    subjectId: 218707,
    subject: {
      id: 218707,
      type: 'anime',
      name: 'Shoujo Shuumatsu Ryokou',
      nameCn: '少女终末旅行',
      summary: 'A'.repeat(2500),
      nsfw: false,
      locked: false,
      date: '2017-10-06',
      platform: 'TV',
      eps: 12,
      totalEpisodes: 12,
    },
    stats: {
      state: 'partial',
      data: {
        score: 8.6,
        rank: 42,
        ratingTotal: 100,
        ratingHistogram: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [String(index + 1), index + 1]),
        ),
        collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
      },
      coverage: { state: 'partial', observed: 100, returned: 1, truncated: true },
    },
    cast: {
      state: 'partial',
      items: castItems,
      coverage: { state: 'partial', observed: 100, returned: 24, truncated: true },
      actorCoverage: { observed: 24, returned: 24, truncated: false },
    },
    staff: {
      state: 'partial',
      items: staffItems,
      groups,
      coverage: { state: 'partial', observed: 100, returned: 80, truncated: true },
    },
    relations: {
      state: 'partial',
      items: Array.from({ length: 30 }, (_, index) => ({
        id: 80000 + index,
        type: 'anime' as const,
        name: `Related Original Title ${index}`,
        nameCn: `关联作品 ${index}`,
        relation: index === 0 ? '续集' : '原作',
      })),
      coverage: { state: 'partial', observed: 90, returned: 30, truncated: true },
    },
    coverage: {
      sourceRequestsAttempted: 5,
      sourceRequestsSucceeded: 5,
      sectionsComplete: 0,
      sectionsPartial: 4,
      sectionsUnavailable: 0,
      sectionsNotComputable: 0,
      truncatedSections: ['cast', 'staff', 'relations'],
      limits: { maxCast: 24, maxStaff: 80, maxRelations: 30 },
      actorLimits: { perCharacter: 4, total: 32 },
    },
    evidence: Array.from({ length: 50 }, (_, index) => ({
      source: index % 2 === 0 ? ('official-v0' as const) : ('derived-s7' as const),
      operation: `source-operation-${index}`,
      retrievedAt: '2026-10-04T00:00:00.000Z',
      formulaVersion: 'subject-overview-composition-v1',
      description: 'A verbose provenance description remains in structuredContent.',
    })),
    limitations: Array.from(
      { length: 10 },
      (_, index) => `Limitation ${index}: the current overview is a bounded sample.`,
    ),
    warnings: Array.from({ length: 10 }, (_, index) => ({
      code: `OVERVIEW_WARNING_${index}`,
      state: 'partial' as const,
      message: `Warning ${index}: this section remains a bounded result.`,
      section: 'staff' as const,
    })),
  };
}

async function callMcpToolWithResult(name: string, toolResult: Record<string, unknown>) {
  const registry = {
    getTools: () => [],
    executeTool: async () => toolResult,
  } as unknown as ToolRegistry;
  const app = new BangumiMcpServer({ registry, storage: new MemoryStorage() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.getMcpServer().connect(serverTransport);
  const client = new Client(
    { name: 'result-presenter-test', version: '1.0.0' },
    { capabilities: {} },
  );
  await client.connect(clientTransport);

  try {
    return await client.callTool({ name, arguments: {} });
  } finally {
    await client.close();
    await app.close();
  }
}

describe('MCP tool result presentation', () => {
  it('keeps the existing full pretty JSON text for small and unrelated results', () => {
    const small = { state: 'complete', count: 1 };
    const smallPresentation = presentMcpToolResult('bangumi.get_person_activity', small);
    const unrelatedLarge = { payload: 'x'.repeat(MCP_TOOL_TEXT_MAX_UTF8_BYTES + 10) };
    const unrelatedPresentation = presentMcpToolResult('bangumi.get_subject', unrelatedLarge);

    expect(smallPresentation).toEqual({ text: JSON.stringify(small, null, 2) });
    expect(unrelatedPresentation).toEqual({
      text: JSON.stringify(unrelatedLarge, null, 2),
    });
  });

  it('keeps the text byte bound for pathological long names while retaining full structure', () => {
    const personResult = makePersonActivityResult();
    personResult.person!.name = '水'.repeat(5000);
    const personPresentation = presentMcpToolResult('bangumi.get_person_activity', personResult);
    const personText = JSON.parse(personPresentation.text);

    expect(Buffer.byteLength(personPresentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(personText.person.displayNameTextTruncated).toBe(true);
    expect(personPresentation.structuredContent).toEqual(personResult);

    const overviewResult = makeSubjectOverviewResult();
    overviewResult.subject!.nameCn = '名'.repeat(5000);
    overviewResult.staff.groups[0]!.relation = '原始职位标签'.repeat(1000);
    const overviewPresentation = presentMcpToolResult(
      'bangumi.get_subject_overview',
      overviewResult,
    );
    const overviewText = JSON.parse(overviewPresentation.text);

    expect(Buffer.byteLength(overviewPresentation.text, 'utf8')).toBeLessThanOrEqual(
      MCP_TOOL_TEXT_MAX_UTF8_BYTES,
    );
    expect(overviewText.subject.displayNameTextTruncated).toBe(true);
    expect(overviewText.mcpTextProjection.staffGroupsOmittedFromText).toBeGreaterThan(0);
    expect(overviewPresentation.structuredContent).toEqual(overviewResult);
  });

  it('returns bounded person-activity text and the unchanged full structured result through MCP', async () => {
    const original = makePersonActivityResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_person_activity',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(response.structuredContent).toEqual(original);
    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.state).toBe('partial');
    expect(parsed.person.nameCn).toBe('水濑祈');
    expect(parsed.window.start).toBe('2025-10-04');
    expect(parsed.summary.uniqueSubjects).toBe(20);
    expect(parsed.coverage.relationRows.omittedAtLimit).toBe(40);
    expect(parsed.rows.length).toBeGreaterThan(0);
    expect(parsed.rows[0].origin.metaTags).toEqual(['漫画']);
    expect(parsed.mcpTextProjection.rowsOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.evidenceRecordsOmittedFromText).toBe(80);
    expect(parsed.exclusions[0]).toEqual({ reason: 'subject_detail_cap', count: 12 });
  });

  it('returns bounded subject-overview text with exact source labels and full structured content', async () => {
    const original = makeSubjectOverviewResult();
    const response = await callMcpToolWithResult(
      'bangumi.get_subject_overview',
      original as unknown as Record<string, unknown>,
    );
    const text = (response.content as Array<{ type: string; text?: string }>)[0]?.text;
    const parsed = JSON.parse(text ?? '');

    expect(response.structuredContent).toEqual(original);
    expect(typeof text).toBe('string');
    expect(Buffer.byteLength(text ?? '', 'utf8')).toBeLessThanOrEqual(MCP_TOOL_TEXT_MAX_UTF8_BYTES);
    expect(parsed.state).toBe('partial');
    expect(parsed.subject.nameCn).toBe('少女终末旅行');
    expect(parsed.cast.items.length).toBeGreaterThan(0);
    expect(parsed.cast.items[0].relation).toBe('主角');
    expect(parsed.staff.groups[0].relation).toBe('原作');
    expect(parsed.staff.groups[1].relation).toBe('导演');
    expect(parsed.staff.groups[0].members.length).toBeGreaterThan(0);
    expect(parsed.staff.groups[0].members[0].relation).toBe('原作');
    expect(parsed.relations.items.length).toBeGreaterThan(0);
    expect(parsed.relations.items[0].relation).toBe('续集');
    expect(parsed.staff.coverage.returned).toBe(80);
    expect(parsed.staff.coverage.truncated).toBe(true);
    expect(parsed.mcpTextProjection.staffMembersOmittedFromText).toBeGreaterThan(0);
    expect(parsed.mcpTextProjection.summaryOmittedFromText).toBe(true);
    expect(parsed.warningsOmittedFromText).toBeGreaterThan(0);
  });
});
