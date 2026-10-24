import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectRendererDesignBaselines } from '../../scripts/lib/renderer-design-baselines.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'design-baseline-'));
  const artifact = (name) => {
    writeFileSync(path.join(root, name), name);
    return { path: name, sha256: createHash('sha256').update(name).digest('hex') };
  };
  const entry = {
    id: 'magazine-v1',
    design_pack: 'anime-magazine',
    template: 'subject-cohort-comparison',
    source_commit: 'a'.repeat(40),
    source_inputs: [artifact('component.tsx')],
    reference: artifact('reference.png'),
    native_receipt: artifact('receipt.json'),
    native_previews: [artifact('native.png')],
    quality_scores: [4, 4, 4, 4, 4, 4],
    release_decision: 'ACCEPTED_FOR_SCOPE',
    user_aesthetic_acceptance: 'unobserved',
    supersedes: null,
  };
  const registry = { schema: 'bangumi-renderer-design-baselines/v1', baselines: [entry] };
  return {
    root,
    artifact,
    entry,
    registry,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('a completed scoped design survives serialization and routes to other work without invented user approval', () => {
  const f = fixture();
  try {
    const inspected = inspectRendererDesignBaselines(f.root, {
      registry: JSON.parse(JSON.stringify(f.registry)),
    });
    assert.equal(inspected.ok, true);
    assert.equal(inspected.locks[0].action, 'PRESERVE_BASELINE_CONTINUE_OTHER_WORK');
    assert.equal(inspected.locks[0].user_aesthetic_acceptance, 'unobserved');
  } finally {
    f.cleanup();
  }
});

test('source, reference and delivered image drift are rejected before a new Candidate', () => {
  for (const filename of ['component.tsx', 'reference.png', 'native.png', 'receipt.json']) {
    const f = fixture();
    try {
      writeFileSync(path.join(f.root, filename), 'unrecorded restyling');
      assert.equal(
        inspectRendererDesignBaselines(f.root, { registry: f.registry }).issues[0].code,
        'DESIGN_BASELINE_SOURCE_DRIFT',
      );
    } finally {
      f.cleanup();
    }
  }
});

test('new packs are independent; replacing an existing design needs evidence and preserves its history', () => {
  const f = fixture();
  try {
    const prior = structuredClone(f.registry);
    f.registry.baselines.push({
      ...structuredClone(f.entry),
      id: 'gallery-v1',
      design_pack: 'clean-gallery',
    });
    assert.equal(
      inspectRendererDesignBaselines(f.root, { registry: f.registry, priorRegistry: prior }).ok,
      true,
    );
    const successor = { ...structuredClone(f.entry), id: 'magazine-v2', supersedes: 'magazine-v1' };
    f.registry.baselines.push(successor);
    assert.equal(
      inspectRendererDesignBaselines(f.root, { registry: f.registry }).issues[0].code,
      'DESIGN_REOPEN_EVIDENCE_REQUIRED',
    );
    successor.reopen = {
      kind: 'verified_regression',
      evidence_ref: 'tests/render/long-title.test.ts',
      reason: 'A reproducible long-title overlap needs a bounded layout correction.',
    };
    assert.equal(
      inspectRendererDesignBaselines(f.root, { registry: f.registry, priorRegistry: prior }).ok,
      true,
    );
    f.registry.baselines[0].quality_scores[0] = 5;
    assert.equal(
      inspectRendererDesignBaselines(f.root, { registry: f.registry, priorRegistry: prior })
        .issues[0].code,
      'DESIGN_BASELINE_HISTORY_CHANGED',
    );
  } finally {
    f.cleanup();
  }
});

test('escaping artifacts and unsupported approval claims fail closed; legacy checkouts have no invented baseline', () => {
  const f = fixture();
  try {
    assert.deepEqual(inspectRendererDesignBaselines(f.root).locks, []);
    f.entry.source_inputs[0].path = '../outside';
    assert.equal(inspectRendererDesignBaselines(f.root, { registry: f.registry }).ok, false);
    f.entry.source_inputs[0].path = 'component.tsx';
    f.entry.user_aesthetic_acceptance = 'assumed';
    assert.equal(inspectRendererDesignBaselines(f.root, { registry: f.registry }).ok, false);
  } finally {
    f.cleanup();
  }
});

test('removing a released registry fails closed, while JSON key reordering preserves history', () => {
  const f = fixture();
  try {
    assert.equal(inspectRendererDesignBaselines(f.root, { priorRegistry: f.registry }).ok, false);
    const reordered = structuredClone(f.registry);
    reordered.baselines[0] = Object.fromEntries(Object.entries(reordered.baselines[0]).reverse());
    assert.equal(
      inspectRendererDesignBaselines(f.root, { registry: reordered, priorRegistry: f.registry }).ok,
      true,
    );
    mkdirSync(path.join(f.root, '.git'));
    writeFileSync(path.join(f.root, '.git', 'private'), 'private');
    symlinkSync(path.join(f.root, '.git', 'private'), path.join(f.root, 'alias'));
    f.entry.source_inputs[0] = {
      path: 'alias',
      sha256: createHash('sha256').update('private').digest('hex'),
    };
    assert.equal(inspectRendererDesignBaselines(f.root, { registry: f.registry }).ok, false);
  } finally {
    f.cleanup();
  }
});

test('the CLI source reader must recover the exact bytes at the recorded source commit', () => {
  const f = fixture();
  try {
    assert.equal(
      inspectRendererDesignBaselines(f.root, {
        registry: f.registry,
        readSourceAtCommit: (commit, file) => {
          assert.equal(commit, f.entry.source_commit);
          return Buffer.from(file);
        },
      }).ok,
      true,
    );
    const drifted = inspectRendererDesignBaselines(f.root, {
      registry: f.registry,
      readSourceAtCommit: () => Buffer.from('other commit'),
    });
    assert.equal(drifted.ok, false);
    assert.equal(drifted.issues[0].code, 'DESIGN_BASELINE_SOURCE_COMMIT_INVALID');
  } finally {
    f.cleanup();
  }
});
