import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRelationModelTransportHost } from '../../../scripts/acceptance/native-relation-model-server.mjs';
import { RELATION_MODEL_PROFILE as P } from '../../../scripts/lib/native-relation-model-profile.mjs';
import { relationModelSha } from '../../../scripts/acceptance/native-relation-model-report.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../../../scripts/lib/agent-mcp-profile-claims.mjs';

// TEST ONLY: no production gate bypass or actual model/control-plane invocation.
const [directory, mode] = process.argv.slice(2);
const stat = fs.lstatSync(directory);
if (
  !path.basename(directory).startsWith('bgk-relation-runtime-test-') ||
  !stat.isDirectory() ||
  stat.isSymbolicLink() ||
  stat.uid !== process.getuid() ||
  (stat.mode & 0o777) !== 0o700
)
  throw new Error('INVALID_TEST_DIRECTORY');
const claim = JSON.parse(fs.readFileSync(path.join(directory, 'claim.json')));
const instance = randomUUID();
let host;
const publish = () => {
  if (mode === 'missing-summary') return;
  const value = {
    schema: 'native-relation-safety-server-summary/v1',
    sourceMode: 'native-synthetic-relation-safety',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    claimSha256: relationModelSha(canonical(claim)),
    serverInstanceId: instance,
    toolNames: P.toolNames,
    lifecycleStage: 'tool',
    failureCode: null,
    ...host.snapshot(),
  };
  fs.writeFileSync(
    path.join(directory, 'summary.json'),
    mode === 'malformed-summary' ? '{' : JSON.stringify(value),
    { mode: 0o600 },
  );
};
host = await createRelationModelTransportHost({ onChange: publish });
await host.server.connect(new StdioServerTransport());
process.stdin.once('end', () => {
  void host.close();
});
