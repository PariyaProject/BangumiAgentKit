import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { C02_PROFILE_ID, projectC02ComparisonResult } from '../../scripts/lib/c02-tv-movie-comparison-evidence.mjs';
import {
  buildC02ProfileReport,
  validateC02SanitizedReportFile,
  writeC02ProfileReport,
} from '../../scripts/acceptance/write-c02-tv-movie-comparison-report.mjs';
import { C02_ANSWER, C02_COMPARISON_RESULT, C02_EVENTS } from './c02-tv-movie-fixtures.mjs';

const PROFILE = getAgentMcpProfileById(C02_PROFILE_ID);

function makeClaim() {
  const pair = generateKeyPairSync('ed25519');
  const runnerReceiptPublicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return {
    claim: {
      claimId: 'c02-test-claim',
      profileId: PROFILE.id,
      frontierId: PROFILE.frontierId,
      epochId: PROFILE.epochId,
      runNumber: 95,
      prNumber: 201,
      sourceCandidateSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      ciSha: 'a'.repeat(40),
      ciStatus: 'SUCCESS',
      reviewerId: 'gpt-6-luna-max-run95-pr201-round1',
      toolName: PROFILE.toolName,
      argumentProfile: PROFILE.argumentProfile,
      expectedArguments: PROFILE.calls.map((call) => call.arguments),
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
      registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
      bundleSha256: 'c'.repeat(64),
      runnerReceiptPublicKey,
    },
    privateKey: pair.privateKey,
  };
}

function makeInput(claim) {
  return {
    claim,
    source: projectC02ComparisonResult(C02_COMPARISON_RESULT),
    rawResult: C02_COMPARISON_RESULT,
    answer: C02_ANSWER,
    codexCliVersion: '0.1.0',
    events: C02_EVENTS,
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
  };
}

test('C02 report is signed and contains only the bounded public projection and check results', () => {
  const { claim, privateKey } = makeClaim();
  const built = buildC02ProfileReport(makeInput(claim), { privateKey });
  assert.equal(built.passed, true, built.reason);
  assert.equal(built.report.source.metrics[0].delta, -69);
  assert.equal(built.report.answer.checks.exactDeltas, true);
  assert.equal(built.report.privacy.rawAnswerStored, false);
  assert.equal(built.report.privacy.rawResultStored, false);
  assert.equal(Object.hasOwn(built.report, 'rawAnswer'), false);
  assert.equal(Object.hasOwn(built.report, 'rawResult'), false);
  assert.equal(Object.hasOwn(built.report, 'toolOutput'), false);
});

test('C02 Harness validator accepts a signed report and rejects changed report bytes', () => {
  const { claim, privateKey } = makeClaim();
  const root = mkdtempSync(path.join(os.tmpdir(), 'c02-report-test-'));
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const written = writeC02ProfileReport(makeInput(claim), { privateKey, root });
    assert.equal(written.passed, true, written.reason);
    assert.equal(validateC02SanitizedReportFile(claim, root, reportPath).passed, true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const mutated = {
      ...report,
      source: { ...report.source, metrics: report.source.metrics.map((metric, index) => index === 0 ? { ...metric, delta: 69 } : metric) },
    };
    writeFileSync(reportPath, `${JSON.stringify(mutated, null, 2)}\n`);
    assert.equal(validateC02SanitizedReportFile(claim, root, reportPath).passed, false);
    assert.equal(validateC02SanitizedReportFile(claim, root, path.join(root, 'other.json')).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('C02 report writer refuses an answer not bound to the structured result and invalid execution events', () => {
  const { claim, privateKey } = makeClaim();
  const wrongAnswer = makeInput(claim);
  wrongAnswer.answer = JSON.stringify({ ...JSON.parse(C02_ANSWER), metrics: [] });
  assert.equal(buildC02ProfileReport(wrongAnswer, { privateKey }).passed, false);

  const wrongEvents = makeInput(claim);
  wrongEvents.events = { ...C02_EVENTS, nonMcpToolEventCount: 1 };
  assert.equal(buildC02ProfileReport(wrongEvents, { privateKey }).passed, false);
});

test('C02 writer refuses a duplicate report path', () => {
  const { claim, privateKey } = makeClaim();
  const root = mkdtempSync(path.join(os.tmpdir(), 'c02-report-once-test-'));
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    assert.equal(writeC02ProfileReport(makeInput(claim), { privateKey, root }).passed, true);
    assert.equal(writeC02ProfileReport(makeInput(claim), { privateKey, root }).reason, 'C02_REPORT_ALREADY_EXISTS');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
