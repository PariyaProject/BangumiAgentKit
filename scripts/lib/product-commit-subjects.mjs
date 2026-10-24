import { gitRepositoryText } from './g26-mcp-bundle.mjs';

// Synchronization merges carry their parents' engineering work. Inspect every
// non-merge commit on both sides, including runtime-only commits on a side branch.
export function readProductCommitSubjects(root, base, head = 'HEAD') {
  return gitRepositoryText(root, ['log', '--no-merges', '--format=%s', `${base}..${head}`])
    .split('\n')
    .filter(Boolean);
}
