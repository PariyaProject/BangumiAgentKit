import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertProductCommitHygiene } from '../../scripts/lib/agent-harness-core.mjs';
import { readProductCommitSubjects } from '../../scripts/lib/product-commit-subjects.mjs';

function repository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'product-merge-history-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'master');
  git('config', 'user.name', 'Harness Test');
  git('config', 'user.email', 'harness@example.invalid');
  const commit = (file, subject) => {
    writeFileSync(path.join(root, file), subject);
    git('add', file);
    git('commit', '-m', subject);
  };
  commit('initial', 'feat(example): initialize capability');
  git('checkout', '-b', 'codex/epoch-example');
  commit('feature', 'feat(renderer): compose comparison');
  git('checkout', 'master');
  commit('policy', 'fix(harness): retain continuation intent');
  const base = git('rev-parse', 'HEAD');
  git('checkout', 'codex/epoch-example');
  git('merge', '--no-edit', 'master');
  return { root, git, commit, base, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('real synchronization merges do not turn engineering history into runtime state', () => {
  const repo = repository();
  try {
    assert.match(repo.git('log', '-1', '--format=%s'), /^Merge /u);
    const subjects = readProductCommitSubjects(repo.root, repo.base);
    assert.deepEqual(subjects, ['feat(renderer): compose comparison']);
    assertProductCommitHygiene(subjects);
  } finally {
    repo.cleanup();
  }
});

test('a non-merge commit cannot evade hygiene by imitating a Git merge subject', () => {
  const repo = repository();
  try {
    const fake = "Merge branch 'master' into codex/epoch-example";
    repo.commit('fake-merge', fake);
    const subjects = readProductCommitSubjects(repo.root, repo.base);
    assert.ok(subjects.includes(fake));
    assert.throws(() => assertProductCommitHygiene(subjects), {
      code: 'RUNTIME_ONLY_COMMIT_REJECTED',
    });
  } finally {
    repo.cleanup();
  }
});

test('runtime-only commits remain rejected when hidden behind a real branch merge', () => {
  const repo = repository();
  try {
    repo.git('checkout', '-b', 'side');
    repo.commit('runtime', 'docs: record candidate review readiness');
    repo.git('checkout', 'codex/epoch-example');
    repo.commit('another-feature', 'fix(renderer): bound comparison labels');
    repo.git('merge', '--no-edit', 'side');
    const subjects = readProductCommitSubjects(repo.root, repo.base);
    assert.ok(subjects.includes('docs: record candidate review readiness'));
    assert.throws(() => assertProductCommitHygiene(subjects), {
      code: 'RUNTIME_ONLY_COMMIT_REJECTED',
    });
  } finally {
    repo.cleanup();
  }
});
