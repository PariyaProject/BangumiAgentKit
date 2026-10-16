import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { buildG06PrivacySummary } from '../../scripts/lib/g06-privacy-summary.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  C04_COHORT_COMPARISON_NETWORK_MODE,
  C04_COHORT_COMPARISON_PROFILE_ID,
  C04_COHORT_COMPARISON_TOOL_NAMES,
} from '../../scripts/lib/c04-cohort-comparison-public-profile.mjs';
import {
  buildC04ProfileReport,
  validateC04ProfileReport,
  validateC04ServerSummary,
} from '../../scripts/acceptance/write-c04-cohort-comparison-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById(C04_COHORT_COMPARISON_PROFILE_ID);
const SOURCE = 'a'.repeat(40);
const BUNDLE = 'b'.repeat(64);
const HASH = 'c'.repeat(64);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const catalogBytes = readFileSync(fileURLToPath(new URL('../../docs/tool-catalog.json', import.meta.url)));
const catalog = JSON.parse(catalogBytes.toString('utf8'));
const toolDescriptors = C04_COHORT_COMPARISON_TOOL_NAMES.map((toolName) => {
  const item = catalog.find((row) => row.name === toolName);
  return {
    toolName,
    descriptionSha256: sha256(item.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(item.inputSchema)),
  };
});

function serverSummary(callIndex) {
  const call = PROFILE.calls[callIndex];
  const toolName = call.toolName;
  const descriptor = toolDescriptors[callIndex];
  const resultSummary = callIndex === 0
    ? {
        resultState: 'partial',
        cohortCount: 2,
        cohorts: [
          { queryState: 'ok', detailHydrationsAttempted: 1, detailHydrationsSucceeded: 1, detailHydrationsFailed: 0, subjectCount: 1 },
          { queryState: 'partial', detailHydrationsAttempted: 1, detailHydrationsSucceeded: 1, detailHydrationsFailed: 0, subjectCount: 1 },
        ],
        metricCount: 4,
        metrics: ['score', 'heat', 'episodesReported', 'ratingStandardDeviation'].map((key) => ({
          key, state: 'partial', validCounts: [1, 1], partialCounts: [0, 0],
          missingCounts: [0, 0], conflictCounts: [0, 0], notComputableCounts: [0, 0],
        })),
        coverage: {
          maxSubjectsPerCohort: 1, totalSubjectsReturned: 2, cohortsComplete: 0,
          cohortsPartial: 2, detailHydrationsAttempted: 2, detailHydrationsSucceeded: 2,
          detailHydrationsFailed: 0, truncated: false,
        },
      }
    : {
        resultState: 'artifact_returned',
        artifact: {
          returned: true, persisted: false, mimeType: 'image/png', width: 1200,
          height: 900, byteLength: 2048, sha256: HASH, pngSignatureValid: true,
        },
      };
  return {
    schemaVersion: 1,
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    serverInstanceId: `00000000-0000-4000-8000-00000000000${callIndex}`,
    profileCallIndex: callIndex,
    expectedCallCount: 1,
    networkMode: C04_COHORT_COMPARISON_NETWORK_MODE,
    sourceRevision: SOURCE,
    bundleSha256: BUNDLE,
    catalogSha256: sha256(catalogBytes),
    toolName,
    toolNames: [toolName],
    toolDescriptionSha256: descriptor.descriptionSha256,
    inputSchemaSha256: descriptor.inputSchemaSha256,
    serverToolNames: [toolName],
    serverToolCount: 1,
    toolDescriptors: [descriptor],
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    results: [
      {
        sequenceIndex: 0,
        toolName,
        status: 'SUCCESS',
        resultSummary,
      },
    ],
    publicRequestScope: {
      requestCount: 8, allowedRequestCount: 8, deniedRequestCount: 0,
      credentialAttemptCount: 0, unexpectedRouteCount: 0, budgetExceeded: false,
      maxRequests: 16, anonymousOnly: true, officialV0Only: true, redirectPolicy: 'error',
    },
    privacy: buildG06PrivacySummary(),
  };
}

