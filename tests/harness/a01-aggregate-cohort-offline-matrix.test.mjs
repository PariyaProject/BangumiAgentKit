import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
  normalizeAgentMcpProfileDiagnostics,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
  A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID,
  A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS,
  A01_AGGREGATE_COHORT_OFFLINE_V2_EPOCH_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
  A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS,
  A01_AGGREGATE_COHORT_OFFLINE_V3_EPOCH_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE,
  A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
  A01_AGGREGATE_COHORT_TOOL,
  assertA01AggregateCohortOfflineProfile,
  createA01AggregateCohortOfflineFetch,
} from '../../scripts/lib/a01-aggregate-cohort-offline-matrix-profile.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  a01CodexSpawnFacts,
  buildA01AggregateDiagnostics,
  buildCodexExecArgs,
  classifyA01AggregateFailure,
  parseA01AggregateCohortRunnerArgs,
  readA01ClaimOrThrowConfirmedId,
  runA01AggregateCohortOfflineAgentMcpForTest,
} from '../../scripts/acceptance/run-a01-aggregate-cohort-offline-agent-mcp.mjs';

const candidateSha = 'a'.repeat(40);
const bundleSha256 = 'b'.repeat(64);

test('A01 aggregate matrix profile is unique, exact, and matrix-only', () => {
  const profile = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID);
  assert.ok(profile);
  assert.equal(profile.frontierId, 'A01');
  assert.equal(profile.epochId, A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID);
  assert.equal(profile.toolName, A01_AGGREGATE_COHORT_TOOL);
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.networkMode, A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE);
  assert.equal(profile.calls.length, 1);
  assert.deepEqual(profile.calls[0], {
    toolName: A01_AGGREGATE_COHORT_TOOL,
    arguments: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
  });
  assert.equal(agentMcpProfileArgumentsSha256(profile).length, 64);
  assert.equal(assertA01AggregateCohortOfflineProfile(profile), true);
  assert.throws(() =>
    assertA01AggregateCohortOfflineProfile({ ...profile, epochId: 'old-a01-epoch' }),
  );
  assert.throws(() =>
    assertA01AggregateCohortOfflineProfile({
      ...profile,
      acceptanceScope: 'agent-mcp-scenario-and-matrix',
    }),
  );
  assert.throws(() =>
    assertA01AggregateCohortOfflineProfile({
      ...profile,
      calls: [
        {
          toolName: A01_AGGREGATE_COHORT_TOOL,
          arguments: { ...A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS, maxSubjects: 2 },
        },
      ],
    }),
  );
});

test('A01 aggregate matrix v2 is distinct from the spent v1 input and fixture', () => {
  const profile = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  const v1 = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID);
  assert.ok(profile);
  assert.equal(profile.frontierId, 'A01');
  assert.equal(profile.epochId, A01_AGGREGATE_COHORT_OFFLINE_V2_EPOCH_ID);
  assert.equal(profile.toolName, A01_AGGREGATE_COHORT_TOOL);
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.networkMode, A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(profile.calls[0].arguments, A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS);
  assert.notEqual(profile.id, v1.id);
  assert.notDeepEqual(profile.calls[0].arguments, v1.calls[0].arguments);
  assert.equal(assertA01AggregateCohortOfflineProfile(profile), true);
  assert.throws(() =>
    assertA01AggregateCohortOfflineProfile({
      ...profile,
      calls: [
        {
          ...profile.calls[0],
          arguments: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
        },
      ],
    }),
  );
});

test('A01 aggregate matrix v3 is fresh from both terminal profiles and matrix-only', () => {
  const profile = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID);
  const v1 = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID);
  const v2 = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  assert.ok(profile);
  assert.equal(profile.frontierId, 'A01');
  assert.equal(profile.epochId, A01_AGGREGATE_COHORT_OFFLINE_V3_EPOCH_ID);
  assert.equal(profile.toolName, A01_AGGREGATE_COHORT_TOOL);
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.networkMode, A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE);
  assert.equal(
    A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE,
    A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
  );
  assert.deepEqual(profile.calls[0].arguments, A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS);
  assert.notEqual(profile.id, v1.id);
  assert.notEqual(profile.id, v2.id);
  assert.notDeepEqual(profile.calls[0].arguments, v1.calls[0].arguments);
  assert.notDeepEqual(profile.calls[0].arguments, v2.calls[0].arguments);
  assert.equal(assertA01AggregateCohortOfflineProfile(profile), true);
  assert.throws(() =>
    assertA01AggregateCohortOfflineProfile({
      ...profile,
      calls: [
        { ...profile.calls[0], arguments: A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS },
      ],
    }),
  );
});

