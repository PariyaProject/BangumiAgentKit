/** Fresh fake QA only. Module identity and network denial precede product imports. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import dgram from 'node:dgram';
import { createRequire, registerHooks, syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const role = process.env.C12_ROLE;
if (!['controller', 'server'].includes(role)) throw Error('C12_ROLE');
const output = path.join('/tmp/c12-output', role + '-trace.json');
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const expected = JSON.parse(fs.readFileSync('/qa/runtime-files.json', 'utf8'));
if (Object.keys(expected).length !== 2) throw Error('C12_RUNTIME_INVENTORY');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isQs = (value) =>
  typeof value === 'string' &&
  (value === 'qs' ||
    value.startsWith('qs/') ||
    /(?:^|[/\\])qs(?:@[^/\\]+)?(?:[/\\]|$)/u.test(value));
const cached = () => Object.keys(require.cache).filter(isQs).length;
const facts = {
  schema: 'calendar-account-closed-guard/v1',
  role,
  started: true,
  hooksReady: false,
  initialCached: cached(),
  attempts: 0,
  finalCached: null,
  compiledFilesVerified: false,
  loadedRuntimeFiles: {},
  networkAttempts: 0,
  networkSurfaces: {},
  fixtureFetchInstalled: false,
  fixtureFetchCalls: 0,
  finalized: false,
  cleanExit: false,
};
const publish = () => fs.writeFileSync(output, JSON.stringify(facts), { mode: 0o600 });
publish();
if (facts.initialCached) throw Error('C12_PRELOADED');
for (const [name, digest] of Object.entries(expected)) {
  const stat = fs.lstatSync(name);
  if (!stat.isFile() || stat.isSymbolicLink() || hash(fs.readFileSync(name)) !== digest)
    throw Error('C12_RUNTIME_BYTES');
}
facts.compiledFilesVerified = true;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (isQs(specifier)) {
      facts.attempts++;
      publish();
      throw Error('C12_MODULE_DENIED');
    }
    const result = nextResolve(specifier, context);
    if (isQs(result.url)) {
      facts.attempts++;
      publish();
      throw Error('C12_MODULE_DENIED');
    }
    return result;
  },
  load(url, context, nextLoad) {
    if (isQs(url)) {
      facts.attempts++;
      publish();
      throw Error('C12_MODULE_DENIED');
    }
    const loaded = nextLoad(url, context);
    const name = url.startsWith('file:') ? fileURLToPath(url) : null;
    if (name && expected[name]) {
      if (
        loaded.source === undefined ||
        loaded.source === null ||
        hash(loaded.source) !== expected[name]
      )
        throw Error('C12_EXECUTED_MODULE_BYTES');
      facts.loadedRuntimeFiles[name] = expected[name];
      publish();
    }
    return loaded;
  },
});
const deny = (surface) => () => {
  facts.networkAttempts++;
  facts.networkSurfaces[surface] = (facts.networkSurfaces[surface] ?? 0) + 1;
  publish();
  throw Error('C12_NETWORK_DENIED');
};
for (const [name, module, methods] of [
  ['http', http, ['request', 'get']],
  ['https', https, ['request', 'get']],
  ['net', net, ['connect', 'createConnection']],
  ['tls', tls, ['connect']],
  [
    'dns',
    dns,
    [
      'lookup',
      'lookupService',
      'resolve',
      'resolve4',
      'resolve6',
      'resolveAny',
      'resolveCname',
      'resolveMx',
      'resolveNaptr',
      'resolveNs',
      'resolvePtr',
      'resolveSoa',
      'resolveSrv',
      'resolveTxt',
      'reverse',
    ],
  ],
  [
    'dnsPromises',
    dnsPromises,
    [
      'lookup',
      'lookupService',
      'resolve',
      'resolve4',
      'resolve6',
      'resolveAny',
      'resolveCname',
      'resolveMx',
      'resolveNaptr',
      'resolveNs',
      'resolvePtr',
      'resolveSoa',
      'resolveSrv',
      'resolveTxt',
      'reverse',
    ],
  ],
  ['dgram', dgram, ['createSocket']],
])
  for (const method of methods)
    if (typeof module[method] === 'function') module[method] = deny(name + '.' + method);
net.Socket.prototype.connect = deny('Socket.connect');
syncBuiltinESMExports();
let fixtureFetch;
export function installFixtureFetch(handler) {
  if (role !== 'server' || fixtureFetch || typeof handler !== 'function')
    throw Error('C12_FETCH_REGISTRATION');
  fixtureFetch = handler;
  facts.fixtureFetchInstalled = true;
  publish();
}
Object.defineProperty(globalThis, 'fetch', {
  configurable: false,
  writable: false,
  value: async (...args) => {
    if (!fixtureFetch) return deny('fetch')();
    facts.fixtureFetchCalls++;
    publish();
    return fixtureFetch(...args);
  },
});
facts.hooksReady = true;
publish();
process.once('SIGTERM', () => {
  facts.termination = 'SIGTERM';
  process.exit(0);
});
process.once('exit', (code) => {
  facts.finalCached = cached();
  facts.finalized = true;
  facts.cleanExit = code === 0;
  publish();
});
