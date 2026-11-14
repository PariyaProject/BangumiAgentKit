import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
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

function activeProcess(pid) {
  try {
    const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return state.length > 0 && !state.startsWith('Z');
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

function killFixtureGroup(pid) {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

for (const [signal, mode] of [
  ['SIGTERM', 'running'],
  ['SIGINT', 'ack-failure'],
  ['SIGTERM', 'before-spawn'],
]) {
  test(
    `parent ${signal} (${mode}) stops owned processes and retains cancellation through reconciliation`,
    {
      timeout: 15000,
    },
    async () => {
      const execution = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-cancel-exec-'));
      const diagnostic = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-cancel-diag-'));
      const ready = path.join(execution, 'ready.json');
      const messages = [];
      const parent = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL('./fixtures/native-relation-model-cancellation.mjs', import.meta.url),
          ),
          mode,
          execution,
          diagnostic,
        ],
        { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] },
      );
      parent.on('message', (message) => messages.push(message));
      const exited = new Promise((resolve, reject) => {
        parent.once('close', (code, signal) => resolve({ code, signal }));
        parent.once('error', reject);
      });
      let pids = [];
      try {
        for (let i = 0; i < 200 && !fs.existsSync(ready) && !messages.includes('ready'); i++)
          await delay(10);
        if (mode === 'before-spawn') assert(messages.includes('ready'));
        else {
          pids = JSON.parse(fs.readFileSync(ready));
          assert.equal(pids.length, 2);
          assert(pids.every(activeProcess));
        }
        assert(parent.kill(signal));
        assert.deepEqual(await exited, { code: 0, signal: null });
        const result = messages.at(-1);
        assert.equal(result.reason, 'AGENT_MCP_PROCESS_CANCELLED');
        assert.equal(result.acknowledgement, 'INCONCLUSIVE');
        assert.equal(
          result.terminal.state,
          mode === 'ack-failure' ? 'INCONCLUSIVE_ACK_PENDING' : 'INCONCLUSIVE',
        );
        assert.equal(result.terminal.retryAllowed, false);
        assert.equal(result.executionRemoved, true);
        const retained = JSON.parse(
          fs.readFileSync(path.join(diagnostic, 'agent-mcp-failure-observation.json')),
        );
        assert.equal(retained.process.reason, 'cancelled');
        assert.equal(retained.acceptanceCredit, false);
        assert.equal(retained.retryAllowed, false);
        if (mode === 'before-spawn') assert.equal(retained.process.reportedStdoutBytes, 0);
        for (let i = 0; i < 50 && pids.some(activeProcess); i++) await delay(10);
        assert(pids.every((pid) => !activeProcess(pid)));
      } finally {
        if (pids.length === 0 && fs.existsSync(ready)) pids = JSON.parse(fs.readFileSync(ready));
        if (pids[0] && pids.some(activeProcess)) {
          killFixtureGroup(pids[0]);
        }
        if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
        await exited;
        fs.rmSync(execution, { recursive: true, force: true });
        fs.rmSync(diagnostic, { recursive: true, force: true });
      }
    },
  );
}