test('registered MCP arguments select only the exact offline profile and reject overrides', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    '--summary-file',
    '/tmp/a01-aggregate-summary.json',
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.toolNames, [A01_AGGREGATE_COHORT_TOOL]);
  assert.deepEqual(config.expectedToolSequence, [A01_AGGREGATE_COHORT_TOOL]);
  assert.deepEqual(config.expectedArgumentSequence, [A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS]);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
      '--network-mode',
      A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
      '--summary-file',
      '/tmp/a01-aggregate-summary.json',
      '--candidate-sha',
      candidateSha,
      '--bundle-sha256',
      bundleSha256,
    ]),
  );
});

test('registered MCP arguments select the distinct v2 mode and inputs', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    '--summary-file',
    '/tmp/a01-aggregate-summary-v2.json',
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.toolNames, [A01_AGGREGATE_COHORT_TOOL]);
  assert.deepEqual(config.expectedArgumentSequence, [
    A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS,
  ]);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
      '--network-mode',
      A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
      '--summary-file',
      '/tmp/a01-aggregate-summary-v2.json',
      '--candidate-sha',
      candidateSha,
      '--bundle-sha256',
      bundleSha256,
    ]),
  );
});

test('registered MCP arguments select fresh v3 inputs over the bounded v2 transport', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
    '--summary-file',
    '/tmp/a01-aggregate-summary-v3.json',
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE);
  assert.deepEqual(config.toolNames, [A01_AGGREGATE_COHORT_TOOL]);
  assert.deepEqual(config.expectedArgumentSequence, [
    A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS,
  ]);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
      '--network-mode',
      A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE,
      '--summary-file',
      '/tmp/a01-aggregate-summary-v3.json',
      '--candidate-sha',
      candidateSha,
      '--bundle-sha256',
      bundleSha256,
    ]),
  );
});

test('offline fixture serves exactly one anonymous synthetic search and detail response', async () => {
  const fixture = createA01AggregateCohortOfflineFetch();
  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(search.status, 200);
  const searchBody = await search.json();
  assert.equal(searchBody.data.length, 1);
  assert.equal(searchBody.data[0].id, 990184);

  const detail = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184');
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).rating.total, 10);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    requestCount: 2,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('offline v2 fixture serves only the new synthetic input and subject', async () => {
  const fixture = createA01AggregateCohortOfflineFetch(A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  const v1Input = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(v1Input.status, 599);
  assert.equal(fixture.snapshot().searchRequestCount, 0);

  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).data[0].id, 991219);
  const detail = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/991219');
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.score, 6.5);
  assert.equal(detailBody.collection.collect, 61);
  assert.equal(detailBody.eps, 10);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    requestCount: 3,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 1,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('offline v3 fixture rejects v1/v2 inputs and serves only its fresh synthetic subject', async () => {
  const fixture = createA01AggregateCohortOfflineFetch(A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID);
  for (const profile of [
    A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
    A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS,
  ]) {
    const rejected = await fixture.fetchFn(
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keyword: profile.cohort.query.keyword,
          sort: 'match',
          filter: { type: [2] },
        }),
      },
    );
    assert.equal(rejected.status, 599);
  }
  assert.equal(fixture.snapshot().searchRequestCount, 0);

  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).data[0].id, 991220);
  const detail = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/991220');
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.score, 7);
  assert.equal(detailBody.collection.collect, 80);
  assert.equal(detailBody.eps, 12);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
    requestCount: 4,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 2,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('offline fixture rejects credentials, repeated calls, and unregistered requests', async () => {
  const fixture = createA01AggregateCohortOfflineFetch();
  const auth = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184', {
    headers: { authorization: 'Bearer synthetic-test-only' },
  });
  assert.equal(auth.status, 599);
  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(search.status, 200);
  const allowed = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184');
  assert.equal(allowed.status, 200);
  const repeated = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184');
  assert.equal(repeated.status, 599);
  const badOrigin = await fixture.fetchFn('https://example.invalid/v0/subjects/990184');
  assert.equal(badOrigin.status, 599);
  const credentialedUrl = await fixture.fetchFn(
    'https://synthetic-user:synthetic-password@api.bgm.tv/v0/subjects/990184',
  );
  assert.equal(credentialedUrl.status, 599);
  const cookieHeader = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184', {
    headers: { cookie: 'synthetic-cookie' },
  });
  assert.equal(cookieHeader.status, 599);
  assert.equal(fixture.snapshot().unexpectedRequestCount, 5);
  const proxyAuthorizationHeader = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184', {
    headers: { 'proxy-authorization': 'Bearer synthetic-proxy-only' },
  });
  assert.equal(proxyAuthorizationHeader.status, 599);
  assert.equal(fixture.snapshot().unexpectedRequestCount, 6);
  const apiKeyHeader = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990184', {
    headers: { 'x-api-key': 'synthetic-api-key-only' },
  });
  assert.equal(apiKeyHeader.status, 599);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    requestCount: 9,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 7,
    authorizationHeaderCount: 1,
    expectedOperationsComplete: true,
  });
});

