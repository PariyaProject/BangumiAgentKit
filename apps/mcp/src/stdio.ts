import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BangumiMcpServer } from './server.js';

export async function startStdioServer() {
  const mcpApp = new BangumiMcpServer();
  const server = mcpApp.getMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[bangumi-mcp] Stdio transport connected and running');
}

if (require.main === module) {
  startStdioServer().catch((err) => {
    console.error('[bangumi-mcp] Fatal Stdio error:', err);
    process.exit(1);
  });
}
