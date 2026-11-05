/** Compile the exact two-source delta; verify the parent projection first. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.argv[2];
const parentManifest = process.argv[3];
if (!output || !parentManifest || process.argv.length !== 4)
  throw Error('Pass fresh output directory and parent metadata.');
const parent = JSON.parse(fs.readFileSync(parentManifest, 'utf8'));
const names = [
  'packages/renderer/src/render-service.ts',
  'packages/renderer/src/templates/CalendarCard.tsx',
];
const baselineRevision = 'bfe1229d03edac0c7e218f442b2d746254cb4c4c';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
if (
  JSON.stringify(
    git(
      'diff',
      '--name-only',
      baselineRevision,
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
      .sort(),
  ) !== JSON.stringify([...names].sort())
)
  throw Error('Runtime delta must remain exactly the two reviewed renderer files.');
const configName = path.join(root, 'packages/renderer/tsconfig.json');
const config = ts.readConfigFile(configName, ts.sys.readFile);
if (config.error) throw Error('Invalid compiler configuration');
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configName),
  undefined,
  configName,
);
if (parsed.errors.length) throw Error('Invalid compiler options');
function compile(overrides) {
  const host = ts.createCompilerHost(parsed.options);
  const read = host.readFile.bind(host);
  host.readFile = (name) => overrides.get(path.resolve(name)) ?? read(name);
  const outputs = new Map();
  host.writeFile = (name, data) => outputs.set(path.resolve(name), data);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  if (ts.getPreEmitDiagnostics(program).length || program.emit().emitSkipped)
    throw Error('Typechecked project compilation failed');
  return outputs;
}
const historical = new Map(
  names.map((name) => [
    path.join(root, name),
    execFileSync('git', ['-C', root, 'show', baselineRevision + ':' + name], { encoding: 'utf8' }),
  ]),
);
const before = compile(historical);
const after = compile(new Map());
fs.mkdirSync(output); // create-only
const files = [];
for (const source of names) {
  const emitted = source.replace('/src/', '/dist/').replace(/\.tsx?$/u, '.js');
  const target = path.join(root, emitted);
  const relative = emitted.split('/dist/')[1];
  const base = parent.files.find((file) => file.relative === relative);
  const oldJs = before.get(target),
    newJs = after.get(target);
  if (
    !base ||
    oldJs === undefined ||
    newJs === undefined ||
    hash(oldJs) !== base.sha256 ||
    fs.readFileSync(target, 'utf8') !== newJs
  )
    throw Error('Parent/project/native compiled-byte mismatch');
  const name = path.basename(emitted);
  fs.writeFileSync(path.join(output, name), newJs, { flag: 'wx' });
  files.push({
    source,
    sourceSha256: hash(fs.readFileSync(path.join(root, source))),
    emitted,
    emittedSha256: hash(newJs),
    parentSha256: hash(oldJs),
    parentPath: base.path,
    stagedName: name,
  });
}
const result = {
  schema: 'calendar-account-compiled-projection/v1',
  sourceRevision: git('rev-parse', 'HEAD'),
  baselineRevision,
  typescript: ts.version,
  compilation:
    'Full typechecked renderer project with NodeNext/ES2022/react-jsx from tracked tsconfig; virtual baseline reads replace only two source files. No string rewriting or transpile-only projection.',
  parentProjectionExact: true,
  currentDistExact: true,
  files,
};
fs.writeFileSync(path.join(output, 'compiled.json'), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify({ passed: true, files: files.length, parentProjectionExact: true }));