test('Agent result projection is bounded and contains no synthetic row identity or text', () => {
  const summary = summarizeProfileToolResult(
    {
      state: 'complete',
      cohorts: [
        {
          subjects: [{ id: 990184, title: 'Synthetic Aggregate Matrix Subject' }],
          coverage: {
            query: { state: 'ok' },
            detailHydrationsAttempted: 1,
            detailHydrationsSucceeded: 1,
            detailHydrationsFailed: 0,
          },
        },
      ],
      metrics: [
        {
          key: 'score',
          state: 'complete',
          averages: [7],
          validCounts: [1],
          partialCounts: [0],
          missingCounts: [0],
          conflictCounts: [0],
          notComputableCounts: [0],
        },
      ],
      coverage: {
        maxSubjectsPerCohort: 1,
        totalSubjectsReturned: 1,
        cohortsComplete: 1,
        cohortsPartial: 0,
        detailHydrationsAttempted: 1,
        detailHydrationsSucceeded: 1,
        detailHydrationsFailed: 0,
        truncated: false,
      },
    },
    A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
    A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    null,
    A01_AGGREGATE_COHORT_TOOL,
  );
  const encoded = JSON.stringify(summary);
  assert.equal(summary.resultState, 'complete');
  assert.equal(summary.metrics[0].averages[0], 7);
  assert.equal(encoded.includes('990184'), false);
  assert.equal(encoded.includes('Synthetic Aggregate Matrix Subject'), false);
  assert.equal(encoded.includes('subjects'), false);

  const repeatedMetric = {
    key: 'score',
    state: 'complete',
    averages: [7, 8],
    partialAverages: [],
    validCounts: [1, 2, 3],
    partialCounts: [0],
    missingCounts: [0],
    conflictCounts: [0],
    notComputableCounts: [0],
  };
  const expanded = summarizeProfileToolResult(
    {
      state: 'complete',
      cohorts: [
        { subjects: [], coverage: { query: { state: 'ok' } } },
        { subjects: [], coverage: { query: { state: 'ok' } } },
      ],
      metrics: Array.from({ length: 5 }, () => repeatedMetric),
      coverage: { truncated: false },
    },
    A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
    A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    null,
    A01_AGGREGATE_COHORT_TOOL,
  );
  assert.equal(expanded.cohortCount, 2);
  assert.equal(expanded.cohorts.length, 2);
  assert.equal(expanded.metricCount, 5);
  assert.equal(expanded.metrics.length, 5);
  assert.deepEqual(expanded.metrics[0].averages, [7, 8]);
  assert.deepEqual(expanded.metrics[0].validCounts, [1, 2]);
});

