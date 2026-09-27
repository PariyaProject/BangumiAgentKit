import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { z } from 'zod';

const CONFIRMATION_ID_PATTERN = '^cfm_[A-Za-z0-9_-]+$';

function confirmationSchema(
  tool: ReturnType<ToolRegistry['getTools']>[number],
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (tool.risk === 'read') return schema;

  const properties =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, unknown>)
      : {};

  return {
    ...schema,
    properties: {
      ...properties,
      _confirmationId: {
        type: 'string',
        pattern: CONFIRMATION_ID_PATTERN,
        description:
          'Only use the confirmation ID returned by a previous CONFIRMATION_REQUIRED response for the exact same operation and payload.',
      },
    },
  };
}

export function toMcpTool(tool: ReturnType<ToolRegistry['getTools']>[number]) {
  const inputSchema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete inputSchema.$schema;
  if (!inputSchema.type) inputSchema.type = 'object';

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: confirmationSchema(tool, inputSchema),
  };
}

export function toMcpCatalogEntry(tool: ReturnType<ToolRegistry['getTools']>[number]) {
  return {
    ...toMcpTool(tool),
    auth: tool.auth,
    risk: tool.risk,
  };
}

/** Return the real full-profile catalog without opening a network client or persistent database. */
export async function createFullMcpCatalog() {
  const storage = new MemoryStorage();
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    clientId: 'catalog-only.invalid',
    clientSecret: 'catalog-only.invalid',
    redirectUri: 'http://127.0.0.1/catalog-only',
    secretKey: 'catalog-only-unused-encryption-key',
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full' });
  try {
    return registry.getTools().map(toMcpCatalogEntry);
  } finally {
    await registry.close();
    await storage.close();
  }
}
