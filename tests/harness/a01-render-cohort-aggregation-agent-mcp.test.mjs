import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS,
  A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE,
  A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
  A01_RENDER_COHORT_AGGREGATION_TOOL,
  A01_RENDER_COHORT_AGGREGATION_V2_EXPECTED_ARGUMENTS,
  A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE,
  A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
  assertA01RenderCohortAggregationOfflineProfile,
  createA01RenderCohortAggregationOfflineFetch,
  getA01RenderCohortAggregationOfflineProfileSpec,
} from '../../scripts/lib/a01-render-cohort-aggregation-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { buildA01RenderCohortAggregationCodexExecArgs } from '../../scripts/acceptance/run-a01-render-cohort-aggregation-agent-mcp.mjs';
import {
  buildA01RenderCohortAggregationProfileReport,
  validateA01RenderCohortAggregationProfileReport,
  validateA01RenderCohortAggregationProfileRun,
} from '../../scripts/acceptance/write-a01-render-cohort-aggregation-agent-mcp-report.mjs';
import { buildG06PrivacySummary } from '../../scripts/lib/g06-privacy-summary.mjs';

const candidateSha = 'a'.repeat(40);
const bundleSha256 = 'b'.repeat(64);
const summaryPath = '/tmp/a01-render-cohort-summary.json';
const serverSource = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function createValidA01RunInput(profileId = A01_RENDER_COHORT_AGGREGATION_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  const profileSpec = getA01RenderCohortAggregationOfflineProfileSpec(profileId);
  const serverId = profileSpec.serverId;
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBytes = keyPair.publicKey.export({ format: 'der', type: 'spki' });
  const publicKeyBase64 = publicKeyBytes.toString('base64');
  const sourceCandidateSha = candidateSha;
  const bundleSha256 = 'b'.repeat(64);
  const baseSha = 'c'.repeat(40);
  const reviewerId = 'gpt-6-luna-max-run95-pr123-round1';
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    runNumber: 95,
    frontierId: 'A01',
    epochId: profile.epochId,
    profileId: profile.id,
    claimId: 'profile-run-95-pr-123-abcdef123456-1730000000000',
    prNumber: 123,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    sourceCandidateSha,
    baseSha,
    ciSha: sourceCandidateSha,
    ciStatus: 'SUCCESS',
    reviewerId,
    bundleSha256,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyBytes),
    retryAllowed: false,
  };
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === A01_RENDER_COHORT_AGGREGATION_TOOL);
  const artifact = {
    returned: true,
    persisted: false,
    mimeType: 'image/png',
    width: 720,
    height: 1200,
    byteLength: 12000,
    sha256: 'd'.repeat(64),
    pngSignatureValid: true,
    decoded: true,
    dimensionsMatch: true,
  };
  const resultSummary = { resultState: 'artifact_returned', artifact };
  const offlineFixture = {
    profile: profileId,
    requestCount: 2,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  };
  const serverSummary = {
    schemaVersion: 1,
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedCallCount: 1,
    networkMode: profile.networkMode,
    sourceRevision: sourceCandidateSha,
    bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    offlineFixture,
    privacy: buildG06PrivacySummary(),
    serverInstanceId: '123e4567-e89b-12d3-a456-426614174000',
  };
  const answer = JSON.stringify({
    resultState: 'artifact_returned',
    mimeType: artifact.mimeType,
    width: artifact.width,
    height: artifact.height,
    pngSignatureValid: true,
    decoded: true,
    dimensionsMatch: true,
  });
  const call = {
    tool: profile.toolName,
    status: 'completed',
    arguments: profileSpec.expectedArguments,
    result: { isError: false, structuredContent: resultSummary },
  };
  const events = {
    eventStreamComplete: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [serverId],
    completedMcpCalls: [call],
    toolCalls: [{ name: profile.toolName, state: 'DONE' }],
  };
  return {
    keyPair,
    claim,
    serverSummary,
    events,
    completedMcpCalls: [call],
    answer,
    codexCliVersion: '1.2.3',
    processExitCode: 0,
    executionFailed: false,
    eventStreamParsed: true,
    serverId,
  };
}

