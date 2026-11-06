// Synthetic native-stdio worker. Never import this fixture in a live runner.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createNativeEntityPageMcpServer } from '../../../scripts/acceptance/native-entity-page-mcp.mjs';
let requests = 0;
globalThis.fetch = async () => { throw new Error('SYNTHETIC_NATIVE_NETWORK_DISABLED'); };
const host = createNativeEntityPageMcpServer({
  fetchImpl: async () => {
    requests++;
    return Response.json({ total: 0, limit: 1, offset: 0, data: [] });
  },
});
process.stdin.once('end', async () => {
  await host.close();
  const facts = host.snapshot();
  process.stderr.write(JSON.stringify({ requests, facts }) + '\n');
  process.exitCode = requests === 2 && facts.requestCount === 2 && facts.forbiddenServiceAttempts === 0 ? 0 : 2;
});
await host.server.connect(new StdioServerTransport());
