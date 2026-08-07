import { BangumiMcpServer } from './server.js';

export function createHttpMcpServer() {
  const mcpApp = new BangumiMcpServer();
  return mcpApp;
}
