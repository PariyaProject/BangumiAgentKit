import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DIST_RELATIVE_PATHS = ['apps/mcp/dist'];

export function computeMcpBundleSha256(root) {
  const absoluteRoot = path.resolve(root);
  const packageRoot = path.join(absoluteRoot, 'packages');
  const packageDirectories = readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages', entry.name, 'dist'));
  const relativeFiles = [];

  for (const relativeDirectory of [...DIST_RELATIVE_PATHS, ...packageDirectories]) {
    const absoluteDirectory = path.join(absoluteRoot, relativeDirectory);
    if (!statExists(absoluteDirectory)) continue;
    collectFiles(absoluteRoot, absoluteDirectory, relativeFiles);
  }

  relativeFiles.sort();
  if (relativeFiles.length === 0) {
    throw new Error('G26 MCP build output is missing; build the exact Candidate first.');
  }

  const digest = createHash('sha256');
  for (const relativeFile of relativeFiles) {
    digest.update(relativeFile, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(readFileSync(path.join(absoluteRoot, relativeFile)));
    digest.update('\0', 'utf8');
  }
  return digest.digest('hex');
}

function statExists(filePath) {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function collectFiles(root, directory, output) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, absolutePath, output);
    } else if (entry.isFile()) {
      output.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
  }
}
