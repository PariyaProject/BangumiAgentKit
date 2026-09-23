import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import catalog from '../../docs/tool-catalog.json';

const ROOT = process.cwd();
const CATALOG_TEXT = readFileSync(join(ROOT, 'docs/tool-catalog.json'), 'utf8');
const TABLE = readFileSync(join(ROOT, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
const COMPACT_EVIDENCE = JSON.parse(
  readFileSync(join(ROOT, 'docs/live-probes/pariya-agent-compact-e2e-2026-09-23.json'), 'utf8'),
);
const FULL_PUBLIC_QA_EVIDENCE = JSON.parse(
  readFileSync(
    join(ROOT, 'docs/live-probes/pariya-agent-full-public-qa-e2e-2026-09-23.json'),
    'utf8',
  ),
);
const EVIDENCE = [COMPACT_EVIDENCE, FULL_PUBLIC_QA_EVIDENCE];

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
      'bangumi.get_calendar',
      'bangumi.get_subject',
      'bangumi.get_subject_cast',
      'bangumi.query_subjects',
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

    expect(FULL_PUBLIC_QA_EVIDENCE).toMatchObject({
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
      scenarios: [
        {
          id: 'bangumi.get_calendar',
          passed: true,
          toolCalls: [{ name: 'bangumi.get_calendar', state: 'DONE' }],
        },
      ],
    });
    expect(FULL_PUBLIC_QA_EVIDENCE.scenarios[0]).not.toHaveProperty('prompt');
    expect(FULL_PUBLIC_QA_EVIDENCE.scenarios[0]).not.toHaveProperty('arguments');
  });
  it('continues to mark the public QA probe as Agent/MCP only', () => {
    const rows = rowsByTool();
    expect(rows.get('bangumi.get_calendar')?.[8]).toBe('✅');
    expect(rows.get('bangumi.get_calendar')?.[9]).toBe('⬜');
    expect(rows.get('bangumi.get_calendar')?.[10]).toBe('⬜');
  });
});
