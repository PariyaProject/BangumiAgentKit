import { BangumiMcpServer } from './server.js';

export async function createHttpMcpServer() {
  return await BangumiMcpServer.create();
}
