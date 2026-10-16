import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { buildG06PrivacySummary } from '../../scripts/lib/g06-privacy-summary.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  assertTitleQueryRenderPublicProfile,
  createTitleQueryRenderPublicFetch,
  TITLE_QUERY_RENDER_MAX_REQUESTS,
  TITLE_QUERY_RENDER_NETWORK_MODE,
  TITLE_QUERY_RENDER_PROFILE_ID,
  TITLE_QUERY_RENDER_SERVER_ID,
  TITLE_QUERY_RENDER_TOOL_NAMES,
} from '../../scripts/lib/title-query-render-agent-mcp-profile.mjs';
import {
  buildTitleQueryRenderCodexExecArgs,
  finalizeTitleQueryRenderClaimedReport,
  hashRetainedTitleQueryRenderReport,
  isTitleQueryRenderProfileResultAcknowledged,
  validateTitleQueryRenderRunnerArgs,
} from '../../scripts/acceptance/run-title-query-render-agent-mcp.mjs';
import {
  buildTitleQueryRenderProfileReport,
  isTitleQueryRenderAnswerValid,
  validateTitleQueryRenderServerSummary,
  validateTitleQueryRenderProfileReport,
} from '../../scripts/acceptance/write-title-query-render-agent-mcp-report.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';

