import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
import {
  validateG06SubjectCastOfflineReport,
  writeG06SubjectCastOfflineReport,
} from '../../scripts/acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import { sanitizeGitRepositoryEnvironment } from '../../scripts/lib/g26-mcp-bundle.mjs';
import {
  G06_CAST_OFFLINE_PROFILE_ID,
  G06_CAST_OFFLINE_REPORT_PATH,
  G06_CAST_OFFLINE_V2_PROFILE_ID,
} from '../../scripts/lib/g06-subject-cast-offline-profile.mjs';

const TOOL_NAME = 'bangumi.get_subject_cast';
const ROOT = process.cwd();
const SOURCE_SHA = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: sanitizeGitRepositoryEnvironment(),
}).trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function runGit(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: sanitizeGitRepositoryEnvironment(),
  }).trim();
}

function prepareRoot(profileId = G06_CAST_OFFLINE_V2_PROFILE_ID) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'g06-cast-catalog-snapshot-test-'));
  const profile = getAgentMcpProfileById(profileId);
  mkdirSync(path.join(root, 'docs/research'), { recursive: true });
  copyFileSync(path.join(ROOT, 'docs/tool-catalog.json'), path.join(root, 'docs/tool-catalog.json'));
  const selectionPath = path.join(root, profile.selectionEvidencePath);
  mkdirSync(path.dirname(selectionPath), { recursive: true });
  copyFileSync(path.join(ROOT, profile.selectionEvidencePath), selectionPath);
  runGit(root, ['init', '--quiet']);
  runGit(root, ['config', 'user.name', 'Acceptance Fixture']);
  runGit(root, ['config', 'user.email', 'acceptance-fixture@example.invalid']);
  runGit(root, ['add', 'docs/tool-catalog.json']);
  runGit(root, ['commit', '--quiet', '-m', 'catalog source fixture']);
  return root;
}

function fixture(
  profileId = G06_CAST_OFFLINE_PROFILE_ID,
  root = ROOT,
  sourceRevision = SOURCE_SHA,
) {
  const profile = getAgentMcpProfileById(profileId);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    claimId: `profile-run-95-pr-222-${sourceRevision.slice(0, 12)}-1792200000000`,
    profileId: profile.id,
    frontierId: 'G06',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 222,
    toolName: TOOL_NAME,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: sourceRevision,
    baseSha: 'b'.repeat(40),
    ciSha: sourceRevision,
    ciStatus: 'SUCCESS',
    ciRunId: '38900001234',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: 'gpt-6-luna-max-run95-pr222-round1',
    bundleSha256: 'c'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
  };
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const tool = JSON.parse(catalogBytes.toString('utf8')).find(
    (item) => item.name === TOOL_NAME,
  );
  const offlineFixture = {
    profile: profile.networkMode,
    requestCount: 1,
    allowedRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 2,
    expectedOperationComplete: true,
  };
  const serverSummary = {
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    offlineFixture,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          status: 'ok',
          subjectIdMatches: true,
          rowsObserved: 2,
          rowsReturned: 2,
          multiRoleVoiceActorCount: 1,
          truncated: false,
          schemaDriftRows: 0,
          invalidActorIdRows: 0,
          sourceStatus: 'observed',
          paginationAvailable: false,
          totalCountAvailable: false,
        },
      },
    ],
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
    mcpServerNames: ['bgk_g06_cast_offline_profile'],
  };
  return {
    privateKey,
    publicKeyBase64,
    claim,
    input: {
      claim,
      serverSummary,
      events,
      answerChecks: {
        exactRegisteredProfile: true,
        oneAllowedMcpTool: true,
        fixedArguments: true,
        exactCandidateBundle: true,
        offlineFixtureOnly: true,
        singleExpectedLocalResponse: true,
        boundedResultSummary: true,
        exactAcknowledgement: true,
        noRealSourceClaim: true,
        privacyPreserved: true,
      },
      codexCliVersion: '0.162.0-alpha.17.2',
      observedAt: '2026-10-17T05:00:00.000Z',
      eventStreamSha256: 'e'.repeat(64),
      serverSummarySha256: 'f'.repeat(64),
    },
  };
}

