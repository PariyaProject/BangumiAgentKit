import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertS04CandidateReviewGate,
  buildCodexExecArgs,
  buildS04AgentMcpReport,
  canonicalS04ClaimPath,
  createS04OneShotClaim,
  mandatoryChecksSuccessful,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-s04-codex-agent-mcp.mjs';
import { S04_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/s04-agent-answer-check.mjs';

const temporaryRoots: string[] = [];
const BASE_SHA = 'a'.repeat(40);
const CANDIDATE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const PR_NUMBER = 123;
const REVIEWER_ID = `gpt-6-luna-max-run95-s04-pr${PR_NUMBER}-round1`;

function statusAndPr() {
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const passRecord = {
    candidate_sha: CANDIDATE_SHA,
    reviewed_base_sha: BASE_SHA,
    verdict: 'PASS',
    reviewer_id: REVIEWER_ID,
  };
  const epochState = {
    epoch_id: 's04-subject-cast-multirole',
    pr_number: PR_NUMBER,
    branch: 'codex/epoch-s04-subject-cast-multirole',
    base_branch: 'master',
    base_sha: BASE_SHA,
    reviewed_base_sha: BASE_SHA,
    candidate_sha: CANDIDATE_SHA,
    ci: { sha: CANDIDATE_SHA, status: 'SUCCESS' },
    state: 'REVIEW_PASSED',
    advances_frontier_ids: ['S04'],
    review_pass_sha: CANDIDATE_SHA,
    review_history: [passRecord],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The bounded source contract was validated first.',
      why_not_extend_further: 'Catalog-wide discovery is a separate frontier.',
    },
    adversarial_preflight: {
      completed: true,
      summary: 'Prompt/data, partial source, and omission gates checked.',
    },
  };
  const status = {
    git: {
      status: '',
      head: CANDIDATE_SHA,
      branch: 'codex/epoch-s04-subject-cast-multirole',
    },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: PR_NUMBER,
        pending_epoch: null,
      },
    },
    epoch: { number: PR_NUMBER, github_state: 'OPEN', state: epochState },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    headRefOid: CANDIDATE_SHA,
    headRefName: 'codex/epoch-s04-subject-cast-multirole',
    baseRefName: 'master',
    baseRefOid: BASE_SHA,
    statusCheckRollup: checks,
  };
  return { status, pr, checks };
}

function resultFixture() {
  return {
    status: 'ok',
    subjectId: 565,
    cast: [
      {
        character: { id: 11, name: '角色甲', type: 1 },
        relation: '主角',
        actors: [{ id: 77, name: '声优甲', career: ['seiyu'] }],
      },
      {
        character: { id: 12, name: '角色乙', type: 1 },
        relation: '原始标签乙',
        actors: [{ id: 77, name: '声优甲', career: ['seiyu'] }],
      },
    ],
    observed: 2,
    returned: 2,
    selectedRows: 2,
    omittedRowsByLimit: 0,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    duplicateActorCharacterLinks: 0,
    multiRoleVoiceActors: [
      {
        person: { id: 77, name: '声优甲', career: ['seiyu'] },
        distinctCharacterCount: 2,
        roles: [
          { characterId: 11, characterName: '角色甲', relation: '主角' },
          { characterId: 12, characterName: '角色乙', relation: '原始标签乙' },
        ],
      },
    ],
    source: {
      api: 'official-v0',
      operation: 'GET /v0/subjects/{subject_id}/characters',
      retrievedAt: '2026-10-08T12:00:00.000Z',
      status: 'observed',
    responseBytes: 1234,
      responseByteLimit: 1_048_576,
      paginationAvailable: false,
      totalCountAvailable: false,
    },
  };
}

function answerFixture(result: ReturnType<typeof resultFixture>) {
  return {
    subjectId: result.subjectId,
    source: result.source,
    coverage: {
      observed: result.observed,
      selectedRows: result.selectedRows,
      omittedRowsByLimit: result.omittedRowsByLimit,
      truncated: result.truncated,
      schemaDriftRows: result.schemaDriftRows,
      invalidActorIdRows: result.invalidActorIdRows,
      duplicateActorCharacterLinks: result.duplicateActorCharacterLinks,
      sourceStatus: result.source.status,
      responseBytes: result.source.responseBytes,
      responseByteLimit: result.source.responseByteLimit,
    },
    multiRoleVoiceActors: result.multiRoleVoiceActors,
    caveat:
      '本次选取的合法角色行仅覆盖当前观察；接口没有分页或总数；关系标签不作主角或主役分类；未观察到重复声优角色组不表示完整作品角色表中不存在。',
  };
}

function createGitRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 's04-runner-test-'));
  temporaryRoots.push(root);
  const init = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  if (init.status !== 0) throw new Error('git init failed for S04 test fixture.');
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('S04 create-once Agent/MCP runner', () => {
  it('accepts only the single Run 95 invocation form', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow('exact-Candidate CI');
  });

  it('starts Codex with Luna Max and only the fixed cast MCP tool', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/node',
      serverScript: '/repo/apps/mcp/s04-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/s04-summary.json',
      sourceRevision: CANDIDATE_SHA,
      bundleSha256: BUNDLE_SHA,
      baseSha: BASE_SHA,
      reviewerId: REVIEWER_ID,
      prNumber: PR_NUMBER,
    });
    expect(args).toContain('gpt-6-luna');
    expect(args).toContain('read-only');
    expect(args).toContain('features.multi_agent=false');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain(
      'mcp_servers.bgk_s04_one_tool.enabled_tools=["bangumi.get_subject_cast"]',
    );
    expect(args.at(-1)).toContain(JSON.stringify(S04_EXPECTED_QUERY_ARGUMENTS));
  });

  it('requires the exact reviewed Candidate, Base, PR, CI, and all mandatory checks', () => {
    const { status, pr, checks } = statusAndPr();
    expect(mandatoryChecksSuccessful(checks)).toBe(true);
    expect(
      assertS04CandidateReviewGate(status, pr, {
        sourceRevision: CANDIDATE_SHA,
        currentBaseSha: BASE_SHA,
      }),
    ).toMatchObject({ prNumber: PR_NUMBER, candidateSha: CANDIDATE_SHA, reviewerId: REVIEWER_ID });

    const staleCi = structuredClone(status);
    staleCi.epoch.state.ci.sha = 'd'.repeat(40);
    expect(() =>
      assertS04CandidateReviewGate(staleCi, pr, {
        sourceRevision: CANDIDATE_SHA,
        currentBaseSha: BASE_SHA,
      }),
    ).toThrow('exact Candidate/Base');

    const duplicateCheck = [...checks, { ...checks[0] }];
    expect(mandatoryChecksSuccessful(duplicateCheck)).toBe(false);
  });

  it('creates one local-only claim with exclusive mode and refuses a second claim', () => {
    const root = createGitRoot();
    const claimPath = canonicalS04ClaimPath(root);
    const details = { baseSha: BASE_SHA, prNumber: PR_NUMBER, reviewerId: REVIEWER_ID };

    const claim = createS04OneShotClaim(claimPath, CANDIDATE_SHA, BUNDLE_SHA, details, root);

    expect(claim).toMatchObject({
      state: 'CLAIMED',
      sourceRevision: CANDIDATE_SHA,
      bundleSha256: BUNDLE_SHA,
      baseSha: BASE_SHA,
      prNumber: PR_NUMBER,
      reviewerId: REVIEWER_ID,
    });
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toEqual(claim);
    expect(() =>
      createS04OneShotClaim(claimPath, CANDIDATE_SHA, BUNDLE_SHA, details, root),
    ).toThrow('already exists; refusing to invoke Codex again');
  });

  it('writes only sanitized counters and checks in the report', () => {
    const result = resultFixture();
    const report = buildS04AgentMcpReport({
      answer: JSON.stringify(answerFixture(result)),
      queryArguments: S04_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      },
      toolCalls: [{ name: 'bangumi.get_subject_cast', state: 'DONE' }],
      sourceRevision: CANDIDATE_SHA,
      bundleSha256: BUNDLE_SHA,
      baseSha: BASE_SHA,
      prNumber: PR_NUMBER,
      reviewerId: REVIEWER_ID,
      observedAt: '2026-10-08T12:00:00.000Z',
      codexCliVersion: '0.1.0',
      processExitCode: 0,
      serverSummary: {
        catalogSha256: 'e'.repeat(64),
        toolDescriptionSha256: 'f'.repeat(64),
        inputSchemaSha256: '1'.repeat(64),
      },
      serverSummaryMatches: true,
      candidateMatches: true,
      eventStreamParsed: true,
    });

    const encoded = JSON.stringify(report);
    expect(report).toMatchObject({
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexMcpToolEventCount: 1,
      allowedCallCount: 1,
      privacy: { rawAnswerPersisted: false, rawToolResultPersisted: false },
    });
    expect(encoded).not.toContain('声优甲');
    expect(encoded).not.toContain('角色甲');
  });
});
