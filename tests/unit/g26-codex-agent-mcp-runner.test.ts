import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  G26_EXPECTED_QUERY_ARGUMENTS,
  buildCodexExecArgs,
  canonicalG26ClaimPath,
  createAttestedOneShotClaims,
  createOneShotClaim,
  createOneShotClaims,
  parseCodexJsonl,
  sanitizeCodexEnvironment,
  serverSummaryMatchesCandidate,
  summarizeCodexEvents,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../../scripts/lib/g26-mcp-bundle.mjs';

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
      sourceRevision: 'a'.repeat(40),
      bundleSha256: 'b'.repeat(64),
    });
    const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]!] : []));

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
    expect(configs.some((value) => value.includes('--candidate-sha'))).toBe(true);
    expect(configs.some((value) => value.includes('a'.repeat(40)))).toBe(true);
    expect(configs.some((value) => value.includes('--bundle-sha256'))).toBe(true);
    expect(configs.some((value) => value.includes('b'.repeat(64)))).toBe(true);
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
      GIT_DIR: '/alternate/.git',
      GIT_WORK_TREE: '/alternate',
      GIT_COMMON_DIR: '/alternate/.git',
      GIT_INDEX_FILE: '/alternate/.git/index',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.worktree',
      GIT_CONFIG_VALUE_0: '/alternate',
      GIT_CONFIG_GLOBAL: '/alternate/global.gitconfig',
      GIT_CONFIG_SYSTEM: '/alternate/system.gitconfig',
      GIT_CONFIG_NOSYSTEM: '0',
    });

    expect(sanitized).toEqual({
      PATH: '/usr/bin',
      CODEX_HOME: '/private/codex-home',
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_SYSTEM: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
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
      bundleSha256: 'b'.repeat(64),
      toolName: 'bangumi.query_subjects',
      serverToolNames: ['bangumi.query_subjects'],
      serverToolCount: 1,
      argumentMatch: true,
      expectedArgumentsSha256: sha256(canonicalJson(G26_EXPECTED_QUERY_ARGUMENTS)),
      catalogSha256: sha256(catalogBytes),
      toolDescriptionSha256: sha256(String(tool.description)),
      inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    };

    expect(serverSummaryMatchesCandidate(summary, sourceRevision, 'b'.repeat(64))).toBe(true);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, sourceRevision: '0'.repeat(40) },
        sourceRevision,
        'b'.repeat(64),
      ),
    ).toBe(false);
    expect(serverSummaryMatchesCandidate(summary, sourceRevision, 'c'.repeat(64))).toBe(false);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, argumentMatch: false },
        sourceRevision,
        'b'.repeat(64),
      ),
    ).toBe(false);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, serverToolNames: ['bangumi.auth_status'] },
        sourceRevision,
        'b'.repeat(64),
      ),
    ).toBe(false);
  });

  it('creates a local claim once and refuses a second invocation', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-claim-test-'));
    const claimPath = path.join(directory, 'claimed.json');
    try {
      const claim = createOneShotClaim(claimPath, 'a'.repeat(40), 'b'.repeat(64));
      const stored = JSON.parse(readFileSync(claimPath, 'utf8')) as Record<string, unknown>;

      expect(claim.state).toBe('CLAIMED');
      expect(stored.sourceRevision).toBe('a'.repeat(40));
      expect(stored.bundleSha256).toBe('b'.repeat(64));
      expect(Object.keys(stored)).not.toContain('answer');
      expect(() => createOneShotClaim(claimPath, 'a'.repeat(40), 'b'.repeat(64))).toThrow(
        'G26 one-shot claim already exists',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates one claim when canonical and mirror paths alias through a symlink', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-claim-alias-test-'));
    const canonicalDirectory = path.join(directory, 'canonical');
    const aliasDirectory = path.join(directory, 'alias');
    const canonicalClaimPath = path.join(canonicalDirectory, 'claimed.json');
    const localClaimPath = path.join(aliasDirectory, 'claimed.json');
    mkdirSync(canonicalDirectory, { recursive: true });
    symlinkSync(canonicalDirectory, aliasDirectory, 'dir');

    try {
      const result = createOneShotClaims({
        canonicalClaimPath,
        localClaimPath,
        sourceRevision: 'a'.repeat(40),
        bundleSha256: 'b'.repeat(64),
      });

      expect(result.paths).toEqual([canonicalClaimPath]);
      expect(readdirSync(canonicalDirectory)).toEqual(['claimed.json']);
      expect(JSON.parse(readFileSync(localClaimPath, 'utf8'))).toMatchObject({
        state: 'CLAIMED',
        sourceRevision: 'a'.repeat(40),
        bundleSha256: 'b'.repeat(64),
      });
      expect(() =>
        createOneShotClaims({
          canonicalClaimPath,
          localClaimPath,
          sourceRevision: 'a'.repeat(40),
          bundleSha256: 'b'.repeat(64),
        }),
      ).toThrow('G26 one-shot claim already exists');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not create a one-shot claim when the built bundle attestation is stale', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-stale-attestation-test-'));
    const canonicalClaimPath = path.join(directory, 'canonical', 'claim.json');
    const localClaimPath = path.join(directory, 'local', 'claim.json');
    try {
      expect(() =>
        createAttestedOneShotClaims({
          canonicalClaimPath,
          localClaimPath,
          sourceRevision: 'a'.repeat(40),
          bundleSha256: 'b'.repeat(64),
          attestationSha256: 'c'.repeat(64),
        }),
      ).toThrow('Built G26 MCP bundle does not match its exact-Candidate attestation.');
      expect(existsSync(canonicalClaimPath)).toBe(false);
      expect(existsSync(localClaimPath)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps the run-level one-shot lock independent of HOME, Git overrides, and mirror path', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-canonical-claim-test-'));
    const repositoryRoot = path.join(directory, 'repository');
    const alternateRepositoryRoot = path.join(directory, 'alternate-repository');
    const homeA = path.join(directory, 'home-a');
    const homeB = path.join(directory, 'home-b');
    const callerGlobalConfigA = path.join(directory, 'global-a.gitconfig');
    const callerGlobalConfigB = path.join(directory, 'global-b.gitconfig');
    const callerSystemConfig = path.join(directory, 'system.gitconfig');
    mkdirSync(repositoryRoot, { recursive: true });
    mkdirSync(alternateRepositoryRoot, { recursive: true });
    mkdirSync(homeA, { recursive: true });
    mkdirSync(homeB, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: repositoryRoot });
    execFileSync('git', ['init', '-q'], { cwd: alternateRepositoryRoot });
    for (const configPath of [
      path.join(homeA, '.gitconfig'),
      path.join(homeB, '.gitconfig'),
      callerGlobalConfigA,
      callerGlobalConfigB,
      callerSystemConfig,
    ]) {
      writeFileSync(configPath, `[core]\n\tworktree = ${alternateRepositoryRoot}\n`);
    }
    const gitCommonDirectory = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim();
    const firstMirror = path.join(directory, 'pariya-state', 'claim.json');
    const alternateMirror = path.join(directory, 'alternate', 'claim.json');
    const gitOverrideKeys = [
      'GIT_DIR',
      'GIT_WORK_TREE',
      'GIT_COMMON_DIR',
      'GIT_INDEX_FILE',
      'GIT_CONFIG_COUNT',
      'GIT_CONFIG_KEY_0',
      'GIT_CONFIG_VALUE_0',
      'GIT_CONFIG_GLOBAL',
      'GIT_CONFIG_SYSTEM',
      'GIT_CONFIG_NOSYSTEM',
    ];
    const previousEnvironment = new Map(
      ['HOME', ...gitOverrideKeys].map((key) => [key, process.env[key]]),
    );
    try {
      process.env.HOME = homeA;
      process.env.GIT_DIR = path.join(alternateRepositoryRoot, '.git');
      process.env.GIT_WORK_TREE = alternateRepositoryRoot;
      process.env.GIT_COMMON_DIR = path.join(alternateRepositoryRoot, '.git');
      process.env.GIT_INDEX_FILE = path.join(alternateRepositoryRoot, '.git', 'index');
      process.env.GIT_CONFIG_COUNT = '1';
      process.env.GIT_CONFIG_KEY_0 = 'core.worktree';
      process.env.GIT_CONFIG_VALUE_0 = alternateRepositoryRoot;
      process.env.GIT_CONFIG_GLOBAL = callerGlobalConfigA;
      process.env.GIT_CONFIG_SYSTEM = callerSystemConfig;
      process.env.GIT_CONFIG_NOSYSTEM = '0';
      expect(gitRepositoryText(repositoryRoot, ['rev-parse', '--show-toplevel'])).toBe(
        realpathSync(repositoryRoot),
      );
      const canonicalPath = canonicalG26ClaimPath(repositoryRoot);
      expect(canonicalPath).toBe(
        path.join(
          path.resolve(repositoryRoot, gitCommonDirectory),
          'pariya-agent-state',
          'g26-run95-one-shot-claim.json',
        ),
      );
      const first = createOneShotClaims({
        canonicalClaimPath: canonicalPath,
        localClaimPath: firstMirror,
        sourceRevision: 'a'.repeat(40),
        bundleSha256: 'b'.repeat(64),
      });

      expect(first.paths).toEqual([canonicalPath, firstMirror]);
      process.env.HOME = homeB;
      process.env.GIT_DIR = path.join(directory, 'not-a-repository');
      process.env.GIT_WORK_TREE = path.join(directory, 'not-a-worktree');
      process.env.GIT_COMMON_DIR = path.join(directory, 'not-a-common-dir');
      process.env.GIT_CONFIG_GLOBAL = callerGlobalConfigB;
      process.env.GIT_CONFIG_SYSTEM = callerGlobalConfigB;
      expect(gitRepositoryText(repositoryRoot, ['rev-parse', '--show-toplevel'])).toBe(
        realpathSync(repositoryRoot),
      );
      expect(canonicalG26ClaimPath(repositoryRoot)).toBe(canonicalPath);
      expect(() =>
        createOneShotClaims({
          canonicalClaimPath: canonicalG26ClaimPath(repositoryRoot),
          localClaimPath: alternateMirror,
          sourceRevision: 'a'.repeat(40),
          bundleSha256: 'b'.repeat(64),
        }),
      ).toThrow('G26 one-shot claim already exists');
      expect(() => readFileSync(alternateMirror)).toThrow();
    } finally {
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fingerprints compiled MCP and workspace dependency outputs deterministically', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g26-bundle-test-'));
    const mcpFile = path.join(directory, 'apps', 'mcp', 'dist', 'index.js');
    const packageFile = path.join(directory, 'packages', 'tools', 'dist', 'index.js');
    try {
      mkdirSync(path.dirname(mcpFile), { recursive: true });
      mkdirSync(path.dirname(packageFile), { recursive: true });
      writeFileSync(mcpFile, 'export const mcp = true;');
      writeFileSync(packageFile, 'export const tools = true;');
      const first = computeMcpBundleSha256(directory);

      expect(first).toMatch(/^[0-9a-f]{64}$/u);
      expect(computeMcpBundleSha256(directory)).toBe(first);
      const attestationPath = path.join(
        directory,
        'docs',
        'product',
        'g26-mcp-bundle-attestation.json',
      );
      mkdirSync(path.dirname(attestationPath), { recursive: true });
      writeFileSync(
        attestationPath,
        JSON.stringify({
          schemaVersion: 1,
          kind: 'g26-mcp-runtime-bundle-attestation-v1',
          bundleSha256: first,
        }),
      );
      expect(readG26McpBundleAttestation(directory)).toBe(first);
      writeFileSync(packageFile, 'export const tools = false;');
      expect(computeMcpBundleSha256(directory)).not.toBe(first);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
