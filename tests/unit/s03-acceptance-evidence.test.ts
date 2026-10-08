import { execFileSync } from 'node:child_process';
import { createHash, createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertS03CandidateReviewGate,
  buildCodexExecArgs,
  canonicalS03ClaimPath,
  sanitizeS03CodexEnvironment,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-s03-codex-agent-mcp.mjs';
import * as S03RunnerModule from '../../scripts/acceptance/run-s03-codex-agent-mcp.mjs';
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
import {
  captureS03ServerResult,
  claimS03ServerCall,
  s03EventEvidenceSha256,
  s03ServerSummarySha256,
} from '../../scripts/lib/s03-one-shot-authorization.mjs';
import * as S03AuthorizationModule from '../../scripts/lib/s03-one-shot-authorization.mjs';

const tempRoots: string[] = [];
const evidenceSigningKeyPair = generateKeyPairSync('ed25519');

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

function writeClaimFixture(input: {
  claimPath: string;
  candidateSha: string;
  bundleSha256: string;
  authorizationToken: string;
  baseSha: string;
  reviewerId: string;
  summaryPath: string;
}) {
  const claim = {
    schemaVersion: 1,
    runNumber: 95,
    frontierId: 'S03',
    state: 'CLAIMED',
    sourceRevision: input.candidateSha,
    bundleSha256: input.bundleSha256,
    baseSha: input.baseSha,
    reviewerId: input.reviewerId,
    summaryPathSha256: sha256(path.resolve(input.summaryPath)),
    authorizationTokenSha256: sha256(input.authorizationToken),
    expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
    claimedAt: '2026-10-08T00:00:00.000Z',
  };
  writeFileSync(input.claimPath, `${JSON.stringify(claim, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  return claim;
}

function signReportClaimFixture(
  claimPath: string,
  authorizationToken: string,
  reportAuthorization: Record<string, unknown>,
) {
  const claim = JSON.parse(readFileSync(claimPath, 'utf8'));
  const unsignedClaim = {
    ...claim,
    state: 'REPORT_READY',
    reportAuthorization,
    reportReadyAt: '2026-10-08T00:01:00.000Z',
  };
  const reportAuthorizationProof = createHmac('sha256', authorizationToken)
    .update(canonicalJson(unsignedClaim))
    .digest('hex');
  writeFileSync(
    claimPath,
    `${JSON.stringify({ ...unsignedClaim, reportAuthorizationProof }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
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
      '仅覆盖当前匿名可见、无分页的直接关系和人物角色行；未命中不证明没有其他演出；不是完整履历；不是官方唯一顺序。',
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
  const attestationPublicKey = readFileSync(
    'docs/product/s03-run95-attestation-ed25519.pub',
    'utf8',
  );
  const attestationTrustMarker =
    'S03 runner attestation trust: candidate ' +
    candidateSha +
    '; Ed25519 public key SHA-256 ' +
    createHash('sha256').update(attestationPublicKey).digest('hex') +
    '.';
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
    reviewed_base_sha: baseSha,
    advances_frontier_ids: ['S03'],
    review_history: [
      {
        review_number: 1,
        reviewer_id: `gpt-6-luna-max-run95-s03-pr${prNumber}-round1`,
        candidate_sha: candidateSha,
        reviewed_base_sha: baseSha,
        verdict: 'PASS',
      },
    ],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The exact-SHA regression suite was necessary.',
      why_not_extend_further: 'The bounded source contract closes the selected S03 scope.',
    },
    adversarial_preflight: {
      completed: true,
      summary: 'No blocker remained. ' + attestationTrustMarker,
    },
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
      baseRefOid: baseSha,
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
    const extraAnswerClaim = { ...answer, careerSummary: '这是完整履历。' };
    const unsupportedTitleClaim = structuredClone(answer);
    unsupportedTitleClaim.works[0]!.title = '完整履历';
    const unrelatedNegationClaim = structuredClone(answer);
    unrelatedNegationClaim.works[0]!.title = '这是完整履历，没有其他遗漏';
    const causalNegationBypass = {
      ...answer,
      caveat: '不是完整履历，所以这是官方唯一顺序。',
    };
    const becauseNegationBypass = {
      ...answer,
      caveat: '不是完整履历；不是官方唯一顺序；并非官方唯一顺序因为这就是官方唯一顺序。',
    };
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
        JSON.stringify(missingCaveat),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.careerAndCanonicalOrderCaveatsPresent,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(extraAnswerClaim),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.answerRowsMatch,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(extraAnswerClaim),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.noUnsupportedCompletenessClaim,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(unsupportedTitleClaim),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.noUnsupportedCompletenessClaim,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(unrelatedNegationClaim),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.noUnsupportedCompletenessClaim,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(causalNegationBypass),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.noUnsupportedCompletenessClaim,
    ).toBe(false);
    expect(
      verifyS03VoiceActorOverlapAnswer(
        JSON.stringify(becauseNegationBypass),
        S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        toolCalls,
      ).answerChecks.noUnsupportedCompletenessClaim,
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
      claimPath: '/private/.git/pariya-agent-state/s03-run95-one-shot-claim.json',
      authorizationToken: 'c'.repeat(64),
      currentBaseSha: 'd'.repeat(40),
      reviewerId: 'gpt-6-luna-max-run95-s03-pr110-round2',
    });

    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(S03RunnerModule).not.toHaveProperty('createS03OneShotClaim');
    expect(S03AuthorizationModule).not.toHaveProperty('prepareS03ReportClaim');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow();
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual([
      '--model',
      'gpt-6-luna',
    ]);
    expect(args).toContain('model_reasoning_effort="max"');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('features.web_search=false');
    expect(args).toContain('web_search="disabled"');
    expect(args).toContain(
      'mcp_servers.bgk_s03_one_tool.enabled_tools=["bangumi.get_series_watch_order"]',
    );
    const serializedArgs = args.join('\n');
    expect(serializedArgs).toContain(
      '/private/.git/pariya-agent-state/s03-run95-one-shot-claim.json',
    );
    expect(serializedArgs).toContain('gpt-6-luna-max-run95-s03-pr110-round2');
    expect(serializedArgs).toContain('c'.repeat(64));
    expect(args.at(-1)).toContain(JSON.stringify(S03_EXPECTED_QUERY_ARGUMENTS));
  });

  it('requires all exact Candidate, Harness, CI, and Luna Max PASS gates', () => {
    const fixture = gateFixture();
    expect(
      assertS03CandidateReviewGate(fixture.status, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toEqual({
      prNumber: 128,
      candidateSha: fixture.candidateSha,
      baseSha: fixture.baseSha,
      reviewerId: 'gpt-6-luna-max-run95-s03-pr128-round1',
    });

    const laterRoundSameReviewer = structuredClone(fixture.status);
    laterRoundSameReviewer.epoch.state.review_history[0]!.review_number = 2;
    expect(
      assertS03CandidateReviewGate(laterRoundSameReviewer, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }).reviewerId,
    ).toBe('gpt-6-luna-max-run95-s03-pr128-round1');

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
    const staleReviewedBase = structuredClone(fixture.status);
    staleReviewedBase.epoch.state.reviewed_base_sha = 'c'.repeat(40);
    staleReviewedBase.epoch.state.review_history[0]!.reviewed_base_sha = 'c'.repeat(40);
    expect(() =>
      assertS03CandidateReviewGate(staleReviewedBase, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
    const wrongReviewer = structuredClone(fixture.status);
    wrongReviewer.epoch.state.review_history[0]!.reviewer_id = 'gpt-6-sol-run95-s03-pr128-round1';
    expect(() =>
      assertS03CandidateReviewGate(wrongReviewer, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
    const missingReviewer = structuredClone(fixture.status);
    Reflect.deleteProperty(missingReviewer.epoch.state.review_history[0]!, 'reviewer_id');
    expect(() =>
      assertS03CandidateReviewGate(missingReviewer, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
    const missingTrustRecord = structuredClone(fixture.status);
    missingTrustRecord.epoch.state.adversarial_preflight.summary = 'No blocker remained.';
    expect(() =>
      assertS03CandidateReviewGate(missingTrustRecord, fixture.pr, {
        sourceRevision: fixture.candidateSha,
        currentBaseSha: fixture.baseSha,
      }),
    ).toThrow();
  });

  it('consumes one canonical MCP claim and binds it to the runner summary path', () => {
    const { root, bundleSha256, candidateSha } = tempGitRoot();
    const claimPath = canonicalS03ClaimPath(root, path.join(root, '.git/pariya-agent-state'));
    const authorizationToken = 'd'.repeat(64);
    const baseSha = 'b'.repeat(40);
    const reviewerId = 'gpt-6-luna-max-run95-s03-pr128-round1';
    const summaryPath = path.join(os.tmpdir(), 's03-summary.json');
    const summaryPathSha256 = sha256(path.resolve(summaryPath));
    const claim = writeClaimFixture({
      claimPath,
      candidateSha,
      bundleSha256,
      authorizationToken,
      baseSha,
      reviewerId,
      summaryPath,
    });

    expect(claim).toMatchObject({
      runNumber: 95,
      frontierId: 'S03',
      state: 'CLAIMED',
      sourceRevision: candidateSha,
      bundleSha256,
      baseSha,
      reviewerId,
      summaryPathSha256,
      authorizationTokenSha256: sha256(authorizationToken),
    });
    expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toMatchObject(claim);
    expect(
      claimS03ServerCall(claimPath, authorizationToken, {
        sourceRevision: candidateSha,
        bundleSha256,
        expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
        baseSha,
        reviewerId,
        summaryPathSha256,
      }),
    ).toBe(true);
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).state).toBe('SERVER_CALL_STARTED');
    expect(
      claimS03ServerCall(claimPath, authorizationToken, {
        sourceRevision: candidateSha,
        bundleSha256,
        expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
        baseSha,
        reviewerId,
        summaryPathSha256,
      }),
    ).toBe(false);
    expect(() =>
      claimS03ServerCall(claimPath, authorizationToken, {
        sourceRevision: candidateSha,
        bundleSha256,
        expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
        baseSha,
        reviewerId,
        summaryPathSha256: sha256(path.join(os.tmpdir(), 'alternate-summary.json')),
      }),
    ).toThrow('runner-created Candidate claim');
    expect(() => canonicalS03ClaimPath(root, path.join(root, 'outside-state'))).toThrow(
      'local .git',
    );
  });

  it('writes a sanitized exact-Candidate report without storing the raw answer or tool result', () => {
    const { root, bundleSha256, candidateSha } = tempGitRoot();
    const claimPath = canonicalS03ClaimPath(root, path.join(root, '.git/pariya-agent-state'));
    const authorizationToken = 'e'.repeat(64);
    const baseSha = 'b'.repeat(40);
    const reviewerId = 'gpt-6-luna-max-run95-s03-pr128-round1';
    const summaryPath = path.join(os.tmpdir(), 's03-report-summary.json');
    const summaryPathSha256 = sha256(path.resolve(summaryPath));
    writeClaimFixture({
      claimPath,
      candidateSha,
      bundleSha256,
      authorizationToken,
      baseSha,
      reviewerId,
      summaryPath,
    });
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
    const eventsSummary = {
      eventStreamComplete: true,
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
    };
    const answerText = JSON.stringify(answer);
    const toolTextUtf8Bytes = 1800;
    const expectedArgumentsSha256 = sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS));
    expect(
      claimS03ServerCall(claimPath, authorizationToken, {
        sourceRevision: candidateSha,
        bundleSha256,
        expectedArgumentsSha256,
        baseSha,
        reviewerId,
        summaryPathSha256,
      }),
    ).toBe(true);
    captureS03ServerResult(claimPath, authorizationToken, serverSummary);
    const reportAuthorization = {
      sourceRevision: candidateSha,
      baseSha,
      bundleSha256,
      prNumber: 128,
      reviewerId,
      summaryPathSha256,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexCliVersion: '1.2.14',
      processExitCode: 0,
      eventStreamParsed: true,
      eventsSha256: s03EventEvidenceSha256({
        eventsSummary,
        queryArguments: S03_EXPECTED_QUERY_ARGUMENTS,
        toolOutput,
        answer: answerText,
        toolTextUtf8Bytes,
      }),
      serverSummarySha256: s03ServerSummarySha256(serverSummary),
      toolTextUtf8Bytes,
    };
    const reportInput = {
      authorizationToken,
      evidenceSigningKey: evidenceSigningKeyPair.privateKey,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexCliVersion: '1.2.14',
      processExitCode: 0,
      resultStatus: 'SUCCESS',
      eventStreamParsed: true,
      eventsSummary,
      queryArguments: S03_EXPECTED_QUERY_ARGUMENTS,
      toolOutput,
      answer: answerText,
      toolTextUtf8Bytes,
      sourceRevision: candidateSha,
      bundleSha256,
      prNumber: 128,
      baseSha,
      reviewerId,
      claimPath,
      summaryPath,
      serverSummary,
    };
    expect(() => writeS03AgentMcpReport(reportInput, root)).toThrow(
      'runner-authorized REPORT_READY claim',
    );
    signReportClaimFixture(claimPath, authorizationToken, reportAuthorization);
    expect(() =>
      writeS03AgentMcpReport({ ...reportInput, authorizationToken: 'f'.repeat(64) }, root),
    ).toThrow('authorization token');
    expect(() =>
      writeS03AgentMcpReport(
        {
          ...reportInput,
          summaryPath: path.join(os.tmpdir(), 'alternate-s03-summary.json'),
        },
        root,
      ),
    ).toThrow('authenticated one-shot claim');
    expect(() =>
      writeS03AgentMcpReport(
        {
          ...reportInput,
          eventsSummary: { ...eventsSummary, shellToolCallCount: 1 },
        },
        root,
      ),
    ).toThrow('runner-authenticated evidence digest');
    expect(() =>
      writeS03AgentMcpReport(
        {
          ...reportInput,
          serverSummary: { ...serverSummary, serverResultStatus: 'ERROR' },
        },
        root,
      ),
    ).toThrow('runner-authenticated evidence digest');
    const result = writeS03AgentMcpReport(reportInput, root);

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
    expect(report.evidenceProvenance).toMatchObject({
      kind: 's03-runner-evidence-digest-v1',
      summaryPathSha256,
      serverSummarySha256: reportAuthorization.serverSummarySha256,
      eventsSha256: reportAuthorization.eventsSha256,
    });
    expect(
      verify(
        null,
        Buffer.from(report.evidenceProvenance.proofSha256, 'hex'),
        evidenceSigningKeyPair.publicKey,
        Buffer.from(report.evidenceProvenance.signature, 'base64'),
      ),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain('间谍过家家');
  });

  it('removes account credentials and the claim path from the Codex child environment', () => {
    const env = sanitizeS03CodexEnvironment({
      PATH: '/usr/bin',
      PARIYA_S03_RUN95_STATE_DIR: '/private/.git/pariya-agent-state',
      PARIYA_S03_EVIDENCE_SIGNING_KEY_PATH: '/private/key.pem',
      BANGUMI_ACCESS_TOKEN: 'never-copy',
      OPENAI_API_KEY: 'never-copy',
      GITHUB_TOKEN: 'never-copy',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.PARIYA_S03_RUN95_STATE_DIR).toBeUndefined();
    expect(env.PARIYA_S03_EVIDENCE_SIGNING_KEY_PATH).toBeUndefined();
    expect(env.BANGUMI_ACCESS_TOKEN).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });
});
