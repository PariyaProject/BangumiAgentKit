import { execFileSync } from 'node:child_process';
import { sanitizeGitRepositoryEnvironment } from './g26-mcp-bundle.mjs';

const CATALOG_BLOB_PATH = 'docs/tool-catalog.json';
const GIT_COMMIT_SHA = /^[0-9a-f]{40}$/u;

export function readToolCatalogAtSourceRevision(repositoryRoot, sourceRevision) {
  if (typeof repositoryRoot !== 'string' || !GIT_COMMIT_SHA.test(sourceRevision ?? '')) {
    throw new Error('A repository root and full Git source revision are required.');
  }

  let bytes;
  try {
    bytes = execFileSync('git', ['show', `${sourceRevision}:${CATALOG_BLOB_PATH}`], {
      cwd: repositoryRoot,
      env: sanitizeGitRepositoryEnvironment(),
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error('Unable to read the tool catalog at its source revision.');
  }

  let catalog;
  try {
    catalog = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('The source-revision tool catalog is not valid UTF-8 JSON.');
  }
  if (!Array.isArray(catalog)) {
    throw new Error('The source-revision tool catalog must be a JSON array.');
  }

  return { bytes, catalog };
}
