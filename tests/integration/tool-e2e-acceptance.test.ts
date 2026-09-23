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
const FULL_RENDERER_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-renderer-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_OPERATION_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-operation-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_START_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-start-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_DENIAL_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-denial-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_SWITCH_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-switch-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const EVIDENCE = [
  COMPACT_EVIDENCE,
  ...FULL_PUBLIC_QA_EVIDENCE,
  ...FULL_RENDERER_QA_EVIDENCE,
  ...FULL_OPERATION_QA_EVIDENCE,
  ...FULL_AUTH_START_QA_EVIDENCE,
  ...FULL_AUTH_SWITCH_QA_EVIDENCE,
];
const CURRENT_CATALOG_SHA256 = createHash('sha256').update(CATALOG_TEXT).digest('hex');
const catalogCache = new Map<string, unknown[]>([[CURRENT_CATALOG_SHA256, catalog]]);

function catalogForHash(sha256: string): unknown[] | undefined {
  const cached = catalogCache.get(sha256);
  if (cached) return cached;
  if (!/^[a-f0-9]{64}$/u.test(sha256)) return undefined;
  try {
    const content = readFileSync(
      join(ROOT, 'docs/live-probes/catalog-snapshots', `${sha256}.json`),
    );
    if (createHash('sha256').update(content).digest('hex') !== sha256) return undefined;
    const snapshot = JSON.parse(content.toString('utf8')) as unknown[];
    catalogCache.set(sha256, snapshot);
    return snapshot;
  } catch {
    return undefined;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function toolContractMatchesCurrent(report: any, name: string): boolean {
  const evidenceCatalog = catalogForHash(report.catalogSha256);
  const evidenceTool = evidenceCatalog?.find((item) =>
    Boolean(item && typeof item === 'object' && (item as { name?: unknown }).name === name),
  );
  const currentTool = catalog.find((item) => item.name === name);
  return Boolean(
    evidenceTool && currentTool && stableJson(evidenceTool) === stableJson(currentTool),
  );
}

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
          scenario.passed
            ? scenario.toolCalls
                .filter((call: { name: string }) => toolContractMatchesCurrent(report, call.name))
                .map((call: { name: string }) => call.name)
            : [],
      ),
    );

    expect(rows.size).toBe(96);
    expect([...rows.keys()].sort()).toEqual(catalogNames);
    expect(new Set(evidenceNames).size).toBe(evidenceNames.length);
    expect(evidenceNames.sort()).toEqual(
      [
        'bangumi.aggregate_subject_cohort',
        'bangumi.auth_list_accounts',
        'bangumi.auth_status',
        'bangumi.compare_subject_cohorts',
        'bangumi.describe_operation',
        'bangumi.get_calendar',
        'bangumi.get_calendar_intelligence',
        'bangumi.get_character',
        'bangumi.get_character_collection',
        'bangumi.get_character_credit_integrity',
        'bangumi.get_collection',
        'bangumi.get_episode',
        'bangumi.get_episode_guide',
        'bangumi.get_episode_integrity',
        'bangumi.get_episodes',
        'bangumi.get_index',
        'bangumi.get_latest_subject_revision',
        'bangumi.get_person',
        'bangumi.get_person_activity',
        'bangumi.get_person_collaboration',
        'bangumi.get_person_collection',
        'bangumi.get_person_profile',
        'bangumi.get_revision',
        'bangumi.get_revision_intelligence',
        'bangumi.get_series_watch_order',
        'bangumi.get_subject',
        'bangumi.get_subject_cast',
        'bangumi.get_subject_comparison',
        'bangumi.get_subject_identity',
        'bangumi.get_subject_index_membership',
        'bangumi.get_subject_overlap',
        'bangumi.get_subject_overview',
        'bangumi.get_subject_relations',
        'bangumi.get_subject_staff',
        'bangumi.get_subject_stats',
        'bangumi.get_subject_stats_history',
        'bangumi.get_subject_stats_intelligence',
        'bangumi.get_user',
        'bangumi.list_character_collections',
        'bangumi.list_collections',
        'bangumi.list_operations',
        'bangumi.list_person_collections',
        'bangumi.list_revisions',
        'bangumi.query_subjects',
        'bangumi.resolve_subject_concept',
        'bangumi.search_characters',
        'bangumi.search_persons',
        'bangumi.search_subjects',
        'bangumi.auth_start',
        'bangumi.auth_switch_account',
        'bangumi.call_operation',
        'bangumi.render_calendar',
        'bangumi.render_cast_card',
        'bangumi.render_character_credit_integrity',
        'bangumi.render_episode_guide',
        'bangumi.render_episode_integrity',
        'bangumi.render_latest_subject_revision',
        'bangumi.render_person_activity',
        'bangumi.render_person_collaboration',
        'bangumi.render_person_profile',
        'bangumi.render_query_subjects',
        'bangumi.render_revision_timeline',
        'bangumi.render_search',
        'bangumi.render_series_watch_order',
        'bangumi.render_subject_card',
        'bangumi.render_subject_cohort_aggregation',
        'bangumi.render_subject_cohort_comparison',
        'bangumi.render_subject_comparison',
        'bangumi.render_subject_identity',
        'bangumi.render_subject_index_membership',
        'bangumi.render_subject_overlap',
        'bangumi.render_subject_overview',
        'bangumi.render_subject_stats_history',
        'bangumi.render_subject_stats_intelligence',
      ].sort(),
    );

    for (const [name, fields] of rows) {
      expect(fields, name).toHaveLength(13);
      expect(fields[9], `${name} model/MCP`).toBe(evidenceNames.includes(name) ? '✅' : '⬜');
      expect(fields[10], `${name} QQ pipeline`).toBe('⬜');
      expect(fields[11], `${name} TIM client`).toBe('⬜');
    }
  });

  it('keeps the committed probe evidence scoped to actual CLI tool events', () => {
    expect(COMPACT_EVIDENCE).toMatchObject({
      schemaVersion: 1,
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: '724b286a1bc72a4dc7d84c988ffee792359fdf02',
      catalogSha256: COMPACT_EVIDENCE.catalogSha256,
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
    expect(catalogForHash(COMPACT_EVIDENCE.catalogSha256)).toBeDefined();
    for (const scenario of COMPACT_EVIDENCE.scenarios) {
      for (const call of scenario.toolCalls) {
        expect(toolContractMatchesCurrent(COMPACT_EVIDENCE, call.name)).toBe(true);
      }
    }

    expect(FULL_PUBLIC_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual(
      [
        'bangumi.aggregate_subject_cohort',
        'bangumi.auth_list_accounts',
        'bangumi.auth_status',
        'bangumi.compare_subject_cohorts',
        'bangumi.describe_operation',
        'bangumi.get_calendar',
        'bangumi.get_calendar_intelligence',
        'bangumi.get_character',
        'bangumi.get_character_collection',
        'bangumi.get_character_credit_integrity',
        'bangumi.get_collection',
        'bangumi.get_episode',
        'bangumi.get_episode_guide',
        'bangumi.get_episode_integrity',
        'bangumi.get_episodes',
        'bangumi.get_index',
        'bangumi.get_latest_subject_revision',
        'bangumi.get_person',
        'bangumi.get_person_activity',
        'bangumi.get_person_collaboration',
        'bangumi.get_person_collection',
        'bangumi.get_person_profile',
        'bangumi.get_revision',
        'bangumi.get_revision_intelligence',
        'bangumi.get_series_watch_order',
        'bangumi.get_subject_comparison',
        'bangumi.get_subject_identity',
        'bangumi.get_subject_index_membership',
        'bangumi.get_subject_overlap',
        'bangumi.get_subject_overview',
        'bangumi.get_subject_relations',
        'bangumi.get_subject_staff',
        'bangumi.get_subject_stats',
        'bangumi.get_subject_stats_history',
        'bangumi.get_subject_stats_intelligence',
        'bangumi.get_user',
        'bangumi.list_character_collections',
        'bangumi.list_collections',
        'bangumi.list_operations',
        'bangumi.list_person_collections',
        'bangumi.list_revisions',
        'bangumi.resolve_subject_concept',
        'bangumi.search_characters',
        'bangumi.search_persons',
      ].sort(),
    );
    for (const report of FULL_PUBLIC_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        catalogSha256: report.catalogSha256,
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
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, report.scenarios[0].id)).toBe(true);
    }
  });

  it('accepts only renderer evidence containing a verified temporary PNG artifact', () => {
    expect(FULL_RENDERER_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual(
      [
        'bangumi.render_calendar',
        'bangumi.render_cast_card',
        'bangumi.render_character_credit_integrity',
        'bangumi.render_episode_guide',
        'bangumi.render_episode_integrity',
        'bangumi.render_latest_subject_revision',
        'bangumi.render_person_activity',
        'bangumi.render_person_collaboration',
        'bangumi.render_person_profile',
        'bangumi.render_query_subjects',
        'bangumi.render_revision_timeline',
        'bangumi.render_search',
        'bangumi.render_series_watch_order',
        'bangumi.render_subject_card',
        'bangumi.render_subject_cohort_aggregation',
        'bangumi.render_subject_cohort_comparison',
        'bangumi.render_subject_comparison',
        'bangumi.render_subject_identity',
        'bangumi.render_subject_index_membership',
        'bangumi.render_subject_overlap',
        'bangumi.render_subject_overview',
        'bangumi.render_subject_stats_history',
        'bangumi.render_subject_stats_intelligence',
      ].sort(),
    );
    for (const report of FULL_RENDERER_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-renderer-qa-v1',
        processExitCode: 0,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      const scenario = report.scenarios[0];
      expect(scenario).toMatchObject({
        passed: true,
        id: scenario.toolCalls[0].name,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          exactTargetToolCompleted: true,
          rendererArtifactVerified: true,
          artifactRefReturned: true,
          toolReportedError: false,
          artifactMimeType: 'image/png',
        },
      });
      expect(scenario.assertions.artifactWidth).toBeGreaterThan(0);
      expect(scenario.assertions.artifactHeight).toBeGreaterThan(0);
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
    }
  });

  it('accepts dynamic-operation evidence only for the pinned public getCalendar operation', () => {
    expect(FULL_OPERATION_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.call_operation',
    ]);
    for (const report of FULL_OPERATION_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-operation-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('GET /calendar');
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.call_operation',
        passed: true,
        toolCalls: [{ name: 'bangumi.call_operation', state: 'DONE' }],
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.call_operation')).toBe(true);
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
    }
  });

  it('accepts only synthetic OAuth-start evidence with state redacted before the model', () => {
    expect(FULL_AUTH_START_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.auth_start',
    ]);
    for (const report of FULL_AUTH_START_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-start-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('test_client_id');
      expect(report.scopeNote).toContain('redacted');
      expect(report.scopeNote).toContain('No real account authorization');
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.auth_start',
        passed: true,
        toolCalls: [{ name: 'bangumi.auth_start', state: 'DONE' }],
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.auth_start')).toBe(true);
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
    }
  });

  it('records auth-required denial separately from authenticated feature execution', () => {
    const expectedTools = [
      'bangumi.get_collection_backlog',
      'bangumi.get_collection_dashboard',
      'bangumi.get_collection_entity_consistency',
      'bangumi.get_collection_intelligence',
      'bangumi.get_collection_schedule',
      'bangumi.get_collection_series_groups',
      'bangumi.get_episode_collections',
      'bangumi.get_my_profile',
      'bangumi.render_collection_backlog',
      'bangumi.render_collection_dashboard',
      'bangumi.render_collection_entity_consistency',
      'bangumi.render_collection_intelligence',
      'bangumi.render_collection_progress',
      'bangumi.render_collection_schedule',
      'bangumi.render_collection_series_groups',
    ].sort();
    expect(FULL_AUTH_DENIAL_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual(
      expectedTools,
    );
    const rows = rowsByTool();
    for (const report of FULL_AUTH_DENIAL_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-denial-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('AUTH_REQUIRED');
      const scenario = report.scenarios[0];
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          authRequiredGateObserved: true,
          operationExecuted: false,
          accountDataReturned: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rows.get(scenario.id)?.[7]).toBe('✅');
      expect(rows.get(scenario.id)?.[8]).toBe('⬜');
      expect(rows.get(scenario.id)?.[9]).toBe('⬜');
    }
  });

  it('accepts local auth-switch evidence only for the fixed synthetic account binding', () => {
    expect(FULL_AUTH_SWITCH_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.auth_switch_account',
    ]);
    for (const report of FULL_AUTH_SWITCH_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-switch-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic MemoryStorage');
      expect(report.scopeNote).toContain('no Bangumi API');
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.auth_switch_account',
        passed: true,
        toolCalls: [{ name: 'bangumi.auth_switch_account', state: 'DONE' }],
        assertions: {
          syntheticLocalStateMutation: true,
          activeBindingVerified: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.auth_switch_account')).toBe(true);
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
      expect(rowsByTool().get('bangumi.auth_switch_account')?.[9]).toBe('✅');
    }
  });
  it('continues to mark the public QA probe as Agent/MCP only', () => {
    const rows = rowsByTool();
    for (const report of FULL_PUBLIC_QA_EVIDENCE) {
      const name = report.scenarios[0].id;
      expect(rows.get(name)?.[9]).toBe('✅');
      expect(rows.get(name)?.[10]).toBe('⬜');
      expect(rows.get(name)?.[11]).toBe('⬜');
    }
  });
});
