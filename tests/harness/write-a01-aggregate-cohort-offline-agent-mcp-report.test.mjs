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
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
  A01_AGGREGATE_COHORT_TOOL,
  getA01AggregateCohortOfflineProfileSpec,
} from '../../scripts/lib/a01-aggregate-cohort-offline-matrix-profile.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { buildG06PrivacySummary } from '../../scripts/lib/g06-privacy-summary.mjs';
import {
  buildA01AggregateCohortProfileReport,
  validateA01AggregateCohortProfileReport,
  validateA01AggregateCohortProfileRun,
  writeA01AggregateCohortProfileReport,
} from '../../scripts/acceptance/write-a01-aggregate-cohort-offline-agent-mcp-report.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const bundleSha256 = 'c'.repeat(64);

function createValidRunInput(profileId = A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  const profileSpec = getA01AggregateCohortOfflineProfileSpec(profile);
  const expectedArguments = profile.calls[0].arguments;
  const serverId = profileSpec.serverId;
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBytes = keyPair.publicKey.export({ format: 'der', type: 'spki' });
  const publicKeyBase64 = publicKeyBytes.toString('base64');
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === A01_AGGREGATE_COHORT_TOOL);
  const rawResult = {
    state: 'complete',
    cohorts: [
      {
        subjects: [{ id: profileSpec.subject.id, title: profileSpec.subject.name }],
        coverage: {
          query: { state: 'ok' },
          detailHydrationsAttempted: 1,
          detailHydrationsSucceeded: 1,
          detailHydrationsFailed: 0,
        },
      },
    ],
    metrics: profileSpec.expectedMetrics.map(({ key, value: average }) => ({
      key,
      state: 'complete',
      averages: [average],
      partialAverages: [],
      validCounts: [1],
      partialCounts: [0],
      missingCounts: [0],
      conflictCounts: [0],
      notComputableCounts: [0],
    })),
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
  };
  const resultSummary = summarizeProfileToolResult(
    rawResult,
    expectedArguments,
    profile.id,
    null,
    A01_AGGREGATE_COHORT_TOOL,
  );
  const answer = JSON.stringify({
    resultState: resultSummary.resultState,
    queryState: resultSummary.cohorts[0].queryState,
    subjectCount: resultSummary.cohorts[0].subjectCount,
    metrics: resultSummary.metrics.map((metric) => ({
      key: metric.key,
      state: metric.state,
      average: metric.averages[0],
      validCount: metric.validCounts[0],
    })),
    coverage: {
      detailHydrationsAttempted: resultSummary.coverage.detailHydrationsAttempted,
      detailHydrationsSucceeded: resultSummary.coverage.detailHydrationsSucceeded,
      detailHydrationsFailed: resultSummary.coverage.detailHydrationsFailed,
      truncated: resultSummary.coverage.truncated,
    },
  });
  const expectedArgumentsSha256 = agentMcpProfileArgumentsSha256(profile);
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    runNumber: 95,
    frontierId: 'A01',
    epochId: profile.epochId,
    profileId: profile.id,
    claimId: 'profile-run-95-pr-123-aaaaaaaaaaaa-1792220000000',
    prNumber: 123,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr123-round1',
    bundleSha256,
    expectedArgumentsSha256,
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyBytes),
    retryAllowed: false,
  };
  const resultSummarySha256 = sha256(canonicalAgentMcpProfileJson(resultSummary));
  const serverSummary = {
    schemaVersion: 1,
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedCallCount: 1,
    networkMode: profile.networkMode,
    sourceRevision: candidateSha,
    bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedArgumentsSha256,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    offlineFixture: {
      profile: profile.id,
      requestCount: 2,
      searchRequestCount: 1,
      detailRequestCount: 1,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
    privacy: buildG06PrivacySummary(),
    serverInstanceId: '123e4567-e89b-12d3-a456-426614174000',
  };
  const call = {
    tool: profile.toolName,
    status: 'completed',
    arguments: expectedArguments,
    result: { isError: false, structuredContent: resultSummary },
  };
  const events = {
    eventStreamComplete: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    mcpToolErrorResultCount: 0,
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
    codexCliVersion: '0.163.0-alpha.10.2',
    processExitCode: 0,
    processSpawned: true,
    processTimedOut: false,
    stdoutBytes: 100,
    stderrBytes: 0,
    eventStreamParsed: true,
    resultSummarySha256,
  };
}

