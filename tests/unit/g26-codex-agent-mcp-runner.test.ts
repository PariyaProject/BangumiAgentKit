import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  G26_EXPECTED_QUERY_ARGUMENTS,
  buildCodexExecArgs,
  createOneShotClaim,
  parseCodexJsonl,
  sanitizeCodexEnvironment,
  serverSummaryMatchesCandidate,
  summarizeCodexEvents,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';

const canonicalJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
          )
          .join(',')}}`
      : JSON.stringify(value);

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

function codexEvents() {
  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          state: 'ok',
          items: [
            {
              id: 42,
              name: 'Public sample',
              media: 'anime',
              category: 'tv',
              date: '2020-01-01',
              ratingCount: 12000,
              tags: ['女性向'],
            },
          ],
        }),
      },
    ],
    structuredContent: {
      state: 'ok',
      items: [
        {
          id: 42,
          name: 'Public sample',
          media: 'anime',
          category: 'tv',
          date: '2020-01-01',
          ratingCount: 12000,
          tags: ['女性向'],
        },
      ],
    },
    isError: false,
  };
  const call = {
    id: 'call-1',
    type: 'mcp_tool_call',
    server: 'bgk_g26_one_tool',
    tool: 'bangumi.query_subjects',
    arguments: G26_EXPECTED_QUERY_ARGUMENTS,
    status: 'completed',
    result,
  };
  return [
    { type: 'thread.started', thread_id: 'redacted-thread' },
    { type: 'turn.started' },
    {
      type: 'item.started',
      item: { ...call, status: 'in_progress', result: undefined },
    },
    { type: 'item.completed', item: call },
    {
      type: 'item.completed',
      item: {
        id: 'answer-1',
        type: 'agent_message',
        text: '42｜Public sample｜2020-01-01｜12000\n范围：示例。',
      },
    },
    { type: 'turn.completed' },
  ];
}

describe('G26 Codex one-tool runner', () => {
  it('pins GPT-6 Luna Max and exposes only the fixed read-only MCP tool', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/usr/bin/node',
      serverScript: '/repo/apps/mcp/codex-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/g26/server-summary.json',
    });
    const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]] : []));

    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--strict-config');
    expect(args).toContain('--ephemeral');
    expect(args).toContain('--json');
    expect(args).toContain('--sandbox');
    expect(args).toContain('read-only');
    expect(args).toContain('--model');
    expect(args).toContain('gpt-6-luna');
    expect(configs).toContain('model_reasoning_effort="max"');
    expect(configs).toContain('features.shell_tool=false');
    expect(configs).toContain('features.multi_agent=false');
    expect(configs).toContain('features.web_search_request=false');
    expect(configs).toContain(
      'mcp_servers.bgk_g26_one_tool.enabled_tools=["bangumi.query_subjects"]',
    );
    expect(args.at(-1)).toContain(JSON.stringify(G26_EXPECTED_QUERY_ARGUMENTS));
  });

  it('requires an explicit run flag after the candidate gates', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run'])).toBe('run');
    expect(() => validateRunnerArgs([])).toThrow(/only after exact-head CI/u);
    expect(() => validateRunnerArgs(['--run', '--force'])).toThrow(/only after exact-head CI/u);
  });

  it('parses and deduplicates started/completed events while retaining the final answer in memory', () => {
    const parsed = parseCodexJsonl(
      codexEvents()
        .map((event) => JSON.stringify(event))
        .join('\n'),
    );
    const summary = summarizeCodexEvents(parsed.events);

    expect(parsed.parsed).toBe(true);
    expect(parsed.malformedLinesCount).toBe(0);
    expect(summary.eventStreamComplete).toBe(true);
    expect(summary.codexMcpToolEventCount).toBe(1);
    expect(summary.mcpServerNames).toEqual(['bgk_g26_one_tool']);
    expect(summary.nonMcpToolEventCount).toBe(0);
    expect(summary.shellToolCallCount).toBe(0);
    expect(summary.toolCalls).toEqual([
      {
        name: 'bangumi.query_subjects',
        arguments: G26_EXPECTED_QUERY_ARGUMENTS,
        state: 'DONE',
      },
    ]);
    expect(summary.completedMcpCalls[0]?.result?.structuredContent?.items?.[0]?.id).toBe(42);
    expect(summary.answer).toContain('Public sample');
  });

  it('fails closed on malformed JSONL or a shell event', () => {
    const malformed = parseCodexJsonl('{"type":"thread.started"}\nnot-json');
    const withShell = summarizeCodexEvents([
      ...codexEvents(),
      {
        type: 'item.completed',
        item: { id: 'shell-1', type: 'command_execution', command: 'echo unsafe' },
      },
    ]);

    expect(malformed.parsed).toBe(false);
    expect(malformed.malformedLinesCount).toBe(1);
    expect(withShell.nonMcpToolEventCount).toBe(1);
    expect(withShell.shellToolCallCount).toBe(1);
  });

  it('removes product credentials, external model routes, and the private claim path', () => {
    const sanitized = sanitizeCodexEnvironment({
      PATH: '/usr/bin',
      CODEX_HOME: '/private/codex-home',
      PARIYA_G26_RUN95_CLAIM_FILE: '/private/local-claim.json',
      BANGUMI_ACCESS_TOKEN: 'test',
      OPENAI_API_KEY: 'test',
      OPENAI_BASE_URL: 'https://example.invalid',
      CODEX_MODEL_CATALOG_JSON: '/private/model-catalog.json',
      GEMINI_API_KEY: 'test',
      ANTHROPIC_API_KEY: 'test',
    });

    expect(sanitized).toEqual({
      PATH: '/usr/bin',
      CODEX_HOME: '/private/codex-home',
    });
  });

  it('binds the one-tool server summary to the exact Candidate, catalog, and fixed query', () => {
    const catalogBytes = readFileSync(path.resolve('docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8')) as Array<Record<string, unknown>>;
    const tool = catalog.find((item) => item.name === 'bangumi.query_subjects')!;
    const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const summary = {
      serverProfile: 'one-tool-anonymous-public-v1',
      sourceRevision,
      toolName: 'bangumi.query_subjects',
      serverToolNames: ['bangumi.query_subjects'],
      serverToolCount: 1,
      argumentMatch: true,
      expectedArgumentsSha256: sha256(canonicalJson(G26_EXPECTED_QUERY_ARGUMENTS)),
      catalogSha256: sha256(catalogBytes),
      toolDescriptionSha256: sha256(String(tool.description)),
      inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    };

    expect(serverSummaryMatchesCandidate(summary, sourceRevision)).toBe(true);
    expect(
      serverSummaryMatchesCandidate({ ...summary, sourceRevision: '0'.repeat(40) }, sourceRevision),
    ).toBe(false);
    expect(
      serverSummaryMatchesCandidate({ ...summary, argumentMatch: false }, sourceRevision),
    ).toBe(false);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, serverToolNames: ['bangumi.auth_status'] },
        sourceRevision,
      ),
    ).toBe(false);
  });

  it('creates a local claim once and refuses a second invocation', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-claim-test-'));
    const claimPath = path.join(directory, 'claimed.json');
    try {
      const claim = createOneShotClaim(claimPath, 'a'.repeat(40));
      const stored = JSON.parse(readFileSync(claimPath, 'utf8')) as Record<string, unknown>;

      expect(claim.state).toBe('CLAIMED');
      expect(stored.sourceRevision).toBe('a'.repeat(40));
      expect(Object.keys(stored)).not.toContain('answer');
      expect(() => createOneShotClaim(claimPath, 'a'.repeat(40))).toThrow(
        'G26 one-shot claim already exists',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
