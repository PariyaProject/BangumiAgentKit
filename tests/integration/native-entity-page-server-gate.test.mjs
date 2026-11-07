import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main, readNativePageServerGate } from '../../scripts/acceptance/native-entity-page-server.mjs';
import { nativePageReportFixture } from '../harness/fixtures/native-page-report.mjs';
import { computeMcpBundleSha256 } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { assertNativePageReviewGate, readNativePageBundleAttestation } from '../../scripts/lib/native-entity-page-gates.mjs';
import { NATIVE_PAGE_ROOT } from '../../scripts/acceptance/native-entity-page-report.mjs';
import { NATIVE_PAGE_PROFILE } from '../../scripts/lib/native-entity-page-profile.mjs';

test('the historical native-page attestation remains bound to its original report', () => {
  const report = JSON.parse(fs.readFileSync(path.join(NATIVE_PAGE_ROOT, NATIVE_PAGE_PROFILE.reportPath), 'utf8'));
  assert.equal(readNativePageBundleAttestation(), report.gate.bundleSha256);
});

test('the original execution gate rejects a changed built presenter before the live CI query', () => {
  const fixture = nativePageReportFixture();
  const originalPath = process.env.PATH;
  const file = (relative) => path.join(fixture.root, relative);
  try {
    fs.mkdirSync(file('apps/mcp/dist'), { recursive: true });
    const presenter = file('apps/mcp/dist/result-presenter.js');
    fs.writeFileSync(presenter, 'export const original = true;\n');
    const bundleSha256 = computeMcpBundleSha256(fixture.root);
    fs.writeFileSync(file('docs/product/native-entity-page-mcp-bundle-attestation.json'), JSON.stringify({
      schemaVersion: 1, kind: 'native-entity-page-mcp-runtime-bundle-attestation-v1', bundleSha256,
    }));
    fs.writeFileSync(presenter, 'export const changed = true;\n');
    fs.mkdirSync(file('bin'));
    fs.writeFileSync(file('bin/gh'), '#!/bin/sh\nexit 98\n', { mode: 0o700 });
    fixture.git('add', '.');
    fixture.git('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'synthetic changed bundle');
    const revision = fixture.git('rev-parse', 'HEAD');
    const branch = fixture.git('branch', '--show-current');
    const base = fixture.claim.sourceCandidateSha;
    fixture.git('update-ref', 'refs/remotes/origin/master', base);
    process.env.PATH = file('bin') + path.delimiter + originalPath;
    const status = {
      run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: 292 } },
      epoch: { number: 292, pr_head_sha: revision, pr_base_ref_name: 'master', pr_base_sha: base,
        pr_is_draft: false, github_state: 'OPEN',
        state: { state: 'REVIEW_PASSED', epoch_id: NATIVE_PAGE_PROFILE.epochId, pr_number: 292,
          base_branch: 'master', base_sha: base, candidate_sha: revision, review_pass_sha: revision,
          reviewed_base_sha: base, branch, ci: { sha: revision, status: 'SUCCESS' },
          scope_closure: { related_work_remaining: false }, adversarial_preflight: { completed: true },
          advances_frontier_ids: [NATIVE_PAGE_PROFILE.frontierId],
          review_history: [{ verdict: 'PASS', candidate_sha: revision, reviewed_base_sha: base,
            reviewer_id: 'synthetic-reviewer' }],
        },
      },
    };
    assert.throws(() => assertNativePageReviewGate(status, {
      sourceRevision: revision, bundleSha256, root: fixture.root,
    }), /NATIVE_PAGE_SOURCE_GATE_FAILED/u);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    fixture.close();
  }
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
