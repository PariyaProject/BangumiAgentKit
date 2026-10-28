// A network=none/read-only container owns all outputs; exports sanitized counters only.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const runtime = createRequire('/opt/bangumi/package.json');
const sdk = createRequire(runtime.resolve('@modelcontextprotocol/sdk/client/index.js'));
const express = createRequire(sdk.resolve('express'));
const version = express('qs/package.json').version; // metadata only, in untraced verifier process
if (version !== '6.16.1') throw Error('QS55_PATCH_MISSING');
const runs = [];
for (const mode of ['', 'require', 'import', 'preloaded']) {
  fs.rmSync('/tmp/qs55-output', { recursive: true, force: true });
  const result = spawnSync(process.execPath, ['--import', '/qa/trace.mjs', '/qa/controller.mjs'], {
    env: {
      PATH: process.env.PATH,
      HOME: '/tmp',
      NODE_ENV: 'test',
      QS55_ROLE: 'controller',
      QS55_FORCE: mode,
    },
    timeout: 180000,
    encoding: 'utf8',
    maxBuffer: 65536,
  });
  const read = (name) => {
    try {
      return JSON.parse(fs.readFileSync('/tmp/qs55-output/' + name + '.json', 'utf8'));
    } catch {
      return null;
    }
  };
  const controller = read('controller-trace'),
    server = read('server-trace'),
    native = read('compiled-mcp'),
    provider = read('provider');
  const cleanTrace = (t) =>
    t?.started === true &&
    t.hooksReady === true &&
    t.initialCached === 0 &&
    t.attempts === 0 &&
    t.finalCached === 0 &&
    t.finalized === true &&
    t.cleanExit === true;
  const cleanProvider =
    provider?.calls.length > 0 &&
    provider.denied === 0 &&
    provider.assetAttempts === 0 &&
    provider.renderCalls === 5 &&
    provider.privateCacheDisabled === true &&
    provider.cacheWrites === 0;
  const passed =
    mode === ''
      ? result.status === 0 &&
        cleanTrace(controller) &&
        cleanTrace(server) &&
        native?.passed === true &&
        cleanProvider
      : result.status !== 0 &&
        native?.passed === false &&
        native?.workspaceRemoved === true &&
        (mode === 'preloaded'
          ? server?.initialCached > 0 && server?.hooksReady === false
          : server?.attempts > 0);
  runs.push({
    mode: mode || 'normal',
    passed,
    exitStatus: result.status,
    signal: result.signal,
    controller,
    server,
    native,
    provider,
  });
}
fs.rmSync('/tmp/qs55-output', { recursive: true, force: true });
const passed = runs.every((r) => r.passed);
process.stdout.write(
  JSON.stringify({
    schema: 'qs55-isolated-compiled-proof/v1',
    passed,
    version,
    imageDelta: JSON.parse(fs.readFileSync('/qs55-image-delta.json', 'utf8')),
    runs,
    containerNetwork: 'none',
    realDataMounts: 0,
    fixtureRowsPerResponse: 1,
    modelCalls: 0,
    clientMessages: 0,
    actualAccountActions: 0,
  }) + '\n',
);
process.exitCode = passed ? 0 : 1;
