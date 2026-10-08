import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { presentMcpToolResult } from '../../apps/mcp/src/result-presenter.js';
import { verifyG20DirectRelationsAnswer } from '../../scripts/acceptance/g20-direct-relations-answer-check.mjs';
import {
  G20_EXPECTED_QUERY_ARGUMENTS,
  assertG20CandidateReviewGate,
  buildCodexExecArgs,
  createOneShotClaim,
  canonicalG20ClaimPath,
  createOneShotClaims,
  sanitizeCodexEnvironment,
  serverSummaryMatchesCandidate,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g20-codex-agent-mcp.mjs';
import {
  buildG20AgentMcpReport,
  writeG20AgentMcpReport,
} from '../../scripts/acceptance/write-g20-agent-mcp-report.mjs';
import { computeMcpBundleSha256 } from '../../scripts/lib/g26-mcp-bundle.mjs';
import {
  parseCodexJsonl,
  summarizeCodexEvents,
} from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';

const TARGET_TOOL = 'bangumi.get_subject_relations';
const SERVER_ID = 'bgk_g20_one_tool';
const MANDATORY_CI_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];
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

function makeResult(options: { many?: boolean; schemaDriftRows?: number } = {}) {
  const count = options.many ? 60 : 2;
  const schemaDriftRows = options.schemaDriftRows ?? 0;
  const items = Array.from({ length: count }, (_, index) => ({
    id: 5001 + index,
    type: 'anime',
    name: `Source title ${index}${options.many ? ` ${'Title'.repeat(80)}` : ''}`,
    nameCn: `来源作品${index}${options.many ? ` ${'作品'.repeat(80)}` : ''}`,
    relation: index === 0 ? '前传' : '续集',
    images: { small: `https://images.example.test/${index}.jpg` },
  }));
  return {
    state: schemaDriftRows > 0 ? 'partial' : 'observed',
    subjectId: 227245,
    source: {
      api: 'Bangumi official v0',
      operation: 'GET /v0/subjects/{subject_id}/subjects',
      direction: 'source_subject_to_returned_target',
      scope: 'visible_direct_rows_returned_for_source_subject',
      retrievedAt: '2026-10-07T09:00:00.000Z',
    },
    coverage: {
      responseRowsObserved: count + schemaDriftRows,
      rowsReturned: count,
      schemaDriftRows,
      truncated: schemaDriftRows > 0,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    },
    items,
    limitations: [
      '仅表示本次响应中指定来源条目指向目标条目的直接关系，不含反向或传递关系。',
      '官方 v0 此操作没有分页、总数或系列完整性字段；未返回关系不等于不存在。',
      'relation 是来源记录的原始标签；接口行顺序不是官方观看顺序。',
      '匿名可见性可能不包含敏感条目。',
    ],
  };
}

function makeOutput(result = makeResult()) {
  const presentation = presentMcpToolResult(TARGET_TOOL, result);
  return {
    content: [{ type: 'text', text: presentation.text }],
    ...(presentation.structuredContent
      ? { structuredContent: presentation.structuredContent }
      : {}),
  };
}

function makeAnswer(result = makeResult()) {
  const rows = result.items.map((item) => `${item.id}｜${item.nameCn}｜${item.relation}`);
  const observed = result.coverage.responseRowsObserved;
  const returned = result.coverage.rowsReturned;
  return [
    ...rows,
    `范围：本次官方 v0 响应对来源条目 227245 观察到 ${observed} 行，返回 ${returned} 条直接关系；此操作无分页、无总数，不能据此认定全系列完整；未返回关系不等于不存在，也不含反向或传递关系。关系接口顺序不是官方观看顺序。${result.coverage.schemaDriftRows > 0 ? `解析遗漏 ${result.coverage.schemaDriftRows} 条。` : ''}`,
  ].join('\n');
}

function completeCandidateRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'g20-candidate-report-test-'));
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  mkdirSync(path.join(root, 'apps/mcp/dist'), { recursive: true });
  mkdirSync(path.join(root, 'packages/tools/dist'), { recursive: true });
  mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  copyFileSync(path.resolve('docs/tool-catalog.json'), path.join(root, 'docs/tool-catalog.json'));
  writeFileSync(path.join(root, 'apps/mcp/dist/main.js'), 'export const mcp = true;');
  writeFileSync(path.join(root, 'packages/tools/dist/main.js'), 'export const tools = true;');
  const bundleSha256 = computeMcpBundleSha256(root);
  writeFileSync(
    path.join(root, 'docs/product/g26-mcp-bundle-attestation.json'),
    `${JSON.stringify({ schemaVersion: 1, kind: 'g26-mcp-runtime-bundle-attestation-v1', bundleSha256 })}\n`,
  );
  const git = (args: string[]) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'ignore' });
  expect(git(['init', '-q']).status).toBe(0);
  expect(git(['add', '.']).status).toBe(0);
  expect(
    git([
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'test(g20): set up report writer fixture',
    ]).status,
  ).toBe(0);
  return {
    root,
    bundleSha256,
    head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  };
}

function writeG20CanonicalClaim(root: string, sourceRevision: string, bundleSha256: string) {
  const claimPath = path.join(root, '.git/pariya-agent-state/g20-run95-one-shot-claim.json');
  mkdirSync(path.dirname(claimPath), { recursive: true });
  writeFileSync(
    claimPath,
    `${JSON.stringify({
      schemaVersion: 1,
      runNumber: 95,
      frontierId: 'G20',
      state: 'CLAIMED',
      sourceRevision,
      bundleSha256,
      expectedArgumentsSha256: sha256(canonicalJson(G20_EXPECTED_QUERY_ARGUMENTS)),
    })}\n`,
  );
}

function writerInput(bundleSha256: string, sourceRevision: string) {
  const result = makeResult();
  const toolOutput = makeOutput(result);
  const text = toolOutput.content[0]!.text;
  const toolCalls = [{ name: TARGET_TOOL, state: 'DONE', arguments: G20_EXPECTED_QUERY_ARGUMENTS }];
  return {
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: '1.2.14',
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    serverToolNames: [TARGET_TOOL],
    serverToolCount: 1,
    codexMcpToolEventCount: 1,
    mcpServerNames: [SERVER_ID],
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      qqPipelineTested: false,
      timClientTested: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
    },
    queryArguments: G20_EXPECTED_QUERY_ARGUMENTS,
    answer: makeAnswer(result),
    toolOutput,
    toolCalls,
    toolTextUtf8Bytes: Buffer.byteLength(text, 'utf8'),
    sourceRevision,
    bundleSha256,
    toolResultSummary: {
      toolName: TARGET_TOOL,
      resultState: result.state,
      resultByteLength: 1024,
      resultSha256: 'c'.repeat(64),
      sourceOperations: [],
      artifact: { returned: false, persisted: false },
    },
  };
}

