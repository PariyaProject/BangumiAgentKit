import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { NATIVE_PAGE_PROFILE as P, NATIVE_PAGE_SERVER_ID } from '../../../scripts/lib/native-entity-page-profile.mjs';
import { agentMcpProfileArgumentsSha256, agentMcpProfileRegistrySha256, canonicalAgentMcpProfileJson } from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../../scripts/lib/p06-ci-run-evidence.mjs';
import { NATIVE_PAGE_ROOT, NATIVE_PAGE_SOURCE_PATHS, nativePageSha, buildNativePageReport } from '../../../scripts/acceptance/native-entity-page-report.mjs';
import { sanitizeGitRepositoryEnvironment } from '../../../scripts/lib/g26-mcp-bundle.mjs';

/** Synthetic Git/key/claim fixture only; it never contacts the control plane. */
export function nativePageReportFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-native-page-unit-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, env: sanitizeGitRepositoryEnvironment(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const verifierSupport = ['scripts/acceptance/validate-native-entity-page-report.mjs',
    'scripts/acceptance/agent-mcp-profile-registry.json', 'scripts/lib/agent-mcp-profile-claims.mjs',
    'scripts/lib/p06-ci-run-evidence.mjs', 'scripts/lib/source-revision-tool-catalog.mjs', 'scripts/lib/g26-mcp-bundle.mjs'];
  for (const relative of [...NATIVE_PAGE_SOURCE_PATHS, ...verifierSupport, P.selectionEvidencePath, 'docs/tool-catalog.json']) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(NATIVE_PAGE_ROOT, relative), path.join(root, relative));
  }
  fs.mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'synthetic report source');
  const revision = git('rev-parse', 'HEAD');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const claim = {
    schemaVersion: 1, claimId: `profile-run-95-pr-292-${revision.slice(0, 12)}-1234`, state: 'CLAIMED',
    profileId: P.id, frontierId: P.frontierId, epochId: P.epochId, runNumber: 95, prNumber: 292,
    toolName: P.toolName, argumentProfile: P.argumentProfile,
    expectedArguments: structuredClone(P.calls.map((call) => call.arguments)),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(P), registrySha256: agentMcpProfileRegistrySha256(P.id),
    sourceCandidateSha: revision, baseSha: '1'.repeat(40), ciSha: revision, ciStatus: 'SUCCESS',
    ciRunId: '123456789', ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    reviewerId: '/root/native_page_product_review', bundleSha256: '2'.repeat(64),
    runnerReceiptPublicKey: der.toString('base64'), runnerReceiptPublicKeySha256: nativePageSha(der), retryAllowed: false,
  };
  const projection = (index) => ({
    kind: index === 0 ? 'person' : 'character', total: index === 0 ? 3 : 0,
    observed: index === 0 ? 1 : 0, returned: index === 0 ? 1 : 0, invalidRows: 0,
    limit: 1, offset: 0, hasMore: index === 0, nextOffset: index === 0 ? 1 : null,
    totalInconsistent: false, empty: index === 0 ? null : 'collection_empty', truncated: index === 0,
    stableSnapshot: false, order: 'created_time_desc', publicOnly: true,
  });
  const observation = { contract: 'native-entity-page-observation-v1', phase: 'COMPLETE', requestCount: 2,
    deniedCount: 0, results: [projection(0), projection(1)], maxRequests: 2, maxResponseBytes: 262144,
    nativeCallDeadlineMs: 10000, minimumRequestStartIntervalMs: 1000, redirectPolicy: 'error',
    liveEvidence: false, forbiddenServiceAttempts: 0 };
  const answer = JSON.stringify({ pages: observation.results, notExhaustive: true, stableSnapshot: false });
  const execution = { sourceMode: 'native-public-fetch', model: P.model, reasoningEffort: P.reasoningEffort,
    codexCliVersion: '0.166.0-alpha.6', modelJobs: 1, processExitCode: 0, eventStreamParsed: true,
    turnCompleted: true, codexMcpToolEventCount: 2, codexErrorItemCount: 0, mcpToolErrorResultCount: 0,
    nonMcpToolEventCount: 0, shellToolCallCount: 0, mcpServerNames: [NATIVE_PAGE_SERVER_ID, NATIVE_PAGE_SERVER_ID],
    eventStreamSha256: '3'.repeat(64), serverSummarySha256: '4'.repeat(64), exactStructuredResults: true,
    providerInternalHttpCount: null, invoiceHardCap: null };
  return { root, git, privateKey, claim, observation, answer, execution,
    build: () => buildNativePageReport({ claim, observation, execution, answer }, privateKey, { root }),
    summary: () => ({ schema: 'native-entity-page-server-summary/v1', sourceMode: 'native-public-fetch',
      sourceRevision: revision, bundleSha256: claim.bundleSha256,
      claimSha256: nativePageSha(canonicalAgentMcpProfileJson(claim)),
      serverInstanceId: '11111111-1111-4111-8111-111111111111', toolNames: P.toolNames, observation }),
    close: () => fs.rmSync(root, { recursive: true, force: true }) };
}