const PROFILE = getAgentMcpProfileById(TITLE_QUERY_RENDER_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('claimed-attempt recovery hashes a retained report without retaining report contents', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'title-query-render-recovery-test-'));
  const reportPath = path.join(directory, 'report.json');
  const reportBytes = Buffer.from('{"invalid":"retained report"}');
  try {
    assert.equal(hashRetainedTitleQueryRenderReport(reportPath), null);
    writeFileSync(reportPath, reportBytes);
    assert.equal(hashRetainedTitleQueryRenderReport(reportPath), sha256(reportBytes));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('valid recovered reports fall back to digest-bound INCONCLUSIVE when Harness rejects REPORT_WRITTEN', () => {
  const reportSha256 = 'a'.repeat(64);
  const calls = [];
  const recovered = finalizeTitleQueryRenderClaimedReport({
    report: { passed: true, reportSha256 },
    claimId: 'claim-test',
    persistReportWritten(digest) {
      calls.push({ state: 'REPORT_WRITTEN', digest });
      return { exitCode: 1, output: null };
    },
    persistInconclusive(value) {
      calls.push({ state: 'INCONCLUSIVE', ...value });
      return true;
    },
  });
  assert.deepEqual(recovered, { state: 'INCONCLUSIVE', reportSha256 });
  assert.deepEqual(calls, [
    { state: 'REPORT_WRITTEN', digest: reportSha256 },
    {
      state: 'INCONCLUSIVE',
      reasonCode: 'TITLE_QUERY_RENDER_STALE_REPORT_RECOVERY',
      diagnostics: { reportBuildValid: true, privacyPreserved: true },
      reportSha256,
    },
  ]);

  const accepted = finalizeTitleQueryRenderClaimedReport({
    report: { passed: true, reportSha256 },
    claimId: 'claim-test',
    persistReportWritten(digest) {
      return {
        exitCode: 0,
        output: {
          state: 'AGENT_MCP_PROFILE_RESULT_RECORDED',
          resultState: 'REPORT_WRITTEN',
          claimId: 'claim-test',
          profileId: PROFILE.id,
          reportSha256: digest,
        },
      };
    },
    persistInconclusive() {
      assert.fail('An accepted REPORT_WRITTEN result must not be replaced.');
    },
  });
  assert.deepEqual(accepted, { state: 'REPORT_WRITTEN', reportSha256 });
});

test('runner acknowledges only matching created or replayed terminal Harness results', () => {
  for (const state of [
    'AGENT_MCP_PROFILE_RESULT_RECORDED',
    'AGENT_MCP_PROFILE_RESULT_ALREADY_RECORDED',
  ]) {
    assert.equal(
      isTitleQueryRenderProfileResultAcknowledged(
        {
          exitCode: 0,
          output: {
            state,
            resultState: 'INCONCLUSIVE',
            claimId: 'claim-test',
            profileId: PROFILE.id,
          },
        },
        { resultState: 'INCONCLUSIVE', claimId: 'claim-test' },
      ),
      true,
    );
  }
  assert.equal(
    isTitleQueryRenderProfileResultAcknowledged(
      {
        exitCode: 0,
        output: {
          state: 'AGENT_MCP_PROFILE_RESULT_ALREADY_RECORDED',
          resultState: 'INCONCLUSIVE',
          claimId: 'another-claim',
          profileId: PROFILE.id,
        },
      },
      { resultState: 'INCONCLUSIVE', claimId: 'claim-test' },
    ),
    false,
  );
});

test('valid recovered reports reject REPORT_WRITTEN acknowledgements without the exact digest', () => {
  const reportSha256 = 'a'.repeat(64);
  for (const acknowledgedDigest of [null, 'b'.repeat(64)]) {
    let inconclusive = null;
    const recovered = finalizeTitleQueryRenderClaimedReport({
      report: { passed: true, reportSha256 },
      claimId: 'claim-test',
      persistReportWritten() {
        return {
          exitCode: 0,
          output: {
            state: 'AGENT_MCP_PROFILE_RESULT_RECORDED',
            resultState: 'REPORT_WRITTEN',
            claimId: 'claim-test',
            profileId: PROFILE.id,
            ...(acknowledgedDigest === null ? {} : { reportSha256: acknowledgedDigest }),
          },
        };
      },
      persistInconclusive(value) {
        inconclusive = value;
        return true;
      },
    });

    assert.deepEqual(recovered, { state: 'INCONCLUSIVE', reportSha256 });
    assert.equal(inconclusive?.reasonCode, 'TITLE_QUERY_RENDER_STALE_REPORT_RECOVERY');
    assert.equal(inconclusive?.reportSha256, reportSha256);
  }
});

function requestScope(requestCount = 2) {
  return {
    requestCount,
    allowedRequestCount: requestCount,
    deniedRequestCount: 0,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
    maxRequests: TITLE_QUERY_RENDER_MAX_REQUESTS,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  };
}

function querySummary() {
  return {
    resultState: 'ok',
    returnedItems: 1,
    coverage: {
      state: 'partial',
      requested: 1,
      scanned: 1,
      matched: 1,
      returned: 1,
      pagesRequested: 1,
      pagesScanned: 1,
      upstreamExhausted: false,
      budgetExceeded: false,
      totalKind: 'estimated',
    },
    warningCodes: ['EXPERIMENTAL_SOURCE'],
  };
}

function artifactSummary() {
  return {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 360,
      height: 720,
      byteLength: 4096,
      sha256: 'e'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  };
}

test('title query/render profile is fixed to two distinct matrix tools and exact anonymous arguments', () => {
  assert.equal(assertTitleQueryRenderPublicProfile(PROFILE), true);
  assert.deepEqual(TITLE_QUERY_RENDER_TOOL_NAMES, [
    'bangumi.query_subjects',
    'bangumi.render_query_subjects',
  ]);
  assert.deepEqual(PROFILE.calls[0].arguments, PROFILE.calls[1].arguments);
  assert.equal(PROFILE.calls[0].arguments.keyword, '葬送的芙莉莲');
  assert.equal(PROFILE.calls[0].arguments.limit, 1);
  assert.equal(PROFILE.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(
    assertTitleQueryRenderPublicProfile({ ...PROFILE, networkMode: 'arbitrary' }),
    false,
  );

  const parsed = parseCodexOneToolMcpArguments([
    '--profile-id',
    PROFILE.id,
    '--summary-file',
    '/tmp/title-query-render-summary.json',
    '--candidate-sha',
    'a'.repeat(40),
    '--bundle-sha256',
    'b'.repeat(64),
  ]);
  assert.deepEqual(parsed.toolNames, TITLE_QUERY_RENDER_TOOL_NAMES);
  assert.deepEqual(parsed.expectedToolSequence, TITLE_QUERY_RENDER_TOOL_NAMES);
  assert.equal(parsed.networkMode, TITLE_QUERY_RENDER_NETWORK_MODE);
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--profile-id',
        PROFILE.id,
        '--profile-call-index',
        '0',
        '--summary-file',
        '/tmp/title-query-render-summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /reserved for the registered C04 profile/u,
  );
});

test('title query/render public fetch allows only bounded anonymous official v0 routes', async () => {
  const observed = [];
  const guard = createTitleQueryRenderPublicFetch({
    fetchImpl: async (input, init) => {
      observed.push({
        url: String(input),
        method: init.method,
        redirect: init.redirect,
        credentials: init.credentials,
      });
      return new Response('{}', { status: 200 });
    },
  });
  await guard.fetchFn('https://api.bgm.tv/v0/search/subjects', {
    method: 'POST',
    body: '{}',
  });
  await guard.fetchFn('https://api.bgm.tv/v0/subjects/1234', { method: 'GET' });
  assert.deepEqual(observed.map(({ method, redirect }) => ({ method, redirect })), [
    { method: 'POST', redirect: 'error' },
    { method: 'GET', redirect: 'error' },
  ]);
  assert.deepEqual(observed.map(({ credentials }) => credentials), ['omit', 'omit']);
  assert.equal(guard.snapshot().requestCount, 2);
  assert.equal(guard.snapshot().anonymousOnly, true);
  assert.equal(guard.snapshot().officialV0Only, true);

  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/users/me', { method: 'GET' }),
    /denied/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      headers: { 'x-auth-token': 'synthetic-secret' },
    }),
    /denied/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      credentials: 'include',
    }),
    /denied/u,
  );
  await assert.rejects(
    guard.fetchFn(new Request('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      credentials: 'include',
    })),
    /denied/u,
  );
  assert.equal(guard.snapshot().credentialAttemptCount, 3);
  assert.equal(guard.snapshot().deniedRequestCount, 4);

  let calls = 0;
  const capped = createTitleQueryRenderPublicFetch({
    maxRequests: 1,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    },
  });
  await capped.fetchFn('https://api.bgm.tv/v0/search/subjects', { method: 'POST' });
  await assert.rejects(
    capped.fetchFn('https://api.bgm.tv/v0/search/subjects', { method: 'POST' }),
    /budget exceeded/u,
  );
  assert.equal(calls, 1);
  assert.equal(capped.snapshot().budgetExceeded, true);
});

