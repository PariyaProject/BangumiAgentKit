import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BangumiMcpServer } from './server.js';
import type { ToolProfile } from '@bangumi-agent-kit/tools';

function readProfile(value: string | undefined): ToolProfile | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'compact' || value === 'full') return value;
  throw new Error(`CONFIG_ERROR: BANGUMI_MCP_PROFILE must be compact or full (received ${value}).`);
}

export async function startStdioServer(options: { profile?: ToolProfile } = {}) {
  loadRuntimeEnv();
  const profile = options.profile || readProfile(process.env.BANGUMI_MCP_PROFILE);
  const mcpApp = await BangumiMcpServer.create({ profile });
  const server = mcpApp.getMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[bangumi-mcp] Stdio transport connected and running');
}
