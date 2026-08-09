import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

async function main(): Promise<void> {
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'smoke-secret-key-123456789012345678901234',
    publicHttpClient: new HttpClient({
      userAgent: process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/PR-7C (read-only smoke)',
    }),
  });
  const registry = new ToolRegistry(deps);
  const result = (await registry.executeTool(
    'bangumi.query_subjects',
    { media: 'anime', sort: 'heat', limit: 3, explain: 'compact' },
    {
      principalId: 'smoke-principal',
      botInstanceId: 'smoke-bot',
      conversationId: 'smoke-discovery',
    },
  )) as {
    state?: string;
    items?: unknown[];
    coverage?: { scanned?: number; returned?: number };
  };
  if (!result.state || !Array.isArray(result.items) || !result.coverage) {
    throw new Error('Discovery online smoke returned an invalid structured result.');
  }
  process.stdout.write(
    `${JSON.stringify({
      state: result.state,
      itemCount: result.items.length,
      scanned: result.coverage.scanned,
      returned: result.coverage.returned,
    })}\n`,
  );
  await registry.close();
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