test('runner is Run #95/PR-bound, exposes one tool, and disables general capabilities', () => {
  assert.deepEqual(parseA01AggregateCohortRunnerArgs(['--run', '95', '--pr', '231']), {
    runNumber: 95,
    prNumber: 231,
    profileId: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  });
  assert.deepEqual(
    parseA01AggregateCohortRunnerArgs([
      '--run',
      '95',
      '--pr',
      '231',
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    ]),
    {
      runNumber: 95,
      prNumber: 231,
      profileId: A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    },
  );
  assert.deepEqual(parseA01AggregateCohortRunnerArgs(['--help']), { help: true });
  assert.throws(() => parseA01AggregateCohortRunnerArgs(['--run', '94', '--pr', '231']));
  const args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    summaryPath: '/tmp/summary.json',
    candidateSha,
    bundleSha256,
  });
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--approve-for-me'));
  assert.equal(args.includes('--sandbox'), false);
  const config = args.flatMap((value, index) => (value === '--config' ? [args[index + 1]] : []));
  assert.ok(config.includes('features.shell_tool=false'));
  assert.ok(config.includes('features.browser_use=false'));
  assert.ok(config.includes('features.computer_use=false'));
  assert.ok(config.includes('features.apps=false'));
  assert.ok(config.includes('features.multi_agent=false'));
  assert.ok(
    config.includes(
      'mcp_servers.bgk_a01_aggregate_cohort_offline.enabled_tools=["bangumi.aggregate_subject_cohort"]',
    ),
  );
  const v2Args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    summaryPath: '/tmp/summary-v2.json',
    candidateSha,
    bundleSha256,
    profileId: A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
  });
  assert.ok(
    v2Args.at(-1).includes(A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS.cohort.query.keyword),
  );
  assert.ok(v2Args.some((value) => value.includes(A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID)));
  const v3Args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    summaryPath: '/tmp/summary-v3.json',
    candidateSha,
    bundleSha256,
    profileId: A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
  });
  assert.ok(
    v3Args.at(-1).includes(A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS.cohort.query.keyword),
  );
  assert.ok(v3Args.some((value) => value.includes(A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID)));
  assert.ok(v3Args.some((value) => value.includes('"average":90')));
});

test('claim readback failure retains the confirmed claim id without retaining the readback error', () => {
  const confirmedClaimId = `profile-run-95-pr-218-${candidateSha.slice(0, 12)}-123`;
  const recoveredClaim = { claimId: confirmedClaimId, prNumber: 218 };
  assert.equal(
    readA01ClaimOrThrowConfirmedId(confirmedClaimId, () => recoveredClaim),
    recoveredClaim,
  );
  assert.throws(
    () =>
      readA01ClaimOrThrowConfirmedId(confirmedClaimId, () => {
        throw new Error('raw control-plane response body');
      }),
    (error) =>
      error.confirmedClaimId === confirmedClaimId &&
      error.message === 'A01 aggregate durable claim readback failed.',
  );
});

test('confirmed claim readback failure terminalizes without invoking Codex', () => {
  const confirmedClaimId = `profile-run-95-pr-218-${candidateSha.slice(0, 12)}-123`;
  const readbackError = Object.assign(new Error('durable readback failed'), {
    confirmedClaimId,
  });
  let readbackAttempts = 0;
  let codexInvocations = 0;
  const terminalResults = [];
  let output = '';
  let durableStatusReads = 0;
  const exitCode = runA01AggregateCohortOfflineAgentMcpForTest({
    prNumber: 218,
    dependencies: {
      gitText(args) {
        return args[0] === 'status' ? '' : candidateSha;
      },
      reportExists: () => false,
      assertCurrentGate: () => ({
        candidateSha,
        baseSha: 'c'.repeat(40),
        reviewerId: 'gpt-6-luna-max-run95-pr218-round1',
        prNumber: 218,
      }),
      codexVersion: () => '1.2.14',
      buildExactCandidateBundle: () => bundleSha256,
      currentCandidateBundleMatches: () => true,
      claimProfile() {
        readbackAttempts += 1;
        throw readbackError;
      },
      recoverClaim() {
        readbackAttempts += 1;
        return null;
      },
      durableClaimStatus() {
        durableStatusReads += 1;
        return durableStatusReads === 1 ? { state: 'UNCLAIMED' } : null;
      },
      invokeCodex() {
        codexInvocations += 1;
        throw new Error('Codex must not be invoked before claim readback.');
      },
      terminalResult(claim, state, diagnostics) {
        terminalResults.push({ claim, state, diagnostics });
        return true;
      },
      writeOutput(value) {
        output += value;
      },
    },
  });

  assert.equal(readbackAttempts, 2);
  assert.equal(codexInvocations, 0);
  assert.equal(exitCode, 1);
  assert.equal(terminalResults.length, 1);
  assert.deepEqual(terminalResults[0].claim, { claimId: confirmedClaimId, prNumber: 218 });
  assert.equal(terminalResults[0].state, 'INCONCLUSIVE');
  assert.equal(
    terminalResults[0].diagnostics.reasonCode,
    'A01_AGGREGATE_MATRIX_CLAIM_READBACK_FAILED',
  );
  assert.equal(terminalResults[0].diagnostics.checks.invocationAttempted, false);
  assert.equal(terminalResults[0].diagnostics.checks.claimReadbackValid, false);
  assert.equal(JSON.parse(output).state, 'INCONCLUSIVE');
  assert.equal(JSON.parse(output).retryAllowed, false);
});