test('A01 aggregate matrix run accepts only the exact synthetic result and answer', () => {
  const input = createValidRunInput();
  const validation = validateA01AggregateCohortProfileRun(input);
  assert.equal(validation.passed, true);
  assert.equal(validation.serverSummaryValid, true);
  assert.equal(validation.eventStreamValid, true);
  assert.ok(Object.values(validation.answerChecks).every(Boolean));
  assert.equal(JSON.stringify(validation.resultSummary).includes('990184'), false);

  const altered = {
    ...input,
    answer: input.answer.replace('56', '57'),
  };
  assert.equal(validateA01AggregateCohortProfileRun(altered).passed, false);
  const repeated = {
    ...input,
    events: { ...input.events, codexMcpToolEventCount: 2 },
  };
  assert.equal(validateA01AggregateCohortProfileRun(repeated).passed, false);
  assert.equal(
    validateA01AggregateCohortProfileRun({
      ...input,
      codexCliVersion: `1.2.3-${'x'.repeat(129)}`,
    }).passed,
    false,
  );

  const expandedMetricCounts = createValidRunInput();
  expandedMetricCounts.serverSummary.results[0].resultSummary.metrics[0].validCounts.push(0);
  expandedMetricCounts.events.completedMcpCalls[0].result.structuredContent.metrics[0].validCounts.push(
    0,
  );
  expandedMetricCounts.completedMcpCalls = expandedMetricCounts.events.completedMcpCalls;
  assert.equal(validateA01AggregateCohortProfileRun(expandedMetricCounts).passed, false);
});

test('A01 aggregate signed report binds the one-shot claim and rejects mutation', () => {
  const input = createValidRunInput();
  const built = buildA01AggregateCohortProfileReport(input, {
    privateKey: input.keyPair.privateKey,
  });
  assert.equal(built.passed, true);
  assert.equal(built.report.reportWritten, true);
  assert.equal(built.report.retryAllowed, false);
  assert.equal(JSON.stringify(built.report).includes('Synthetic Aggregate Matrix Subject'), false);
  assert.equal(JSON.stringify(built.report).includes('990184'), false);
  assert.equal(
    validateA01AggregateCohortProfileReport(built.report, input.claim, built.reportBytes).passed,
    true,
  );
  assert.equal(
    validateA01AggregateCohortProfileReport(built.report, input.claim, Buffer.from('{}')).passed,
    false,
  );
  const changed = { ...built.report, stderrBytes: built.report.stderrBytes + 1 };
  assert.equal(validateA01AggregateCohortProfileReport(changed, input.claim).passed, false);
  assert.throws(
    () => writeA01AggregateCohortProfileReport(built.report, { reportPath: '/tmp/other.json' }),
    /fixed and create-once/u,
  );
});

test('A01 aggregate v2 report binds the fresh synthetic profile and metrics', () => {
  const input = createValidRunInput(A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  const validation = validateA01AggregateCohortProfileRun(input);
  assert.equal(validation.passed, true);
  assert.deepEqual(
    validation.resultSummary.metrics.map((metric) => metric.averages[0]),
    [6.5, 71, 10, 2],
  );
  const built = buildA01AggregateCohortProfileReport(input, {
    privateKey: input.keyPair.privateKey,
  });
  assert.equal(built.passed, true);
  assert.equal(built.report.profileId, A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  assert.equal(built.report.networkMode, 'run95-a01-aggregate-cohort-offline-matrix-v2');
  assert.equal(built.report.serverId, 'bgk_a01_aggregate_cohort_offline_v2');
  assert.equal(JSON.stringify(built.report).includes('991219'), false);
  assert.equal(
    JSON.stringify(built.report).includes('Synthetic Aggregate Matrix V2 Subject'),
    false,
  );
  assert.equal(
    validateA01AggregateCohortProfileReport(built.report, input.claim, built.reportBytes).passed,
    true,
  );
});

test('A01 aggregate v3 report binds only its fresh synthetic profile and metrics', () => {
  const input = createValidRunInput(A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID);
  const validation = validateA01AggregateCohortProfileRun(input);
  assert.equal(validation.passed, true);
  assert.deepEqual(
    validation.resultSummary.metrics.map((metric) => metric.averages[0]),
    [7, 90, 12, 1],
  );
  const built = buildA01AggregateCohortProfileReport(input, {
    privateKey: input.keyPair.privateKey,
  });
  assert.equal(built.passed, true);
  assert.equal(built.report.profileId, A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID);
  assert.equal(built.report.networkMode, 'run95-a01-aggregate-cohort-offline-matrix-v2');
  assert.equal(built.report.serverId, 'bgk_a01_aggregate_cohort_offline_v3');
  assert.equal(built.report.retryAllowed, false);
  assert.equal(JSON.stringify(built.report).includes('991220'), false);
  assert.equal(
    JSON.stringify(built.report).includes('Synthetic Aggregate Matrix V3 Subject'),
    false,
  );
  assert.equal(
    validateA01AggregateCohortProfileReport(built.report, input.claim, built.reportBytes).passed,
    true,
  );
});
