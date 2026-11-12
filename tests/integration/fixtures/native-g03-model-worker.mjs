import fs from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createG03ModelTransportHost } from '../../../scripts/acceptance/native-g03-date-png-server.mjs';
import { G03_MODEL_PROFILE as P } from '../../../scripts/lib/native-g03-date-png-profile.mjs';
import { g03ModelSha } from '../../../scripts/acceptance/native-g03-date-png-report.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../../../scripts/lib/agent-mcp-profile-claims.mjs';

// Test-only host: synthetic claim/event input, no GitHub or model dispatch.
const directory = process.argv[2],
  claim = JSON.parse(fs.readFileSync(path.join(directory, 'test-input.json')));
process.env.TMPDIR = directory;
let host;
const publish = () => {
  const summary = {
    schema: 'native-g03-date-png-server-summary/v1',
    sourceMode: 'native-synthetic-discovery-date-png',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    claimSha256: g03ModelSha(canonical(claim)),
    serverInstanceId: '11111111-1111-4111-8111-111111111111',
    toolNames: P.toolNames,
    ...host.snapshot(),
  };
  fs.writeFileSync(path.join(directory, 'model-summary-new.json'), JSON.stringify(summary));
  fs.renameSync(
    path.join(directory, 'model-summary-new.json'),
    path.join(directory, 'model-summary.json'),
  );
};
host = await createG03ModelTransportHost({ onChange: publish });
process.stdin.once('end', async () => {
  await host.close();
  publish();
});
const transport = new StdioServerTransport();
publish();
await host.server.connect(transport);
