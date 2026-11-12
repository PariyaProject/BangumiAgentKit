import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { projectRelationModelAnswer } from '../../../scripts/lib/native-relation-model-answer.mjs';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID,
} from '../../../scripts/lib/native-relation-model-profile.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  RELATION_MODEL_ROOT,
  RELATION_MODEL_SOURCE_PATHS,
  relationModelSha,
  relationModelResultSha,
  buildRelationModelReport,
  RELATION_MODEL_EXPECTED_SNAPSHOT,
} from '../../../scripts/acceptance/native-relation-model-report.mjs';
import { sanitizeGitRepositoryEnvironment } from '../../../scripts/lib/g26-mcp-bundle.mjs';

/** Synthetic Git/key/claim fixture only; it never contacts the control plane. */
export function relationModelReportFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-model-unit-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env: sanitizeGitRepositoryEnvironment(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  const verifierSupport = [
    'scripts/acceptance/validate-native-relation-model-report.mjs',
    'scripts/acceptance/agent-mcp-profile-registry.json',
    'scripts/lib/agent-mcp-profile-claims.mjs',
    'scripts/lib/p06-ci-run-evidence.mjs',
    'scripts/lib/source-revision-tool-catalog.mjs',
    'scripts/lib/g26-mcp-bundle.mjs',
  ];
  for (const relative of [
    ...RELATION_MODEL_SOURCE_PATHS,
    ...verifierSupport,
    P.selectionEvidencePath,
    'docs/tool-catalog.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(RELATION_MODEL_ROOT, relative), path.join(root, relative));
  }
  fs.mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=Synthetic Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-qm',
    'synthetic report source',
  );
  const revision = git('rev-parse', 'HEAD');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-9891-${revision.slice(0, 12)}-1234`,
    state: 'CLAIMED',
    profileId: P.id,
    frontierId: P.frontierId,
    epochId: P.epochId,
    runNumber: 95,
    prNumber: 9891,
    toolName: P.toolName,
    argumentProfile: P.argumentProfile,
    expectedArguments: structuredClone(P.calls.map((call) => call.arguments)),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(P),
    registrySha256: agentMcpProfileRegistrySha256(P.id),
    sourceCandidateSha: revision,
    baseSha: '1'.repeat(40),
    ciSha: revision,
    ciStatus: 'SUCCESS',
    ciRunId: '123456789',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: '/synthetic/relation-model-review',
    bundleSha256: JSON.parse(
      fs.readFileSync(
        path.join(root, 'docs/product/native-relation-model-mcp-bundle-attestation.json'),
      ),
    ).bundleSha256,
    runnerReceiptPublicKey: der.toString('base64'),
    runnerReceiptPublicKeySha256: relationModelSha(der),
    retryAllowed: false,
  };
  const observation = structuredClone(RELATION_MODEL_EXPECTED_SNAPSHOT);
  const results = JSON.parse(
    fs.readFileSync(new URL('./native-relation-model-results.json', import.meta.url), 'utf8'),
  ).results;
  const answer = JSON.stringify(projectRelationModelAnswer(results));
  const execution = {
    sourceMode: 'native-synthetic-relation-safety',
    model: P.model,
    reasoningEffort: P.reasoningEffort,
    codexCliVersion: '0.167.0-alpha.3.2',
    modelJobs: 1,
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 2,
    codexErrorItemCount: 0,
    mcpToolErrorResultCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [RELATION_MODEL_SERVER_ID, RELATION_MODEL_SERVER_ID],
    eventStreamSha256: '3'.repeat(64),
    serverSummarySha256: '4'.repeat(64),
    exactStructuredResults: true,
    fixtureResponses: 5,
    liveHttpRequests: 0,
    diagnosticPublished: true,
    diagnosticSha256: '6'.repeat(64),
    cleanupComplete: true,
    protocolDeniedCalls: 0,
    providerInternalHttpCount: null,
    invoiceHardCap: null,
  };
  return {
    root,
    git,
    privateKey,
    claim,
    observation,
    answer,
    execution,
    results,
    build: () =>
      buildRelationModelReport({ claim, observation, execution, answer, results }, privateKey, {
        root,
      }),
    summary: () => ({
      schema: 'native-relation-safety-server-summary/v1',
      sourceMode: 'native-synthetic-relation-safety',
      sourceRevision: revision,
      bundleSha256: claim.bundleSha256,
      claimSha256: relationModelSha(canonicalAgentMcpProfileJson(claim)),
      serverInstanceId: '11111111-1111-4111-8111-111111111111',
      toolNames: P.toolNames,
      observation,
      resultSha256: results.map(relationModelResultSha),
      lifecycleStage: 'cleanup',
      failureCode: null,
      captureFailed: false,
      closed: true,
      protocolDenied: 0,
    }),
    close: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
