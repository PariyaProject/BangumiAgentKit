import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { BangumiMcpServer } from './server.js';

export async function startStdioServer() {
  loadRuntimeEnv();
  const mcpApp = await BangumiMcpServer.create();
  const server = mcpApp.getMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[bangumi-mcp] Stdio transport connected and running');
}