test('A01 offline profile is registered for one exact matrix-only render call', () => {
  const profile = getAgentMcpProfileById(A01_RENDER_COHORT_AGGREGATION_PROFILE_ID);
  assert.ok(profile);
  assert.equal(profile.frontierId, 'A01');
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.networkMode, A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE);
  assert.equal(profile.calls.length, 1);
  assert.equal(profile.calls[0].toolName, A01_RENDER_COHORT_AGGREGATION_TOOL);
  assert.deepEqual(profile.calls[0].arguments, A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS);
  assert.equal(assertA01RenderCohortAggregationOfflineProfile(profile), true);
  assert.throws(() =>
    assertA01RenderCohortAggregationOfflineProfile({
      ...profile,
      calls: [
        {
          toolName: A01_RENDER_COHORT_AGGREGATION_TOOL,
          arguments: { ...A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS, maxSubjects: 2 },
        },
      ],
    }),
  );
});

test('v2 profile rejects the consumed v1 input and uses a distinct fixture', async () => {
  const profileV1 = getAgentMcpProfileById(A01_RENDER_COHORT_AGGREGATION_PROFILE_ID);
  const profileV2 = getAgentMcpProfileById(A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID);
  assert.ok(profileV2);
  assert.equal(profileV2.epochId, 'run95-a01-render-cohort-aggregation-offline-matrix-v2-20261022');
  assert.notEqual(profileV2.claimLabelName, profileV1.claimLabelName);
  assert.notEqual(profileV2.reportPath, profileV1.reportPath);
  assert.notDeepEqual(profileV2.calls[0].arguments, profileV1.calls[0].arguments);
  assert.equal(profileV2.networkMode, A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE);
  assert.equal(assertA01RenderCohortAggregationOfflineProfile(profileV2), true);
  assert.throws(() =>
    assertA01RenderCohortAggregationOfflineProfile({
      ...profileV2,
      calls: [{ toolName: profileV2.toolName, arguments: profileV1.calls[0].arguments }],
    }),
  );
  assert.throws(() =>
    assertA01RenderCohortAggregationOfflineProfile({
      ...profileV2,
      networkMode: A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE,
    }),
  );

  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
    '--summary-file',
    summaryPath,
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    A01_RENDER_COHORT_AGGREGATION_V2_EXPECTED_ARGUMENTS,
  ]);

  const fixture = createA01RenderCohortAggregationOfflineFetch(
    A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
  );
  const v1Search = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyword: A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword,
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );
  assert.equal(v1Search.status, 599);

  const v2Search = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyword: A01_RENDER_COHORT_AGGREGATION_V2_EXPECTED_ARGUMENTS.cohort.query.keyword,
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );
  assert.equal(v2Search.status, 200);
  assert.equal((await v2Search.json()).data[0].id, 990104);
  const detail = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990104');
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, 990104);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
    requestCount: 3,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 1,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('registered MCP arguments select the fixed offline mode and reject mode overrides', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
    '--summary-file',
    summaryPath,
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE);
  assert.deepEqual(config.toolNames, [A01_RENDER_COHORT_AGGREGATION_TOOL]);
  assert.deepEqual(config.expectedToolSequence, [A01_RENDER_COHORT_AGGREGATION_TOOL]);
  assert.deepEqual(config.expectedArgumentSequence, [
    A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS,
  ]);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
      '--network-mode',
      A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE,
      '--summary-file',
      summaryPath,
      '--candidate-sha',
      candidateSha,
      '--bundle-sha256',
      bundleSha256,
    ]),
  );
});

