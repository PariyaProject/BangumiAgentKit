import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { createRuntimeDependencies, ToolRegistry } from '../packages/tools/dist/index.js';
import { MemoryStorage } from '../packages/db/dist/index.js';
import { HttpClient } from '../packages/bangumi-transport/dist/index.js';

async function main() {
  const storage = new MemoryStorage();
  const publicHttpClient = new HttpClient();
  const deps = createRuntimeDependencies({ storage, publicHttpClient: publicHttpClient as any });
  const registry = new ToolRegistry(deps);

  const tools = registry.getTools();

  const catalog = tools.map((t: any) => {
    const inputSchema = z.toJSONSchema(t.input) as Record<string, unknown>;
    delete inputSchema.$schema;

    const isDynamic = Boolean(t.resolvePolicy);

    return {
      name: t.name,
      description: t.description,
      auth: t.auth,
      risk: t.risk,
      scopes: t.scopes,
      policyMode: isDynamic ? ('dynamic' as const) : ('static' as const),
      ...(isDynamic
        ? {
            policyDescription:
              'Tool policies (auth, risk, confirmation) are resolved dynamically based on input parameters.',
          }
        : {}),
      inputSchema,
    };
  });

  // Sort tools by name for stable catalog output
  catalog.sort((a, b) => a.name.localeCompare(b.name));

  const catalogPath = path.join(process.cwd(), 'docs', 'tool-catalog.json');
  const docsDir = path.dirname(catalogPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
  console.log(`Successfully generated Tool Catalog at ${catalogPath} (${catalog.length} tools)`);
}

main().catch((err) => {
  console.error('Failed to generate tool catalog:', err);
  process.exit(1);
});
