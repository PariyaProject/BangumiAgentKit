import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildR04ProfileReport } from '../../../scripts/acceptance/write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import { R04_SERIES_WATCH_ORDER_V2_PROFILE_ID } from '../../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
import { getR04SeriesWatchOrderOfflineProfileConfig } from '../../../scripts/lib/r04-series-watch-order-offline-profile-config.mjs';
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const CI_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

export function r04SignedReportInput(profileId = R04_SERIES_WATCH_ORDER_V2_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  const config = getR04SeriesWatchOrderOfflineProfileConfig(profileId);
  const keys = generateKeyPairSync('ed25519');
  const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const catalogBytes = readFileSync(new URL('../../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((row) => row.name === profile.toolName);
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-186-${SOURCE_SHA.slice(0, 12)}-1792100000000`,
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'R04',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 186,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: SOURCE_SHA,
    baseSha: BASE_SHA,
    ciSha: SOURCE_SHA,
    ciStatus: 'SUCCESS',
    ciRunId: '38819999125',
    ciChecks: CI_CHECKS,
    reviewerId: 'gpt-6-luna-max-run95-pr186-round1',
    bundleSha256: BUNDLE_SHA,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    networkMode: config.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(catalogTool.description ?? ''),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: config.expectedResultSummary,
      },
    ],
    offlineFixture: config.expectedFixture,
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: [config.serverId],
    exactCall: true,
    exactToolEvent: true,
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return { claim, serverSummary, events, keys, config, profile };
}

// Synthetic cross-language verification; never writes to the real report path.
export function createSignedR04Report(profileId, reviewerId) {
  const value = r04SignedReportInput(profileId);
  value.claim.reviewerId = reviewerId;
  const root = mkdtempSync(path.join(os.tmpdir(), 'r04-signed-fixture-'));
  const reportPath = path.join(root, value.profile.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const result = buildR04ProfileReport(
      {
        ...value,
        answer: value.config.acknowledgement,
        codexCliVersion: '1.2.14',
        eventStreamSha256: '7'.repeat(64),
        serverSummarySha256: '8'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root, reportPath },
    );
    if (!result.passed) throw new Error(result.reason);
    return { report: JSON.parse(readFileSync(reportPath, 'utf8')), claim: value.claim };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
