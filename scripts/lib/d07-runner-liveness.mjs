import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const CLAIM_ID_PATTERN = /^d07-run-95-pr-\d+-[0-9a-f]{12}-[0-9a-f]{12}$/u;

export function d07RunnerProcessTitle(claimId) {
  if (typeof claimId !== 'string' || !CLAIM_ID_PATTERN.test(claimId)) {
    throw new TypeError('Invalid D07 one-shot claim ID.');
  }
  return `d07-run95-${claimId}`;
}

export function setD07RunnerProcessTitle(claimId) {
  const title = d07RunnerProcessTitle(claimId);
  process.title = title;
  return title;
}

export function d07RunnerTempDirectory(claimId, tempRoot = os.tmpdir()) {
  const title = d07RunnerProcessTitle(claimId);
  return path.join(tempRoot, title);
}

/** Match both the PID and claim-specific process title to avoid PID-reuse stalls. */
export function isD07RunnerProcessActive({ runnerPid, claimId }) {
  if (!Number.isSafeInteger(runnerPid) || runnerPid <= 0) return false;
  let expectedTitle;
  try {
    expectedTitle = d07RunnerProcessTitle(claimId);
    process.kill(runnerPid, 0);
  } catch {
    return false;
  }
  const result = spawnSync('ps', ['-p', String(runnerPid), '-o', 'command='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  });
  return result.status === 0 && result.stdout?.trim() === expectedTitle;
}
