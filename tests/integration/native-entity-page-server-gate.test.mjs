import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main, readNativePageServerGate } from '../../scripts/acceptance/native-entity-page-server.mjs';
import { nativePageReportFixture } from '../harness/fixtures/native-page-report.mjs';
import { computeMcpBundleSha256 } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { readNativePageBundleAttestation } from '../../scripts/lib/native-entity-page-gates.mjs';
import { NATIVE_PAGE_ROOT } from '../../scripts/acceptance/native-entity-page-report.mjs';

test('the exact native-page attestation matches the current built workspace before any one-shot', () => {
  assert.equal(readNativePageBundleAttestation(), computeMcpBundleSha256(NATIVE_PAGE_ROOT));
});

test('native executable imports without authority and rejects unsafe gate files before any control/model/source request', async () => {
  const fixture = nativePageReportFixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-native-pages-cold-'));
  fs.chmodSync(directory, 0o700);
  const gate = path.join(directory, 'gate.json');
  try {
    await assert.rejects(main(['--unexpected']), /SERVER_ARGS_INVALID/u);
    fs.writeFileSync(gate, JSON.stringify({ claim: fixture.claim }), { mode: 0o600 });
    assert.equal(readNativePageServerGate(gate).claim.claimId, fixture.claim.claimId);
    fs.chmodSync(gate, 0o644);
    assert.throws(() => readNativePageServerGate(gate), /GATE_FILE_INVALID/u);
    fs.chmodSync(gate, 0o600);
    fs.chmodSync(directory, 0o755);
    assert.throws(() => readNativePageServerGate(gate), /GATE_FILE_INVALID/u);
    fs.chmodSync(directory, 0o700);
    const real = path.join(directory, 'actual.json');
    fs.renameSync(gate, real); fs.symlinkSync(real, gate);
    assert.throws(() => readNativePageServerGate(gate), /GATE_FILE_INVALID/u);
    fs.unlinkSync(gate); fs.renameSync(real, gate);
    const old = process.env.HARNESS_MOCK_STATE;
    process.env.HARNESS_MOCK_STATE = '/synthetic-never-read';
    try { await assert.rejects(main(['--gate-file', gate]), /MOCK_CONTROL_FORBIDDEN/u); }
    finally {
      if (old === undefined) delete process.env.HARNESS_MOCK_STATE;
      else process.env.HARNESS_MOCK_STATE = old;
    }
    assert.equal(fs.existsSync(path.join(directory, 'server-started.json')), false);
    assert.equal(fs.existsSync(path.join(directory, 'summary.json')), false);
  } finally { fs.rmSync(directory, { recursive: true }); fixture.close(); }
});
