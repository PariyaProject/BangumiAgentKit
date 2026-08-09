import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { createApiApp } from './app.js';

async function main() {
  loadRuntimeEnv();
  const { app } = await createApiApp();
  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3000', 10);

  try {
    const address = await app.listen({ host, port });
    console.log(`Bangumi API server listening at ${address}`);
  } catch (err) {
    console.error('Failed to start API server:', err);
    process.exit(1);
  }
}

main();
