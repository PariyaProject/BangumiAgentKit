/** Bind the two new core modules in every native Node descendant of frozen C12. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const expected = JSON.parse(fs.readFileSync('/qa/core-runtime-files.json', 'utf8'));
if (Object.keys(expected).length !== 2) throw Error('PERSON_CORE_INVENTORY');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
for (const [name, digest] of Object.entries(expected)) {
  const stat = fs.lstatSync(name);
  if (!stat.isFile() || stat.isSymbolicLink() || hash(fs.readFileSync(name)) !== digest)
    throw Error('PERSON_CORE_BYTES');
}
const role = process.env.C12_ROLE || 'driver',
  mode = process.env.C12_FORCE || 'normal';
if (
  !['driver', 'controller', 'server'].includes(role) ||
  ![
    'normal',
    'require',
    'import',
    'preloaded',
    'network-controller',
    'network-server',
    'person',
  ].includes(mode)
) {
  throw Error('PERSON_CORE_ROLE');
}
const output = '/tmp/person-account-source/' + role + '-' + mode + '.json';
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const facts = {
  schema: 'person-account-core-guard/v1',
  role,
  mode,
  verifiedFiles: expected,
  loadedRuntimeFiles: {},
  nodeChildrenPreloaded: 0,
  finalized: false,
};
const publish = () => fs.writeFileSync(output, JSON.stringify(facts), { mode: 0o600 });
publish();
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context),
      name = url.startsWith('file:') ? fileURLToPath(url) : null;
    if (name && expected[name]) {
      if (
        loaded.source === undefined ||
        loaded.source === null ||
        hash(loaded.source) !== expected[name]
      ) {
        throw Error('PERSON_CORE_EXECUTED_BYTES');
      }
      facts.loadedRuntimeFiles[name] = expected[name];
      publish();
    }
    return loaded;
  },
});
// Frozen C12 children intentionally reconstruct their environments. Inject the
// new *test-source guard* through actual Node argv, leaving their bytes intact.
for (const name of ['spawn', 'spawnSync']) {
  const original = childProcess[name];
  childProcess[name] = function (command, args, options) {
    if (command === process.execPath) {
      if (!Array.isArray(args)) throw Error('PERSON_CHILD_ARGUMENTS');
      args = ['--import', '/qa/person-account-core-guard.mjs', ...args];
      facts.nodeChildrenPreloaded++;
      publish();
    }
    return original.call(this, command, args, options);
  };
}
syncBuiltinESMExports();
process.on('exit', () => {
  facts.finalized = true;
  publish();
});
