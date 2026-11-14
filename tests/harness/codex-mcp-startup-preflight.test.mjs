import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  codexMcpToolLimitsOverride,
  inspectCodexMcpStartup,
} from '../../scripts/lib/codex-mcp-startup-preflight.mjs';

test('strict metadata command binds exact ordered overrides and retains only safe facts', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-metadata-fixture-'));
  const cli = path.join(cwd, 'codex');
  const marker = 'SYNTHETIC_PRIVATE_ERROR_DO_NOT_RETAIN';
  const limits = codexMcpToolLimitsOverride('example', ['bangumi.one', 'bangumi.two'], 12000);
  const plan = ['mcp_servers.example.command="unused"', limits];
  try {
    fs.writeFileSync(
      cli,
      `#!${process.execPath}
const args = process.argv.slice(2);
if (JSON.stringify(args) !== ${JSON.stringify(JSON.stringify(['app-server', '--print-startup-config', '--strict-config', ...plan.flatMap((x) => ['--config', x])]))}) process.exit(91);
const mode=process.env.MODE;
if(mode==='oversize') process.stdout.write('x'.repeat(70000));
if(mode==='nonjson') process.stdout.write('not JSON');
if(mode==='good') process.stdout.write(JSON.stringify({appServerVersion:'0.167.0-alpha.4.1',configRequirements:null,private:${JSON.stringify(marker)}}));
if(mode==='bad') {
  process.stderr.write(${JSON.stringify(marker)});
  process.stdout.write(JSON.stringify({error:{code:-32600,message:'failed to load configuration: '+${JSON.stringify(marker)}}}));
  process.exitCode=1;
}
if(mode==='invalid') process.stdout.write(JSON.stringify({appServerVersion:'0.167.0',configRequirements:[]}));
`,
      { mode: 0o700 },
    );
    const options = (mode) => ({ cwd, env: { PATH: cwd, MODE: mode } });
    const good = inspectCodexMcpStartup(plan, options('good'));
    assert.equal(good.accepted, true);
    assert.equal(good.cliVersion, '0.167.0-alpha.4.1');
    assert.match(good.configSha256, /^[a-f0-9]{64}$/u);
    assert.deepEqual(inspectCodexMcpStartup(plan, options('bad')), {
      ...good,
      accepted: false,
      cliVersion: null,
      reason: 'STRICT_STARTUP_CONFIG_REJECTED',
    });
    for (const mode of ['oversize', 'nonjson', 'invalid']) {
      const result = inspectCodexMcpStartup(plan, options(mode));
      assert.equal(result.reason, 'STRICT_STARTUP_CONFIG_UNAVAILABLE');
      assert.equal(result.accepted, false);
    }
    const reordered = inspectCodexMcpStartup(plan.toReversed(), options('good'));
    assert.notEqual(reordered.configSha256, good.configSha256);
    assert(!reordered.accepted);
    assert(!JSON.stringify(good).includes(marker));
    fs.unlinkSync(cli);
    assert.equal(
      inspectCodexMcpStartup(plan, options('good')).reason,
      'STRICT_STARTUP_CONFIG_UNAVAILABLE',
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('inline tool limits preserve literal names and reject override injection', () => {
  assert.equal(
    codexMcpToolLimitsOverride('example', ['bangumi.first', 'bangumi.second'], 12),
    'mcp_servers.example.tools={"bangumi.first"={output_token_limit=12},"bangumi.second"={output_token_limit=12}}',
  );
  for (const [name, tools, limit] of [
    ['server.extra', ['bangumi.first'], 12],
    ['server', ['bangumi.first', 'bangumi.first'], 12],
    ['server', ['bangumi.first"'], 12],
    ['server', [], 12],
    ['server', ['bangumi.first'], 32769],
  ])
    assert.throws(() => codexMcpToolLimitsOverride(name, tools, limit), /MCP_TOOL_LIMITS_INVALID/u);
  for (const invalid of [[], ['--strict-config'], ['foo\u0000=2'], ['foo=' + 'x'.repeat(65536)]])
    assert.throws(() => inspectCodexMcpStartup(invalid), /MCP_STARTUP_OVERRIDES_INVALID/u);
});
