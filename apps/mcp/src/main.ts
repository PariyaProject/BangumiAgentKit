import { startStdioServer } from './stdio.js';
import { createFullMcpCatalog } from './catalog.js';

async function main(): Promise<void> {
  if (process.argv.includes('--catalog')) {
    const catalog = await createFullMcpCatalog();
    process.stdout.write(`${JSON.stringify(catalog)}\n`);
    return;
  }
  await startStdioServer();
}

main().catch((err: unknown) => {
  console.error('[bangumi-mcp] Failed to start server:', err);
  process.exit(1);
});
