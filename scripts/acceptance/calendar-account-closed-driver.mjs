/** Six bounded runs inside one network-none container; only synthetic facts leave. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const runtime = createRequire('/opt/bangumi/package.json');
const sdk = createRequire(runtime.resolve('@modelcontextprotocol/sdk/client/index.js'));
const express = createRequire(sdk.resolve('express'));
const qsVersion = JSON.parse(fs.readFileSync(express.resolve('qs/package.json'), 'utf8')).version;
if (qsVersion !== '6.16.1') throw Error('C12_DEPENDENCY_VERSION');
const runs = [];
for (const mode of [
  'normal',
  'require',
  'import',
  'preloaded',
  'network-controller',
  'network-server',
]) {
  fs.rmSync('/tmp/c12-output', { recursive: true, force: true });
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      '/qa/calendar-account-closed-guard.mjs',
      '/qa/calendar-account-closed-controller.mjs',
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: '/tmp',
        NODE_ENV: 'test',
        C12_ROLE: 'controller',
        C12_FORCE: mode,
      },
      timeout: 180000,
      encoding: 'utf8',
      maxBuffer: 65536,
    },
  );
  const read = (name) => {
    try {
      return JSON.parse(fs.readFileSync('/tmp/c12-output/' + name + '.json', 'utf8'));
    } catch {
      return null;
    }
  };
  const controller = read('controller-trace'),
    server = read('server-trace'),
    native = read('compiled-mcp'),
    provider = read('provider');
  const cleanTrace = (trace) =>
    trace?.started === true &&
    trace.hooksReady === true &&
    trace.compiledFilesVerified === true &&
    trace.initialCached === 0 &&
    trace.attempts === 0 &&
    trace.finalCached === 0 &&
    trace.networkAttempts === 0 &&
    trace.finalized === true &&
    trace.cleanExit === true;
  const normal =
    result.status === 0 &&
    cleanTrace(controller) &&
    cleanTrace(server) &&
    Object.keys(server.loadedRuntimeFiles).length === 2 &&
    server.fixtureFetchInstalled === true &&
    controller.fixtureFetchInstalled === false &&
    controller.fixtureFetchCalls === 0 &&
    native?.passed === true &&
    native.results.length === 12 &&
    native.episodeSelectionValidated === true &&
    provider?.denied === 0 &&
    provider.assetAttempts === 0 &&
    provider.renderCalls === 5 &&
    provider.cacheWrites === 0 &&
    provider.privateCacheDisabled === true &&
    provider.calls.length > 0 &&
    provider.calls.length === server.fixtureFetchCalls;
  let negative =
    result.status !== 0 &&
    native?.passed === false &&
    native.workspaceRemoved === true &&
    native.results.length === 0;
  if (mode === 'preloaded') negative &&= server?.initialCached > 0 && server.hooksReady === false;
  else if (mode === 'require' || mode === 'import') negative &&= server?.attempts > 0;
  else if (mode === 'network-controller')
    negative &&= controller?.networkAttempts > 0 && server === null;
  else if (mode === 'network-server') negative &&= server?.networkAttempts > 0;
  runs.push({
    mode,
    passed: mode === 'normal' ? normal : negative,
    exitStatus: result.status,
    signal: result.signal,
    controller,
    server,
    native,
    provider,
  });
}
fs.rmSync('/tmp/c12-output', { recursive: true, force: true });
const passed = runs.every((run) => run.passed);
process.stdout.write(
  JSON.stringify({
    schema: 'calendar-account-closed-native-proof/v1',
    passed,
    qsVersion,
    runs,
    fixtureRowsPerResponse: 1,
    actualAccountActions: 0,
    modelCalls: 0,
    clientMessages: 0,
  }) + '\n',
);
process.exitCode = passed ? 0 : 1;
