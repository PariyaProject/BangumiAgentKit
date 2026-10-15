import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R05_COVERAGE_NOTE,
  summarizeR05SubjectOverlapToolResult,
} from '../../scripts/lib/r05-shared-person-overlap-evidence.mjs';
import {
  assertR05CandidateReviewGate,
  buildR05CodexExecArgs,
  buildR05CodexPrompt,
  classifyR05ProfileStart,
  isR05LiveClaim,
  validateR05RunnerArgs,
  validateR05ServerSummary,
} from '../../scripts/acceptance/run-r05-shared-person-overlap-agent-mcp.mjs';
import { makeR05OverlapToolResult } from './fixtures/r05-overlap-result.mjs';

const PROFILE = getAgentMcpProfileById('r05-k-on-season-shared-person-v1');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function serverSummary() {
  const raw = makeR05OverlapToolResult();
  const resultSummary = summarizeR05SubjectOverlapToolResult(raw, PROFILE.calls[0].arguments);
  const catalogBytes = readFileSync('docs/tool-catalog.json');
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === PROFILE.toolName);
  return {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'c'.repeat(64),
    toolName: PROFILE.toolName,
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
}

test('R05 runner accepts only Run 95 and configures one closed read-only server', () => {
  assert.equal(validateR05RunnerArgs(['--help']), 'help');
  assert.equal(validateR05RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR05RunnerArgs(['--run', '94']), /Pass --run 95/u);
  const args = buildR05CodexExecArgs({
    summaryPath: '/tmp/r05-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'c'.repeat(64),
  });
  assert.ok(args.includes('--sandbox') && args.includes('read-only'));
  assert.ok(args.some((arg) => arg.includes('mcp_servers.bgk_r05_overlap.enabled_tools')));
  assert.ok(args.some((arg) => arg.includes('features.shell_tool=false')));
  assert.ok(args.some((arg) => arg.includes('features.web_search=false')));
});

test('R05 prompt and answer validator share the exact coverage note', () => {
  const prompt = buildR05CodexPrompt();
  assert.ok(prompt.includes(`coverageNote exactly to: “${R05_COVERAGE_NOTE}”`));
  assert.equal(prompt.split(R05_COVERAGE_NOTE).length - 1, 1);
});

test('a second or restarted R05 runner leaves an unresolved live claim untouched', () => {
  const claim = {
    claimId: 'r05-claim-170',
    state: 'CLAIMED',
    retryAllowed: false,
    profileId: PROFILE.id,
    frontierId: 'R05',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 170,
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr170-round1',
    bundleSha256: 'c'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    runnerReceiptPublicKey: 'cHVibGljLWtleQ==',
  };
  const status = {
    state: 'CLAIMED',
    profile_id: PROFILE.id,
    run: 95,
    pr: 170,
    epoch_id: PROFILE.epochId,
    frontier_id: 'R05',
    tool_name: PROFILE.toolName,
    argument_profile: PROFILE.argumentProfile,
    call_count: 1,
    claim_label_present: true,
    terminal_label_present: false,
    retry_allowed: false,
    disposition: claim,
  };

  assert.equal(classifyR05ProfileStart(status, false), 'CLAIMED_UNRESOLVED');
  assert.equal(classifyR05ProfileStart(status, true), 'RECOVER_EXISTING_REPORT');
  assert.equal(isR05LiveClaim(status, claim), true);
  assert.equal(isR05LiveClaim({ ...status, terminal_label_present: true }, claim), false);
  assert.equal(
    isR05LiveClaim({ ...status, disposition: { ...claim, claimId: 'another-claim' } }, claim),
    false,
  );
});

test('R05 candidate gate fails closed when the live local Candidate or review is not exact', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  assert.throws(
    () =>
      assertR05CandidateReviewGate(
        {},
        {},
        {
          sourceRevision: head,
          currentBaseSha: 'b'.repeat(40),
        },
      ),
    /clean active exact Candidate/u,
  );
});

test('R05 server summary requires exact profile, one successful call, and a positive bound result', () => {
  const summary = serverSummary();
  assert.equal(validateR05ServerSummary(summary, 'a'.repeat(40), 'c'.repeat(64)), true);
  assert.equal(
    validateR05ServerSummary({ ...summary, allowedCallCount: 2 }, 'a'.repeat(40), 'c'.repeat(64)),
    false,
  );
  const noPositive = structuredClone(summary);
  noPositive.results[0].resultSummary.pair.cast.sharedPeople = [];
  assert.equal(validateR05ServerSummary(noPositive, 'a'.repeat(40), 'c'.repeat(64)), false);
  assert.equal(validateR05ServerSummary(summary, 'd'.repeat(40), 'c'.repeat(64)), false);
});
