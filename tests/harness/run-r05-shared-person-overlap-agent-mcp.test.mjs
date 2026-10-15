import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { summarizeR05SubjectOverlapToolResult } from '../../scripts/lib/r05-shared-person-overlap-evidence.mjs';
import {
  assertR05CandidateReviewGate,
  buildR05CodexExecArgs,
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
