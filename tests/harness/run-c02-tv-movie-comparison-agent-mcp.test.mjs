import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertC02CandidateReviewGate,
  buildC02CodexExecArgs,
  validateC02ServerSummary,
} from '../../scripts/acceptance/run-c02-tv-movie-comparison-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById('c02-cardcaptor-tv-movie-v1');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const baseSha = 'b'.repeat(40);
const candidateSha = 'a'.repeat(40);
const bundleSha = 'c'.repeat(64);
const reviewerId = 'gpt-6-luna-max-run95-pr201-round1';

function candidateState() {
  const branch = 'codex/epoch-run95-c02-cardcaptor-tv-movie';
  return {
    branch,
    status: {
      git: { branch, head: candidateSha, status: '' },
      run: { state: { state: 'EPOCH_ACTIVE', profile: 'AUTONOMOUS_EVOLUTION', active_epoch_pr: 201, pending_epoch: null } },
      epoch: {
        number: 201,
        github_state: 'OPEN',
        state: {
          epoch_id: PROFILE.epochId,
          pr_number: 201,
          branch,
          base_branch: 'master',
          base_sha: baseSha,
          reviewed_base_sha: baseSha,
          candidate_sha: candidateSha,
          review_pass_sha: candidateSha,
          ci: { sha: candidateSha, status: 'SUCCESS' },
          state: 'REVIEW_PASSED',
          advances_frontier_ids: ['C02'],
          scope_closure: { related_work_remaining: false },
          adversarial_preflight: { completed: true },
          review_history: [{ candidate_sha: candidateSha, reviewed_base_sha: baseSha, verdict: 'PASS', reviewer_id: reviewerId }],
        },
      },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'master',
      baseRefOid: baseSha,
      headRefName: branch,
      headRefOid: candidateSha,
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: [
        'harness-control', 'sqlite-default', 'host-integration', 'standalone-release-smoke',
        'postgres-compat', 'provider-foundation', 'discovery-foundation',
      ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    },
  };
}

test('C02 Codex config allows exactly its one anonymous read tool and no shell/browser/secondary server', () => {
  const args = buildC02CodexExecArgs({ summaryPath: '/tmp/summary.json', sourceRevision: candidateSha, bundleSha256: bundleSha });
  const serialized = args.join('\n');
  assert.equal(args[0], 'exec');
  assert.ok(serialized.includes('--sandbox\nread-only'));
  assert.ok(serialized.includes('mcp_servers.bgk_c02_one_tool.enabled_tools=["bangumi.get_subject_comparison"]'));
  assert.ok(serialized.includes('features.shell_tool=false'));
  assert.ok(serialized.includes('features.browser_use=false'));
  assert.ok(serialized.includes('Call its sole tool bangumi.get_subject_comparison exactly once'));
  assert.equal(serialized.includes('mcp_servers.bgk_c01'), false);
});

test('C02 one-shot review gate requires exact Candidate, current Base, clean PR, seven checks, and same-identity PASS', () => {
  const fixture = candidateState();
  const result = assertC02CandidateReviewGate(fixture.status, fixture.pr, {
    sourceRevision: candidateSha,
    currentBaseSha: baseSha,
    gitTextFn: (...args) => args[0] === 'rev-parse' ? candidateSha : '',
  });
  assert.equal(result.candidateSha, candidateSha);
  assert.equal(result.baseSha, baseSha);
  assert.equal(result.prNumber, 201);
  assert.equal(result.reviewerId, reviewerId);

  const differentRound = structuredClone(fixture.status);
  differentRound.epoch.state.review_history.push({
    ...differentRound.epoch.state.review_history[0],
    review_number: 2,
    reviewer_id: 'gpt-6-luna-max-run95-pr201-round2',
  });
  assert.throws(() => assertC02CandidateReviewGate(differentRound, fixture.pr, {
    sourceRevision: candidateSha, currentBaseSha: baseSha, gitTextFn: (...args) => args[0] === 'rev-parse' ? candidateSha : '',
  }));

  const wrongReview = structuredClone(fixture.status);
  wrongReview.epoch.state.review_history[0].reviewer_id = 'gpt-6-sol-run95-pr201-round1';
  assert.throws(() => assertC02CandidateReviewGate(wrongReview, fixture.pr, {
    sourceRevision: candidateSha, currentBaseSha: baseSha, gitTextFn: (...args) => args[0] === 'rev-parse' ? candidateSha : '',
  }));

  const stalePr = { ...fixture.pr, headRefOid: 'f'.repeat(40) };
  assert.throws(() => assertC02CandidateReviewGate(fixture.status, stalePr, {
    sourceRevision: candidateSha, currentBaseSha: baseSha, gitTextFn: (...args) => args[0] === 'rev-parse' ? candidateSha : '',
  }));
});

test('C02 server summary binds exact catalog, tool schema, arguments, bundle, and privacy boundary', () => {
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === PROFILE.toolName);
  const summary = {
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision: candidateSha,
    bundleSha256: bundleSha,
    catalogSha256: sha256(catalogBytes),
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedArgumentsSha256: sha256(canonicalAgentMcpProfileJson(PROFILE.calls[0].arguments)),
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    result: { resultState: 'complete' },
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    privacy: {
      authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false, writesAttempted: false,
      communityRead: false, qqPipelineTested: false, timClientTested: false, rawResultStored: false,
      credentialsStored: false,
    },
  };
  assert.equal(validateC02ServerSummary(summary, candidateSha, bundleSha), true);
  assert.equal(validateC02ServerSummary({ ...summary, allowedCallCount: 2 }, candidateSha, bundleSha), false);
  assert.equal(validateC02ServerSummary({ ...summary, privacy: { ...summary.privacy, oauthAttempted: true } }, candidateSha, bundleSha), false);
});