test('C04 server summary validates one exact indexed tool per bounded public run', () => {
  const valid = serverSummary(0);
  assert.equal(validateC04ServerSummary(valid, SOURCE, BUNDLE, 0), true);
  assert.equal(validateC04ServerSummary(serverSummary(1), SOURCE, BUNDLE, 1), true);
  assert.equal(validateC04ServerSummary(serverSummary(1), SOURCE, BUNDLE, 0), false);
  const overBudget = structuredClone(valid);
  overBudget.publicRequestScope.requestCount = 17;
  overBudget.publicRequestScope.allowedRequestCount = 17;
  assert.equal(validateC04ServerSummary(overBudget, SOURCE, BUNDLE, 0), false);
  const excessiveHydration = structuredClone(valid);
  excessiveHydration.results[0].resultSummary.cohorts[0].detailHydrationsAttempted = 2;
  excessiveHydration.results[0].resultSummary.cohorts[0].detailHydrationsSucceeded = 2;
  assert.equal(validateC04ServerSummary(excessiveHydration, SOURCE, BUNDLE, 0), false);
  const inconsistentMetricCounts = structuredClone(valid);
  inconsistentMetricCounts.results[0].resultSummary.metrics[0].partialCounts[0] = 1;
  assert.equal(validateC04ServerSummary(inconsistentMetricCounts, SOURCE, BUNDLE, 0), false);
  const inconsistentCoverage = structuredClone(valid);
  inconsistentCoverage.results[0].resultSummary.coverage.totalSubjectsReturned = 1;
  assert.equal(validateC04ServerSummary(inconsistentCoverage, SOURCE, BUNDLE, 0), false);
  const rawTitle = structuredClone(valid);
  rawTitle.results[0].resultSummary.cohorts[0].title = 'must never be recorded';
  assert.equal(validateC04ServerSummary(rawTitle, SOURCE, BUNDLE, 0), false);
  const extraTool = structuredClone(valid);
  extraTool.serverToolNames.push('bangumi.auth_status');
  extraTool.toolNames.push('bangumi.auth_status');
  assert.equal(validateC04ServerSummary(extraTool, SOURCE, BUNDLE, 0), false);
});

test('C04 signed report binds one claim to both tool events without retaining source data', () => {
  const pair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = pair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const publicKeySha256 = sha256(Buffer.from(publicKeyBase64, 'base64'));
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    claimId: 'profile-run-95-pr-191-aaaaaaaaaaaa-1792123456789',
    profileId: PROFILE.id,
    runNumber: 95,
    prNumber: 191,
    epochId: PROFILE.epochId,
    frontierId: PROFILE.frontierId,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: SOURCE,
    baseSha: 'd'.repeat(40),
    ciSha: SOURCE,
    ciStatus: 'SUCCESS',
    ciRunId: '38849999999',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: 'gpt-6-luna-max-run95-pr191-round1',
    bundleSha256: BUNDLE,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: publicKeySha256,
  };
  const built = buildC04ProfileReport(
    {
      claim,
      serverSummaries: [serverSummary(0), serverSummary(1)],
      events: {
        codexRunCount: 2,
        allRunAnswersExact: true,
        processExitCode: 0,
        eventStreamParsed: true,
        turnCompleted: true,
        codexMcpToolEventCount: 2,
        codexErrorItemCount: 0,
        nonMcpToolEventCount: 0,
        nonMcpToolTypes: [],
        shellToolCallCount: 0,
        mcpServerNames: [
          'bgk_c04_cohort_comparison',
          'bgk_c04_cohort_comparison',
        ],
        exactCallSequence: true,
        exactToolEvents: true,
      },
      answer: 'C04_COHORT_TOOLS_READ_ONLY_MATRIX_ONLY',
      codexCliVersion: '1.2.14',
      eventStreamSha256: 'e'.repeat(64),
      serverSummarySha256: 'f'.repeat(64),
    },
    { privateKey: pair.privateKey },
  );
  assert.equal(built.passed, true, built.reason);
  assert.equal(built.report.codexRunCount, 2);
  assert.equal(built.report.publicRequestScope.requestCount, 16);
  assert.equal(built.report.publicRequestScope.maxRequests, 32);
  assert.equal(built.report.ciRunId, claim.ciRunId);
  assert.deepEqual(built.report.ciChecks, claim.ciChecks);
  assert.equal(validateC04ProfileReport(built.report, claim).passed, true);
  const claimWithoutCiIdentity = structuredClone(claim);
  delete claimWithoutCiIdentity.ciRunId;
  delete claimWithoutCiIdentity.ciChecks;
  assert.equal(validateC04ProfileReport(built.report, claimWithoutCiIdentity).passed, false);
  const encoded = JSON.stringify(built.report);
  assert.doesNotMatch(encoded, /public season label|private-to-report|do-not-retain/u);
  assert.doesNotMatch(encoded, /"subjectId"|"title"/u);
  const tampered = structuredClone(built.report);
  tampered.toolNames.reverse();
  assert.equal(validateC04ProfileReport(tampered, claim).passed, false);
});