test('lost claim response with a failed first readback reconciles an ambiguous latch without retry or invocation', () => {
  let claimAttempts = 0;
  let readbackAttempts = 0;
  let latchStatusReads = 0;
  let reconciliationAttempts = 0;
  let codexInvocations = 0;
  let output = '';
  const exitCode = runA01AggregateCohortOfflineAgentMcpForTest({
    prNumber: 218,
    dependencies: {
      gitText(args) {
        return args[0] === 'status' ? '' : candidateSha;
      },
      reportExists: () => false,
      assertCurrentGate: () => ({
        candidateSha,
        baseSha: 'c'.repeat(40),
        reviewerId: 'gpt-6-luna-max-run95-pr218-round1',
        prNumber: 218,
      }),
      durableClaimStatus() {
        latchStatusReads += 1;
        return { state: latchStatusReads === 1 ? 'UNCLAIMED' : 'AMBIGUOUS' };
      },
      reconcileAmbiguousLatch(prNumber) {
        reconciliationAttempts += 1;
        assert.equal(prNumber, 218);
        return {
          state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED',
          profileId: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
          resultState: 'INCONCLUSIVE',
          retryAllowed: false,
        };
      },
      codexVersion: () => '1.2.14',
      buildExactCandidateBundle: () => bundleSha256,
      currentCandidateBundleMatches: () => true,
      claimProfile() {
        claimAttempts += 1;
        throw new Error('Harness claim response lost after latch acquisition');
      },
      recoverClaim() {
        readbackAttempts += 1;
        throw new Error('first status readback unavailable');
      },
      invokeCodex() {
        codexInvocations += 1;
        throw new Error('Codex must not run after an ambiguous claim response.');
      },
      writeOutput(value) {
        output += value;
      },
    },
  });

  assert.equal(claimAttempts, 1);
  assert.equal(readbackAttempts, 1);
  assert.equal(latchStatusReads, 2);
  assert.equal(reconciliationAttempts, 1);
  assert.equal(codexInvocations, 0);
  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(output), {
    passed: false,
    state: 'INCONCLUSIVE',
    profileId: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    reasonCode: 'A01_AGGREGATE_MATRIX_AMBIGUOUS_LATCH_RECONCILED',
    invocationState: 'UNKNOWN',
    retryAllowed: false,
  });
});

test('startup reconciles an ambiguous A01 latch before the initial candidate gate', () => {
  let candidateGateChecks = 0;
  let claimAttempts = 0;
  let reconciliationAttempts = 0;
  let codexInvocations = 0;
  let output = '';
  const exitCode = runA01AggregateCohortOfflineAgentMcpForTest({
    prNumber: 218,
    dependencies: {
      gitText(args) {
        return args[0] === 'status' ? '' : candidateSha;
      },
      reportExists: () => false,
      durableClaimStatus: () => ({ state: 'AMBIGUOUS' }),
      reconcileAmbiguousLatch() {
        reconciliationAttempts += 1;
        return {
          state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED',
          profileId: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
          resultState: 'INCONCLUSIVE',
          retryAllowed: false,
        };
      },
      assertCurrentGate() {
        candidateGateChecks += 1;
        throw new Error('Candidate gate must not run after finding an ambiguous latch.');
      },
      claimProfile() {
        claimAttempts += 1;
        throw new Error('The profile may not be claimed again.');
      },
      invokeCodex() {
        codexInvocations += 1;
        throw new Error('Codex must not be invoked during ambiguous-latch recovery.');
      },
      writeOutput(value) {
        output += value;
      },
    },
  });

  assert.equal(candidateGateChecks, 0);
  assert.equal(claimAttempts, 0);
  assert.equal(reconciliationAttempts, 1);
  assert.equal(codexInvocations, 0);
  assert.equal(exitCode, 1);
  assert.equal(JSON.parse(output).state, 'INCONCLUSIVE');
  assert.equal(JSON.parse(output).retryAllowed, false);
});