test('Codex invocation uses the approved isolated MCP surface without deprecated flags', () => {
  const args = buildA01RenderCohortAggregationCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    serverScript: '/repo/server.mjs',
    summaryPath: '/tmp/summary.json',
    candidateSha,
    bundleSha256,
  });
  assert.ok(args.includes('--approve-for-me'));
  assert.equal(args.includes('--sandbox'), false);
  assert.equal(args.includes('read-only'), false);
  const config = args.flatMap((value, index) => (value === '--config' ? [args[index + 1]] : []));
  assert.ok(config.includes('features.shell_tool=false'));
  assert.ok(config.includes('features.browser_use=false'));
  assert.ok(config.includes('features.computer_use=false'));
  assert.ok(config.includes('features.apps=false'));
  assert.ok(config.includes('features.multi_agent=false'));
  assert.ok(config.includes('web_search="disabled"'));
  assert.equal(
    config.some((value) => value.startsWith('features.web_search')),
    false,
  );
  assert.equal(
    config.includes(
      'mcp_servers.bgk_a01_render_cohort_aggregation_offline.enabled_tools=["bangumi.render_subject_cohort_aggregation"]',
    ),
    true,
  );
});

test('v2 Codex invocation binds the distinct server, profile, and fixed arguments', () => {
  const args = buildA01RenderCohortAggregationCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    serverScript: '/repo/server.mjs',
    summaryPath: '/tmp/summary-v2.json',
    candidateSha,
    bundleSha256,
    profileId: A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
  });
  const config = args.flatMap((value, index) => (value === '--config' ? [args[index + 1]] : []));
  assert.ok(
    config.includes('mcp_servers.bgk_a01_render_cohort_aggregation_offline_v2.enabled=true'),
  );
  assert.equal(
    config.some((value) =>
      value.startsWith('mcp_servers.bgk_a01_render_cohort_aggregation_offline.'),
    ),
    false,
  );
  const serverArgs = config.find((value) =>
    value.startsWith('mcp_servers.bgk_a01_render_cohort_aggregation_offline_v2.args='),
  );
  assert.ok(serverArgs?.includes(A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID));
  const prompt = args.at(-1);
  assert.ok(
    prompt.includes(A01_RENDER_COHORT_AGGREGATION_V2_EXPECTED_ARGUMENTS.cohort.query.keyword),
  );
  assert.equal(
    prompt.includes(A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword),
    false,
  );
});

test('MCP server dispatches v2 only through its profile-specific offline fixture', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID,
    '--summary-file',
    summaryPath,
    '--candidate-sha',
    candidateSha,
    '--bundle-sha256',
    bundleSha256,
  ]);
  assert.equal(config.networkMode, A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE);
  assert.match(serverSource, /A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE/u);
  assert.match(
    serverSource,
    /createA01RenderCohortAggregationOfflineFetch\(config\.profile\.id\)/u,
  );
  assert.match(
    serverSource,
    /A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE,\s*A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE/u,
  );
  assert.ok(
    serverSource.includes('A01_RENDER_COHORT_AGGREGATION_PROFILE_IDS.has(config.profile.id)'),
  );
  assert.ok(
    serverSource.includes('if (A01_RENDER_COHORT_AGGREGATION_PROFILE_IDS.has(config.profile?.id))'),
  );
});

test('offline fixture returns one synthetic search and detail, blocks auth and repeats', async () => {
  const fixture = createA01RenderCohortAggregationOfflineFetch();
  const search = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      keyword: A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword,
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).data[0].id, 990103);

  const detail = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990103');
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, 990103);

  const repeatedSearch = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyword: A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword,
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );
  assert.equal(repeatedSearch.status, 599);

  const wrongOrigin = await fixture.fetchFn(
    'https://example.invalid/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyword: A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword,
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );
  assert.equal(wrongOrigin.status, 599);

  const authenticated = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990103', {
    headers: { authorization: 'Bearer synthetic-test-only' },
  });
  assert.equal(authenticated.status, 599);
  assert.deepEqual(fixture.snapshot(), {
    profile: A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
    requestCount: 5,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 3,
    authorizationHeaderCount: 1,
    expectedOperationsComplete: true,
  });
});

