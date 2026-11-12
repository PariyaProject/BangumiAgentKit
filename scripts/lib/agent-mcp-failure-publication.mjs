import fs from 'node:fs';
import path from 'node:path';
import { isProducedFailureObservation } from './agent-mcp-failure-observation.mjs';

function privateDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid() ||
    (stat.mode & 0o777) !== 0o700
  )
    throw new Error('FAILURE_OBSERVATION_DIRECTORY_INVALID');
  return { realPath: fs.realpathSync(directory), device: stat.dev, inode: stat.ino };
}

function insideExecutionDirectory(target, execution) {
  let current = target.realPath;
  for (;;) {
    const stat = fs.statSync(current);
    if (stat.dev === execution.device && stat.ino === execution.inode) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/** Publish outside the execution cleanup root, create-only. Call before cleanup. */
export function publishAgentMcpFailure(observation, { directory, executionDirectory } = {}) {
  if (!isProducedFailureObservation(observation))
    throw new Error('FAILURE_OBSERVATION_NOT_PRODUCED');
  let descriptor,
    failed = false;
  try {
    const target = privateDirectory(directory),
      execution = privateDirectory(executionDirectory);
    if (insideExecutionDirectory(target, execution))
      throw new Error('FAILURE_OBSERVATION_PUBLICATION_INSIDE_CLEANUP_ROOT');
    descriptor = fs.openSync(
      path.join(target.realPath, 'agent-mcp-failure-observation.json'),
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600,
    );
    fs.fchmodSync(descriptor, 0o600);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1)
      throw new Error('FAILURE_OBSERVATION_PUBLICATION_FAILED');
    fs.writeFileSync(descriptor, JSON.stringify(observation) + '\n');
    fs.fsyncSync(descriptor);
  } catch {
    failed = true;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        failed = true;
      }
    }
  }
  if (failed) throw new Error('FAILURE_OBSERVATION_PUBLICATION_FAILED');
  return { published: true, observationOnly: true, acceptanceCredit: false, retryAllowed: false };
}
