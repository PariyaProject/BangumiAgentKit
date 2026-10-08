import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { S02_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/s02-agent-answer-check.mjs';
import {
  assertS02CandidateReviewGate,
  buildCodexExecArgs,
  buildS02EvidenceReport,
  canonicalS02ClaimPath,
  createS02OneShotClaim,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-s02-codex-agent-mcp.mjs';

const candidateSha = 'a'.repeat(40);
const bundleSha = 'b'.repeat(64);
const branch = 'codex/epoch-s02-top-rated-voice-main-works';
const prNumber = 107;
const temporaryRoots: string[] = [];

function makeCoverage() {
  return {
    relationRowsObserved: 42,
    relationRowsSelected: 42,
    relationRowsDroppedAtLimit: 0,
    subjectDetailRequests: 21,
    subjectDetailsSucceeded: 21,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    mainRoleSubjectsSelected: 1,
    scoreableMainRoleSubjects: 1,
    zeroRatingScoreSubjects: 0,
    unknownRoleRows: 0,
    missingRatingScoreSubjects: 0,
    missingRatingTotalSubjects: 0,
    mediaUnknownSubjects: 0,
    missingSubjectIdRows: 0,
    mainRoleSubjectsMissingDetail: 0,
    rowsReturned: 1,
  };
}

function makeResult() {
  return {
    structuredContent: {
      personId: 3474,
      ranking: {
        mode: 'top_rated_main_voice',
        scope: 'current_official_person_character_response',
        media: 'all',
        state: 'partial',
        limit: 5,
        items: [
          {
            subjectId: 1001,
            subjectName: 'Work A',
            subjectNameCn: '作品甲',
            ratingScore: 8.9,
            ratingTotal: 8123,
            rawRoles: ['主役'],
          },
        ],
        coverage: { ...makeCoverage(), rowsReturned: 1, truncated: false },
      },
    },
  };
}

function makeAnswer() {
  return JSON.stringify({
    personId: 3474,
    rankingMode: 'top_rated_main_voice',
    scope: 'current_official_person_character_response',
    state: 'partial',
    items: [
      {
        subjectId: 1001,
        title: '作品甲',
        ratingScore: 8.9,
        ratingTotal: 8123,
        rawRoles: ['主役'],
      },
    ],
    coverage: makeCoverage(),
    caveat: '这是本次观察样本中的评分排序，不代表完整生涯排名，也不是历史评分快照。',
  });
}

function makeStatus(overrides: Record<string, any> = {}) {
  const mandatoryChecks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const state = {
    pr_number: prNumber,
    branch,
    base_branch: 'master',
    base_sha: 'c'.repeat(40),
    candidate_sha: candidateSha,
    ci: { sha: candidateSha, status: 'SUCCESS' },
    state: 'PASS',
    advances_frontier_ids: ['S02'],
    review_pass_sha: candidateSha,
    review_history: [{ candidate_sha: candidateSha, verdict: 'PASS' }],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The connected ranking and presentation packages are complete.',
      why_not_extend_further: 'Other person analytics use different questions and source policy.',
    },
    adversarial_preflight: {
      completed: true,
      summary: 'Coverage and malformed-source cases reviewed.',
    },
    ...overrides.epochState,
  };
  return {
    git: { status: '', head: candidateSha, branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: prNumber,
        pending_epoch: null,
      },
    },
    epoch: { number: prNumber, github_state: 'OPEN', state },
    pr: {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidateSha,
      headRefName: branch,
      baseRefName: 'master',
      statusCheckRollup: mandatoryChecks,
      ...overrides.pr,
    },
    currentBaseSha: state.base_sha,
  };
}

