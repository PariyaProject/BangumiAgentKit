import { startStdioServer } from './stdio.js';

startStdioServer().catch((err) => {
  console.error('[bangumi-mcp] Failed to start server:', err);
  process.exit(1);
});
