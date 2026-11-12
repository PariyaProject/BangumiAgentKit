import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRelationSafetyMcpServer } from '../../../scripts/acceptance/native-relation-safety-mcp.mjs';

// Synthetic test entry only. No model, live source or durable execution claim.
const host = createRelationSafetyMcpServer();
const deadline = setTimeout(() => {
  void host.close();
}, 20000);
deadline.unref();
const transport = new StdioServerTransport();
await host.server.connect(transport);
process.stdin.once('end', () => {
  clearTimeout(deadline);
  void host.close();
});
