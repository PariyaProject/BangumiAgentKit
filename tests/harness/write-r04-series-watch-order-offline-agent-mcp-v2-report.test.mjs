import { r04SignedReportInput as input } from './fixtures/r04-signed-report.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { R04_SERIES_WATCH_ORDER_V2_PROFILE_ID } from '../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
import {
  buildR04ProfileReport,
  validateR04ProfileReport,
  validateR04SeriesWatchOrderOfflineV2SanitizedReportFile,
} from '../../scripts/acceptance/write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs';

const PROFILE = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const ACK = 'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ';
test('R04 report builder signs only sanitized matrix evidence without scenario credit', () => {
  const value = input();
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'r04-report-test-'));
  const reportPath = path.join(tempRoot, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const result = buildR04ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: value.events,
        answer: ACK,
        codexCliVersion: '0.1.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root: tempRoot, reportPath },
    );
    assert.equal(result.passed, true, result.reason);
    assert.equal(result.reportPath, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.frontierId, 'R04');
    assert.equal(report.scenarioId, null);
    assert.deepEqual(report.resultSummary, value.serverSummary.results[0].resultSummary);
    assert.equal(Object.hasOwn(report, 'answer'), false);
    assert.equal(Object.hasOwn(report, 'prompt'), false);
    const validated = validateR04SeriesWatchOrderOfflineV2SanitizedReportFile(
      value.claim,
      tempRoot,
      reportPath,
    );
    assert.equal(validated.passed, true, validated.reason);
    assert.equal(validated.reportSha256, result.reportSha256);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('R04 report validator rejects modified signatures and local request counters', () => {
  const value = input();
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'r04-report-tamper-'));
  const reportPath = path.join(tempRoot, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const result = buildR04ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: value.events,
        answer: ACK,
        codexCliVersion: '0.1.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root: tempRoot, reportPath },
    );
    assert.equal(result.passed, true, result.reason);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.offlineFixture.requestCount = 3;
    writeFileSync(reportPath, JSON.stringify(report));
    assert.equal(
      validateR04SeriesWatchOrderOfflineV2SanitizedReportFile(value.claim, tempRoot, reportPath)
        .passed,
      false,
    );
    const tampered = { ...report, offlineFixture: value.serverSummary.offlineFixture };
    tampered.resultSummary.subjectId = 12;
    assert.equal(validateR04ProfileReport(tampered, value.claim).passed, false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('R04 report builder refuses a non-exact tool call', () => {
  const value = input();
  const result = buildR04ProfileReport(
    {
      claim: value.claim,
      serverSummary: value.serverSummary,
      events: { ...value.events, exactCall: false },
      answer: ACK,
      codexCliVersion: '0.1.0',
      eventStreamSha256: '1'.repeat(64),
      serverSummarySha256: '2'.repeat(64),
    },
    { privateKey: value.keys.privateKey },
  );
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'R04_RUNNER_GATE_INVALID');
});
