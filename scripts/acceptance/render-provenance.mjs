import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The QA report records the source digest, so exclude it to avoid a self-referential hash.
// It is still bound to the rendered source by the Candidate SHA and all renderer inputs.
export const sourceIdentityExclusions = [
  'docs/research/run95-ux002-flexible-mask-visual-qa-2026-10-21.md',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function sourcePaths() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((file) => file && !sourceIdentityExclusions.includes(file))
    .sort();
}

function hashFiles(files) {
  const digest = createHash('sha256');
  for (const file of [...files].sort()) {
    digest.update(file).update('\0');
    digest.update(sha256(readFileSync(path.join(repoRoot, file)))).update('\0');
  }
  return digest.digest('hex');
}

export function candidateIdentity() {
  return {
    headSha: git(['rev-parse', 'HEAD']),
    baseSha: git(['merge-base', 'HEAD', 'origin/master']),
  };
}

export function sourceIdentity() {
  const paths = sourcePaths();
  return {
    workingTreeSha256: hashFiles(paths),
    includedPathCount: paths.length,
    excludedPaths: sourceIdentityExclusions,
  };
}

function filesBelow(root, relativeRoot) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    const relative = path.posix.join(relativeRoot, entry.name);
    return entry.isDirectory() ? filesBelow(absolute, relative) : [relative];
  });
}

export function distBuildIdentity(roots) {
  const files = roots.flatMap((relativeRoot) => {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    return filesBelow(absoluteRoot, relativeRoot);
  });
  const digest = createHash('sha256');
  for (const file of files.sort()) {
    digest.update(file).update('\0');
    digest.update(sha256(readFileSync(path.join(repoRoot, file)))).update('\0');
  }
  return {
    kind: 'typescript-dist',
    roots,
    sha256: digest.digest('hex'),
    fileCount: files.length,
  };
}

export function vitestSourceBuildIdentity() {
  const files = sourcePaths().filter((file) => file.startsWith('packages/renderer/src/'));
  const pipelineFiles = [
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'vitest.mobile-render-audit.config.ts',
    'tests/render/mobile-layout-audit.setup.ts',
    'tests/render/helpers/mobile-layout.ts',
    'tests/render/helpers/visual-matrix-fixture.ts',
  ];
  const inputs = [...new Set([...files, ...pipelineFiles])].sort();
  const pipeline = {
    runtime: 'Vitest source transform (no persisted renderer bundle)',
    nodeVersion: process.version,
    inputSha256: hashFiles(inputs),
    inputFileCount: inputs.length,
  };
  return {
    kind: 'vitest-source-transform',
    sha256: sha256(JSON.stringify(pipeline)),
    inputSha256: pipeline.inputSha256,
    inputFileCount: pipeline.inputFileCount,
    nodeVersion: pipeline.nodeVersion,
    runtime: pipeline.runtime,
  };
}

export function renderProvenance(kind) {
  const rendererBuild =
    kind === 'full-render'
      ? vitestSourceBuildIdentity()
      : kind === 'auth'
        ? distBuildIdentity([
            'packages/renderer/dist',
            'packages/bangumi-core/dist',
            'packages/auth/dist',
            'packages/bangumi-openapi/dist',
            'packages/bangumi-transport/dist',
            'apps/api/dist',
          ])
        : distBuildIdentity(['packages/renderer/dist']);
  return {
    candidate: candidateIdentity(),
    source: sourceIdentity(),
    rendererBuild,
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const kind = process.argv[2];
  if (!['fixed-reference', 'full-render', 'auth'].includes(kind)) {
    throw new Error(
      'Usage: node scripts/acceptance/render-provenance.mjs <fixed-reference|full-render|auth>',
    );
  }
  process.stdout.write(`${JSON.stringify(renderProvenance(kind))}\n`);
}
