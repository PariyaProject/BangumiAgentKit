import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCodexExecArgs,
  runD02CodexAgentMcp,
  sanitizedEnvironment,
  validateLocalClaimPath,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-d02-codex-agent-mcp.mjs';
import { D02_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/d02-public-search-answer-check.mjs';

test('D02 one-shot runner is Harness-private', () => {
  assert.equal(validateRunnerArgs(['--help']), 'help');
  assert.throws(() => validateRunnerArgs(['--run', '95']), /Harness-private/u);
  assert.throws(() => validateRunnerArgs(['--run', '95', '--retry']), /Harness-private/u);
  assert.throws(() => runD02CodexAgentMcp(), /durable Harness claim\/result route/u);
  assert.equal(validateLocalClaimPath(undefined), null);
});

test('D02 Codex invocation is Luna Max, read-only, credential-free, and one-tool only', () => {
  const args = buildCodexExecArgs({
    root: '/repo',
    nodePath: '/node',
    summaryPath: '/tmp/d02-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('model_reasoning_effort="max"'));
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.web_search=false'));
  assert.ok(args.includes('features.multi_agent=false'));
  assert.ok(args.includes('mcp_servers.bgk_d02_one_tool.enabled_tools=["bangumi.search_subjects"]'));
  assert.ok(args.some((entry) => entry.includes('--auth-mode')));
  assert.ok(args.some((entry) => entry.includes('anonymous-optional-read')));
  assert.ok(args.at(-1).includes(JSON.stringify(D02_EXPECTED_QUERY_ARGUMENTS)));
  assert.match(args.at(-1), /exactly once/u);
  assert.match(args.at(-1), /不判断低刺激或官方相似度/u);
});

test('D02 runner passes only its minimal environment allowlist to child processes', () => {
  const environment = sanitizedEnvironment({
    PATH: '/usr/bin:/bin',
    HOME: '/tmp/d02-home',
    CODEX_HOME: '/tmp/d02-codex-home',
    TMPDIR: '/tmp',
    PGPASSWORD: 'fixture-only',
    MYSQL_PWD: 'fixture-only',
    AWS_ACCESS_KEY_ID: 'fixture-only',
    DATABASE_URL: 'postgres://fixture-only',
    BANGUMI_OAUTH_TOKEN: 'fixture-only',
    OPENAI_API_KEY: 'fixture-only',
    PARIYA_D02_RUN95_CLAIM_FILE: '/tmp/private-claim.json',
    UNCLASSIFIED_SECRET: 'fixture-only',
  });

  assert.deepEqual(Object.keys(environment).sort(), [
    'CODEX_HOME',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_CONFIG_SYSTEM',
    'HOME',
    'PATH',
    'TMPDIR',
  ]);
  assert.equal(environment.PATH, '/usr/bin:/bin');
  assert.equal(environment.HOME, '/tmp/d02-home');
  assert.equal(environment.CODEX_HOME, '/tmp/d02-codex-home');
  for (const key of [
    'PGPASSWORD',
    'MYSQL_PWD',
    'AWS_ACCESS_KEY_ID',
    'DATABASE_URL',
    'BANGUMI_OAUTH_TOKEN',
    'OPENAI_API_KEY',
    'PARIYA_D02_RUN95_CLAIM_FILE',
    'UNCLASSIFIED_SECRET',
  ]) {
    assert.equal(Object.hasOwn(environment, key), false);
  }
});
