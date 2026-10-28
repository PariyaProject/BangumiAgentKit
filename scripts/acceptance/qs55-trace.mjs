// Fresh fake QA only. Loaded before controller/server imports, never in production.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, registerHooks } from 'node:module';

const require = createRequire(import.meta.url);
const role = process.env.QS55_ROLE;
if (!['controller', 'server'].includes(role)) throw Error('QS55_ROLE');
const output = path.join('/tmp/qs55-output', role + '-trace.json');
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const isQs = (value) =>
  typeof value === 'string' &&
  (value === 'qs' ||
    value.startsWith('qs/') ||
    /(?:^|[/\\])qs(?:@[^/\\]+)?(?:[/\\]|$)/u.test(value));
const cached = () => Object.keys(require.cache).filter(isQs).length;
const facts = {
  schema: 'qs55-module-trace/v1',
  role,
  started: true,
  hooksReady: false,
  initialCached: cached(),
  attempts: 0,
  finalCached: null,
  finalized: false,
  cleanExit: false,
};
const publish = () => fs.writeFileSync(output, JSON.stringify(facts), { mode: 0o600 });
publish();
if (facts.initialCached) throw Error('QS55_PRELOADED');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (isQs(specifier)) {
      facts.attempts++;
      publish();
      throw Error('QS55_MODULE_DENIED');
    }
    const result = nextResolve(specifier, context);
    if (isQs(result.url)) {
      facts.attempts++;
      publish();
      throw Error('QS55_MODULE_DENIED');
    }
    return result;
  },
  load(url, context, nextLoad) {
    if (isQs(url)) {
      facts.attempts++;
      publish();
      throw Error('QS55_MODULE_DENIED');
    }
    return nextLoad(url, context);
  },
});
facts.hooksReady = true;
publish();
// SDK stdio close ends its child with SIGTERM. Finalize the QA observation on
// that explicit shutdown as well; this does not claim production shutdown QA.
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
// A future controller fetch is a test failure, independently of Docker network=none.
globalThis.fetch = async () => {
  throw Error('QS55_CONTROLLER_FETCH_DENIED');
};
