import crypto from 'node:crypto';
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  ToolRegistry,
  ToolContext,
  RuntimeDependencies,
  createRuntimeDependencies,
} from '@bangumi-agent-kit/tools';
import { HttpClient, BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import { Storage } from '@bangumi-agent-kit/db';

export interface McpExecutionIdentityProvider {
  resolveContext(request: unknown): Promise<Omit<ToolContext, 'confirmationId'>>;
}

export class StdioMcpExecutionIdentityProvider implements McpExecutionIdentityProvider {
  private conversationId = `session_${crypto.randomUUID()}`;

  async resolveContext(): Promise<Omit<ToolContext, 'confirmationId'>> {
    return {
      principalId: process.env.BANGUMI_MCP_PRINCIPAL_ID || 'local-mcp-user',
      botInstanceId: 'local-mcp',
      conversationId: this.conversationId,
    };
  }
}

export interface McpServerOptions {
  dependencies?: RuntimeDependencies;
  storage?: Storage;
  databaseUrl?: string;
  httpClient?: HttpClient;
  registry?: ToolRegistry;
  identityProvider?: McpExecutionIdentityProvider;
}

export class BangumiMcpServer {
  private server: Server;
  private registry: ToolRegistry;
  private dependencies: RuntimeDependencies;
  private identityProvider: McpExecutionIdentityProvider;

  constructor(options: McpServerOptions | HttpClient = {}) {
    let opts: McpServerOptions = {};
    if (options && 'request' in options && typeof (options as HttpClient).request === 'function') {
      opts = { httpClient: options as HttpClient };
    } else {
      opts = options as McpServerOptions;
    }

    this.identityProvider = opts.identityProvider || new StdioMcpExecutionIdentityProvider();

    if (opts.registry) {
      this.registry = opts.registry;
      this.dependencies = opts.dependencies || createRuntimeDependencies({ storage: opts.storage });
    } else {
      this.dependencies =
        opts.dependencies ||
        createRuntimeDependencies({
          storage: opts.storage,
          databaseUrl: opts.databaseUrl,
          publicHttpClient: opts.httpClient,
        });
      this.registry = new ToolRegistry(this.dependencies);
    }

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

  public get mcpServer(): Server {
    return this.server;
  }

  public getMcpServer(): Server {
    return this.server;
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
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
          inputSchema: derivedJsonSchema,
        };
      });

      return { tools: mcpTools };
    });

    // Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const rawArgs = (args || {}) as Record<string, unknown>;

      const resolvedContext = await this.identityProvider.resolveContext(request);
      const confirmationId =
        (rawArgs._confirmationId as string) || (rawArgs.confirmationId as string) || undefined;

      const context: ToolContext = {
        ...resolvedContext,
        confirmationId,
      };

      const toolArgs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawArgs)) {
        if (!k.startsWith('_')) {
          toolArgs[k] = v;
        }
      }

      try {
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
        const safeMessage =
          err instanceof BangumiError
            ? err.message
            : process.env.NODE_ENV === 'production'
              ? '内部服务发生错误'
              : err instanceof Error
                ? err.message
                : '内部服务发生错误';

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${safeMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
}
