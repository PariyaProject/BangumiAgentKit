/** Frozen twelve-input graph plus new native-page cases; no real provider or model. */
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
const core = JSON.parse(fs.readFileSync('/qa/entity-runtime-files.json', 'utf8'));
const loaded = (trace) =>
  trace?.finalized === true &&
  isDeepStrictEqual(trace.verifiedFiles, core) &&
  isDeepStrictEqual(trace.loadedRuntimeFiles, core);
const closedResult = run(
  ['--import', '/qa/entity-page-source-guard.mjs', '/qa/calendar-account-closed-driver.mjs'],
  { C12_ROLE: 'driver' },
);
let closed;
try {
  closed = JSON.parse(closedResult.stdout);
} catch {
  closed = null;
}
const closedCore = {
  driver: read('/tmp/entity-page-source/driver-normal.json'),
  controller: read('/tmp/entity-page-source/controller-normal.json'),
  server: read('/tmp/entity-page-source/server-normal.json'),
};
const closedPassed =
  closedResult.status === 0 &&
  closed?.passed === true &&
  loaded(closedCore.server) &&
  closedCore.controller?.finalized === true &&
  closedCore.controller.nodeChildrenPreloaded === 1 &&
  closedCore.driver?.nodeChildrenPreloaded === 6;

// A new source-bound fixture, not extra inputs appended to the frozen C12 graph.
const pageResult = run(
  [
    '--import',
    '/qa/entity-page-source-guard.mjs',
    '--import',
    '/qa/calendar-account-closed-guard.mjs',
    '/qa/entity-page-controller.mjs',
  ],
  { C12_ROLE: 'controller', C12_FORCE: 'entity-page' },
);
const native = read('/tmp/entity-page-mcp/compiled-mcp.json');
const provider = read('/tmp/entity-page-mcp/provider.json');
const coreTraces = {
  controller: read('/tmp/entity-page-source/controller-entity-page.json'),
  server: read('/tmp/entity-page-source/server-entity-page.json'),
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
  'bounded-person',
  'observed-followup',
  'hydration-gap',
  'empty-collection',
  'empty-page',
  'wrong-echo',
  'unavailable',
  'too-many-rows',
  'oversized-body',
];
const pagePassed =
  pageResult.status === 0 &&
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
  provider.renderCalls === 0 &&
  provider.offeredBytes === 262145 &&
  provider.bodyCancelled === true &&
  provider.calls.length === 9 &&
  networkTraces.server.fixtureFetchCalls === provider.calls.length;
const passed = closedPassed && pagePassed;
const report = {
  schema: 'entity-page-closed-native-proof/v1',
  passed,
  closedTwelve: closed,
  closedCore,
  page: { native, provider, coreTraces, networkTraces },
  closedPassed,
  pagePassed,
  originalInputsExpanded: false,
  realAccountActions: 0,
  modelCalls: 0,
  clientMessages: 0,
};
if (!passed)
  report.diagnostics = {
    closedExit: closedResult.status,
    pageExit: pageResult.status,
    knownCodes: [
      ...new Set((closedResult.stderr + pageResult.stderr).match(/(?:ECP|C12)_[A-Z_]+/gu) ?? []),
    ].sort(),
  };
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = passed ? 0 : 1;
