import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
test('native page integration checks execute after dependency installation and MCP build, outside dependency-free Harness', () => {
  const workflow = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
  const host = workflow.split('\n  host-integration:\n')[1]?.split('\n  standalone-release-smoke:\n')[0];
  assert.equal(typeof host, 'string');
  const install = host.indexOf('pnpm install --frozen-lockfile');
  const build = host.indexOf('run: pnpm build');
  for (const name of ['native-entity-page-verification', 'native-entity-page-mcp']) {
    assert.equal(existsSync(new URL(`tests/harness/${name}.test.mjs`, root)), false,
      'built-runtime tests cannot enter the dependency-free harness:test wildcard');
    const relative = `tests/integration/${name}.test.mjs`;
    assert.equal(existsSync(new URL(relative, root)), true);
    const scheduled = host.indexOf(relative);
    assert.equal(install >= 0 && build > install && scheduled > build, true,
      'native checks must be explicitly scheduled after install and full workspace build');
  }
});