test('query and renderer summaries retain only bounded counts, warning codes, and ephemeral PNG metadata', () => {
  const query = summarizeProfileToolResult(
    {
      state: 'ok',
      items: [{ id: 987654, name: 'private title', nameCn: 'private title cn' }],
      coverage: {
        state: 'partial',
        requested: 1,
        scanned: 1,
        matched: 1,
        returned: 1,
        pagesRequested: 1,
        pagesScanned: 1,
        upstreamExhausted: false,
        budgetExceeded: false,
        totalKind: 'estimated',
      },
      warnings: [{ code: 'EXPERIMENTAL_SOURCE', message: 'private title' }],
    },
    PROFILE.calls[0].arguments,
    PROFILE.id,
    null,
    PROFILE.calls[0].toolName,
  );
  assert.deepEqual(query, querySummary());
  assert.equal(JSON.stringify(query).includes('private title'), false);
  assert.equal(JSON.stringify(query).includes('987654'), false);

  const artifact = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-secret-id' } },
    PROFILE.calls[1].arguments,
    PROFILE.id,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 360,
      height: 720,
      byteLength: 4096,
      sha256: 'e'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
    PROFILE.calls[1].toolName,
  );
  assert.deepEqual(artifact, artifactSummary());
  assert.equal(JSON.stringify(artifact).includes('ephemeral-secret-id'), false);

  const answer = JSON.stringify({
    queryState: query.resultState,
    returnedItems: query.returnedItems,
    rendered: true,
    artifactMimeType: artifact.artifact.mimeType,
    artifactWidth: artifact.artifact.width,
    artifactHeight: artifact.artifact.height,
    notExhaustive: true,
  });
  assert.equal(
    isTitleQueryRenderAnswerValid(answer, [
      { toolName: PROFILE.calls[0].toolName, summary: query },
      { toolName: PROFILE.calls[1].toolName, summary: artifact },
    ]),
    true,
  );
  assert.equal(
    isTitleQueryRenderAnswerValid(answer.replace('"notExhaustive":true', '"notExhaustive":false'), [
      { toolName: PROFILE.calls[0].toolName, summary: query },
      { toolName: PROFILE.calls[1].toolName, summary: artifact },
    ]),
    false,
  );
});

