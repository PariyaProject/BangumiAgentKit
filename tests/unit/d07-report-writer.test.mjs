import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalHash } from '../../scripts/lib/frontier-ledger.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_LIMITATIONS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';
import {
  buildD07SanitizedReport,
  validateD07SanitizedReport,
  writeD07AgentMcpReport,
} from '../../scripts/acceptance/write-d07-agent-mcp-report.mjs';

const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function claimFixture() {
  return {
    claimId: 'd07-run-95-pr-158-candidate-claim',
    frontierId: 'D07',
    epochId: 'run95-d07-current-rank-by-release-year',
    runNumber: 95,
    prNumber: 158,
    toolName: 'bangumi.query_subjects',
    argumentProfile: 'fixed-d07-current-rank-by-source-year-2016-2025-v1',
    expectedArgumentsSha256: canonicalHash(D07_QUERY_ARGUMENTS_BY_YEAR),
    expectedCallCount: 10,
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    bundleSha256: 'c'.repeat(64),
    reviewerId: 'gpt-6-luna-max-run95-pr158-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    state: 'CLAIMED',
    retryAllowed: false,
  };
}

function acceptedInput(claim) {
  const callSummaries = D07_EXPECTED_YEARS.map((year, index) => ({
    year,
    state: index % 3 === 2 ? 'partial' : 'ok',
    operation: 'browseSubjects',
    retrievedAt: `2026-10-13T12:${String(index).padStart(2, '0')}:00.000Z`,
    totalKind: 'exact',
    coverage: {
      state: ['complete', 'unknown', 'partial'][index % 3],
      requested: 1,
      scanned: index % 3 === 0 ? 8 : 20,
      matched: index % 3 === 0 ? 4 : 7,
      returned: 1,
    },
    itemCount: 1,
    items: [{ id: 10000 + year, rank: index + 1, titleSha256: hash(`Example anime ${year}`) }],
  }));
  const answer = JSON.stringify({
    schemaVersion: 1,
    interpretation: 'current_rank_by_source_year',
    rows: callSummaries.map((call) => ({
      year: call.year,
      subjectId: call.items[0].id,
      title: `Example anime ${call.year}`,
      rank: call.items[0].rank,
    })),
    limitations: D07_LIMITATIONS,
  });
  const args = D07_EXPECTED_YEARS.map((year) => D07_QUERY_ARGUMENTS_BY_YEAR[year]);
  return {
    claim,
    answer,
    observedAt: '2026-10-13T12:30:00.000Z',
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    codexCliVersion: '0.162.0-alpha.17.2',
    processExitCode: 0,
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    bundleSha256: claim.bundleSha256,
    catalogSha256: 'd'.repeat(64),
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    serverSummary: {
      sourceRevision: claim.sourceCandidateSha,
      bundleSha256: claim.bundleSha256,
      serverToolNames: ['bangumi.query_subjects'],
      serverToolCount: 1,
      expectedArgumentsSha256: claim.expectedArgumentsSha256,
      expectedCallCount: 10,
      allowedCallCount: 10,
      deniedCallCount: 0,
      sequence: { allowedCalls: 10, deniedCalls: 0, nextIndex: 10, terminal: false },
      callSummaries,
      activeYear: null,
      privacy: {
        authProfile: 'anonymous',
        oauthAttempted: false,
        accountDataRead: false,
        communityRead: false,
        writesAttempted: false,
        qqPipelineTested: false,
        timClientTested: false,
        promptStored: false,
        answerStored: false,
        rawResultStored: false,
        credentialsStored: false,
      },
    },
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexEvents: {
      eventStreamParsed: true,
      eventStreamComplete: true,
      turnCompleted: true,
      turnFailed: false,
      unexpectedEventTypes: 0,
      codexMcpToolEventCount: 10,
      codexErrorItemCount: 0,
      mcpServerNames: Array(10).fill('bgk_d07_one_tool'),
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      toolCalls: args.map((arguments_) => ({
        name: 'bangumi.query_subjects',
        arguments: arguments_,
        state: 'DONE',
      })),
    },
  };
}

test('writes only hash-bound D07 evidence without retaining answer or returned titles', () => {
  const claim = claimFixture();
  const result = buildD07SanitizedReport(acceptedInput(claim), claim);

  assert.equal(result.passed, true);
  assert.equal(result.report.evidenceKind, 'codex_cli_d07_current_rank_agent_mcp');
  assert.equal(result.report.answerChecks.allPassed, true);
  assert.equal(result.report.resultSummaries.length, 10);
  assert.equal(result.report.coverageSummaries.length, 10);
  assert.deepEqual(
    [...new Set(result.report.coverageSummaries.map((row) => row.coverageState))].sort(),
    ['complete', 'partial', 'unknown'],
  );
  assert.equal(result.report.coverageSummaries[1].scanned, 20);
  assert.equal(result.report.coverageSummaries[1].matched, 7);
  assert.equal(result.report.coverageSummaries[1].returned, 1);
  assert.equal(result.report.rawAnswerPersisted, false);
  assert.equal(result.report.rawToolResultPersisted, false);
  assert.equal(Object.hasOwn(result.report, 'answer'), false);
  assert.equal(Object.hasOwn(result.report, 'toolCalls'), false);
  assert.equal(JSON.stringify(result.report).includes('Example anime'), false);
  assert.equal(validateD07SanitizedReport(result.report, claim).passed, true);
});

test('does not create a report when any one-shot runner invariant fails', () => {
  const claim = claimFixture();
  const input = acceptedInput(claim);
  input.codexEvents.nonMcpToolEventCount = 1;

  const result = buildD07SanitizedReport(input, claim);

  assert.equal(result.passed, false);
  assert.equal(Object.hasOwn(result, 'report'), false);
});

test('rejects persisted reports with extra raw fields or a mismatched claim', () => {
  const claim = claimFixture();
  const result = buildD07SanitizedReport(acceptedInput(claim), claim);
  assert.equal(result.passed, true);

  assert.equal(
    validateD07SanitizedReport({ ...result.report, answer: 'raw answer' }, claim).passed,
    false,
  );
  assert.equal(
    validateD07SanitizedReport(result.report, { ...claim, claimId: 'different-claim' }).passed,
    false,
  );
});

test('writes a claim-bound report atomically with mode 0600 and refuses replacement', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd07-report-writer-test-'));
  const claim = claimFixture();
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const result = writeD07AgentMcpReport(acceptedInput(claim), claim, root);
    assert.equal(result.passed, true);
    const reportBytes = fs.readFileSync(result.reportPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    assert.equal(createHash('sha256').update(reportBytes).digest('hex'), result.reportSha256);
    assert.equal(fs.statSync(result.reportPath).mode & 0o777, 0o600);
    assert.equal(validateD07SanitizedReport(report, claim).passed, true);
    assert.equal(reportBytes.toString('utf8').includes('Example anime'), false);
    assert.throws(
      () => writeD07AgentMcpReport(acceptedInput(claim), claim, root),
      /already exists/u,
    );
    assert.equal(fs.readFileSync(result.reportPath).equals(reportBytes), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
