import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import catalog from '../../docs/tool-catalog.json';

const ROOT = process.cwd();
const CATALOG_TEXT = readFileSync(join(ROOT, 'docs/tool-catalog.json'), 'utf8');
const TABLE = readFileSync(join(ROOT, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
const COMPACT_EVIDENCE = JSON.parse(
  readFileSync(join(ROOT, 'docs/live-probes/pariya-agent-compact-e2e-2026-09-23.json'), 'utf8'),
);
const FULL_PUBLIC_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-public-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const EVIDENCE = [COMPACT_EVIDENCE, ...FULL_PUBLIC_QA_EVIDENCE];

function rowsByTool(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of TABLE.split(/\r?\n/u)) {
    if (!line.startsWith('| `bangumi.')) continue;
    const fields = line
      .slice(1, -1)
      .split('|')
      .map((field) => field.trim());
    const toolName = fields[0];
    if (toolName) rows.set(toolName.replaceAll('`', ''), fields);
  }
  return rows;
}

describe('per-tool model/MCP and QQ/TIM acceptance evidence', () => {
  it('records observed model-to-MCP calls without implying QQ or TIM acceptance', () => {
    const rows = rowsByTool();
    const catalogNames = catalog.map((item) => item.name).sort();
    const evidenceNames = EVIDENCE.flatMap((report) =>
      report.scenarios.flatMap(
        (scenario: { toolCalls: Array<{ name: string }>; passed: boolean }) =>
          scenario.passed ? scenario.toolCalls.map((call: { name: string }) => call.name) : [],
      ),
    );

    expect(rows.size).toBe(96);
    expect([...rows.keys()].sort()).toEqual(catalogNames);
    expect(new Set(evidenceNames).size).toBe(evidenceNames.length);
    expect(evidenceNames.sort()).toEqual([
      'bangumi.aggregate_subject_cohort',
      'bangumi.compare_subject_cohorts',
      'bangumi.describe_operation',
      'bangumi.get_calendar',
      'bangumi.get_calendar_intelligence',
      'bangumi.get_character',
      'bangumi.get_character_credit_integrity',
      'bangumi.get_episode_guide',
      'bangumi.get_episode_integrity',
      'bangumi.get_episodes',
      'bangumi.get_latest_subject_revision',
      'bangumi.get_person',
      'bangumi.get_person_activity',
      'bangumi.get_person_collaboration',
      'bangumi.get_person_profile',
      'bangumi.get_series_watch_order',
      'bangumi.get_subject',
      'bangumi.get_subject_cast',
      'bangumi.get_subject_comparison',
      'bangumi.get_subject_identity',
      'bangumi.get_subject_overlap',
      'bangumi.get_subject_overview',
      'bangumi.get_subject_relations',
      'bangumi.get_subject_stats',
      'bangumi.get_subject_stats_intelligence',
      'bangumi.list_operations',
      'bangumi.query_subjects',
      'bangumi.resolve_subject_concept',
      'bangumi.search_characters',
      'bangumi.search_persons',
      'bangumi.search_subjects',
    ]);

    for (const [name, fields] of rows) {
      expect(fields, name).toHaveLength(12);
      expect(fields[8], `${name} model/MCP`).toBe(evidenceNames.includes(name) ? '✅' : '⬜');
      expect(fields[9], `${name} QQ pipeline`).toBe('⬜');
      expect(fields[10], `${name} TIM client`).toBe('⬜');
    }
  });

  it('keeps the committed probe evidence scoped to actual CLI tool events', () => {
    expect(COMPACT_EVIDENCE).toMatchObject({
      schemaVersion: 1,
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: '724b286a1bc72a4dc7d84c988ffee792359fdf02',
      catalogSha256: createHash('sha256').update(CATALOG_TEXT).digest('hex'),
      profile: 'bangumi-compact-v1',
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(COMPACT_EVIDENCE.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subject-and-cast',
          passed: true,
          toolCalls: [
            { name: 'bangumi.search_subjects', state: 'DONE' },
            { name: 'bangumi.get_subject', state: 'DONE' },
            { name: 'bangumi.get_subject_cast', state: 'DONE' },
          ],
        }),
        expect.objectContaining({
          id: 'july-discovery',
          passed: true,
          toolCalls: [{ name: 'bangumi.query_subjects', state: 'DONE' }],
        }),
      ]),
    );

    expect(FULL_PUBLIC_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual([
      'bangumi.aggregate_subject_cohort',
      'bangumi.compare_subject_cohorts',
      'bangumi.describe_operation',
      'bangumi.get_calendar',
      'bangumi.get_calendar_intelligence',
      'bangumi.get_character',
      'bangumi.get_character_credit_integrity',
      'bangumi.get_episode_guide',
      'bangumi.get_episode_integrity',
      'bangumi.get_episodes',
      'bangumi.get_latest_subject_revision',
      'bangumi.get_person',
      'bangumi.get_person_activity',
      'bangumi.get_person_collaboration',
      'bangumi.get_person_profile',
      'bangumi.get_series_watch_order',
      'bangumi.get_subject_comparison',
      'bangumi.get_subject_identity',
      'bangumi.get_subject_overlap',
      'bangumi.get_subject_overview',
      'bangumi.get_subject_relations',
      'bangumi.get_subject_stats',
      'bangumi.get_subject_stats_intelligence',
      'bangumi.list_operations',
      'bangumi.resolve_subject_concept',
      'bangumi.search_characters',
      'bangumi.search_persons',
    ]);
    for (const report of FULL_PUBLIC_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        upstreamRevision: '724b286a1bc72a4dc7d84c988ffee792359fdf02',
        catalogSha256: createHash('sha256').update(CATALOG_TEXT).digest('hex'),
        profile: 'bangumi-full-public-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        passed: true,
        toolCalls: [{ name: report.scenarios[0].id, state: 'DONE' }],
      });
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
    }
  });
  it('continues to mark the public QA probe as Agent/MCP only', () => {
    const rows = rowsByTool();
    for (const report of FULL_PUBLIC_QA_EVIDENCE) {
      const name = report.scenarios[0].id;
      expect(rows.get(name)?.[8]).toBe('✅');
      expect(rows.get(name)?.[9]).toBe('⬜');
      expect(rows.get(name)?.[10]).toBe('⬜');
    }
  });
});
