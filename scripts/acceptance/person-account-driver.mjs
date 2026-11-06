/** Frozen twelve-input graph plus new person cases; no real provider or model. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const run = (args, env) =>
  spawnSync(process.execPath, args, {
    env: { PATH: process.env.PATH, HOME: '/tmp', NODE_ENV: 'test', ...env },
    timeout: 240000,
    encoding: 'utf8',
    maxBuffer: 2097152,
  });
const core = JSON.parse(fs.readFileSync('/qa/core-runtime-files.json', 'utf8'));
const loaded = (trace) =>
  trace?.finalized === true &&
  isDeepStrictEqual(trace.verifiedFiles, core) &&
  isDeepStrictEqual(trace.loadedRuntimeFiles, core);
const closedResult = run(
  ['--import', '/qa/person-account-core-guard.mjs', '/qa/calendar-account-closed-driver.mjs'],
  { C12_ROLE: 'driver' },
);
let closed;
try {
  closed = JSON.parse(closedResult.stdout);
} catch {
  closed = null;
}
const closedCore = {
  driver: read('/tmp/person-account-source/driver-normal.json'),
  controller: read('/tmp/person-account-source/controller-normal.json'),
  server: read('/tmp/person-account-source/server-normal.json'),
};
const closedPassed =
  closedResult.status === 0 &&
  closed?.passed === true &&
  loaded(closedCore.server) &&
  closedCore.controller?.finalized === true &&
  closedCore.controller.nodeChildrenPreloaded === 1 &&
  closedCore.driver?.nodeChildrenPreloaded === 6;

// A new source-bound fixture, not extra inputs appended to the frozen C12 graph.
const personResult = run(
  [
    '--import',
    '/qa/person-account-core-guard.mjs',
    '--import',
    '/qa/calendar-account-closed-guard.mjs',
    '/qa/person-account-controller.mjs',
  ],
  { C12_ROLE: 'controller', C12_FORCE: 'person' },
);
const native = read('/tmp/person-account-mcp/compiled-mcp.json');
const provider = read('/tmp/person-account-mcp/provider.json');
const coreTraces = {
  controller: read('/tmp/person-account-source/controller-person.json'),
  server: read('/tmp/person-account-source/server-person.json'),
};
const networkTraces = {
  controller: read('/tmp/c12-output/controller-trace.json'),
  server: read('/tmp/c12-output/server-trace.json'),
};
const clean = (trace) =>
  trace?.started === true &&
  trace.hooksReady === true &&
  trace.compiledFilesVerified === true &&
  trace.initialCached === 0 &&
  trace.attempts === 0 &&
  trace.finalCached === 0 &&
  trace.networkAttempts === 0 &&
  trace.finalized === true &&
  trace.cleanExit === true;
const expectedCases = [
  'unknown',
  'empty',
  'raw-label',
  'list',
  'join',
  'png',
  'parser-error',
  'not-found',
];
const personPassed =
  personResult.status === 0 &&
  native?.passed === true &&
  native.mcpClosed === true &&
  native.workspaceRemoved === true &&
  isDeepStrictEqual(
    native.results.map((item) => item.case),
    expectedCases,
  ) &&
  native.results.every((item) => item.passed) &&
  loaded(coreTraces.server) &&
  coreTraces.controller?.finalized === true &&
  coreTraces.controller.nodeChildrenPreloaded === 1 &&
  clean(networkTraces.controller) &&
  clean(networkTraces.server) &&
  Object.keys(networkTraces.server.loadedRuntimeFiles).length === 2 &&
  provider?.denied === 0 &&
  provider.assetAttempts === 0 &&
  provider.renderCalls === 1 &&
  provider.privateCacheDisabled === true &&
  provider.cacheWrites === 0 &&
  provider.calls.length > 0 &&
  provider.calls.length <= 24 &&
  networkTraces.server.fixtureFetchCalls === provider.calls.length;
const passed = closedPassed && personPassed;
const report = {
  schema: 'person-account-closed-native-proof/v1',
  passed,
  closedTwelve: closed,
  closedCore,
  person: { native, provider, coreTraces, networkTraces },
  closedPassed,
  personPassed,
  originalInputsExpanded: false,
  realAccountActions: 0,
  modelCalls: 0,
  clientMessages: 0,
};
if (passed)
  report.previewBase64 = fs.readFileSync('/tmp/person-account-mcp/preview.png').toString('base64');
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = passed ? 0 : 1;