test('recovered claim readback failure before Codex terminalizes without invoking Codex', () => {
  const confirmedClaimId = `profile-run-95-pr-218-${candidateSha.slice(0, 12)}-124`;
  const reviewerId = 'gpt-6-luna-max-run95-pr218-round1';
  let gateChecks = 0;
  let durableStatusReads = 0;
  let codexInvocations = 0;
  const terminalResults = [];
  let output = '';
  const exitCode = runA01AggregateCohortOfflineAgentMcpForTest({
    prNumber: 218,
    dependencies: {
      gitText(args) {
        return args[0] === 'status' ? '' : candidateSha;
      },
      reportExists: () => false,
      assertCurrentGate(_prNumber, _candidate, { allowClaimed = false } = {}) {
        gateChecks += 1;
        if (allowClaimed) throw new Error('durable profile readback unavailable');
        return { candidateSha, baseSha: 'c'.repeat(40), reviewerId, prNumber: 218 };
      },
      codexVersion: () => '1.2.14',
      buildExactCandidateBundle: () => bundleSha256,
      currentCandidateBundleMatches: () => true,
      claimProfile(_gate, _bundle, keyPair) {
        return {
          claimId: confirmedClaimId,
          prNumber: 218,
          baseSha: 'c'.repeat(40),
          reviewerId,
          runnerReceiptPublicKey: keyPair.publicKey
            .export({ format: 'der', type: 'spki' })
            .toString('base64'),
        };
      },
      recoverClaim: () => null,
      durableClaimStatus() {
        durableStatusReads += 1;
        if (durableStatusReads === 1) return { state: 'UNCLAIMED' };
        throw new Error('durable profile readback unavailable');
      },
      invokeCodex() {
        codexInvocations += 1;
        throw new Error('Codex must not be invoked when claim state is not re-established.');
      },
      terminalResult(claim, state, diagnostics) {
        terminalResults.push({ claim, state, diagnostics });
        return true;
      },
      writeOutput(value) {
        output += value;
      },
    },
  });

  assert.equal(gateChecks, 3);
  assert.equal(codexInvocations, 0);
  assert.equal(exitCode, 1);
  assert.equal(terminalResults.length, 1);
  assert.equal(terminalResults[0].claim.claimId, confirmedClaimId);
  assert.equal(terminalResults[0].state, 'INCONCLUSIVE');
  assert.equal(
    terminalResults[0].diagnostics.reasonCode,
    'A01_AGGREGATE_MATRIX_CLAIM_READBACK_FAILED',
  );
  assert.equal(JSON.parse(output).reasonCode, 'A01_AGGREGATE_MATRIX_CLAIM_READBACK_FAILED');
  assert.equal(JSON.parse(output).retryAllowed, false);
});

