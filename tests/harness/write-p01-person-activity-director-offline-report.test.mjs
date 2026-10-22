import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/p01-person-activity-director-offline-profile.mjs';
import {
  validateP01PersonActivityDirectorOfflineReport,
  validateP01PersonActivityDirectorOfflineServerSummary,
  validateP01PersonActivityDirectorOfflineSanitizedReportFile,
  writeP01PersonActivityDirectorOfflineReport,
} from '../../scripts/acceptance/write-p01-person-activity-director-offline-report.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const PROFILE = getAgentMcpProfileById(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function projection() {
  return {
    resultState: 'partial',
    windowMonths: 36,
    matchedDirectorRows: 1,
    excludedOtherRoleRows: 1,
    unknownRoleRows: 1,
    coverage: {
      relationRowsObserved: 3,
      relationRowsSelected: 1,
      relationRowsDroppedAtLimit: 0,
      subjectDetailsSucceeded: 1,
      subjectDetailsFailed: 0,
      rowsEligible: 1,
      rowsReturned: 1,
      outputTruncated: false,
      truncated: false,
    },
  };
}

function offlineFixture() {
  return {
    profile: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    subjectDetailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    operations: ['person', 'subjects', 'subject_detail'],
  };
}

function claimAndKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const sourceCandidateSha = 'a'.repeat(40);
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    profileId: PROFILE.id,
    claimId: `profile-run-95-pr-42-${sourceCandidateSha.slice(0, 12)}-1`,
    runNumber: 95,
    prNumber: 42,
    epochId: PROFILE.epochId,
    frontierId: 'P01',
    sourceCandidateSha,
    baseSha: 'c'.repeat(40),
    ciSha: sourceCandidateSha,
    ciStatus: 'SUCCESS',
    ciRunId: '39200000001',
    ciChecks: [
      'harness-control',
      'sqlite-default',
      'host-integration',
      'standalone-release-smoke',
      'postgres-compat',
      'provider-foundation',
      'discovery-foundation',
    ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    bundleSha256: 'b'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    runnerReceiptPublicKey: publicKeyDer.toString('base64'),
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
  };
  return { claim, privateKey };
}

function serverSummary(root = ROOT) {
  const projectionResult = projection();
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === PROFILE.toolName);
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: PROFILE.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: projectionResult }],
    offlineFixture: offlineFixture(),
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
  };
}

function passingEvents() {
  return {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    exactCall: true,
    exactToolEvent: true,
    resultReadbackMatched: true,
    answerEchoedToolResult: true,
    outputSchemaApplied: true,
    mcpServerNames: ['bgk_p01_person_activity_director_offline_v1'],
  };
}

function makeTempRoot() {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'p01-activity-v2-report-test-'));
  mkdirSync(path.join(temp, 'docs/research'), { recursive: true });
  mkdirSync(path.join(temp, 'docs/live-probes'), { recursive: true });
  copyFileSync(
    path.join(ROOT, 'docs/tool-catalog.json'),
    path.join(temp, 'docs/tool-catalog.json'),
  );
  copyFileSync(
    path.join(ROOT, PROFILE.selectionEvidencePath),
    path.join(temp, PROFILE.selectionEvidencePath),
  );
  return temp;
}

test('P01 director v1 server summary binds exact offline fixture, tool catalog, and bounded projection', () => {
  assert.equal(
    validateP01PersonActivityDirectorOfflineServerSummary(
      serverSummary(),
      'a'.repeat(40),
      'b'.repeat(64),
      ROOT,
    ),
    true,
  );
  const tampered = serverSummary();
  tampered.offlineFixture.requestCount = 4;
  assert.equal(
    validateP01PersonActivityDirectorOfflineServerSummary(tampered, 'a'.repeat(40), 'b'.repeat(64), ROOT),
    false,
  );
});