describe('G20 Codex one-tool runner', () => {
  it('pins GPT-6 Luna Max, read-only ephemeral execution, and the sole fixed G20 tool', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/usr/bin/node',
      serverScript: '/repo/apps/mcp/codex-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/g20/server-summary.json',
      sourceRevision: 'a'.repeat(40),
      bundleSha256: 'b'.repeat(64),
    });
    const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]!] : []));

    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--strict-config');
    expect(args).toContain('--ephemeral');
    expect(args).toContain('--json');
    expect(args).toContain('read-only');
    expect(args).toContain('gpt-6-luna');
    expect(configs).toContain('model_reasoning_effort="max"');
    expect(configs).toContain('history.persistence="none"');
    expect(configs).toContain('features.shell_tool=false');
    expect(configs).toContain('features.multi_agent=false');
    expect(configs).toContain('features.web_search_request=false');
    expect(configs).toContain(
      'mcp_servers.bgk_g20_one_tool.enabled_tools=["bangumi.get_subject_relations"]',
    );
    expect(args.at(-1)).toContain(JSON.stringify(G20_EXPECTED_QUERY_ARGUMENTS));
    expect(args.at(-1)).toContain('来源条目 227245');
    expect(args.at(-1)).toContain('MCP文本视图省略 K 行');
  });

  it('requires the explicit one-shot run flag', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs([])).toThrow(/only after exact-Candidate CI/u);
    expect(() => validateRunnerArgs(['--run', '95', '--force'])).toThrow(
      /only after exact-Candidate CI/u,
    );
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow(/only after exact-Candidate CI/u);
  });

  it('accepts only the active exact Candidate with exact-head CI and a recorded review PASS', () => {
    const candidateSha = 'a'.repeat(40);
    const baseSha = 'b'.repeat(40);
    const branch = 'codex/epoch-g20-direct-relation-mcp-acceptance';
    const status = {
      git: { branch, head: candidateSha, status: '' },
      run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: 104, pending_epoch: null } },
      epoch: {
        number: 104,
        github_state: 'OPEN',
        state: {
          pr_number: 104,
          branch,
          state: 'REVIEW_READY',
          base_sha: baseSha,
          candidate_sha: candidateSha,
          ci: { sha: candidateSha, status: 'SUCCESS' },
          review_pass_sha: candidateSha,
          review_history: [{ candidate_sha: candidateSha, verdict: 'PASS' }],
        },
      },
    };
    const pr: {
      state: string;
      isDraft: boolean;
      headRefOid: string;
      headRefName: string;
      statusCheckRollup: Array<{ name: string; status: string; conclusion: string | null }>;
    } = {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidateSha,
      headRefName: branch,
      statusCheckRollup: MANDATORY_CI_CHECKS.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      })),
    };

    expect(
      assertG20CandidateReviewGate(status, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toEqual({
      prNumber: 104,
      candidateSha,
    });
    expect(() =>
      assertG20CandidateReviewGate(status, pr, {
        sourceRevision: 'c'.repeat(40),
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
    expect(() =>
      assertG20CandidateReviewGate(
        status,
        { ...pr, isDraft: true },
        { sourceRevision: candidateSha, currentBaseSha: baseSha },
      ),
    ).toThrow(/active exact Candidate/u);
    const noPass = structuredClone(status);
    noPass.epoch.state.review_pass_sha = '';
    expect(() =>
      assertG20CandidateReviewGate(noPass, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/Luna Max PASS/u);
    const pendingChecks = structuredClone(pr);
    pendingChecks.statusCheckRollup[1] = {
      name: 'sqlite-default',
      status: 'IN_PROGRESS',
      conclusion: null,
    };
    expect(() =>
      assertG20CandidateReviewGate(status, pendingChecks, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
    const staleSuccessChecks = structuredClone(pr);
    staleSuccessChecks.statusCheckRollup[1] = {
      name: 'sqlite-default',
      status: 'IN_PROGRESS',
      conclusion: 'SUCCESS',
    };
    expect(() =>
      assertG20CandidateReviewGate(status, staleSuccessChecks, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
    const failedChecks = structuredClone(pr);
    failedChecks.statusCheckRollup[1] = {
      name: 'sqlite-default',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
    };
    expect(() =>
      assertG20CandidateReviewGate(status, failedChecks, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
    const missingChecks = structuredClone(pr);
    missingChecks.statusCheckRollup = missingChecks.statusCheckRollup.filter(
      (check) => check.name !== 'postgres-compat',
    );
    expect(() =>
      assertG20CandidateReviewGate(status, missingChecks, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
    const duplicateChecks = structuredClone(pr);
    duplicateChecks.statusCheckRollup.push({
      name: 'sqlite-default',
      status: 'IN_PROGRESS',
      conclusion: null,
    });
    expect(() =>
      assertG20CandidateReviewGate(status, duplicateChecks, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/active exact Candidate/u);
  });

  it('sanitizes Bangumi, credential, model-route, claim, and Git override environment values', () => {
    expect(
      sanitizeCodexEnvironment({
        PATH: '/usr/bin',
        CODEX_HOME: '/private/codex',
        PARIYA_G20_RUN95_CLAIM_FILE: '/private/local-claim.json',
        PARIYA_G26_RUN95_CLAIM_FILE: '/private/g26-claim.json',
        BANGUMI_ACCESS_TOKEN: 'secret',
        OPENAI_API_KEY: 'secret',
        OPENAI_BASE_URL: 'https://example.invalid',
        ANTHROPIC_API_KEY: 'secret',
        GEMINI_API_KEY: 'secret',
        GIT_DIR: '/alternate/.git',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.worktree',
        GIT_CONFIG_VALUE_0: '/alternate',
      }),
    ).toEqual({
      PATH: '/usr/bin',
      CODEX_HOME: '/private/codex',
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_SYSTEM: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
    });
  });

  it('uses the repository common metadata path and refuses a second canonical claim', () => {
    const root = process.cwd();
    const commonDirectory = spawnSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim();
    const expectedCanonical = path.join(
      path.resolve(root, commonDirectory),
      'pariya-agent-state',
      'g20-run95-one-shot-claim.json',
    );
    expect(canonicalG20ClaimPath(root)).toBe(expectedCanonical);
  });

  it('creates canonical and local claims and refuses retry after inconclusive result', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g20-claim-test-'));
    const canonical = path.join(directory, 'canonical', 'claim.json');
    const mirror = path.join(directory, 'pariya-state', 'claim.json');
    try {
      const first = createOneShotClaims({
        canonicalClaimPath: canonical,
        localClaimPath: mirror,
        sourceRevision: 'a'.repeat(40),
        bundleSha256: 'b'.repeat(64),
      });
      const stored = JSON.parse(readFileSync(mirror, 'utf8')) as Record<string, unknown>;
      expect(first.paths).toEqual([canonical, mirror]);
      expect(stored.frontierId).toBe('G20');
      expect(stored.state).toBe('CLAIMED');
      expect(stored.expectedArgumentsSha256).toBe(
        sha256(canonicalJson(G20_EXPECTED_QUERY_ARGUMENTS)),
      );
      expect(Object.keys(stored)).not.toContain('answer');

      const canonicalStored = JSON.parse(readFileSync(canonical, 'utf8')) as Record<
        string,
        unknown
      >;
      writeFileSync(
        canonical,
        JSON.stringify({ ...canonicalStored, state: 'INCONCLUSIVE' }, null, 2),
      );
      writeFileSync(mirror, JSON.stringify({ ...stored, state: 'INCONCLUSIVE' }, null, 2));
      expect(JSON.parse(readFileSync(mirror, 'utf8')).state).toBe('INCONCLUSIVE');
      expect(() => createOneShotClaim(mirror, 'a'.repeat(40), 'b'.repeat(64))).toThrow(
        /already exists/u,
      );
      expect(() =>
        createOneShotClaims({
          canonicalClaimPath: canonical,
          localClaimPath: path.join(directory, 'alternate.json'),
          sourceRevision: 'a'.repeat(40),
          bundleSha256: 'b'.repeat(64),
        }),
      ).toThrow(/already exists/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('parses only the single completed G20 MCP event and rejects extra or shell tools', () => {
    const result = makeResult();
    const call = {
      id: 'call-1',
      type: 'mcp_tool_call',
      server: SERVER_ID,
      tool: TARGET_TOOL,
      arguments: G20_EXPECTED_QUERY_ARGUMENTS,
      status: 'completed',
      result: makeOutput(result),
    };
    const events = [
      { type: 'thread.started', thread_id: 'redacted-thread' },
      { type: 'turn.started' },
      { type: 'item.started', item: { ...call, status: 'in_progress', result: undefined } },
      { type: 'item.completed', item: call },
      {
        type: 'item.completed',
        item: { id: 'answer-1', type: 'agent_message', text: makeAnswer(result) },
      },
      { type: 'turn.completed' },
    ];
    const parsed = parseCodexJsonl(events.map((event) => JSON.stringify(event)).join('\n'));
    const summary = summarizeCodexEvents(parsed.events);

    expect(parsed.parsed).toBe(true);
    expect(summary.eventStreamComplete).toBe(true);
    expect(summary.codexMcpToolEventCount).toBe(1);
    expect(summary.mcpServerNames).toEqual([SERVER_ID]);
    expect(summary.nonMcpToolEventCount).toBe(0);
    expect(summary.toolCalls).toEqual([
      { name: TARGET_TOOL, arguments: G20_EXPECTED_QUERY_ARGUMENTS, state: 'DONE' },
    ]);
    const extra = summarizeCodexEvents([
      ...parsed.events,
      { type: 'item.completed', item: { id: 'shell-1', type: 'command_execution' } },
    ]);
    expect(extra.nonMcpToolEventCount).toBe(1);
    expect(extra.shellToolCallCount).toBe(1);
    expect(parseCodexJsonl('{"type":"thread.started"}\nnot-json').parsed).toBe(false);
  });

  it('binds the one-tool server summary to current catalog, exact source, bundle, and arguments', () => {
    const bytes = readFileSync(path.resolve('docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8')) as Array<Record<string, any>>;
    const tool = catalog.find((item) => item.name === TARGET_TOOL)!;
    const sourceRevision = spawnSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).stdout.trim();
    const summary = {
      serverProfile: 'one-tool-anonymous-public-v1',
      sourceRevision,
      bundleSha256: 'b'.repeat(64),
      toolName: TARGET_TOOL,
      serverToolNames: [TARGET_TOOL],
      serverToolCount: 1,
      argumentMatch: true,
      expectedArgumentsSha256: sha256(canonicalJson(G20_EXPECTED_QUERY_ARGUMENTS)),
      catalogSha256: sha256(bytes),
      toolDescriptionSha256: sha256(String(tool.description)),
      inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    };
    expect(serverSummaryMatchesCandidate(summary, sourceRevision, 'b'.repeat(64))).toBe(true);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, toolName: 'bangumi.auth_status' },
        sourceRevision,
        'b'.repeat(64),
      ),
    ).toBe(false);
    expect(
      serverSummaryMatchesCandidate(
        { ...summary, argumentMatch: false },
        sourceRevision,
        'b'.repeat(64),
      ),
    ).toBe(false);
  });

  it('writes only sanitized counts and hashes after exact G20 row and scope readback', () => {
    const fixture = completeCandidateRepo();
    try {
      writeG20CanonicalClaim(fixture.root, fixture.head, fixture.bundleSha256);
      const input = writerInput(fixture.bundleSha256, fixture.head);
      const check = verifyG20DirectRelationsAnswer(
        input.answer,
        input.queryArguments,
        input.toolOutput,
        input.toolCalls,
        input.toolTextUtf8Bytes,
      );
      expect(check.passed).toBe(true);
      const built = buildG20AgentMcpReport(input, fixture.root) as {
        passed: boolean;
        report: Record<string, any>;
      };
      expect(built.passed).toBe(true);
      const scenario = built.report.scenarios[0];
      expect(Object.keys(built.report).sort()).toEqual(
        [
          'allowedCallCount',
          'argumentProfile',
          'catalogSha256',
          'codexCliVersion',
          'codexMcpToolEventCount',
          'deniedCallCount',
          'eventStreamParsed',
          'evidenceKind',
          'expectedArgumentsSha256',
          'inputSchemaSha256',
          'model',
          'nonMcpToolEventCount',
          'privacy',
          'processExitCode',
          'profile',
          'qqPipelineTested',
          'reasoningEffort',
          'resultCount',
          'resultStatus',
          'schemaVersion',
          'scenarios',
          'serverToolCount',
          'serverToolNames',
          'shellToolCallCount',
          'sourceRevision',
          'timClientTested',
          'toolDescriptionSha256',
          'toolName',
        ].sort(),
      );
      expect(Object.keys(scenario).sort()).toEqual(
        [
          'answerCheckPassed',
          'answerChecks',
          'exactArgumentsMatched',
          'id',
          'oneToolAllowlistVerified',
          'passed',
          'result',
          'resultReadbackVerified',
          'toolCalls',
        ].sort(),
      );
      expect(Object.keys(scenario.result).sort()).toEqual(
        [
          'answerCounters',
          'artifact',
          'coverage',
          'limitationsCount',
          'resultByteLength',
          'resultSha256',
          'resultState',
          'source',
          'sourceOperations',
          'sourceSubjectId',
          'textProjection',
          'toolName',
          'visibleRows',
        ].sort(),
      );
      expect(Object.keys(scenario.result.textProjection).sort()).toEqual(
        [
          'displayNamesClipped',
          'fullStructuredContentAvailable',
          'imageFieldsOmitted',
          'limitationsClipped',
          'relationLabelsClipped',
          'rowsIncluded',
          'rowsOmitted',
          'textUtf8Bytes',
        ].sort(),
      );
      const serialized = JSON.stringify(built.report);
      expect(serialized).toContain('Source title');
      expect(serialized).toContain('来源作品');
      expect(serialized).not.toContain('范围：');
      expect(built.report).toMatchObject({
        evidenceKind: 'codex_cli_mcp_tool_use',
        resultCount: 1,
        model: 'gpt-6-luna',
        reasoningEffort: 'max',
        toolName: TARGET_TOOL,
        privacy: { answerStored: false, rawResultStored: false, promptStored: false },
        scenarios: [
          {
            id: TARGET_TOOL,
            passed: true,
            toolCalls: [{ name: TARGET_TOOL, state: 'DONE' }],
            answerChecks: {
              finalScopeLineVerified: true,
              sourceSubjectDisclosurePresent: true,
              responseCountsDisclosurePresent: true,
              projectionRowsOmittedDisclosurePresent: true,
              reverseTransitiveDisclosurePresent: true,
              noUnsupportedCompletenessClaim: true,
              noUnsupportedCanonicalOrderClaim: true,
              noUnsupportedAbsenceClaim: true,
              noUnsupportedReverseClaim: true,
              noMarkdownFormatting: true,
            },
            result: {
              sourceSubjectId: 227245,
              coverage: {
                responseRowsObserved: 2,
                rowsReturned: 2,
                schemaDriftRows: 0,
                paginationAvailable: false,
                totalCountAvailable: false,
                completeness: 'not_provided_by_source',
              },
              visibleRows: [
                { id: 5001, name: 'Source title 0', nameCn: '来源作品0', relation: '前传' },
                { id: 5002, name: 'Source title 1', nameCn: '来源作品1', relation: '续集' },
              ],
              textProjection: { rowsOmitted: 0, fullStructuredContentAvailable: true },
              answerCounters: { visibleSourceRows: 2, answerRowsParsed: 2, rowsMatched: 2 },
            },
          },
        ],
      });
      const written = writeG20AgentMcpReport(input, fixture.root) as {
        passed: boolean;
        reportPath: string;
      };
      expect(written.passed).toBe(true);
      const report = JSON.parse(readFileSync(written.reportPath, 'utf8')) as Record<string, any>;
      expect(report.scenarios[0].answerChecks.noMarkdownFormatting).toBe(true);
      expect(report.scenarios[0].result.answerCounters.rowsMatched).toBe(2);
      expect(() => writeG20AgentMcpReport(input, fixture.root)).toThrow(
        /clean exact Candidate|must not be repeated/u,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('fails report creation on argument, call-count, readback, event, or privacy mismatch', () => {
    const fixture = completeCandidateRepo();
    try {
      writeG20CanonicalClaim(fixture.root, fixture.head, fixture.bundleSha256);
      const valid = writerInput(fixture.bundleSha256, fixture.head);
      const wrongArguments = { ...valid, queryArguments: { subjectId: 227245 } };
      const extraCall = { ...valid, codexMcpToolEventCount: 2 };
      const privateRead = { ...valid, privacy: { ...valid.privacy, accountDataRead: true } };
      const noReadback = { ...valid, toolOutput: { content: [] } };
      expect(
        (buildG20AgentMcpReport(wrongArguments, fixture.root) as { passed: boolean }).passed,
      ).toBe(false);
      expect(() => buildG20AgentMcpReport(extraCall, fixture.root)).toThrow(/exactly one/u);
      expect(() => buildG20AgentMcpReport(privateRead, fixture.root)).toThrow(
        /anonymous public read-only/u,
      );
      expect((buildG20AgentMcpReport(noReadback, fixture.root) as { passed: boolean }).passed).toBe(
        false,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