describe('S02 Codex Agent/MCP runner', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses only GPT-6 Luna Max and a required one-tool read-only MCP server', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow();
    const args = buildCodexExecArgs({
      root: '/candidate',
      nodePath: '/usr/bin/node',
      summaryPath: '/tmp/s02-summary.json',
      sourceRevision: candidateSha,
      bundleSha256: bundleSha,
    });
    expect(args).toContain('gpt-6-luna');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('features.multi_agent=false');
    expect(args).toContain('history.persistence="none"');
    expect(args.join(' ')).toContain('reasoning_effort="max"');
    expect(args.join(' ')).toContain('bangumi.get_person_activity');
    expect(args).toContain('read-only');
  });

  it('requires an exact active Candidate, passing current-base CI, and a recorded review', () => {
    const fixture = makeStatus();
    expect(
      assertS02CandidateReviewGate(fixture, fixture.pr, {
        sourceRevision: candidateSha,
        currentBaseSha: fixture.currentBaseSha,
      }),
    ).toEqual({ prNumber, candidateSha });

    expect(() =>
      assertS02CandidateReviewGate(
        fixture,
        { ...fixture.pr, headRefOid: 'd'.repeat(40) },
        { sourceRevision: candidateSha, currentBaseSha: fixture.currentBaseSha },
      ),
    ).toThrow(/exact Candidate/u);
    expect(() =>
      assertS02CandidateReviewGate(
        makeStatus({ epochState: { scope_closure: { related_work_remaining: true } } }),
        fixture.pr,
        { sourceRevision: candidateSha, currentBaseSha: fixture.currentBaseSha },
      ),
    ).toThrow(/exact Candidate/u);
  });

  it('claims a fixed candidate only once under the selected checkout Git metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 's02-claim-test-'));
    temporaryRoots.push(root);
    expect(spawnSync('git', ['init', '-q'], { cwd: root }).status).toBe(0);
    const claimPath = canonicalS02ClaimPath(root);
    const claim = createS02OneShotClaim(claimPath, candidateSha, bundleSha, root);
    expect(claim).toMatchObject({ runNumber: 95, frontierId: 'S02', state: 'CLAIMED' });
    expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toMatchObject({
      sourceRevision: candidateSha,
      bundleSha256: bundleSha,
    });
    expect(() => createS02OneShotClaim(claimPath, candidateSha, bundleSha, root)).toThrow(
      /already exists/u,
    );
  });

  it('writes only sanitized IDs, scores, counts, and answer-check booleans to evidence', () => {
    const result = makeResult();
    const answer = makeAnswer();
    const call = {
      name: 'bangumi.get_person_activity',
      state: 'DONE',
      arguments: S02_EXPECTED_QUERY_ARGUMENTS,
    };
    const eventsSummary = {
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      toolCalls: [{ name: call.name, state: call.state }],
    };
    const serverSummary = {
      catalogSha256: '1'.repeat(64),
      toolDescriptionSha256: '2'.repeat(64),
      inputSchemaSha256: '3'.repeat(64),
      serverResultStatus: 'SUCCESS',
      allowedCallCount: 1,
      deniedCallCount: 0,
    };
    const built = buildS02EvidenceReport({
      answer,
      queryArguments: S02_EXPECTED_QUERY_ARGUMENTS,
      toolOutput: result,
      toolCalls: [call],
      sourceRevision: candidateSha,
      bundleSha256: bundleSha,
      observedAt: '2026-10-08T05:00:00.000Z',
      codexCliVersion: '1.2.3',
      processExitCode: 0,
      serverSummary,
      eventStreamParsed: true,
      eventsSummary,
    });
    expect(built.answer.passed).toBe(true);
    expect(built.report).toMatchObject({
      evidenceKind: 'codex_cli_s02_person_activity_agent_mcp',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      toolName: 'bangumi.get_person_activity',
      resultSummary: {
        rows: [{ subjectId: 1001, ratingScore: 8.9, ratingTotal: 8123 }],
      },
    });
    const encoded = JSON.stringify(built.report);
    expect(encoded).not.toContain('作品甲');
    expect(encoded).not.toContain('主役');
    expect(built.report).not.toHaveProperty('answer');
    expect(built.report).not.toHaveProperty('prompt');
  });
});
