/** Full compiler projections for the closed person-collection compatibility graph. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [output, parentFile] = process.argv.slice(2);
if (!output || !parentFile || process.argv.length !== 4) throw Error('PERSON_COMPILER_ARGUMENTS');
const baseline = 'bfe1229d03edac0c7e218f442b2d746254cb4c4c';
const sources = [
  'packages/bangumi-core/src/models/user.ts',
  'packages/bangumi-core/src/services/user-service.ts',
  'packages/bangumi-core/src/services/collection-entity-consistency-service.ts',
  'packages/renderer/src/render-service.ts',
  'packages/renderer/src/templates/CalendarCard.tsx',
];
const expectedChangedJs = new Set([
  'core:services/user-service.js',
  'core:services/collection-entity-consistency-service.js',
  'renderer:render-service.js',
  'renderer:templates/CalendarCard.js',
]);
const parent = JSON.parse(fs.readFileSync(parentFile, 'utf8'));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const delta = git(
  'diff',
  '--name-only',
  baseline,
  'HEAD',
  '--',
  'apps',
  'packages',
  'pnpm-lock.yaml',
  'docs/tool-catalog.json',
  'tsconfig.base.json',
  'tsconfig.json',
  'pnpm-workspace.yaml',
  '.npmrc',
)
  .split('\n')
  .sort();
if (JSON.stringify(delta) !== JSON.stringify([...sources].sort()))
  throw Error('PERSON_RUNTIME_DELTA');
if (!Array.isArray(parent.files) || parent.registerHooks !== 'function')
  throw Error('PERSON_PARENT_METADATA');
const overrides = new Map(
  sources.map((name) => [
    path.join(root, name),
    execFileSync('git', ['-C', root, 'show', baseline + ':' + name], { encoding: 'utf8' }),
  ]),
);

function compile(packageName, virtualReads) {
  const configName = path.join(root, 'packages', packageName, 'tsconfig.json');
  const config = ts.readConfigFile(configName, ts.sys.readFile);
  if (config.error) throw Error('PERSON_COMPILER_CONFIG');
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configName),
    undefined,
    configName,
  );
  if (parsed.errors.length) throw Error('PERSON_COMPILER_OPTIONS');
  const host = ts.createCompilerHost(parsed.options),
    read = host.readFile.bind(host),
    outputs = new Map();
  host.readFile = (name) => virtualReads.get(path.resolve(name)) ?? read(name);
  host.writeFile = (name, data) => outputs.set(path.resolve(name), data);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  if (ts.getPreEmitDiagnostics(program).length || program.emit().emitSkipped)
    throw Error('PERSON_PROJECT_TYPECHECK');
  return outputs;
}

const records = [],
  changed = [];
for (const [name, packageName] of [
  ['core', 'bangumi-core'],
  ['renderer', 'renderer'],
]) {
  const before = compile(packageName, overrides),
    after = compile(packageName, new Map());
  const dist = path.join(root, 'packages', packageName, 'dist');
  const outputs = [...after].filter(
    ([target]) => target.startsWith(dist + path.sep) && target.endsWith('.js'),
  );
  const native = parent.files.filter((file) => file.package === name);
  if (outputs.length !== native.length) throw Error('PERSON_PROJECT_FILE_SET');
  for (const [target, data] of outputs) {
    const relative = path.relative(dist, target),
      key = name + ':' + relative;
    const original = before.get(target),
      imageFile = native.find((file) => file.relative === relative);
    if (
      original === undefined ||
      !imageFile ||
      hash(original) !== imageFile.sha256 ||
      fs.readFileSync(target, 'utf8') !== data
    )
      throw Error('PERSON_PARENT_OR_DIST_MISMATCH');
    const changedJs = original !== data;
    if (changedJs !== expectedChangedJs.has(key)) throw Error('PERSON_UNEXPECTED_EMITTED_DELTA');
    records.push({
      package: name,
      relative,
      parentPath: imageFile.path,
      parentSha256: hash(original),
      currentSha256: hash(data),
      changed: changedJs,
    });
    if (changedJs)
      changed.push({
        package: name,
        relative,
        parentPath: imageFile.path,
        parentSha256: hash(original),
        emittedSha256: hash(data),
        stagedName: name + '-' + path.basename(relative),
        data,
      });
  }
}
if (changed.length !== expectedChangedJs.size) throw Error('PERSON_COMPILED_OVERLAY_SET');
fs.mkdirSync(output); // Create-only; no implicit reuse of a previous witness.
for (const file of changed) {
  fs.writeFileSync(path.join(output, file.stagedName), file.data, { flag: 'wx' });
  delete file.data;
}
const projection = {
  schema: 'person-account-compiled-projection/v1',
  sourceRevision: git('rev-parse', 'HEAD'),
  baselineRevision: baseline,
  typescript: ts.version,
  sourceFiles: Object.fromEntries(
    sources.map((name) => [name, hash(fs.readFileSync(path.join(root, name)))]),
  ),
  compilation:
    'Full typechecked core and renderer projects; virtual baseline source reads. All emitted JavaScript matches the parent projection/current dist; only four reviewed runtime modules differ.',
  parentProjectionExact: true,
  currentDistExact: true,
  allOtherEmittedJavaScriptUnchanged: true,
  emittedFiles: records,
  files: changed,
};
fs.writeFileSync(path.join(output, 'compiled.json'), JSON.stringify(projection, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    passed: true,
    projects: 2,
    emittedFiles: records.length,
    overlays: changed.length,
  }),
);
