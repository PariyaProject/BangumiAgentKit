import { BangumiMcpServer, type McpServerOptions } from './server.js';

export async function createHttpMcpServer(options: McpServerOptions = {}) {
  return await BangumiMcpServer.create(options);
}
