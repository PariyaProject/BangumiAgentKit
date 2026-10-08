import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertS03CandidateReviewGate,
  buildCodexExecArgs,
  canonicalS03ClaimPath,
  createS03OneShotClaim,
  sanitizeS03CodexEnvironment,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-s03-codex-agent-mcp.mjs';
import {
  S03_ANSWER_CHECK_METHOD,
  S03_EXPECTED_QUERY_ARGUMENTS,
  verifyS03VoiceActorOverlapAnswer,
} from '../../scripts/acceptance/s03-agent-answer-check.mjs';
import { writeS03AgentMcpReport } from '../../scripts/acceptance/write-s03-agent-mcp-report.mjs';
import {
  computeMcpBundleSha256,
  S03_MCP_BUNDLE_ATTESTATION_PATH,
} from '../../scripts/lib/s03-mcp-bundle.mjs';

const tempRoots: string[] = [];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function positiveFixture() {
  const coverage = {
    relationRowsObserved: 12,
    eligibleDirectAnimeWorksObserved: 1,
    eligibleDirectAnimeWorksSelected: 1,
    eligibleDirectAnimeWorksOmitted: 0,
    personRowsObserved: 75,
    personRowsReturned: 75,
    personRowsOmitted: 0,
    matchedCreditRows: 2,
    duplicateRows: 0,
    schemaDriftRows: 0,
    maxRelatedAnimeWorks: 8,
    maxVoiceCredits: 120,
    maxResponseBytes: 1_048_576,
    truncated: false,
  };
  const result = {
    subjectId: 329906,
    evidence: {
      sources: [
        {
          operation: 'GET /v0/persons/{person_id}/characters',
          path: '/v0/persons/7602/characters',
          status: 'succeeded',
          personId: 7602,
        },
      ],
    },
    voiceActorPresence: {
      personId: 7602,
      state: 'observed',
      matchStatus: 'multi_work_found',
      distinctWorks: 2,
      works: [
        {
          subjectId: 329906,
          subjectName: 'SPY×FAMILY',
          subjectNameCn: '间谍过家家',
          relationEvidence: [
            { sourceSubjectId: 329906, targetSubjectId: 329906, direction: 'anchor' },
          ],
          credits: [{ characterId: 71477, characterName: '角色甲', staff: '主角' }],
        },
        {
          subjectId: 373267,
          subjectName: 'SPY×FAMILY 第2クール',
          subjectNameCn: '间谍过家家 第2部分',
          relationEvidence: [
            {
              sourceSubjectId: 329906,
              targetSubjectId: 373267,
              direction: 'outgoing_direct',
              rawRelationLabel: '续集',
              relationKind: 'sequel',
            },
          ],
          credits: [{ characterId: 71479, characterName: '角色乙', staff: '配角' }],
        },
      ],
      coverage,
      sourceOperation: {
        operation: 'GET /v0/persons/{person_id}/characters',
        path: '/v0/persons/7602/characters',
        status: 'succeeded',
      },
      limitations: ['当前匿名可见、无分页的行；未命中不证明没有其他演出。'],
    },
  };
  const works = result.voiceActorPresence.works.map((work) => ({
    subjectId: work.subjectId,
    title: work.subjectNameCn || work.subjectName,
    credits: work.credits.map((credit) => ({
      characterId: credit.characterId,
      name: credit.characterName,
      staff: credit.staff,
    })),
  }));
  const answer = {
    personId: 7602,
    matchStatus: 'multi_work_found',
    distinctWorks: 2,
    works,
    coverage,
    caveat:
      '仅覆盖当前匿名可见、无分页的直接关系和人物角色行；未命中不证明没有其他演出；不是完整履历或官方唯一顺序。',
  };
  const toolOutput = {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  };
  const toolCalls = [{ name: 'bangumi.get_series_watch_order', state: 'DONE' }];
  return { result, answer, toolOutput, toolCalls, coverage };
}

function gateFixture() {
  const candidateSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const branch = 'codex/epoch-s03-series-voice-credit-overlap';
  const prNumber = 128;
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const epoch = {
    pr_number: prNumber,
    branch,
    base_branch: 'master',
    base_sha: baseSha,
    candidate_sha: candidateSha,
    ci: { sha: candidateSha, status: 'SUCCESS' },
    state: 'REVIEW_PASSED',
    review_pass_sha: candidateSha,
    advances_frontier_ids: ['S03'],
    review_history: [{ candidate_sha: candidateSha, verdict: 'PASS' }],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The exact-SHA regression suite was necessary.',
      why_not_extend_further: 'The bounded source contract closes the selected S03 scope.',
    },
    adversarial_preflight: { completed: true, summary: 'No blocker remained.' },
  };
  return {
    candidateSha,
    baseSha,
    branch,
    prNumber,
    checks,
    status: {
      git: { status: '', head: candidateSha, branch },
      run: {
        state: {
          state: 'EPOCH_ACTIVE',
          profile: 'AUTONOMOUS_EVOLUTION',
          active_epoch_pr: prNumber,
          pending_epoch: null,
        },
      },
      epoch: { number: prNumber, github_state: 'OPEN', state: epoch },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidateSha,
      headRefName: branch,
      baseRefName: 'master',
      statusCheckRollup: checks,
    },
  };
}

function tempGitRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 's03-agent-mcp-'));
  tempRoots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'S03 Test'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 's03-test@example.invalid'], { cwd: root });
  mkdirSync(path.join(root, 'packages/core/dist'), { recursive: true });
  mkdirSync(path.join(root, 'apps/mcp/dist'), { recursive: true });
  mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFileSync(path.join(root, 'packages/core/dist/core.js'), 'export const core = true;\n');
  writeFileSync(path.join(root, 'apps/mcp/dist/server.js'), 'export const server = true;\n');
  const tool = {
    name: 'bangumi.get_series_watch_order',
    description: 'Bounded read only series relationships.',
    auth: 'none',
    risk: 'read',
    inputSchema: { type: 'object', properties: { subjectId: { type: 'integer' } } },
  };
  writeFileSync(path.join(root, 'docs/tool-catalog.json'), JSON.stringify([tool]));
  const bundleSha256 = computeMcpBundleSha256(root);
  writeFileSync(
    path.join(root, S03_MCP_BUNDLE_ATTESTATION_PATH),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 's03-mcp-runtime-bundle-attestation-v1',
      bundleSha256,
    })}\n`,
  );
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'fixture candidate'], { cwd: root, stdio: 'ignore' });
  mkdirSync(path.join(root, '.git/pariya-agent-state'), { recursive: true, mode: 0o700 });
  return {
    root,
    bundleSha256,
    candidateSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('S03 create-once Agent/MCP evidence gate', () => {
  it('accepts only the fixed positive ID-grounded overlap and bounded caveat', () => {
    const { result, answer, toolOutput, toolCalls } = positiveFixture();
    const checked = verifyS03VoiceActorOverlapAnswer(
      JSON.stringify(answer),
      S03_EXPECTED_QUERY_ARGUMENTS,
      toolOutput,
      toolCalls,
    );

    expect(checked.answerChecks).toEqual(
      Object.fromEntries(Object.keys(checked.answerChecks).map((key) => [key, true])),
    );
    expect(checked).toMatchObject({
      passed: true,
      method: S03_ANSWER_CHECK_METHOD,
      resultCounters: {
        distinctWorks: 2,
        answerWorks: 2,
        matchedCreditRows: 2,
        personRowsObserved: 75,
        personRowsReturned: 75,
      },
    });
    expect(result.voiceActorPresence.works.map((work) => work.subjectId)).toEqual([329906, 373267]);
  });

  it('rejects wrong actors, unsupported relations, missing caveats, or additional tool calls', () => {
    const { answer, toolOutput, toolCalls } = positiveFixture();
    const wrongActorResult = structuredClone(toolOutput);
    wrongActorResult.structuredContent.voiceActorPresence.personId = 7601;
    const missingCaveat = { ...answer, caveat: '在两部作品中发现了交集。' };
    const wrongRelationResult = structuredClone(toolOutput);
    const directRelation =
      wrongRelationResult.structuredContent.voiceActorPresence.works[1]?.relationEvidence.find(
        (relation) => relation.direction === 'outgoing_direct',
      );
    if (directRelation && 'rawRelationLabel' in directRelation) {
      directRelation.rawRelationLabel = '相关作品';
    }

    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(answer),
        S03_EXPECTED_QUERY_ARGUMENTS,
        wrongActorResult,
        toolCalls,
      ).passed,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(answer),
        S03_EXPECTED_QUERY_ARGUMENTS,
        wrongRelationResult,
        toolCalls,
      ).passed,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(missingCaveat),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).passed,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(answer),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        [...toolCalls, { name: 'bangumi.auth_status', state: 'DONE' }],
      ).passed,
    ).toBe(false);
  });

  it('locks the runner to GPT-6 Luna Max, one allowlisted MCP tool, and --run 95', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/node',
      summaryPath: '/tmp/s03-summary.json',
      sourceRevision: 'a'.repeat(40),
      bundleSha256: 'b'.repeat(64),
    });

    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow();
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual([
      '--model',
      'gpt-6-luna',
    ]);
    expect(args).toContain('model_reasoning_effort="max"');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('features.web_search=false');
    expect(args).toContain(
      'mcp_servers.bgk_s03_one_tool.enabled_tools=["bangumi.get_series_watch_order"]',
    );
    expect(args.at(-1)).toContain(JSON.stringify(S03_EXPECTED_QUERY_ARGUMENTS));
  });

  it('requires all exact Candidate, Harness, CI, and Luna Max PASS gates', () => {
    const fixture = gateFixture();
    expect(
      assertS03CandidateReviewGate(fixture.status, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toEqual({ prNumber: 128, candidateSha: fixture.candidateSha });

    const stalePr = structuredClone(fixture.pr);
    stalePr.headRefOid = 'c'.repeat(40);
    expect(() =>
      assertS03CandidateReviewGate(fixture.status, stalePr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow('Luna Max PASS');
    const failedCheck = structuredClone(fixture.pr);
    failedCheck.statusCheckRollup[0]!.conclusion = 'FAILURE';
    expect(() =>
      assertS03CandidateReviewGate(fixture.status, failedCheck, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
    const missingPass = structuredClone(fixture.status);
    missingPass.epoch.state.review_history = [];
    expect(() =>
      assertS03CandidateReviewGate(missingPass, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
  });

  it('creates one claim under Git metadata and refuses a second query attempt', () => {
    const { root, bundleSha256, candidateSha } = tempGitRoot();
    const claimPath = canonicalS03ClaimPath(root, path.join(root, '.git/pariya-agent-state'));
    const claim = createS03OneShotClaim(claimPath, candidateSha, bundleSha256, root);

    expect(claim).toMatchObject({
      runNumber: 95,
      frontierId: 'S03',
      state: 'CLAIMED',
      sourceRevision: candidateSha,
      bundleSha256,
    });
    expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toMatchObject(claim);
    expect(() => createS03OneShotClaim(claimPath, candidateSha, bundleSha256, root)).toThrow(
      'already exists',
    );
    expect(() =>
      createS03OneShotClaim(
        path.join(root, 'outside-claim.json'),
        candidateSha,
        bundleSha256,
        root,
      ),
    ).toThrow('local .git');
  });

  it('writes a sanitized exact-Candidate report without storing the raw answer or tool result', () => {
    const { root, bundleSha256, candidateSha } = tempGitRoot();
    const claimPath = canonicalS03ClaimPath(root, path.join(root, '.git/pariya-agent-state'));
    createS03OneShotClaim(claimPath, candidateSha, bundleSha256, root);
    const { answer, toolOutput, toolCalls } = positiveFixture();
    const tool = JSON.parse(readFileSync(path.join(root, 'docs/tool-catalog.json'), 'utf8'))[0];
    const serverSummary = {
      serverProfile: 's03-one-tool-anonymous-public-v1',
      sourceRevision: candidateSha,
      bundleSha256,
      toolName: 'bangumi.get_series_watch_order',
      serverToolNames: ['bangumi.get_series_watch_order'],
      serverToolCount: 1,
      expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
      argumentMatch: true,
      allowedCallCount: 1,
      deniedCallCount: 0,
      serverResultStatus: 'SUCCESS',
      result: {
        subjectId: 329906,
        voiceActorPresence: { personId: 7602, matchStatus: 'multi_work_found' },
      },
      catalogSha256: sha256(readFileSync(path.join(root, 'docs/tool-catalog.json'))),
      toolDescriptionSha256: sha256(tool.description),
      inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
      privacy: {
        authProfile: 'anonymous',
        oauthAttempted: false,
        accountDataRead: false,
        communityRead: false,
        writesAttempted: false,
        qqPipelineTested: false,
        timClientTested: false,
        promptStored: false,
        answerStored: false,
        rawResultStored: false,
        credentialsStored: false,
      },
    };
    const result = writeS03AgentMcpReport(
      {
        model: 'gpt-6-luna',
        reasoningEffort: 'max',
        codexCliVersion: '1.2.14',
        processExitCode: 0,
        resultStatus: 'SUCCESS',
        eventStreamParsed: true,
        eventsSummary: {
          codexMcpToolEventCount: 1,
          mcpServerNames: ['bgk_s03_one_tool'],
          nonMcpToolEventCount: 0,
          shellToolCallCount: 0,
          toolCalls,
          completedMcpCalls: [
            {
              tool: 'bangumi.get_series_watch_order',
              arguments: S03_EXPECTED_QUERY_ARGUMENTS,
              result: toolOutput,
            },
          ],
        },
        queryArguments: S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        answer: JSON.stringify(answer),
        toolTextUtf8Bytes: 1800,
        sourceRevision: candidateSha,
        bundleSha256,
        prNumber: 128,
        baseSha: 'b'.repeat(40),
        claimPath,
        serverSummary,
      },
      root,
    );

    expect(result.passed).toBe(true);
    const report = JSON.parse(readFileSync(path.join(root, result.reportPath!), 'utf8'));
    expect(report).toMatchObject({
      evidenceKind: 'codex_cli_s03_series_voice_overlap_agent_mcp',
      sourceRevision: candidateSha,
      answerCheckMethod: S03_ANSWER_CHECK_METHOD,
      rawAnswerPersisted: false,
      rawToolResultPersisted: false,
    });
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('toolOutput');
    expect(JSON.stringify(report)).not.toContain('间谍过家家');
  });

  it('removes account credentials and the claim path from the Codex child environment', () => {
    const env = sanitizeS03CodexEnvironment({
      PATH: '/usr/bin',
      PARIYA_S03_RUN95_STATE_DIR: '/private/.git/pariya-agent-state',
      BANGUMI_ACCESS_TOKEN: 'never-copy',
      OPENAI_API_KEY: 'never-copy',
      GITHUB_TOKEN: 'never-copy',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.PARIYA_S03_RUN95_STATE_DIR).toBeUndefined();
    expect(env.BANGUMI_ACCESS_TOKEN).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });
});
