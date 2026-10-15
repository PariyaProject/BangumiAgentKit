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
import { projectC01ComparisonResult } from '../../scripts/lib/c01-rating-count-evidence.mjs';
import {
  buildC01ProfileReport,
  validateC01SanitizedReportFile,
  writeC01ProfileReport,
} from '../../scripts/acceptance/write-c01-rating-count-report.mjs';

const PROFILE = getAgentMcpProfileById('c01-rating-count-gap-v1');
const result = {
  subjectIds: [41529, 46729],
  state: 'partial',
  subjects: [
    {
      subjectId: 41529,
      state: 'complete',
      subject: { id: 41529, name: 'BTOOOM!', nameCn: '惊爆游戏' },
      stats: { ratingTotal: 1400 },
    },
    {
      subjectId: 46729,
      state: 'partial',
      subject: { id: 46729, name: 'Sample Work' },
      stats: { ratingTotal: 250 },
    },
  ],
  metrics: [{ key: 'ratingTotal', state: 'complete', values: [1400, 250], delta: -1150 }],
  formulaVersion: 'subject-comparison-v2',
  source: {
    official: {
      class: 'official-v0',
      operations: ['GET /v0/subjects/{subject_id}'],
      attemptedAt: '2026-10-15T12:00:00.000Z',
      retrievedAt: '2026-10-15T12:00:01.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: ['subject-comparison'],
      attemptedAt: '2026-10-15T12:00:01.000Z',
      retrievedAt: '2026-10-15T12:00:01.000Z',
    },
  },
  coverage: {
    requestedSubjects: 2,
    returnedSubjects: 2,
    subjectsComplete: 1,
    subjectsPartial: 1,
    limits: { maxSubjects: 2, maxCast: 1, maxStaff: 1, maxRelations: 1 },
  },
};
const answer = JSON.stringify({
  schemaVersion: 1,
  subjects: [
    { subjectId: 41529, name: '惊爆游戏', ratingTotal: 1400 },
    { subjectId: 46729, name: 'Sample Work', ratingTotal: 250 },
  ],
  ratingTotalDelta: -1150,
  thresholdAssessment: 'not_assessable_without_threshold',
  statisticalSignificance: 'not_established',
  scopeNote:
    '这是两个条目的当前来源快照；未提供实践阈值，无法判断差异是否足够大；未进行统计显著性检验，本结果不代表统计显著性。',
});

function makeClaim() {
  const pair = generateKeyPairSync('ed25519');
  const runnerReceiptPublicKey = pair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  return {
    claim: {
      profileId: PROFILE.id,
      claimId: 'c01-test-claim',
      prNumber: 180,
      sourceCandidateSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      ciSha: 'a'.repeat(40),
      ciStatus: 'SUCCESS',
      reviewerId: 'gpt-6-luna-max-run95-pr180-round1',
      bundleSha256: 'c'.repeat(64),
      registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
      runnerReceiptPublicKey,
    },
    privateKey: pair.privateKey,
  };
}

function makeReportInput(claim) {
  return {
    claim,
    source: projectC01ComparisonResult(result),
    rawResult: result,
    answer,
    codexCliVersion: '0.1.0',
    events: {
      processExitCode: 0,
      eventStreamParsed: true,
      turnCompleted: true,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      mcpServerNames: ['bgk_c01_one_tool'],
      allowedCallCount: 1,
      deniedCallCount: 0,
    },
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
  };
}

function buildReport() {
  const { claim, privateKey } = makeClaim();
  const built = buildC01ProfileReport(makeReportInput(claim), { privateKey });
  assert.equal(built.passed, true, built.reason);
  return { report: built.report, claim };
}

test('C01 report is signed and stores only the exact bounded projection and answer checks', () => {
  const { report } = buildReport();
  assert.equal(report.source.ratingTotal.delta, -1150);
  assert.equal(report.answer.checks.exactSignedDelta, true);
  assert.equal(report.privacy.rawAnswerStored, false);
  assert.equal(report.privacy.rawResultStored, false);
  assert.equal(Object.hasOwn(report, 'rawAnswer'), false);
  assert.equal(Object.hasOwn(report, 'rawResult'), false);
});

test('C01 Harness validator accepts a matching signed report and rejects changed bytes', () => {
  const { claim, privateKey } = makeClaim();
  const root = mkdtempSync(path.join(os.tmpdir(), 'c01-report-test-'));
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const written = writeC01ProfileReport(makeReportInput(claim), { privateKey, root });
    assert.equal(written.passed, true, written.reason);
    assert.equal(validateC01SanitizedReportFile(claim, root, reportPath).passed, true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const mutated = {
      ...report,
      source: { ...report.source, ratingTotal: { ...report.source.ratingTotal, delta: 1150 } },
    };
    writeFileSync(reportPath, `${JSON.stringify(mutated, null, 2)}\n`);
    assert.equal(validateC01SanitizedReportFile(claim, root, reportPath).passed, false);
    assert.equal(
      validateC01SanitizedReportFile(claim, root, path.join(root, 'other.json')).passed,
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
