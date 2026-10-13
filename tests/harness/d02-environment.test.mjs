import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createD02ChildEnvironment,
  isD02ChildEnvironmentVerified,
  restrictD02ProcessEnvironment,
} from '../../scripts/lib/d02-environment.mjs';

test('D02 process restriction removes credential-like and unclassified environment keys', () => {
  const environment = {
    PATH: '/usr/bin:/bin',
    HOME: '/tmp/d02-home',
    CODEX_HOME: '/tmp/d02-codex-home',
    DATABASE_URL: 'fixture-only',
    PGPASSWORD: 'fixture-only',
    MYSQL_PWD: 'fixture-only',
    AWS_ACCESS_KEY_ID: 'fixture-only',
    TOKEN: 'fixture-only',
    CUSTOM_RUNTIME_VALUE: 'fixture-only',
  };

  assert.equal(restrictD02ProcessEnvironment(environment), true);
  assert.equal(isD02ChildEnvironmentVerified(environment), true);
  assert.deepEqual(Object.keys(environment).sort(), [
    'CODEX_HOME',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_CONFIG_SYSTEM',
    'HOME',
    'PATH',
  ]);
  for (const key of [
    'DATABASE_URL',
    'PGPASSWORD',
    'MYSQL_PWD',
    'AWS_ACCESS_KEY_ID',
    'TOKEN',
    'CUSTOM_RUNTIME_VALUE',
  ]) {
    assert.equal(Object.hasOwn(environment, key), false);
  }
});

test('D02 environment verification fails closed if a disallowed variable is added afterward', () => {
  const environment = createD02ChildEnvironment({ PATH: '/usr/bin:/bin', HOME: '/tmp/d02-home' });
  assert.equal(isD02ChildEnvironmentVerified(environment), true);
  assert.equal(
    isD02ChildEnvironmentVerified({ ...environment, DATABASE_URL: 'fixture-only' }),
    false,
  );
  assert.equal(isD02ChildEnvironmentVerified({ ...environment, API_KEY: 'fixture-only' }), false);
});

test('D02 environment construction rejects missing process launch prerequisites', () => {
  assert.throws(
    () => createD02ChildEnvironment({ HOME: '/tmp/d02-home' }),
    /requires PATH and a home directory/u,
  );
  assert.throws(
    () => createD02ChildEnvironment({ PATH: '/usr/bin:/bin' }),
    /requires PATH and a home directory/u,
  );
});
