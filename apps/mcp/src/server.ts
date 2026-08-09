import crypto from 'node:crypto';
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  ToolRegistry,
  ToolContext,
  RuntimeDependencies,
  createRuntimeDependencies,
  createRuntimeDependenciesWithStorage,
} from '@bangumi-agent-kit/tools';
import { HttpClient, BangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { Storage } from '@bangumi-agent-kit/db';
import { StdioMcpExecutionIdentityProvider } from './identity.js';
import type { McpExecutionIdentityProvider } from './identity.js';
import { StdioMcpConfirmationGrantProvider } from './confirmation.js';
import type { McpConfirmationGrantProvider } from './confirmation.js';

export { StdioMcpExecutionIdentityProvider } from './identity.js';
export type { McpExecutionIdentityProvider } from './identity.js';
export { StdioMcpConfirmationGrantProvider } from './confirmation.js';
export type { McpConfirmationGrantProvider } from './confirmation.js';

const RESERVED_IDENTITY_ARGUMENTS = new Set([
  'principalId',
  '_principalId',
  'botInstanceId',
  '_botInstanceId',
  'externalUserId',
  '_externalUserId',
  'conversationId',
  '_conversationId',
  'requestId',
  '_requestId',
]);

const CONFIRMATION_ID_PATTERN = '^cfm_[A-Za-z0-9_-]+$';
const CONFIRMATION_ID_REGEX = /^cfm_[A-Za-z0-9_-]+$/;

function addMcpConfirmationSchema(
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

function extractConfirmationId(
  rawArgs: Record<string, unknown>,
  grantProvider: McpConfirmationGrantProvider,
): string | undefined {
  const reserved = rawArgs._confirmationId;
  const legacy = rawArgs.confirmationId;

  if (reserved !== undefined && typeof reserved !== 'string') {
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      'MCP _confirmationId must be a string.',
      false,
      400,
    );
  }
  if (legacy !== undefined && typeof legacy !== 'string') {
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      'MCP confirmationId must be a string.',
      false,
      400,
    );
  }
  if (reserved !== undefined && legacy !== undefined && reserved !== legacy) {
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      'MCP _confirmationId and confirmationId must match when both are provided.',
      false,
      400,
    );
  }

  const confirmationId = reserved !== undefined ? reserved : legacy;
  if (confirmationId === undefined) return undefined;
  if (!CONFIRMATION_ID_REGEX.test(confirmationId)) {
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      'MCP confirmation ID has an invalid format.',
      false,
      400,
    );
  }

  const trustedGrant = grantProvider.getGrant();
  if (
    !trustedGrant ||
    !CONFIRMATION_ID_REGEX.test(trustedGrant) ||
    confirmationId !== trustedGrant
  ) {
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      'MCP confirmation requires a matching trusted Host grant for this invocation.',
      false,
      400,
    );
  }

  return confirmationId;
}

export interface McpServerOptions {
  dependencies?: RuntimeDependencies;
  storage?: Storage;
  databaseUrl?: string;
  httpClient?: HttpClient;
  registry?: ToolRegistry;
  identityProvider?: McpExecutionIdentityProvider;
  confirmationGrantProvider?: McpConfirmationGrantProvider;
}

export class BangumiMcpServer {
  private server: Server;
  private registry: ToolRegistry;
  private dependencies: RuntimeDependencies;
  private identityProvider: McpExecutionIdentityProvider;
  private confirmationGrantProvider: McpConfirmationGrantProvider;

  constructor(options: McpServerOptions | HttpClient = {}) {
    let opts: McpServerOptions = {};
    if (options && 'request' in options && typeof (options as HttpClient).request === 'function') {
      opts = { httpClient: options as HttpClient };
    } else {
      opts = options as McpServerOptions;
    }

    if (opts.registry) {
      this.registry = opts.registry;
      this.dependencies =
        opts.dependencies ||
        (opts.storage
          ? createRuntimeDependenciesWithStorage(opts.storage)
          : (() => {
              throw new Error('Registry provided without dependencies or storage');
            })());
    } else if (opts.dependencies) {
      this.dependencies = opts.dependencies;
      this.registry = new ToolRegistry(this.dependencies);
    } else if (opts.storage) {
      this.dependencies = createRuntimeDependenciesWithStorage(opts.storage, {
        databaseUrl: opts.databaseUrl,
        publicHttpClient: opts.httpClient,
      });
      this.registry = new ToolRegistry(this.dependencies);
    } else {
      throw new Error('Use BangumiMcpServer.create() for runtime initialization.');
    }

    this.identityProvider =
      opts.identityProvider || new StdioMcpExecutionIdentityProvider(this.dependencies.storage);
    this.confirmationGrantProvider =
      opts.confirmationGrantProvider || new StdioMcpConfirmationGrantProvider();

    this.server = new Server(
      {
        name: 'bangumi-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  static async create(options: McpServerOptions | HttpClient = {}): Promise<BangumiMcpServer> {
    let opts: McpServerOptions = {};
    if (options && 'request' in options && typeof (options as HttpClient).request === 'function') {
      opts = { httpClient: options as HttpClient };
    } else {
      opts = options as McpServerOptions;
    }

    if (opts.dependencies || opts.storage || opts.registry) {
      return new BangumiMcpServer(opts);
    }

    const dependencies = await createRuntimeDependencies({
      databaseUrl: opts.databaseUrl,
      publicHttpClient: opts.httpClient,
    });
    return new BangumiMcpServer({ ...opts, dependencies });
  }

  public get mcpServer(): Server {
    return this.server;
  }

  public getMcpServer(): Server {
    return this.server;
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
  }

  public async close(): Promise<void> {
    await this.dependencies.storage.close();
  }

  private setupHandlers(): void {
    // List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.registry.getTools();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mcpTools = tools.map((tool: any) => {
        const derivedJsonSchema = z.toJSONSchema(tool.input) as Record<string, unknown>;
        delete derivedJsonSchema.$schema;
        if (!derivedJsonSchema.type) {
          derivedJsonSchema.type = 'object';
        }

        return {
          name: tool.name,
          description: tool.description,
          inputSchema: addMcpConfirmationSchema(tool, derivedJsonSchema),
        };
      });

      return { tools: mcpTools };
    });

    // Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        const rawArgs = (args || {}) as Record<string, unknown>;
        const resolvedContext = await this.identityProvider.resolveContext(request);
        const confirmationId = extractConfirmationId(rawArgs, this.confirmationGrantProvider);
        const context: ToolContext = {
          ...resolvedContext,
          requestId: `req_${crypto.randomUUID()}`,
          confirmationId,
        };

        const toolArgs: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rawArgs)) {
          if (
            !key.startsWith('_') &&
            key !== 'confirmationId' &&
            key !== 'confirmationGrant' &&
            key !== 'BANGUMI_MCP_CONFIRMATION_GRANT' &&
            !RESERVED_IDENTITY_ARGUMENTS.has(key)
          ) {
            toolArgs[key] = value;
          }
        }

        const result = await this.registry.executeTool(name, toolArgs, context);
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        if (!(err instanceof BangumiError)) {
          console.error('[MCP Tool Execution Error]', err);
        }
        const publicErr = toPublicError(err);
        const errorBody: Record<string, unknown> = {
          code: publicErr.code,
          message: publicErr.message,
        };
        if (typeof publicErr.retryable === 'boolean') {
          errorBody.retryable = publicErr.retryable;
        }
        if (publicErr.nextAction) {
          errorBody.nextAction = publicErr.nextAction;
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: false,
                  error: errorBody,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }
}
