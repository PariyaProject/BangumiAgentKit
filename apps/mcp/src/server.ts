import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry, ToolContext, RuntimeDependencies, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { Storage } from '@bangumi-agent-kit/db';

export interface McpServerOptions {
  dependencies?: RuntimeDependencies;
  storage?: Storage;
  databaseUrl?: string;
  httpClient?: HttpClient;
  registry?: ToolRegistry;
}

interface ZodCheck {
  check?: string;
  kind?: string;
  def?: { kind?: string; check?: string; format?: string; value?: unknown; min?: unknown; max?: unknown };
  _zod?: { def?: { kind?: string; check?: string; format?: string; value?: unknown; min?: unknown; max?: unknown } };
  value?: unknown;
  min?: unknown;
  max?: unknown;
  minValue?: number;
  maxValue?: number;
  isInt?: boolean;
  constructor?: { name?: string };
}

interface ZodTypeInternal {
  description?: string;
  _def?: {
    typeName?: string;
    description?: string;
    defaultValue?: unknown;
    checks?: ZodCheck[];
    innerType?: ZodTypeInternal;
    schema?: ZodTypeInternal;
    type?: unknown;
  };
  constructor?: { name?: string };
  isOptional?: () => boolean;
}

function convertZodPropToJsonSchema(prop: ZodTypeInternal) {
  let current: ZodTypeInternal | undefined = prop;
  let description: string | undefined;
  let defVal: unknown;
  const checks: ZodCheck[] = [];

  while (current?._def) {
    if (current.description) description = current.description;
    if (current._def.description) description = current._def.description;
    if (current._def.defaultValue !== undefined) {
      defVal = typeof current._def.defaultValue === 'function' ? current._def.defaultValue() : current._def.defaultValue;
    }
    if (Array.isArray(current._def.checks)) {
      checks.push(...current._def.checks);
    }

    if (current._def.innerType) {
      current = current._def.innerType;
    } else if (current._def.schema) {
      current = current._def.schema;
    } else if (current._def.type && typeof current._def.type === 'object') {
      current = current._def.type as ZodTypeInternal;
    } else {
      break;
    }
  }

  const rawType = (typeof current?._def?.type === 'string' ? current._def.type : undefined) || current?.constructor?.name?.replace(/^Zod/, '').toLowerCase() || 'string';
  let type = 'string';
  if (rawType === 'number' || rawType === 'Number') {
    const isInt = checks.some((c) => c.isInt || c.kind === 'int' || c.def?.kind === 'int' || c.def?.format === 'safeint' || c.def?.check === 'number_format' || c._zod?.def?.format === 'safeint');
    type = isInt ? 'integer' : 'number';
  } else if (rawType === 'boolean' || rawType === 'Boolean') {
    type = 'boolean';
  } else if (rawType === 'array' || rawType === 'Array') {
    type = 'array';
  } else if (rawType === 'object' || rawType === 'Object') {
    type = 'object';
  } else {
    type = 'string';
  }

  let min: unknown;
  let max: unknown;
  for (const c of checks) {
    const zodDef = c._zod?.def || c.def || c;
    const checkKind = zodDef.check || zodDef.kind || c.kind || c.constructor?.name || '';
    const val = zodDef.value ?? zodDef.min ?? zodDef.max ?? c.value ?? c.min ?? c.max;

    if (checkKind === 'min' || checkKind === 'greater_than' || String(checkKind).includes('GreaterThan') || String(checkKind).includes('Min')) {
      if (val !== undefined) min = val;
    }
    if (checkKind === 'max' || checkKind === 'less_than' || String(checkKind).includes('LessThan') || String(checkKind).includes('Max')) {
      if (val !== undefined) max = val;
    }
    if (checkKind === 'positive') {
      min = 1;
    }
  }

  if (type === 'integer') {
    if (min === undefined) min = -9007199254740991;
    if (max === undefined) max = 9007199254740991;
  }

  const result: Record<string, unknown> = {};
  if (description) result.description = description;
  if (defVal !== undefined) result.default = defVal;
  if (max !== undefined) result.maximum = max;
  if (min !== undefined) result.minimum = min;
  result.type = type;

  return result;
}

export class BangumiMcpServer {
  private server: Server;
  private registry: ToolRegistry;
  private dependencies: RuntimeDependencies;

  constructor(options: McpServerOptions = {}) {
    if (options.registry) {
      this.registry = options.registry;
      this.dependencies = options.dependencies || createRuntimeDependencies({ storage: options.storage });
    } else {
      this.dependencies =
        options.dependencies ||
        createRuntimeDependencies({
          storage: options.storage,
          databaseUrl: options.databaseUrl,
          publicHttpClient: options.httpClient,
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
      }
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
        let jsonSchema: Record<string, unknown>;
        if (tool.input && 'shape' in tool.input && typeof tool.input.shape === 'object' && tool.input.shape) {
          const properties: Record<string, unknown> = {};
          const required: string[] = [];

          for (const [key, prop] of Object.entries(tool.input.shape)) {
            properties[key] = convertZodPropToJsonSchema(prop as ZodTypeInternal);

            let isOpt = false;
            let current: ZodTypeInternal | undefined = prop as ZodTypeInternal;
            while (current?._def) {
              const tn = current._def.typeName || current.constructor?.name;
              if (tn === 'ZodDefault') {
                break;
              }
              if (tn === 'ZodOptional') {
                isOpt = true;
                break;
              }
              current = (current._def.innerType as ZodTypeInternal) || (current._def.schema as ZodTypeInternal) || (typeof current._def.type === 'object' ? (current._def.type as ZodTypeInternal) : undefined);
            }

            if (!isOpt) {
              required.push(key);
            }
          }

          jsonSchema = {
            type: 'object',
            properties,
            required,
            additionalProperties: false,
          };
        } else {
          jsonSchema = { type: 'object' };
        }

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
      const rawArgs = (args || {}) as Record<string, unknown>;

      const context: ToolContext = {
        principalId: (rawArgs._principalId as string) || 'local-mcp-user',
        botInstanceId: (rawArgs._botInstanceId as string) || 'local-mcp',
        conversationId: (rawArgs._conversationId as string) || 'local-session',
        confirmationId: (rawArgs._confirmationId as string) || (rawArgs.confirmationId as string) || undefined,
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
        const error = err as Error;
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
}