test('title query/render runner uses one restricted Luna Max turn and signed reports omit raw answer/source data', () => {
  assert.equal(validateTitleQueryRenderRunnerArgs(['--help']), 'help');
  assert.equal(validateTitleQueryRenderRunnerArgs(['--run', '95']), 'run');
  const execArgs = buildTitleQueryRenderCodexExecArgs({
    summaryPath: '/tmp/title-query-render-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.deepEqual(execArgs.slice(0, 7), [
    'exec',
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--model',
    'gpt-6-luna',
  ]);
  assert.ok(execArgs.some((item) => item.includes('features.shell_tool=false')));

  const sourceRevision = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const bundleSha256 = 'c'.repeat(64);
  const catalogBytes = readFileSync(fileURLToPath(new URL('../../docs/tool-catalog.json', import.meta.url)));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const toolDescriptors = TITLE_QUERY_RENDER_TOOL_NAMES.map((toolName) => {
    const tool = catalog.find((item) => item.name === toolName);
    return {
      toolName,
      descriptionSha256: sha256(tool.description),
      inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    };
  });
  const claimKeys = generateKeyPairSync('ed25519');
  const runnerReceiptPublicKey = claimKeys.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const claim = {
    claimId: `profile-run-95-pr-17-${sourceRevision.slice(0, 12)}-1`,
    profileId: PROFILE.id,
    runNumber: 95,
    prNumber: 17,
    frontierId: 'G01',
    epochId: PROFILE.epochId,
    sourceCandidateSha: sourceRevision,
    baseSha,
    ciSha: sourceRevision,
    ciStatus: 'SUCCESS',
    ciRunId: '38900000000',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: 'gpt-6-luna-max-run95-pr17-round1',
    bundleSha256,
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    runnerReceiptPublicKey,
  };
  const query = querySummary();
  const artifact = artifactSummary();
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    expectedCallCount: PROFILE.calls.length,
    networkMode: TITLE_QUERY_RENDER_NETWORK_MODE,
    sourceRevision,
    bundleSha256,
    toolName: PROFILE.toolName,
    toolNames: [...TITLE_QUERY_RENDER_TOOL_NAMES],
    serverToolNames: [...TITLE_QUERY_RENDER_TOOL_NAMES],
    serverToolCount: 2,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 2,
    deniedCallCount: 0,
    argumentMatch: true,
    results: PROFILE.calls.map((call, index) => ({
      sequenceIndex: index,
      toolName: call.toolName,
      status: 'SUCCESS',
      resultSummary: index === 0 ? query : artifact,
    })),
    publicRequestScope: requestScope(),
    rendererAssetBoundary: {
      assetNetworkRequestCount: 0,
      remoteAssetResolutionDisabled: true,
    },
    privacy: buildG06PrivacySummary(),
    toolDescriptors,
    catalogSha256: sha256(catalogBytes),
    serverInstanceId: '11111111-1111-4111-8111-111111111111',
  };
  assert.equal(
    validateTitleQueryRenderServerSummary(serverSummary, sourceRevision, bundleSha256),
    true,
  );
  for (const changedArtifact of [
    { ...artifact, artifact: { ...artifact.artifact, decoded: false } },
    { ...artifact, artifact: { ...artifact.artifact, dimensionsMatch: false } },
  ]) {
    const changedSummary = {
      ...serverSummary,
      results: serverSummary.results.map((result, index) =>
        index === 1 ? { ...result, resultSummary: changedArtifact } : result,
      ),
    };
    assert.equal(
      validateTitleQueryRenderServerSummary(changedSummary, sourceRevision, bundleSha256),
      false,
    );
  }
  const answer = JSON.stringify({
    queryState: query.resultState,
    returnedItems: query.returnedItems,
    rendered: true,
    artifactMimeType: artifact.artifact.mimeType,
    artifactWidth: artifact.artifact.width,
    artifactHeight: artifact.artifact.height,
    notExhaustive: true,
  });
  const built = buildTitleQueryRenderProfileReport(
    {
      claim,
      serverSummary,
      events: {
        processExitCode: 0,
        codexRunCount: 1,
        eventStreamParsed: true,
        turnCompleted: true,
        codexMcpToolEventCount: 2,
        codexErrorItemCount: 0,
        nonMcpToolEventCount: 0,
        nonMcpToolTypes: [],
        shellToolCallCount: 0,
        mcpServerNames: [TITLE_QUERY_RENDER_SERVER_ID],
        exactCallSequence: true,
        exactToolEvents: true,
        answerValid: true,
      },
      answer,
      codexCliVersion: '1.2.3',
      eventStreamSha256: 'd'.repeat(64),
      serverSummarySha256: 'e'.repeat(64),
    },
    { privateKey: claimKeys.privateKey },
  );
  assert.equal(built.passed, true, built.reason);
  assert.equal(validateTitleQueryRenderProfileReport(built.report, claim).passed, true);
  const reportJson = JSON.stringify(built.report);
  assert.equal(reportJson.includes('葬送的芙莉莲'), false);
  assert.equal(reportJson.includes('private title'), false);
  assert.equal(reportJson.includes('987654'), false);
  assert.equal(reportJson.includes(answer), false);
  const tampered = {
    ...built.report,
    resultSummaries: [
      built.report.resultSummaries[0],
      {
        ...built.report.resultSummaries[1],
        summary: { ...built.report.resultSummaries[1].summary, subjectId: 987654 },
      },
    ],
  };
  assert.equal(validateTitleQueryRenderProfileReport(tampered, claim).passed, false);
});
