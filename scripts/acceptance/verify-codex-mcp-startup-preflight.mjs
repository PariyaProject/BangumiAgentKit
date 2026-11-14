import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relationModelConfig } from '../lib/native-relation-model-cli.mjs';
import { relationModelEnvironment } from '../lib/native-relation-model-gates.mjs';
import {
  RELATION_MODEL_PROFILE,
  RELATION_MODEL_SERVER_ID,
} from '../lib/native-relation-model-profile.mjs';
import {
  codexMcpToolLimitsOverride,
  inspectCodexMcpStartup,
} from '../lib/codex-mcp-startup-preflight.mjs';

// Metadata-only regression for the original override format. The nonsensical
// gate path is intentional: no actual acceptance workload is started.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-mcp-startup-preflight-'));
try {
  const original = relationModelConfig(path.join(directory, 'unused', 'gate.json'));
  const inline = [
    ...original.filter((line) => !line.includes('.output_token_limit=')),
    codexMcpToolLimitsOverride(RELATION_MODEL_SERVER_ID, RELATION_MODEL_PROFILE.toolNames, 12000),
  ];
  const opts = { cwd: directory, env: relationModelEnvironment() };
  const rejected = inspectCodexMcpStartup(original, opts);
  const accepted = inspectCodexMcpStartup(inline, opts);
  process.stdout.write(JSON.stringify({ rejected, accepted }) + '\n');
  assert.equal(rejected.reason, 'STRICT_STARTUP_CONFIG_REJECTED');
  assert.equal(accepted.accepted, true);
  assert.notEqual(rejected.configSha256, accepted.configSha256);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
