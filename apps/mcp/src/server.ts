import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry, ToolContext } from '@bangumi-agent-kit/tools';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

export class BangumiMcpServer {
  private server: Server;
  private registry: ToolRegistry;

  constructor(httpClient?: HttpClient) {
    const client = httpClient || new HttpClient();
    this.registry = new ToolRegistry(client);

    this.server = new Server(
      {
        name: 'bangumi-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  getMcpServer(): Server {
    return this.server;
  }

  getRegistry(): ToolRegistry {
    return this.registry;
  }

  private setupHandlers(): void {
    // List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.registry.getTools();
      const mcpTools = tools.map((tool) => {
        const jsonSchema = z.toJSONSchema(tool.input) as Record<string, unknown>;
        delete jsonSchema.$schema;
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: jsonSchema,
        };
      });
      return { tools: mcpTools };
    });

    // Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const context: ToolContext = {
        principalId: 'local-mcp-user',
        botInstanceId: 'local-mcp',
        conversationId: 'local-session',
      };

      const tool = this.registry.getTools().find((t) => t.name === name);
      if (!tool) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
      }

      // Perform runtime Zod schema validation
      const parseResult = tool.input.safeParse(args || {});
      if (!parseResult.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Validation Error for ${name}: ${parseResult.error.message}`,
            },
          ],
        };
      }

      try {
        const result = await this.registry.executeTool(name, parseResult.data, context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        };
      }
    });
  }
}
