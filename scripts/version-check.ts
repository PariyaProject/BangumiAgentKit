import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

interface PackageMetadata {
  name?: string;
  version?: string;
  license?: string;
}

interface Check {
  label: string;
  ok: boolean;
  message: string;
}

const root = process.cwd();
const checks: Check[] = [];

function readJson(filePath: string): PackageMetadata {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PackageMetadata;
}

function add(label: string, ok: boolean, message: string): void {
  checks.push({ label, ok, message });
}

const rootPackage = readJson(path.join(root, 'package.json'));
add('root version', rootPackage.version === '0.1.0', rootPackage.version || 'missing');
add('root license', rootPackage.license === 'Apache-2.0', rootPackage.license || 'missing');

for (const workspaceDir of ['apps', 'packages']) {
  const directory = path.join(root, workspaceDir);
  for (const entry of fs.readdirSync(directory).sort()) {
    const packagePath = path.join(directory, entry, 'package.json');
    if (!fs.existsSync(packagePath)) continue;
    const metadata = readJson(packagePath);
    add(
      `${metadata.name || packagePath} version`,
      metadata.version === '0.1.0',
      metadata.version || 'missing',
    );
    add(
      `${metadata.name || packagePath} license`,
      metadata.license === 'Apache-2.0',
      metadata.license || 'missing',
    );
  }
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
add(
  'README status',
  /Current status/u.test(readme) && /Standalone/u.test(readme),
  'release-candidate sections present',
);
add(
  'migration source',
  fs.existsSync(path.join(root, 'packages/db/src/drizzle/sqlite/migrations/0000_initial.sql')),
  'SQLite migration source present',
);
add(
  'license files',
  ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'].every((file) =>
    fs.existsSync(path.join(root, file)),
  ),
  'Apache/provenance files present',
);

let exactTag = '';
try {
  exactTag = execFileSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch {
  exactTag = 'no exact release tag';
}
add(
  'git tag state',
  !exactTag || exactTag === 'no exact release tag',
  exactTag || 'no exact release tag',
);

for (const item of checks)
  console.log(`${item.ok ? '[PASS]' : '[FAIL]'} ${item.label}: ${item.message}`);
const failed = checks.filter((item) => !item.ok).length;
console.log(`\n${checks.length - failed} PASS`);
console.log(`${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
