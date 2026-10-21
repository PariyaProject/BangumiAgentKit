import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildS01CodexExecArgs,
  validateS01RunnerArgs,
  validateS01ServerSummary,
} from '../../scripts/acceptance/run-s01-annual-tv-voice-agent-mcp.mjs';
import {
  agentMcpProfileArgumentsSha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  S01_NETWORK_MODE,
  S01_PROFILE_ID,
  createS01AnnualTvPublicFetch,
  summarizeS01AnnualTvVoiceResult,
} from '../../scripts/lib/s01-annual-tv-voice-activity-profile.mjs';
import {
  codexOneToolMcpServerProfileForNetworkMode,
  parseCodexOneToolMcpArguments,
} from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const profile = getAgentMcpProfileById(S01_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function resultFixture() {
  return {
    personId: 5745,
    kind: 'voice',
    media: 'tv',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-11-01',
      end: '2026-10-21',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [{ subjectId: 51, subjectName: 'private fixture title' }, {}, {}, {}],
    summary: {
      creditRows: 4,
      uniqueSubjects: 4,
      uniqueCharacters: 4,
      byYear: [
        { year: 2023, start: '2023-11-01', end: '2023-12-31', creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 1 },
        { year: 2024, start: '2024-01-01', end: '2024-12-31', creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
        { year: 2025, start: '2025-01-01', end: '2025-12-31', creditRows: 2, uniqueSubjects: 2, uniqueCharacters: 2 },
        { year: 2026, start: '2026-01-01', end: '2026-10-21', creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 1 },
      ],
    },
    coverage: {
      relationRowsObserved: 52,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 4,
      relationSelectionStrategy: 'deterministic_even_spread',
      sampled: true,
      subjectIdsObserved: 4,
      subjectIdsSelected: 4,
      subjectIdsDroppedAtRelationLimit: 0,
      subjectDetailIdsObserved: 4,
      subjectDetailRequests: 4,
      subjectDetailsSucceeded: 4,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 4,
      rowsReturned: 4,
      outputTruncated: false,
      uniqueSubjects: 4,
      uniqueCharacters: 4,
      missingSubjectIdRows: 0,
      missingDateRows: 0,
      invalidDateRows: 0,
      maxRelations: 48,
      maxSubjectDetails: 16,
      maxRows: 8,
      truncated: true,
      retrievedAt: '2026-10-21T00:00:00.000Z',
    },
  };
}

function requestScope() {
  return {
    requestCount: 6,
    allowedRequestCount: 6,
    deniedRequestCount: 0,
    personDetailRequestCount: 1,
    characterRelationRequestCount: 1,
    subjectDetailRequestCount: 4,
    duplicateSubjectDetailCount: 0,
    credentialHeaderCount: 0,
    credentialModeCount: 0,
    forbiddenHeaderCount: 0,
    authorizationHeaderCount: 0,
    writeAttemptCount: 0,
    unexpectedRouteCount: 0,
    sequenceMismatchCount: 0,
    responseValidationFailureCount: 0,
    redirectResponseCount: 0,
    maxRequests: 18,
    maxSubjectDetails: 16,
    requestsWithinLimit: true,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  };
}

test('S01 runner accepts only the fixed Run 95 entry point', () => {
  assert.equal(validateS01RunnerArgs(['--help']), 'help');
  assert.equal(validateS01RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateS01RunnerArgs([]));
  assert.throws(() => validateS01RunnerArgs(['--run', '94']));
  assert.throws(() => validateS01RunnerArgs(['--run', '95', '--retry']));
});

test('S01 Codex config is ephemeral/read-only and exposes exactly its fixed MCP tool', () => {
  const args = buildS01CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/s01-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('mcp_servers.bgk_s01_annual_tv_voice.enabled_tools=["bangumi.get_person_activity"]'));
  for (const disabled of [
    'features.shell_tool=false',
    'features.browser_use=false',
    'features.computer_use=false',
    'features.multi_agent=false',
    'features.web_search=false',
  ]) {
    assert.ok(args.includes(disabled), `missing ${disabled}`);
  }
  assert.equal((args.at(-1).match(/Call its sole tool/g) ?? []).length, 1);
  assert.ok(args.at(-1).includes('uniqueSubjects'));
  assert.ok(args.at(-1).includes('partial zero means no work'));
});

test('S01 registered network mode is public-only and locks the profile in the one-tool parser', () => {
  const parsed = parseCodexOneToolMcpArguments([
    '--profile-id', profile.id,
    '--summary-file', '/tmp/s01-summary.json',
    '--candidate-sha', 'a'.repeat(40),
    '--bundle-sha256', 'b'.repeat(64),
  ]);
  assert.equal(parsed.networkMode, S01_NETWORK_MODE);
  assert.equal(parsed.toolName, 'bangumi.get_person_activity');
  assert.equal(parsed.expectedArgumentSequence.length, 1);
  assert.deepEqual(parsed.expectedArgumentSequence[0], profile.calls[0].arguments);
  assert.equal(
    codexOneToolMcpServerProfileForNetworkMode(S01_NETWORK_MODE),
    'closed-profile-sequence-anonymous-public-v1',
  );
});

test('S01 server summary binds annual counts, safe request counters, and the current catalog', () => {
  const raw = resultFixture();
  const resultSummary = summarizeS01AnnualTvVoiceResult(raw, profile.calls[0].arguments);
  assert.ok(resultSummary);
  assert.equal(JSON.stringify(resultSummary).includes('private fixture title'), false);
  assert.equal(JSON.stringify(resultSummary).includes('subjectId'), false);
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    toolName: profile.toolName,
    serverToolCount: 1,
    serverToolNames: [profile.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    publicRequestScope: requestScope(),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
  assert.equal(
    validateS01ServerSummary(summary, summary.sourceRevision, summary.bundleSha256),
    true,
  );
  const alteredCount = structuredClone(summary);
  alteredCount.results[0].resultSummary.annualObservedCounts[2].uniqueSubjects += 1;
  assert.equal(validateS01ServerSummary(alteredCount, summary.sourceRevision, summary.bundleSha256), false);
  const alteredRoute = structuredClone(summary);
  alteredRoute.publicRequestScope.unexpectedRouteCount = 1;
  assert.equal(validateS01ServerSummary(alteredRoute, summary.sourceRevision, summary.bundleSha256), false);
});

test('S01 profile summary dispatch retains no person or subject identifier', () => {
  const raw = resultFixture();
  const summary = summarizeProfileToolResult(raw, profile.calls[0].arguments, profile.id);
  assert.deepEqual(summary, summarizeS01AnnualTvVoiceResult(raw, profile.calls[0].arguments));
  assert.equal(Object.hasOwn(summary, 'rows'), false);
  assert.equal(JSON.stringify(summary).includes('private fixture title'), false);
  assert.equal(JSON.stringify(summary).includes('subjectId'), false);
  assert.equal(JSON.stringify(summary).includes('5745'), false);
});

test('S01 request fence never reports identifiers in its scope snapshot', async () => {
  const fetcher = createS01AnnualTvPublicFetch({
    fetchImpl: async (input) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      return url.pathname.endsWith('/characters')
        ? new Response(JSON.stringify([{ subject_id: 10 }]), { status: 200 })
        : new Response('{}', { status: 200 });
    },
  });
  const headers = {
    accept: 'application/json',
    'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
  };
  await fetcher.fetchFn('https://api.bgm.tv/v0/persons/5745', { method: 'GET', headers });
  await fetcher.fetchFn('https://api.bgm.tv/v0/persons/5745/characters', { method: 'GET', headers });
  await fetcher.fetchFn('https://api.bgm.tv/v0/subjects/10', { method: 'GET', headers });
  assert.equal(JSON.stringify(fetcher.snapshot()).includes('10'), false);
});