test('A01 summary contains only sanitized artifact metadata', () => {
  const summary = summarizeProfileToolResult(
    { artifact: { id: 'art_private_key_omitted' } },
    A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS,
    A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 720,
      height: 1200,
      byteLength: 12000,
      sha256: 'c'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
    A01_RENDER_COHORT_AGGREGATION_TOOL,
  );
  assert.deepEqual(summary, {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 720,
      height: 1200,
      byteLength: 12000,
      sha256: 'c'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  });
  assert.equal(JSON.stringify(summary).includes('art_private_key_omitted'), false);
});

test('A01 report requires the bounded offline fixture and a signed matrix-only result', () => {
  const input = createValidA01RunInput();
  const runValidation = validateA01RenderCohortAggregationProfileRun(input);
  assert.equal(runValidation.passed, true, JSON.stringify(runValidation));
  assert.ok(Object.values(runValidation.answerChecks).every(Boolean));

  const built = buildA01RenderCohortAggregationProfileReport(input, {
    privateKey: input.keyPair.privateKey,
  });
  assert.equal(built.passed, true);
  const reportValidation = validateA01RenderCohortAggregationProfileReport(
    built.report,
    input.claim,
    built.reportBytes,
  );
  assert.equal(reportValidation.passed, true);
  const serialized = built.reportBytes.toString('utf8');
  assert.equal(serialized.includes('Synthetic Aggregation Sample'), false);
  assert.equal(serialized.includes('990103'), false);
  assert.equal(serialized.includes('A01 scenario accepted'), false);

  const tampered = structuredClone(built.report);
  tampered.acceptanceScope = 'frontier-scenario-only';
  assert.equal(
    validateA01RenderCohortAggregationProfileReport(tampered, input.claim).passed,
    false,
  );
});

test('v2 report validates only against its fresh claim, fixture, and report identity', () => {
  const input = createValidA01RunInput(A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID);
  const runValidation = validateA01RenderCohortAggregationProfileRun(input);
  assert.equal(runValidation.passed, true, JSON.stringify(runValidation));

  const built = buildA01RenderCohortAggregationProfileReport(input, {
    privateKey: input.keyPair.privateKey,
  });
  assert.equal(built.passed, true);
  assert.equal(built.report.profileId, A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID);
  assert.equal(built.report.networkMode, A01_RENDER_COHORT_AGGREGATION_V2_NETWORK_MODE);
  assert.equal(built.report.serverId, 'bgk_a01_render_cohort_aggregation_offline_v2');
  assert.equal(built.report.offlineFixture.profile, A01_RENDER_COHORT_AGGREGATION_V2_PROFILE_ID);
  assert.equal(
    built.report.runnerReceipt.kind,
    'a01-render-cohort-aggregation-agent-mcp-runner-receipt-v2',
  );
  assert.equal(
    validateA01RenderCohortAggregationProfileReport(built.report, input.claim, built.reportBytes)
      .passed,
    true,
  );
  assert.equal(built.reportBytes.includes(Buffer.from('990104')), false);
  assert.equal(built.reportBytes.includes(Buffer.from('Synthetic Render Aggregation V2')), false);

  const v1Claim = createValidA01RunInput(A01_RENDER_COHORT_AGGREGATION_PROFILE_ID).claim;
  assert.equal(
    validateA01RenderCohortAggregationProfileReport(built.report, v1Claim).passed,
    false,
  );
  const tampered = structuredClone(built.report);
  tampered.profileId = A01_RENDER_COHORT_AGGREGATION_PROFILE_ID;
  assert.equal(
    validateA01RenderCohortAggregationProfileReport(tampered, input.claim).passed,
    false,
  );
});