test('P01 director v1 writes and verifies a sanitized signed matrix-only report', () => {
  const temp = makeTempRoot();
  const { claim, privateKey } = claimAndKey();
  try {
    const expected = projection();
    const answer = JSON.stringify(expected);
    const result = writeP01PersonActivityDirectorOfflineReport(
      {
        claim,
        serverSummary: serverSummary(temp),
        events: passingEvents(),
        answer,
        codexCliVersion: '0.54.0',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey, root: temp },
    );
    assert.equal(result.passed, true, result.reason);
    const reportPath = path.join(temp, PROFILE.reportPath);
    assert.equal(existsSync(reportPath), true);
    const text = readFileSync(reportPath, 'utf8');
    assert.equal(text.includes('Synthetic Director Filter Fixture'), false);
    assert.equal(text.includes('Synthetic Director Match'), false);
    assert.equal(text.includes('Synthetic Nonmatching Role'), false);
    assert.equal(text.includes('Synthetic Unknown Role'), false);
    assert.equal(text.includes('合成导演匹配'), false);
    const report = JSON.parse(text);
    const writtenClaim = {
      ...claim,
      state: 'REPORT_WRITTEN',
      reportWritten: true,
      reportPath: PROFILE.reportPath,
      reportSha256: result.reportSha256,
      runnerReceiptSha256: sha256(canonicalAgentMcpProfileJson(report.runnerReceipt)),
    };
    const validation = validateP01PersonActivityDirectorOfflineSanitizedReportFile(
      writtenClaim,
      temp,
      reportPath,
    );
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.report.scenarioId, null);
    assert.equal(validation.report.privacy.oauthAttempted, false);
    assert.equal(validation.report.privacy.qqPipelineTested, false);

    const harnessStatus = {
      state: 'REPORT_WRITTEN',
      run: 95,
      pr: 42,
      epoch_id: PROFILE.epochId,
      profile_id: PROFILE.id,
      frontier_id: 'P01',
      tool_name: PROFILE.toolName,
      argument_profile: PROFILE.argumentProfile,
      expected_arguments_sha256: agentMcpProfileArgumentsSha256(PROFILE),
      registry_sha256: agentMcpProfileRegistrySha256(PROFILE.id),
      claim_label_present: true,
      terminal_label_present: true,
      disposition: writtenClaim,
    };
    const pythonValidation = spawnSync(
      'python3',
      ['-c', [
        'import json, sys',
        'import importlib.util',
        'from pathlib import Path',
        'sys.path.insert(0, str(Path.cwd() / "scripts"))',
        'from acceptance.p01_person_activity_director_offline_acceptance import p01_person_activity_director_offline_signed_report_matches',
        'value = json.load(sys.stdin)',
        'passed = p01_person_activity_director_offline_signed_report_matches(value["report"], Path(value["reportPath"]), harness_status=value["harnessStatus"], root=Path(value["root"]))',
        'spec = importlib.util.spec_from_file_location("generator", Path.cwd() / "scripts/generate-tool-acceptance-tasks.py")',
        'generator = importlib.util.module_from_spec(spec)',
        'spec.loader.exec_module(generator)',
        'generator_passed = generator.codex_p01_person_activity_director_offline_report_is_valid(value["report"], Path(value["reportPath"]), value["harnessStatus"], Path(value["root"]))',
        'checker_spec = importlib.util.spec_from_file_location("table_checker", Path.cwd() / "scripts/check-tool-acceptance-table.py")',
        'checker = importlib.util.module_from_spec(checker_spec)',
        'checker_spec.loader.exec_module(checker)',
        'table_passed = checker.p01_person_activity_director_offline_report_matches(value["report"]["toolName"], "docs/live-probes/p01-person-activity-director-offline-run95-v1.json", value["report"], report_path=Path(value["reportPath"]), harness_status=value["harnessStatus"], root=Path(value["root"]))',
        'print(json.dumps({"passed": passed, "generatorPassed": generator_passed, "tablePassed": table_passed}))',
      ].join('\n')],
      {
        cwd: ROOT,
        input: JSON.stringify({
          report: JSON.parse(text),
          reportPath,
          harnessStatus,
          root: temp,
        }),
        encoding: 'utf8',
      },
    );
    assert.equal(pythonValidation.status, 0, pythonValidation.stderr);
    assert.deepEqual(JSON.parse(pythonValidation.stdout), {
      passed: true,
      generatorPassed: true,
      tablePassed: true,
    });

    const unsignedReport = {
      ...report,
      runnerReceipt: { ...report.runnerReceipt, signature: '' },
    };
    const unsignedBytes = Buffer.from(`${JSON.stringify(unsignedReport)}\n`);
    writeFileSync(reportPath, unsignedBytes);
    const unsignedDisposition = {
      ...writtenClaim,
      reportSha256: sha256(unsignedBytes),
      runnerReceiptSha256: sha256(canonicalAgentMcpProfileJson(unsignedReport.runnerReceipt)),
    };
    const unsignedStatus = { ...harnessStatus, disposition: unsignedDisposition };
    const unsignedValidation = spawnSync(
      'python3',
      ['-c', [
        'import json, sys',
        'from pathlib import Path',
        'sys.path.insert(0, str(Path.cwd() / "scripts"))',
        'from acceptance.p01_person_activity_director_offline_acceptance import p01_person_activity_director_offline_signed_report_matches',
        'value = json.load(sys.stdin)',
        'passed = p01_person_activity_director_offline_signed_report_matches(value["report"], Path(value["reportPath"]), harness_status=value["harnessStatus"], root=Path(value["root"]))',
        'print(json.dumps({"passed": passed}))',
      ].join('\n')],
      {
        cwd: ROOT,
        input: JSON.stringify({
          report: unsignedReport,
          reportPath,
          harnessStatus: unsignedStatus,
          root: temp,
        }),
        encoding: 'utf8',
      },
    );
    assert.equal(unsignedValidation.status, 0, unsignedValidation.stderr);
    assert.deepEqual(JSON.parse(unsignedValidation.stdout), { passed: false });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('P01 director v1 report validator rejects changed fixture receipts and result rows', () => {
  const temp = makeTempRoot();
  const { claim, privateKey } = claimAndKey();
  try {
    const answer = JSON.stringify(projection());
    const result = writeP01PersonActivityDirectorOfflineReport(
      {
        claim,
        serverSummary: serverSummary(temp),
        events: passingEvents(),
        answer,
        codexCliVersion: '0.54.0',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey, root: temp },
    );
    assert.equal(result.passed, true, result.reason);
    const pathToReport = path.join(temp, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(pathToReport, 'utf8'));
    report.offlineFixture.unexpectedRequestCount = 1;
    const bytes = Buffer.from(`${JSON.stringify(report)}\n`);
    assert.equal(
      validateP01PersonActivityDirectorOfflineReport(report, claim, bytes, temp).passed,
      false,
    );
    const changedResult = JSON.parse(readFileSync(pathToReport, 'utf8'));
    changedResult.resultSummary.matchedDirectorRows = 2;
    const changedResultBytes = Buffer.from(`${JSON.stringify(changedResult)}\n`);
    assert.equal(
      validateP01PersonActivityDirectorOfflineReport(
        changedResult,
        claim,
        changedResultBytes,
        temp,
      ).passed,
      false,
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
