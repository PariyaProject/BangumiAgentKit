import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createG03NativeMcpServer } from '../../../scripts/acceptance/g03-native-discovery-mcp.mjs';

const host = await createG03NativeMcpServer();
process.stdin.once('end', async () => {
  try {
    const summary = host.snapshot();
    await host.close();
    process.stderr.write(JSON.stringify({ ...summary, closed: true }) + '\n');
  } catch {
    process.exitCode = 2;
  }
});
await host.server.connect(new StdioServerTransport());