test('Codex spawn facts distinguish invocation, spawn failure, timeout, and output limits', () => {
  assert.deepEqual(a01CodexSpawnFacts({ pid: 123, status: 0 }), {
    invocationAttempted: true,
    processSpawned: true,
    processTimedOut: false,
    outputLimitExceeded: false,
  });
  assert.deepEqual(
    a01CodexSpawnFacts({ pid: undefined, status: null, error: { code: 'ENOENT' } }),
    {
      invocationAttempted: true,
      processSpawned: false,
      processTimedOut: false,
      outputLimitExceeded: false,
    },
  );
  assert.deepEqual(a01CodexSpawnFacts({ pid: 123, status: null, error: { code: 'ETIMEDOUT' } }), {
    invocationAttempted: true,
    processSpawned: true,
    processTimedOut: true,
    outputLimitExceeded: false,
  });
  assert.deepEqual(
    a01CodexSpawnFacts({
      pid: 123,
      status: null,
      error: { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' },
    }),
    {
      invocationAttempted: true,
      processSpawned: true,
      processTimedOut: false,
      outputLimitExceeded: true,
    },
  );
});

test('failure reason codes distinguish process, stream, MCP, answer, and postrun gates', () => {
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: true, processSpawned: true, processTimedOut: true },
      {},
      {},
      {},
      true,
    ),
    'A01_AGGREGATE_MATRIX_CLI_TIMED_OUT',
  );
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: true, processSpawned: false, processTimedOut: false, exitCode: null },
      {},
      {},
      {},
      true,
    ),
    'A01_AGGREGATE_MATRIX_CLI_SPAWN_FAILED',
  );
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: false, processSpawned: false, processTimedOut: false, exitCode: null },
      {},
      {},
      {},
      true,
    ),
    'A01_AGGREGATE_MATRIX_PREINVOCATION_GATE_FAILED',
  );
  assert.equal(
    classifyA01AggregateFailure(
      {
        invocationAttempted: true,
        processSpawned: true,
        processTimedOut: false,
        outputLimitExceeded: true,
        exitCode: null,
      },
      {},
      {},
      {},
      true,
    ),
    'A01_AGGREGATE_MATRIX_CLI_OUTPUT_LIMIT_EXCEEDED',
  );
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: true, processSpawned: true, processTimedOut: false, exitCode: 0 },
      { parsed: false },
      {},
      {},
      true,
    ),
    'A01_AGGREGATE_MATRIX_EVENT_STREAM_INCOMPLETE',
  );
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: true, processSpawned: true, processTimedOut: false, exitCode: 0 },
      { parsed: true },
      { eventStreamComplete: true, codexMcpToolEventCount: 0 },
      { serverSummaryValid: false },
      true,
    ),
    'A01_AGGREGATE_MATRIX_MCP_RESULT_INVALID',
  );
  assert.equal(
    classifyA01AggregateFailure(
      { invocationAttempted: true, processSpawned: true, processTimedOut: false, exitCode: 0 },
      { parsed: true },
      { eventStreamComplete: true, codexMcpToolEventCount: 1 },
      { serverSummaryValid: true, answerChecks: { exactMetricAndCoverageAnswer: false } },
      true,
    ),
    'A01_AGGREGATE_MATRIX_ANSWER_INVALID',
  );
});

test('A01 terminal diagnostics preserve only allowlisted checks and bounded counters', () => {
  const diagnostics = buildA01AggregateDiagnostics(
    {
      invocationAttempted: true,
      outputLimitExceeded: false,
      processSpawned: true,
      processTimedOut: false,
      failed: false,
      exitCode: 0,
      stdoutBytes: 588,
      stderrBytes: 771,
    },
    { parsed: true },
    {
      eventStreamComplete: true,
      turnCompleted: true,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 3,
      mcpToolErrorResultCount: 0,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
    },
    {
      fixedArguments: false,
      singleToolInvocation: false,
      structuredResultReadback: false,
      serverSummaryValid: true,
      answerChecks: { exactMetricAndCoverageAnswer: false },
      answerUtf8Bytes: 588,
      candidateBundleCurrent: true,
      activeGateCurrent: true,
      claimReadbackValid: true,
      reportBuildValid: false,
      runnerReceiptValid: false,
      privacyPreserved: true,
    },
    'A01_AGGREGATE_MATRIX_ANSWER_INVALID',
  );

  assert.deepEqual(Object.keys(diagnostics).sort(), [
    'checks',
    'counters',
    'reasonCode',
    'schemaVersion',
  ]);
  assert.equal(diagnostics.reasonCode, 'A01_AGGREGATE_MATRIX_ANSWER_INVALID');
  assert.equal(diagnostics.checks.exactCallSequence, false);
  assert.equal(diagnostics.checks.structuredReadback, false);
  assert.equal(diagnostics.counters.codexMcpToolEvents, 1);
  assert.equal(diagnostics.counters.codexErrorItems, 3);
  assert.equal(diagnostics.counters.answerUtf8Bytes, 588);
  assert.ok(Object.values(diagnostics.checks).every((value) => typeof value === 'boolean'));
  assert.ok(
    Object.values(diagnostics.counters).every(
      (value) => value === null || Number.isSafeInteger(value),
    ),
  );
  assert.deepEqual(normalizeAgentMcpProfileDiagnostics(diagnostics), diagnostics);
});
