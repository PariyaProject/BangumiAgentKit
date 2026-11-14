import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import {
  inspectRelationModelResult,
  reconcileRelationModelResult,
  retainRelationDiagnostic,
  runRelationModelProcess,
  withRelationModelCancellation,
} from '../../../scripts/acceptance/run-native-relation-model.mjs';
import { RELATION_MODEL_PROFILE as profile } from '../../../scripts/lib/native-relation-model-profile.mjs';

const [mode, execution, diagnostic] = process.argv.slice(2);
const fixture = fileURLToPath(import.meta.url);
const workerArgs = ['--input-type=module', '-e', 'setInterval(() => {}, 1000)'];

// These fixtures have no credentials, live control, MCP or model dispatch.
if (mode === 'child') {
  const descendant = spawn(process.execPath, workerArgs, { stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    descendant.once('spawn', resolve);
    descendant.once('error', reject);
  });
  await new Promise((resolve) => process.stdout.write('{"type":"thread.started"}\n', resolve));
  fs.writeFileSync(
    path.join(execution, 'ready.json'),
    JSON.stringify([process.pid, descendant.pid]),
  );
} else {
  const result = await withRelationModelCancellation(async (signal) => {
    if (mode === 'before-spawn') {
      process.send('ready');
      while (!signal.aborted) await setImmediate();
    }
    try {
      const processResult = await runRelationModelProcess(
        process.execPath,
        [fixture, 'child', execution, diagnostic],
        { signal, timeoutMs: 10000, env: { PATH: process.env.PATH } },
      );
      const inspected = inspectRelationModelResult(processResult, null, {});
      const published = retainRelationDiagnostic(
        { processResult, stage: 'inspection' },
        diagnostic,
        execution,
      );
      let acknowledgement = null;
      const terminal = reconcileRelationModelResult(
        {
          profile_id: profile.id,
          state: 'CLAIMED',
          disposition: { profileId: profile.id, state: 'CLAIMED', retryAllowed: false },
        },
        { passed: inspected.passed },
        null,
        (_claim, state) => {
          assert(fs.existsSync(published.path));
          acknowledgement = state;
          if (mode === 'ack-failure') throw new Error('synthetic acknowledgement failure');
          return { state, retryAllowed: false };
        },
      );
      return { terminal, acknowledgement, reason: inspected.reason };
    } finally {
      fs.rmSync(execution, { recursive: true });
    }
  });
  process.send({ ...result, executionRemoved: !fs.existsSync(execution) }, () =>
    process.disconnect(),
  );
}
