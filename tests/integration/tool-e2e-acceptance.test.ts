import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import catalog from '../../docs/tool-catalog.json';

const ROOT = process.cwd();
const CATALOG_TEXT = readFileSync(join(ROOT, 'docs/tool-catalog.json'), 'utf8');
const TABLE = readFileSync(join(ROOT, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
const COMPACT_EVIDENCE = JSON.parse(
  readFileSync(join(ROOT, 'docs/live-probes/pariya-agent-compact-e2e-2026-09-23.json'), 'utf8'),
);
const RUN86_PERSON_ACTIVITY_COMPARISON_EVIDENCE = JSON.parse(
  readFileSync(
    join(ROOT, 'docs/live-probes/person-activity-comparison-run86-c4acc24.json'),
    'utf8',
  ),
);
const RUN89_SUBJECT_STAFF_EVIDENCE = JSON.parse(
  readFileSync(
    join(
      ROOT,
      'docs/live-probes/pariya-agent-full-public-qa-e2e-get-subject-staff-2026-10-04.json',
    ),
    'utf8',
  ),
);
const FULL_PUBLIC_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-public-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_RENDERER_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-renderer-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const CODEX_LUNA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-codex-luna-e2e-') && name.endsWith('.json'))
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
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')))
  .filter((report: any) => report.scenarios?.[0]?.assertions?.networkAccessBlocked === true);
const FULL_AUTH_SWITCH_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-switch-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_MUTATION_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-mutation-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_FEATURE_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-feature-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_WRITE_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-write-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const RUN66_DISCOVERY_DIRECT_EVIDENCE = JSON.parse(
  readFileSync(
    join(ROOT, 'docs/live-probes/discovery-scenarios-run66-d1a5a03-2026-10-03.json'),
    'utf8',
  ),
);
const RUN66_DISCOVERY_SCENARIO_DIR = join(ROOT, 'docs/live-probes/scenario-runs/run66-d1a5a03');
const RUN66_DISCOVERY_AGENT_EVIDENCE = readdirSync(RUN66_DISCOVERY_SCENARIO_DIR)
  .filter((name) => name.startsWith('agent-query-subjects-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(RUN66_DISCOVERY_SCENARIO_DIR, name), 'utf8')));
const RUN66_DISCOVERY_RENDER_EVIDENCE = readdirSync(RUN66_DISCOVERY_SCENARIO_DIR)
  .filter((name) => name.startsWith('render-query-subjects-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(RUN66_DISCOVERY_SCENARIO_DIR, name), 'utf8')));

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

// Preserve prior reports as history, but count only the newest current-contract
// report for each tool in the current-source acceptance matrix.
const CURRENT_FULL_PUBLIC_QA_EVIDENCE = (() => {
  const current = FULL_PUBLIC_QA_EVIDENCE.filter((report: any) => {
    const name = report.scenarios?.[0]?.id;
    return typeof name === 'string' && toolContractMatchesCurrent(report, name);
  }).sort(
    (left: any, right: any) =>
      Number(Boolean(right.candidateSha)) - Number(Boolean(left.candidateSha)) ||
      String(right.createdOn ?? '').localeCompare(String(left.createdOn ?? '')) ||
      String(right.upstreamRevision ?? '').localeCompare(String(left.upstreamRevision ?? '')),
  );
  const seenTools = new Set<string>();
  return current.filter((report: any) => {
    const name = report.scenarios?.[0]?.id;
    if (typeof name !== 'string' || seenTools.has(name)) return false;
    seenTools.add(name);
    return true;
  });
})();
const CURRENT_FULL_RENDERER_QA_EVIDENCE = FULL_RENDERER_QA_EVIDENCE.filter((report: any) => {
  const name = report.scenarios?.[0]?.id;
  return typeof name === 'string' && toolContractMatchesCurrent(report, name);
});
const CURRENT_CATALOG_PENDING_AGENT_MCP = [
  'bangumi.aggregate_subject_cohort',
  'bangumi.compare_subject_cohorts',
  'bangumi.get_subject_stats_intelligence',
  'bangumi.query_subjects',
  'bangumi.render_query_subjects',
  'bangumi.render_subject_cohort_aggregation',
  'bangumi.render_subject_cohort_comparison',
  'bangumi.render_subject_stats_intelligence',
].sort();
const CURRENT_CATALOG_PENDING_AGENT_MCP_SET = new Set(CURRENT_CATALOG_PENDING_AGENT_MCP);

const EVIDENCE = [
  COMPACT_EVIDENCE,
  ...CURRENT_FULL_PUBLIC_QA_EVIDENCE,
  ...FULL_RENDERER_QA_EVIDENCE,
  ...CODEX_LUNA_EVIDENCE,
  ...FULL_OPERATION_QA_EVIDENCE,
  ...FULL_AUTH_START_QA_EVIDENCE,
  ...FULL_AUTH_SWITCH_QA_EVIDENCE,
  ...FULL_AUTH_MUTATION_QA_EVIDENCE,
  ...FULL_AUTH_FEATURE_QA_EVIDENCE,
  ...FULL_AUTH_WRITE_QA_EVIDENCE,
];

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

function statusMark(cell: string | undefined): string | undefined {
  return cell?.split('<br>', 1)[0];
}

function expectClientEvidenceCell(cell: string | undefined, label: string): void {
  const mark = statusMark(cell);
  expect(['✅', '⬜'], label).toContain(mark);
  if (mark === '✅') {
    expect(cell, label).toContain('pariya-agent-production-client-e2e-');
  } else {
    expect(cell, label).toBe('⬜');
  }
  expect(cell, label).not.toContain('pariya-agent-full-public-qa-e2e-');
}

describe('per-tool model/MCP and QQ/TIM acceptance evidence', () => {
  it('does not count Agent/MCP reports from failed or incomplete CLI runs', () => {
    const liveDir = mkdtempSync(join(tmpdir(), 'bangumi-e2e-evidence-'));
    try {
      const python = String.raw`
import hashlib, importlib.util, json, pathlib, sys
module_path = pathlib.Path(sys.argv[1])
live_dir = pathlib.Path(sys.argv[2])
spec = importlib.util.spec_from_file_location('acceptance_generator', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.LIVE_PROBE_DIR = live_dir
catalog = json.loads(module.CATALOG.read_text(encoding='utf-8'))
catalog_hash = hashlib.sha256(module.CATALOG.read_bytes()).hexdigest()
cases = [
    ('valid', 0, 'SUCCESS', 1, True),
    ('nonzero-exit', 1, 'SUCCESS', 1, True),
    ('bool-exit', False, 'SUCCESS', 1, True),
    ('failed-result', 0, 'FAILURE', 1, True),
    ('missing-exit', None, 'SUCCESS', 1, False),
    ('missing-result-count', 0, 'SUCCESS', None, True),
    ('mismatched-result-count', 0, 'SUCCESS', 2, True),
]
for index, (label, exit_code, result_status, result_count, include_exit) in enumerate(cases):
    tool_name = catalog[index]['name']
    report = {
        'schemaVersion': 1,
        'evidenceKind': 'antigravity_cli_mcp_tool_use',
        'catalogSha256': catalog_hash,
        'profile': 'bangumi-compact-v1',
        'resultStatus': result_status,
        'resultCount': result_count,
        'qqPipelineTested': False,
        'timClientTested': False,
        'scenarios': [{'passed': True, 'toolCalls': [{'name': tool_name, 'state': 'DONE'}]}],
    }
    if include_exit:
        report['processExitCode'] = exit_code
    if result_count is None:
        report.pop('resultCount')
    (live_dir / f'pariya-agent-{label}-e2e-{index}.json').write_text(json.dumps(report), encoding='utf-8')
print(json.dumps(sorted(module.model_mcp_e2e_names(catalog))))
`;
      const result = spawnSync(
        'python3',
        ['-c', python, join(ROOT, 'scripts/generate-tool-acceptance-tasks.py'), liveDir],
        { encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([catalog[0]?.name]);
    } finally {
      rmSync(liveDir, { recursive: true, force: true });
    }
  });

  it('validates the exact-candidate bounded person-activity comparison evidence', () => {
    const report = RUN86_PERSON_ACTIVITY_COMPARISON_EVIDENCE;
    expect(report).toMatchObject({
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: 'c4acc246551d31ddfc91b54d1031d4454365a7fc',
      candidateSha: 'c4acc246551d31ddfc91b54d1031d4454365a7fc',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      sourceProfile: 'standard-full',
      cliVersion: '1.2.14',
      processExitCode: 0,
      resultCount: 1,
      resultStatus: 'SUCCESS',
      personActivityArgumentsVerified: true,
      probeArgumentsVerified: true,
      personActivityResultVerified: true,
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(report.probeArguments).toEqual({
      personId: 13684,
      kind: 'voice',
      media: 'tv',
      windowMonths: 6,
      maxRelations: 48,
      maxSubjectDetails: 12,
      maxRows: 20,
      comparePreviousWindow: true,
    });

    expect(report.toolResultSummaries).toHaveLength(1);
    const tool = report.toolResultSummaries[0];
    expect(tool.name).toBe('bangumi.get_person_activity');
    expect(tool.arguments).toMatchObject({
      available: true,
      matchedFieldNames: [
        'comparePreviousWindow',
        'kind',
        'maxRelations',
        'maxRows',
        'maxSubjectDetails',
        'media',
        'personId',
        'windowMonths',
      ],
      unexpectedFieldNames: [],
      passed: true,
    });
    expect(tool.outputShape.bytes).toBeLessThanOrEqual(3600);
    expect(
      report.bangumiToolEvents.filter((event: { state: string }) => event.state === 'DONE'),
    ).toEqual([{ name: 'bangumi.get_person_activity', state: 'DONE' }]);
    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0]).toMatchObject({
      id: 'bangumi.get_person_activity',
      passed: true,
      targetToolOutcome: 'TARGET_TOOL_COMPLETED',
      toolCalls: [{ name: 'bangumi.get_person_activity', state: 'DONE' }],
      assertions: {
        cliSucceeded: true,
        exactTargetToolCompleted: true,
        boundedToolBudget: true,
        personActivityArgumentsVerified: true,
        personActivityResultVerified: true,
      },
    });

    const comparison = tool.result.comparison;
    expect(comparison).toMatchObject({ state: 'partial', windowMonths: 6 });
    expect(comparison.recent).toMatchObject({
      state: 'partial',
      windowMonths: 6,
      windowStart: '2026-05-01',
      windowEnd: '2026-10-04',
      countsOmittedDueToCoverage: true,
      summary: {},
      coverage: { rowsEligible: 0, maxRelations: 48, maxSubjectDetails: 12, maxRows: 20 },
    });
    expect(comparison.recent.summary).not.toHaveProperty('uniqueSubjects');
    expect(comparison.previous).toMatchObject({
      state: 'partial',
      windowMonths: 6,
      windowStart: '2025-11-01',
      windowEnd: '2026-04-30',
      summary: { uniqueSubjects: 1 },
      coverage: { rowsEligible: 1, rowsReturned: 1 },
    });
    expect(comparison.delta).toMatchObject({
      state: 'partial',
      valuesOmittedDueToCoverage: true,
    });
    expect(comparison.delta).not.toHaveProperty('uniqueSubjects');
    expect(comparison.peak).toMatchObject({ state: 'partial', metric: 'uniqueSubjects' });
    expect(comparison.peak.months).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 'previous', month: '2026-04', uniqueSubjects: 1 }),
      ]),
    );
    expect(comparison.answerSummaryChecks).toMatchObject({
      present: true,
      bothWindows: true,
      recentOmissionExplicit: true,
      previousObservedCountPresent: true,
      deltaOmissionExplicit: true,
      peakMonthsPresent: true,
      scopeLimitsPresent: true,
      passed: true,
    });
    expect(report.personActivityAnswerCheck).toMatchObject({
      resultReadbackAvailable: true,
      personMentioned: true,
      bothWindowBoundariesMentioned: true,
      recentCountMentioned: true,
      previousCountMentioned: true,
      deltaStateAndValueMentioned: true,
      peakStateAndMonthMentioned: true,
      coverageDisclosurePresent: true,
      unsupportedCompleteCareerClaim: false,
      unsupportedWorkloadOrTrendClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
  });

  it('records observed model-to-MCP calls without implying QQ or TIM acceptance', () => {
    const rows = rowsByTool();
    const catalogNames = catalog.map((item) => item.name).sort();
    const evidenceNames = EVIDENCE.filter(
      (report) => report.processExitCode === 0 && report.resultStatus === 'SUCCESS',
    ).flatMap((report) =>
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
    const observedEvidenceNames = new Set(evidenceNames);
    const uncoveredNames = catalogNames.filter((name) => !observedEvidenceNames.has(name));
    expect(uncoveredNames.sort()).toEqual(CURRENT_CATALOG_PENDING_AGENT_MCP);
    expect(evidenceNames.sort()).toEqual(
      catalogNames.filter((name) => !CURRENT_CATALOG_PENDING_AGENT_MCP_SET.has(name)).sort(),
    );

    const newlyVerifiedPublicTools = [
      'bangumi.get_person_activity',
      'bangumi.get_subject_overview',
      'bangumi.render_subject_overview',
    ];
    expect(newlyVerifiedPublicTools.filter((name) => evidenceNames.includes(name))).toEqual(
      newlyVerifiedPublicTools,
    );
    for (const name of newlyVerifiedPublicTools) {
      expect(statusMark(rows.get(name)?.[9]), `${name} current model/MCP evidence`).toBe('✅');
    }

    for (const [name, fields] of rows) {
      expect(fields, name).toHaveLength(13);
      expect(statusMark(fields[9]), `${name} model/MCP`).toBe(
        evidenceNames.includes(name) ? '✅' : '⬜',
      );
      expectClientEvidenceCell(fields[10], `${name} QQ pipeline`);
      expectClientEvidenceCell(fields[11], `${name} TIM client`);
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
        if (toolContractMatchesCurrent(COMPACT_EVIDENCE, call.name)) continue;

        // The historical Compact query report predates the deliberate discovery
        // schema change in this Epoch. Until a new exact-current query passes the
        // Candidate/CI gate, it remains history and query_subjects stays pending.
        expect(call.name).toBe('bangumi.query_subjects');
        const currentReport = CURRENT_FULL_PUBLIC_QA_EVIDENCE.find(
          (report: any) => report.scenarios?.[0]?.id === call.name,
        );
        if (currentReport) {
          expect(toolContractMatchesCurrent(currentReport, call.name)).toBe(true);
        } else {
          expect(CURRENT_CATALOG_PENDING_AGENT_MCP_SET.has(call.name)).toBe(true);
        }
      }
    }

    expect(
      CURRENT_FULL_PUBLIC_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(
      [
        'bangumi.auth_list_accounts',
        'bangumi.auth_status',
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
        'bangumi.get_user',
        'bangumi.list_character_collections',
        'bangumi.list_collections',
        'bangumi.list_operations',
        'bangumi.list_person_collections',
        'bangumi.list_revisions',
        'bangumi.resolve_subject_concept',
        'bangumi.search_characters',
        'bangumi.search_persons',
        'bangumi.search_subjects',
      ].sort(),
    );
    for (const report of CURRENT_FULL_PUBLIC_QA_EVIDENCE) {
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

  it('accepts the exact-candidate bounded subject-staff Agent/MCP answer', () => {
    const report = RUN89_SUBJECT_STAFF_EVIDENCE;
    expect(report).toMatchObject({
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: 'c13fcff7a4c0073299581afb1814555439812aae',
      candidateSha: 'c13fcff7a4c0073299581afb1814555439812aae',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      sourceProfile: 'standard-full',
      profile: 'bangumi-full-public-qa-v1',
      cliVersion: '1.2.14',
      subjectId: 218707,
      processExitCode: 0,
      resultCount: 1,
      resultStatus: 'SUCCESS',
      subjectStaffArgumentsVerified: true,
      subjectStaffResultVerified: true,
      promptPersisted: false,
      answerProsePersisted: false,
      personNamesPersisted: false,
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(report.toolResultSummaries).toHaveLength(1);
    expect(report.toolResultSummaries[0]).toMatchObject({
      name: 'bangumi.get_subject_staff',
      arguments: {
        expectedFieldNames: ['limit', 'subjectId'],
        matchedFieldNames: ['limit', 'subjectId'],
        unexpectedFieldNames: [],
        passed: true,
      },
      result: {
        found: true,
        subjectId: 218707,
        state: 'complete',
        textUtf8Bytes: 3529,
        structuredContentHasFullResult: true,
        scopeDisclosurePresent: true,
        coverage: {
          state: 'complete',
          productionStaff: { observed: 157, returned: 157, truncated: false },
          cast: { observed: 7, returned: 7, truncated: false },
          limit: 200,
        },
        omitted: {
          staffGroupsOmittedFromText: 15,
          staffGroupMembershipsOmittedFromText: 127,
          castItemsOmittedFromText: 7,
        },
      },
    });
    expect(report.toolResultSummaries[0].result.textUtf8Bytes).toBeLessThanOrEqual(3600);
    expect(report.toolResultSummaries[0].result.roleLabels).toContain('导演');
    expect(report.toolResultSummaries[0].result.roleLabels).toContain('原作');
    expect(report.subjectStaffAnswerCheck).toMatchObject({
      resultReadbackAvailable: true,
      roleLabelsMentioned: true,
      memberNamesMentioned: true,
      associationCheckMethod: 'bounded-positive-statement-v2',
      associationCheckerSha256: createHash('sha256')
        .update(readFileSync(join(ROOT, 'scripts/acceptance/subject-staff-answer-check.mjs')))
        .digest('hex'),
      boundedCoverageDisclosurePresent: true,
      omissionNotAbsencePresent: true,
      unsupportedCompletenessClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
    expect(report.subjectStaffAnswerCheck.roleNamePairsMatchedCount).toBeGreaterThanOrEqual(2);
    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0]).toMatchObject({
      id: 'bangumi.get_subject_staff',
      passed: true,
      toolCalls: [{ name: 'bangumi.get_subject_staff', state: 'DONE' }],
    });
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('finalAnswer');
    expect(report.scenarios[0]).not.toHaveProperty('prompt');
    expect(report.scenarios[0]).not.toHaveProperty('arguments');
    expect(report.toolResultSummaries[0].result).not.toHaveProperty('members');
    expect(report.toolResultSummaries[0].result).not.toHaveProperty('personNames');
    expect(catalogForHash(report.catalogSha256)).toBeDefined();
    expect(toolContractMatchesCurrent(report, 'bangumi.get_subject_staff')).toBe(true);
  });

  it('accepts only renderer evidence containing a verified temporary PNG artifact', () => {
    expect(
      CURRENT_FULL_RENDERER_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(
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
        'bangumi.render_revision_timeline',
        'bangumi.render_search',
        'bangumi.render_series_watch_order',
        'bangumi.render_subject_card',
        'bangumi.render_subject_comparison',
        'bangumi.render_subject_identity',
        'bangumi.render_subject_index_membership',
        'bangumi.render_subject_overlap',
        'bangumi.render_subject_overview',
        'bangumi.render_subject_stats_history',
      ].sort(),
    );
    for (const report of CURRENT_FULL_RENDERER_QA_EVIDENCE) {
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
      if (scenario.id === 'bangumi.render_subject_overview') {
        expect(catalogForHash(report.catalogSha256)).toBeDefined();
        expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
        expect(scenario.assertions.subjectOverviewRenderAnswerCheck).toMatchObject({
          coverageDisclosurePresent: true,
          staffCoverageMentioned: true,
          partialCoveragePhrasePresent: true,
          unsupportedCompletenessClaim: false,
          markdownFormattingDetected: false,
          passed: true,
        });
      }
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
    const expectedTools = catalog
      .filter((tool) => tool.auth === 'required')
      .map((tool) => tool.name)
      .sort();
    expect(expectedTools).toHaveLength(22);
    expect(
      FULL_AUTH_DENIAL_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(expectedTools);
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
          networkAccessBlocked: true,
          networkRequestAttempts: 0,
          externalApiCalled: false,
        },
      });
      const catalogTool = catalog.find((tool) => tool.name === scenario.id);
      expect(catalogTool?.auth).toBe('required');
      expect(['read', 'write', 'destructive']).toContain(catalogTool?.risk);
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(statusMark(rows.get(scenario.id)?.[7])).toBe('✅');
      expect(rows.get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rows.get(scenario.id)?.[9])).toBe('✅');
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
      expect(statusMark(rowsByTool().get('bangumi.auth_switch_account')?.[9])).toBe('✅');
    }
  });

  it('accepts auth-mutation evidence only for the two fixed synthetic destructive tools', () => {
    expect(
      FULL_AUTH_MUTATION_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(['bangumi.auth_disconnect', 'bangumi.auth_remove_account']);
    for (const report of FULL_AUTH_MUTATION_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-mutation-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic in-memory accounts');
      expect(report.scopeNote).toContain('No real account, token, or Bangumi API');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          confirmationRequiredObserved: true,
          syntheticConfirmationApplied: true,
          syntheticStateVerified: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rowsByTool().get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('accepts synthetic authenticated-read and render evidence without implying real account auth', () => {
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
    expect(
      FULL_AUTH_FEATURE_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(expectedTools);
    for (const report of FULL_AUTH_FEATURE_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-feature-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic MemoryStorage account');
      expect(report.scopeNote).toContain('local HTTP fixture');
      expect(report.scopeNote).toContain('No real account or OAuth');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          syntheticAccountUsed: true,
          syntheticTokenValidated: true,
          syntheticFixtureOnly: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      if (scenario.id.startsWith('bangumi.render_')) {
        expect(scenario.assertions).toMatchObject({
          rendererArtifactVerified: true,
          artifactRefReturned: true,
          artifactMimeType: 'image/png',
          artifactVerified: true,
        });
        expect(scenario.assertions.artifactWidth).toBeGreaterThan(0);
        expect(scenario.assertions.artifactHeight).toBeGreaterThan(0);
      }
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rowsByTool().get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('accepts the five fixed synthetic write paths without counting real authorization', () => {
    const expectedTools = [
      'bangumi.manage_character_collection',
      'bangumi.manage_index',
      'bangumi.manage_person_collection',
      'bangumi.update_collection',
      'bangumi.update_episode_progress',
    ].sort();
    expect(FULL_AUTH_WRITE_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual(
      expectedTools,
    );
    for (const report of FULL_AUTH_WRITE_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-write-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('local HTTP fixture');
      expect(report.scopeNote).toContain('no external API');
      expect(report.scopeNote).toContain('not real account or write approval');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          syntheticAccountUsed: true,
          syntheticTokenValidated: true,
          syntheticWriteVerified: true,
          syntheticFixtureOnly: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rowsByTool().get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('continues to mark the public QA probe as Agent/MCP only', () => {
    const rows = rowsByTool();
    for (const report of CURRENT_FULL_PUBLIC_QA_EVIDENCE) {
      const name = report.scenarios[0].id;
      expect(statusMark(rows.get(name)?.[9])).toBe('✅');
      expect(report.qqPipelineTested).toBe(false);
      expect(report.timClientTested).toBe(false);
      expectClientEvidenceCell(rows.get(name)?.[10], `${name} QQ pipeline`);
      expectClientEvidenceCell(rows.get(name)?.[11], `${name} TIM client`);
    }
  });

  it('retains exact-source direct, Agent/MCP, and chat-card evidence for G02/G03/G14', () => {
    const expectedScenarios = ['G02', 'G03', 'G14'];
    const expectedRevision = 'd1a5a03095818c090ca7f2f9ff255753e5381f7e';
    const expectedCatalog = '3b140a83270c06e71eb7a470035a5259fc1e65d421020d03c5344f86178b3831';

    expect(RUN66_DISCOVERY_DIRECT_EVIDENCE).toMatchObject({
      evidenceKind: 'bangumi_public_discovery_scenarios_tool_registry',
      mode: 'read_only_public_api_scenario_smoke',
      sourceRevision: expectedRevision,
      catalogSha256: expectedCatalog,
      qqPipelineTested: false,
      timClientTested: false,
      scenarioCount: 3,
    });
    const directByScenario = new Map<string, any>(
      RUN66_DISCOVERY_DIRECT_EVIDENCE.results.map((result: any) => [result.scenario, result]),
    );
    expect([...directByScenario.keys()].sort()).toEqual(expectedScenarios);
    for (const scenario of expectedScenarios) {
      expect(directByScenario.get(scenario).assertions.passed).toBe(true);
      expect(
        directByScenario.get(scenario).result.items.every((item: any) => !('name' in item)),
      ).toBe(true);
    }
    expect(
      directByScenario
        .get('G02')
        .result.items.map((item: any) => item.collectionTotal)
        .every(
          (value: number, index: number, values: number[]) =>
            index === 0 || values[index - 1]! >= value,
        ),
    ).toBe(true);
    expect(directByScenario.get('G02').result.coverage.state).toBe('unknown');
    expect(directByScenario.get('G14').result.warningCodes).toEqual(['EXPERIMENTAL_SOURCE']);

    for (const reports of [RUN66_DISCOVERY_AGENT_EVIDENCE, RUN66_DISCOVERY_RENDER_EVIDENCE]) {
      expect(reports.map((report: any) => report.discoveryScenario).sort()).toEqual(
        expectedScenarios,
      );
      for (const report of reports) {
        expect(report.upstreamRevision).toBe(expectedRevision);
        expect(report.catalogSha256).toBe(expectedCatalog);
        expect(report.processExitCode).toBe(0);
        expect(report.resultStatus).toBe('SUCCESS');
        expect(report.qqPipelineTested).toBe(false);
        expect(report.timClientTested).toBe(false);
        expect(report.scenarios).toHaveLength(1);
        expect(report.scenarios[0].passed).toBe(true);
        expect(report.scenarios[0].assertions.queryArgumentsMatchScenario).toBe(true);
        expect(report.scenarios[0].toolCalls).toEqual([
          { name: report.scenarios[0].id, state: 'DONE' },
        ]);
      }
    }
    for (const report of RUN66_DISCOVERY_RENDER_EVIDENCE) {
      expect(report.scenarios[0].assertions).toMatchObject({
        rendererArtifactVerified: true,
        artifactReadbackVerified: true,
        artifactMimeType: 'image/png',
        artifactWidth: 720,
        chatViewportVerified: true,
        renderTarget: 'chat',
      });
    }
  });
});