test('G06 offline report signs only matrix metadata and validates its exact receipt', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'g06-cast-offline-report-test-'));
  try {
    const { privateKey, publicKeyBase64, claim, input } = fixture();
    const reportPath = path.join(temp, path.basename(G06_CAST_OFFLINE_REPORT_PATH));
    const written = writeG06SubjectCastOfflineReport(input, {
      privateKey,
      publicKeyBase64,
      reportPath,
    });
    assert.equal(written.passed, true);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    assert.equal(validateG06SubjectCastOfflineReport(report, claim, bytes).passed, true);
    const writtenClaim = {
      ...claim,
      state: 'REPORT_WRITTEN',
      reportWritten: true,
      reportSha256: sha256(bytes),
    };
    assert.equal(validateG06SubjectCastOfflineReport(report, writtenClaim, bytes).passed, true);
    assert.equal(
      validateG06SubjectCastOfflineReport(report, writtenClaim, Buffer.from('changed')).passed,
      false,
    );
    assert.equal(bytes.toString('utf8').includes('Synthetic Character'), false);
    assert.equal(bytes.toString('utf8').includes('Synthetic Person'), false);
    assert.equal(bytes.toString('utf8').includes('990804'), false);
    assert.equal(Object.hasOwn(report, 'answer'), false);
    assert.equal(Object.hasOwn(report, 'toolOutput'), false);
    assert.equal(Object.hasOwn(report, 'rawRows'), false);

    const tampered = structuredClone(report);
    tampered.offlineFixture.requestCount = 2;
    assert.equal(validateG06SubjectCastOfflineReport(tampered, claim).passed, false);
    const badSignature = structuredClone(report);
    badSignature.runnerReceipt.signature = 'AA==';
    assert.equal(validateG06SubjectCastOfflineReport(badSignature, claim).passed, false);
    const scenarioClaim = structuredClone(report);
    scenarioClaim.scenarioId = 'G06';
    assert.equal(validateG06SubjectCastOfflineReport(scenarioClaim, claim).passed, false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('G06 offline report cannot be overwritten', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'g06-cast-offline-no-overwrite-'));
  try {
    const { privateKey, publicKeyBase64, input } = fixture();
    const reportPath = path.join(temp, path.basename(G06_CAST_OFFLINE_REPORT_PATH));
    const first = writeG06SubjectCastOfflineReport(input, {
      privateKey,
      publicKeyBase64,
      reportPath,
    });
    assert.equal(first.passed, true);
    assert.throws(() =>
      writeG06SubjectCastOfflineReport(input, { privateKey, publicKeyBase64, reportPath }),
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('G06 v2 report accepts bounded non-fatal Codex error counts with exact server proof', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'g06-cast-offline-v2-report-test-'));
  try {
    const { privateKey, publicKeyBase64, claim, input } = fixture(G06_CAST_OFFLINE_V2_PROFILE_ID);
    input.events.codexErrorItemCount = 3;
    const reportPath = path.join(temp, 'g06-subject-cast-v2.json');
    const written = writeG06SubjectCastOfflineReport(input, {
      privateKey,
      publicKeyBase64,
      reportPath,
    });
    assert.equal(written.passed, true);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    assert.equal(report.profileId, G06_CAST_OFFLINE_V2_PROFILE_ID);
    assert.equal(report.codexErrorItemCount, 3);
    assert.equal(validateG06SubjectCastOfflineReport(report, claim, bytes).passed, true);
    assert.equal(bytes.toString('utf8').includes('990805'), false);
    assert.equal(bytes.toString('utf8').includes('Synthetic Character'), false);

    input.events.codexErrorItemCount = 10_000_001;
    const overflow = writeG06SubjectCastOfflineReport(input, {
      privateKey,
      publicKeyBase64,
      reportPath: path.join(temp, 'g06-subject-cast-v2-overflow.json'),
    });
    assert.equal(overflow.passed, false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('G06 v2 catalog evidence stays bound to sourceRevision and the current target entry', () => {
  const root = prepareRoot(G06_CAST_OFFLINE_V2_PROFILE_ID);
  try {
    const sourceRevision = runGit(root, ['rev-parse', 'HEAD']);
    const { privateKey, publicKeyBase64, claim, input } = fixture(
      G06_CAST_OFFLINE_V2_PROFILE_ID,
      root,
      sourceRevision,
    );
    const reportPath = path.join(root, 'docs/live-probes/g06-source-catalog-test.json');
    mkdirSync(path.dirname(reportPath), { recursive: true });
    const written = writeG06SubjectCastOfflineReport(input, {
      privateKey,
      publicKeyBase64,
      reportPath,
      root,
    });
    assert.equal(written.passed, true, written.reason);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
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
    assert.equal(validateG06SubjectCastOfflineReport(report, claim, bytes, root).passed, true);

    const changedCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    changedCatalog.find((item) => item.name === TOOL_NAME).description += ' changed';
    writeFileSync(catalogPath, `${JSON.stringify(changedCatalog, null, 2)}\n`);
    assert.equal(validateG06SubjectCastOfflineReport(report, claim, bytes, root).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
