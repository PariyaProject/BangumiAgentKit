import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sanitizeGitRepositoryEnvironment } from '../../scripts/lib/g26-mcp-bundle.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID,
} from '../../scripts/lib/r04-render-series-watch-order-offline-v2-fixture.mjs';
import {
  buildR04RenderV2ProfileReport,
  validateR04RenderV2ProfileReport,
  validateR04RenderV2SanitizedReportFile,
} from '../../scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs';

const ROOT = process.cwd();
const PROFILE = getAgentMcpProfileById(R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const SERVER_ID = 'bgk_r04_render_watch_order_v2';
const ACK = 'R04_RENDER_V2_SYNTHETIC_CARD_READY';
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

function makeInput(root = ROOT) {
  const keys = generateKeyPairSync('ed25519');
  const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((row) => row.name === PROFILE.toolName);
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    env: sanitizeGitRepositoryEnvironment(),
  }).trim();
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-207-${sourceRevision.slice(0, 12)}-1792200000000`,
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: 'R04',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 207,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: sourceRevision,
    baseSha: BASE_SHA,
    ciSha: sourceRevision,
    ciStatus: 'SUCCESS',
    ciRunId: '38822222222',
    ciChecks: CI_CHECKS,
    reviewerId: 'gpt-6-luna-max-run95-pr207-round1',
    bundleSha256: BUNDLE_SHA,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const resultSummary = {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 360,
      height: 272,
      byteLength: 4096,
      sha256: 'd'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: sha256(catalogBytes),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: sha256(tool.description ?? ''),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    offlineFixture: {
      profile: R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
      requestCount: 2,
      subjectRequestCount: 1,
      relationsRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
    rendererAssetBoundary: { requestCount: 0 },
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 3,
    mcpToolErrorResultCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: [SERVER_ID],
    exactCall: true,
    exactToolEvent: true,
    safeTextReadback: true,
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return { keyPair: keys, claim, serverSummary, events, answer: ACK };
}

function prepareRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'r04-render-report-test-'));
  mkdirSync(path.join(root, 'docs/research'), { recursive: true });
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  copyFileSync(
    path.join(ROOT, 'docs/tool-catalog.json'),
    path.join(root, 'docs/tool-catalog.json'),
  );
  copyFileSync(
    path.join(ROOT, PROFILE.selectionEvidencePath),
    path.join(root, PROFILE.selectionEvidencePath),
  );
  const gitOptions = {
    cwd: root,
    encoding: 'utf8',
    env: sanitizeGitRepositoryEnvironment(),
  };
  execFileSync('git', ['init', '--quiet'], gitOptions);
  execFileSync('git', ['config', 'user.name', 'Acceptance Fixture'], gitOptions);
  execFileSync('git', ['config', 'user.email', 'acceptance-fixture@example.invalid'], gitOptions);
  execFileSync('git', ['add', 'docs/tool-catalog.json'], gitOptions);
  execFileSync('git', ['commit', '--quiet', '-m', 'catalog source fixture'], gitOptions);
  return root;
}

test('R04 render report signs only artifact metadata and matrix evidence', (t) => {
  const root = prepareRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = makeInput(root);
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const result = buildR04RenderV2ProfileReport(
    {
      claim: input.claim,
      serverSummary: input.serverSummary,
      events: input.events,
      answer: input.answer,
      codexCliVersion: '0.1.0',
      eventStreamSha256: 'e'.repeat(64),
      serverSummarySha256: 'f'.repeat(64),
    },
    { privateKey: input.keyPair.privateKey, root, reportPath },
  );
  assert.equal(result.passed, true, result.reason);
  const validation = validateR04RenderV2SanitizedReportFile(input.claim, root, reportPath);
  assert.equal(validation.passed, true, validation.reason);
  assert.equal(validation.reportSha256, result.reportSha256);
  assert.equal(validation.report.resultSummary.artifact.sha256, 'd'.repeat(64));
  assert.equal(validation.report.resultSummary.artifact.persisted, false);
  assert.equal(validation.report.codexErrorItemCount, 3);
  assert.equal(validation.report.mcpToolErrorResultCount, 0);
  assert.equal('imageBytes' in validation.report.resultSummary.artifact, false);
  assert.equal('answer' in validation.report, false);
  assert.equal(validation.report.frontierId, 'R04');
  assert.equal(validation.report.scenarioId, null);
});

test('R04 v2 catalog evidence stays bound to sourceRevision and the current target entry', (t) => {
  const root = prepareRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = makeInput(root);
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const written = buildR04RenderV2ProfileReport(
    {
      claim: input.claim,
      serverSummary: input.serverSummary,
      events: input.events,
      answer: input.answer,
      codexCliVersion: '0.1.0',
      eventStreamSha256: 'e'.repeat(64),
      serverSummarySha256: 'f'.repeat(64),
    },
    { privateKey: input.keyPair.privateKey, root, reportPath },
  );
  assert.equal(written.passed, true, written.reason);
  const reportBytes = readFileSync(reportPath);
  const report = JSON.parse(reportBytes.toString('utf8'));
  const catalogPath = path.join(root, 'docs/tool-catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  catalog.push({
    name: 'unrelated.synthetic.catalog.entry',
    auth: 'none',
    risk: 'read',
    description: 'Unrelated fixture entry.',
    inputSchema: { type: 'object' },
  });
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  assert.equal(validateR04RenderV2ProfileReport(report, input.claim, reportBytes, root).passed, true);

  const changedCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  changedCatalog.find((row) => row.name === PROFILE.toolName).risk = 'write';
  writeFileSync(catalogPath, `${JSON.stringify(changedCatalog, null, 2)}\n`);
  assert.equal(validateR04RenderV2ProfileReport(report, input.claim, reportBytes, root).passed, false);
});

test('R04 render report rejects external asset activity and altered readback evidence', () => {
  const root = prepareRoot();
  try {
    const input = makeInput(root);
    const rejected = buildR04RenderV2ProfileReport(
      {
        claim: input.claim,
        serverSummary: {
          ...input.serverSummary,
          rendererAssetBoundary: { requestCount: 1 },
        },
        events: input.events,
        answer: input.answer,
        codexCliVersion: '0.1.0',
        eventStreamSha256: 'e'.repeat(64),
        serverSummarySha256: 'f'.repeat(64),
      },
      { privateKey: input.keyPair.privateKey, root },
    );
    assert.equal(rejected.passed, false);

    const mcpError = buildR04RenderV2ProfileReport(
      {
        claim: input.claim,
        serverSummary: input.serverSummary,
        events: { ...input.events, mcpToolErrorResultCount: 1 },
        answer: input.answer,
        codexCliVersion: '0.1.0',
        eventStreamSha256: 'e'.repeat(64),
        serverSummarySha256: 'f'.repeat(64),
      },
      { privateKey: input.keyPair.privateKey, root },
    );
    assert.equal(mcpError.passed, false);

    const falselyPersisted = buildR04RenderV2ProfileReport(
      {
        claim: input.claim,
        serverSummary: {
          ...input.serverSummary,
          results: [
            {
              ...input.serverSummary.results[0],
              resultSummary: {
                ...input.serverSummary.results[0].resultSummary,
                artifact: {
                  ...input.serverSummary.results[0].resultSummary.artifact,
                  persisted: true,
                },
              },
            },
          ],
        },
        events: input.events,
        answer: input.answer,
        codexCliVersion: '0.1.0',
        eventStreamSha256: 'e'.repeat(64),
        serverSummarySha256: 'f'.repeat(64),
      },
      { privateKey: input.keyPair.privateKey, root },
    );
    assert.equal(falselyPersisted.passed, false);

    const reportPath = path.join(root, PROFILE.reportPath);
    mkdirSync(path.dirname(reportPath), { recursive: true });
    const accepted = buildR04RenderV2ProfileReport(
      {
        claim: input.claim,
        serverSummary: input.serverSummary,
        events: input.events,
        answer: input.answer,
        codexCliVersion: '0.1.0',
        eventStreamSha256: 'e'.repeat(64),
        serverSummarySha256: 'f'.repeat(64),
      },
      { privateKey: input.keyPair.privateKey, root, reportPath },
    );
    assert.equal(accepted.passed, true, accepted.reason);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    report.answerChecks.safeTextReadback = false;
    const tampered = Buffer.from(`${JSON.stringify(report)}\n`);
    assert.equal(
      validateR04RenderV2ProfileReport(report, input.claim, tampered, root).passed,
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R04 render report rejects candidate, base, CI, reviewer, bundle, profile, and claim mismatches', (t) => {
  const root = prepareRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = makeInput(root);
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const built = buildR04RenderV2ProfileReport(
    {
      claim: input.claim,
      serverSummary: input.serverSummary,
      events: input.events,
      answer: input.answer,
      codexCliVersion: '0.1.0',
      eventStreamSha256: 'e'.repeat(64),
      serverSummarySha256: 'f'.repeat(64),
    },
    { privateKey: input.keyPair.privateKey, root, reportPath },
  );
  assert.equal(built.passed, true, built.reason);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const reportBytes = readFileSync(reportPath);
  const mismatches = [
    ['Candidate', { sourceCandidateSha: '9'.repeat(40) }],
    ['Base', { baseSha: '9'.repeat(40) }],
    ['CI run', { ciRunId: '38822222223' }],
    ['CI SHA', { ciSha: '9'.repeat(40) }],
    ['reviewer', { reviewerId: 'gpt-6-luna-max-run95-pr207-round2' }],
    ['bundle', { bundleSha256: '9'.repeat(64) }],
    ['profile', { profileId: 'different-profile' }],
    ['claim', { claimId: 'different-claim' }],
  ];

  for (const [name, changes] of mismatches) {
    const mismatchedClaim = { ...input.claim, ...changes };
    assert.equal(
      validateR04RenderV2ProfileReport(report, mismatchedClaim, reportBytes, root).passed,
      false,
      `${name} mismatch must invalidate the report binding`,
    );
  }
});
