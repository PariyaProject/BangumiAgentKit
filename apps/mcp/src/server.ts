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
      const mcpTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      }));
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

      try {
        const result = await this.registry.executeTool(name, args || {}, context);
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
