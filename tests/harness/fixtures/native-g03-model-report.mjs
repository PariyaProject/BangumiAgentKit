import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import {
  G03_NATIVE_QUERY,
  G03_NATIVE_ROWS,
} from '../../../scripts/lib/g03-native-discovery-verification.mjs';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID,
} from '../../../scripts/lib/native-g03-date-png-profile.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  G03_MODEL_ROOT,
  G03_MODEL_SOURCE_PATHS,
  g03ModelSha,
  g03ModelResultSha,
  buildG03ModelReport,
} from '../../../scripts/acceptance/native-g03-date-png-report.mjs';
import { sanitizeGitRepositoryEnvironment } from '../../../scripts/lib/g26-mcp-bundle.mjs';

/** Synthetic Git/key/claim fixture only; it never contacts the control plane. */
export function g03ModelReportFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-model-unit-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env: sanitizeGitRepositoryEnvironment(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  const verifierSupport = [
    'scripts/acceptance/validate-native-g03-date-png-report.mjs',
    'scripts/acceptance/agent-mcp-profile-registry.json',
    'scripts/lib/agent-mcp-profile-claims.mjs',
    'scripts/lib/p06-ci-run-evidence.mjs',
    'scripts/lib/source-revision-tool-catalog.mjs',
    'scripts/lib/g26-mcp-bundle.mjs',
  ];
  for (const relative of [
    ...G03_MODEL_SOURCE_PATHS,
    ...verifierSupport,
    P.selectionEvidencePath,
    'docs/tool-catalog.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(G03_MODEL_ROOT, relative), path.join(root, relative));
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
    claimId: `profile-run-95-pr-296-${revision.slice(0, 12)}-1234`,
    state: 'CLAIMED',
    profileId: P.id,
    frontierId: P.frontierId,
    epochId: P.epochId,
    runNumber: 95,
    prNumber: 296,
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
    reviewerId: '/root/g03_model_product_review',
    bundleSha256: JSON.parse(
      fs.readFileSync(
        path.join(root, 'docs/product/native-g03-date-png-mcp-bundle-attestation.json'),
      ),
    ).bundleSha256,
    runnerReceiptPublicKey: der.toString('base64'),
    runnerReceiptPublicKeySha256: g03ModelSha(der),
    retryAllowed: false,
  };
  const coverage = {
    scanned: 6,
    matched: 4,
    returned: 4,
    pagesScanned: 1,
    totalKind: 'estimated',
    upstreamExhausted: true,
    budgetExceeded: false,
    hydrationsAttempted: 6,
    hydrationsSucceeded: 6,
    hydrationsFailed: 0,
    unresolvedCandidates: 0,
  };
  const observation = {
    contract: 'g03-native-date-and-png-v1',
    phase: 'COMPLETE',
    searchRequests: 2,
    detailRequests: 12,
    denied: 0,
    observation: {
      rows: structuredClone(G03_NATIVE_ROWS),
      coverage,
      synthetic: true,
      unknownDatesDependOnUpstream: true,
    },
    image: {
      width: 720,
      height: 1926,
      bytes: 204626,
      sha256: '3'.repeat(64),
      rows: structuredClone(G03_NATIVE_ROWS),
      decoded: true,
    },
    maxSearchRequests: 2,
    maxDetailRequests: 12,
    deadlineMs: 20000,
    syntheticSource: true,
    modelEvidence: false,
    liveEvidence: false,
    forbiddenServices: 0,
    renderStarted: true,
  };
  const artifact = { id: 'art_' + 'b'.repeat(32), mimeType: 'image/png', width: 720, height: 1926 };
  const answer = JSON.stringify({
    rows: observation.observation.rows,
    bounds: {
      from: G03_NATIVE_QUERY.from,
      to: G03_NATIVE_QUERY.to,
      fromInclusive: true,
      toExclusive: true,
    },
    estimated: true,
    experimental: true,
    unknownDatesDependOnUpstream: true,
    artifact,
  });
  const names = ['搜索日期保留', '详情日期不完整', '详情有效且在范围内', '日期待确认'];
  const query = {
    state: 'ok',
    items: G03_NATIVE_ROWS.map((row, index) => ({
      ...row,
      name: names[index],
      media: 'anime',
      score: 8,
      ratingCount: 6000,
    })),
    coverage: { ...coverage, postFilterCount: 2 },
    plan: {
      source: 'official_v0',
      operation: 'searchSubjects',
      sort: 'date',
      order: 'asc',
      totalKind: 'estimated',
      limitations: [
        '起始日计入，结束日为排除上界。完整有效的日期会在本地复核，其他日期依赖上游筛选。',
      ],
    },
    warnings: [{ code: 'EXPERIMENTAL_SOURCE' }],
  };
  const results = [
    { content: [{ type: 'text', text: 'bounded native query' }], structuredContent: query },
    { content: [{ type: 'text', text: JSON.stringify({ artifact }) }] },
  ];
  const execution = {
    sourceMode: 'native-synthetic-discovery-date-png',
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
    mcpServerNames: [G03_MODEL_SERVER_ID, G03_MODEL_SERVER_ID],
    eventStreamSha256: '3'.repeat(64),
    serverSummarySha256: '4'.repeat(64),
    exactStructuredResults: true,
    fixtureResponses: 14,
    liveHttpRequests: 0,
    artifactMatched: true,
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
    artifact,
    answer,
    execution,
    results,
    build: () =>
      buildG03ModelReport({ claim, observation, execution, answer, artifact }, privateKey, {
        root,
      }),
    summary: () => ({
      schema: 'native-g03-date-png-server-summary/v1',
      sourceMode: 'native-synthetic-discovery-date-png',
      sourceRevision: revision,
      bundleSha256: claim.bundleSha256,
      claimSha256: g03ModelSha(canonicalAgentMcpProfileJson(claim)),
      serverInstanceId: '11111111-1111-4111-8111-111111111111',
      toolNames: P.toolNames,
      observation,
      resultSha256: results.map(g03ModelResultSha),
      artifact,
      captureFailed: false,
      closed: true,
      protocolDenied: 0,
    }),
    close: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
