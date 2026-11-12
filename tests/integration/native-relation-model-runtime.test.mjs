import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  runRelationModelProcess,
  inspectRelationModelResult,
  retainRelationDiagnostic,
  readRelationModelSummary,
  reconcileRelationModelResult,
} from '../../scripts/acceptance/run-native-relation-model.mjs';

for (const mode of [
  'normal',
  'early-exit',
  'tool-error',
  'missing-summary',
  'malformed-summary',
  'timeout',
  'output-limit',
]) {
  test(`synthetic process/real SDK ${mode} retains safe observations before execution cleanup`, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-runtime-test-'));
    const diagnostic = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-diagnostic-test-'));
    const claim = { sourceCandidateSha: 'a'.repeat(40), bundleSha256: 'b'.repeat(64) };
    fs.writeFileSync(path.join(directory, 'claim.json'), JSON.stringify(claim), { mode: 0o600 });
    try {
      const processResult = await runRelationModelProcess(
        process.execPath,
        [
          fileURLToPath(new URL('./fixtures/native-relation-model-codex.mjs', import.meta.url)),
          directory,
          mode,
        ],
        {
          timeoutMs: mode === 'timeout' ? 300 : 10000,
          maxStdout: 512 * 1024,
          env: { PATH: process.env.PATH },
        },
      );
      let summaryText = null,
        summary = null;
      try {
        summaryText = readRelationModelSummary(directory);
        summary = JSON.parse(summaryText);
      } catch {
        summary = summaryText === null ? null : {};
      }
      const inspected = inspectRelationModelResult(processResult, summary, claim);
      assert.equal(inspected.passed, ['normal', 'early-exit'].includes(mode));
      const published = retainRelationDiagnostic(
        { processResult, serverSummary: summaryText, stage: 'inspection' },
        diagnostic,
        directory,
      );
      const before = fs.readFileSync(published.path);
      fs.rmSync(directory, { recursive: true });
      assert(fs.readFileSync(published.path).equals(before));
      const observed = JSON.parse(before);
      assert.equal(observed.acceptanceCredit, false);
      assert.equal(observed.retryAllowed, false);
      assert.deepEqual(observed.verified, {
        model: false,
        source: false,
        artifact: false,
        cleanup: false,
      });
      assert.equal(before.includes(Buffer.from('9632001')), false);
      assert.equal(before.includes(Buffer.from('合成作品')), false);
      if (mode === 'normal' || mode === 'early-exit') {
        assert.equal(observed.native.fixtureReads, 5);
        assert.equal(observed.native.reportedClosed, true);
      }
      if (mode === 'missing-summary') assert.equal(observed.native.status, 'missing');
      if (mode === 'malformed-summary') assert.equal(observed.native.status, 'invalid');
      if (mode === 'tool-error') {
        assert.equal(observed.native.fixtureReads, 0);
        assert.equal(observed.native.reportedFailureCode, 'NATIVE_RELATION_OPERATION_DENIED');
      }
      if (mode === 'timeout') assert.equal(processResult.reason, 'AGENT_MCP_PROCESS_TIMED_OUT');
      if (mode === 'output-limit')
        assert.equal(processResult.reason, 'AGENT_MCP_PROCESS_OUTPUT_LIMIT');
      // A later failed terminal acknowledgement cannot erase the actual first observation.
      let acknowledgements = 0;
      const pending = reconcileRelationModelResult(
        {
          profile_id: 'native-relation-safety-model-v1',
          state: 'CLAIMED',
          terminal_label_present: false,
          disposition: {
            profileId: 'native-relation-safety-model-v1',
            state: 'CLAIMED',
            retryAllowed: false,
          },
        },
        { passed: inspected.passed },
        inspected.passed ? 'f'.repeat(64) : null,
        () => {
          acknowledgements++;
          throw new Error('synthetic ack failure');
        },
      );
      assert.equal(acknowledgements, 1);
      assert.equal(pending.retryAllowed, false);
      assert.equal(
        pending.state,
        inspected.passed ? 'REPORT_ACK_PENDING' : 'INCONCLUSIVE_ACK_PENDING',
      );
      assert(fs.readFileSync(published.path).equals(before));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
      fs.rmSync(diagnostic, { recursive: true, force: true });
    }
  });
}
