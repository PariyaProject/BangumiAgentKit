/** Four full compiler projections; no product JavaScript rewriting or provider I/O. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [output, parentFile] = process.argv.slice(2);
if (!output || !parentFile || process.argv.length !== 4) throw Error('ECP_COMPILER_ARGUMENTS');
const baseline = 'bfe1229d03edac0c7e218f442b2d746254cb4c4c';
const sources = [
  'packages/bangumi-core/src/models/user.ts',
  'packages/bangumi-core/src/services/user-service.ts',
  'packages/bangumi-core/src/services/collection-entity-consistency-service.ts',
  'packages/bangumi-openapi/src/index.ts',
  'packages/bangumi-openapi/src/generated/index.ts',
  'packages/bangumi-openapi/src/native-collection-page-client.ts',
  'packages/tools/src/definitions/read-tools.ts',
  'packages/renderer/src/render-service.ts',
  'packages/renderer/src/templates/CalendarCard.tsx',
];
const addedSource = 'packages/bangumi-openapi/src/native-collection-page-client.ts';
const addedJs = 'openapi:native-collection-page-client.js';
const expectedChanged = new Set([
  'core:services/user-service.js',
  'core:services/collection-entity-consistency-service.js',
  'openapi:index.js',
  'openapi:generated/index.js',
  addedJs,
  'tools:definitions/read-tools.js',
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
if (JSON.stringify(delta) !== JSON.stringify([...sources, 'docs/tool-catalog.json'].sort()))
  throw Error('ECP_RUNTIME_DELTA');
if (
  parent.schema !== 'entity-page-parent-runtime/v1' ||
  !Array.isArray(parent.files) ||
  parent.registerHooks !== 'function'
)
  throw Error('ECP_PARENT_METADATA');
const addedPath = path.join(root, addedSource);
const overrides = new Map(
  sources
    .filter((name) => name !== addedSource)
    .map((name) => [
      path.join(root, name),
      execFileSync('git', ['-C', root, 'show', baseline + ':' + name], { encoding: 'utf8' }),
    ]),
);
if (git('ls-tree', baseline, '--', addedSource)) throw Error('ECP_NEW_SOURCE_NOT_NEW');

function compile(packageName, before) {
  const configName = path.join(root, 'packages', packageName, 'tsconfig.json');
  const config = ts.readConfigFile(configName, ts.sys.readFile);
  if (config.error) throw Error('ECP_COMPILER_CONFIG');
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configName),
    undefined,
    configName,
  );
  if (parsed.errors.length) throw Error('ECP_COMPILER_OPTIONS');
  const host = ts.createCompilerHost(parsed.options),
    read = host.readFile.bind(host),
    exists = host.fileExists.bind(host),
    outputs = new Map();
  host.readFile = (name) =>
    before
      ? path.resolve(name) === addedPath
        ? undefined
        : (overrides.get(path.resolve(name)) ?? read(name))
      : read(name);
  host.fileExists = (name) => (before && path.resolve(name) === addedPath ? false : exists(name));
  host.writeFile = (name, data) => outputs.set(path.resolve(name), data);
  const program = ts.createProgram({
    rootNames: parsed.fileNames.filter((name) => !before || path.resolve(name) !== addedPath),
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw Error(
      'ECP_PROJECT_TYPECHECK_' +
        packageName +
        ':' +
        diagnostics
          .slice(0, 6)
          .map((d) => d.code)
          .join(','),
    );
  if (program.emit().emitSkipped) throw Error('ECP_PROJECT_EMIT');
  return outputs;
}

const emittedFiles = [],
  files = [];
for (const [name, packageName] of [
  ['core', 'bangumi-core'],
  ['openapi', 'bangumi-openapi'],
  ['tools', 'tools'],
  ['renderer', 'renderer'],
]) {
  const before = compile(packageName, true),
    after = compile(packageName, false);
  const dist = path.join(root, 'packages', packageName, 'dist');
  const emitted = (values) =>
    [...values].filter(([target]) => target.startsWith(dist + path.sep) && target.endsWith('.js'));
  const prior = emitted(before),
    current = emitted(after),
    native = parent.files.filter((file) => file.package === name);
  if (
    prior.length !== native.length ||
    current.length !== prior.length + (name === 'openapi' ? 1 : 0)
  )
    throw Error('ECP_PROJECT_FILE_SET');
  const parentRoot = native.find((file) => file.relative === 'index.js');
  if (!parentRoot) throw Error('ECP_PARENT_PACKAGE_ROOT');
  for (const [target, data] of current) {
    const relative = path.relative(dist, target),
      key = name + ':' + relative;
    const original = before.get(target),
      imageFile = native.find((file) => file.relative === relative);
    const isNew = key === addedJs;
    const parentPath = isNew ? path.join(path.dirname(parentRoot.path), relative) : imageFile?.path;
    if (
      fs.readFileSync(target, 'utf8') !== data ||
      (isNew
        ? original !== undefined ||
          imageFile !== undefined ||
          !isDeepStrictEqual(parent.absentFiles, [{ package: name, relative, path: parentPath }])
        : original === undefined || !imageFile || hash(original) !== imageFile.sha256)
    )
      throw Error('ECP_PARENT_OR_DIST_MISMATCH');
    const changed = isNew || original !== data;
    if (changed !== expectedChanged.has(key)) throw Error('ECP_UNEXPECTED_EMITTED_DELTA');
    emittedFiles.push({
      package: name,
      relative,
      parentPath,
      parentSha256: isNew ? null : hash(original),
      currentSha256: hash(data),
      added: isNew,
      changed,
    });
    if (changed)
      files.push({
        package: name,
        relative,
        parentPath,
        parentSha256: isNew ? null : hash(original),
        emittedSha256: hash(data),
        added: isNew,
        stagedName: name + '--' + relative.replaceAll('/', '--'),
        data,
      });
  }
}
if (
  files.length !== expectedChanged.size ||
  new Set(files.map((f) => f.stagedName)).size !== files.length
)
  throw Error('ECP_OVERLAY_INVENTORY');
fs.mkdirSync(output);
for (const file of files) {
  fs.writeFileSync(path.join(output, file.stagedName), file.data, { flag: 'wx' });
  delete file.data;
}
const projection = {
  schema: 'entity-page-compiled-projection/v1',
  sourceRevision: git('rev-parse', 'HEAD'),
  baselineRevision: baseline,
  typescript: ts.version,
  sourceFiles: Object.fromEntries(
    sources.map((name) => [name, hash(fs.readFileSync(path.join(root, name)))]),
  ),
  parentProjectionExact: true,
  currentDistExact: true,
  allOtherEmittedJavaScriptUnchanged: true,
  newParentModuleAbsent: true,
  emittedFiles,
  files,
};
fs.writeFileSync(path.join(output, 'compiled.json'), JSON.stringify(projection, null, 2) + '\n', {
  flag: 'wx',
});
process.stdout.write(
  JSON.stringify({
    prepared: true,
    projects: 4,
    emittedFiles: emittedFiles.length,
    overlays: files.length,
    nativeExecuted: false,
  }) + '\n',
);
