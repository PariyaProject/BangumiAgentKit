import { ToolDefinition, ToolContext } from './define-tool.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DatabaseStore } from '@bangumi-agent-kit/db';
import { createReadTools } from './definitions/read-tools.js';
import { createRawOperationTools } from './definitions/raw-operation-tools.js';
import { createWriteTools } from './definitions/write-tools.js';

export type ToolMode = 'curated' | 'full';

export class ToolRegistry {
  private toolsMap = new Map<string, ToolDefinition>();
  private curatedToolNames = new Set<string>();

  constructor(httpClient: HttpClient, db?: DatabaseStore) {
    const database = db || new DatabaseStore();
    const readTools = createReadTools(httpClient);
    const writeTools = createWriteTools(httpClient, database);
    const rawOperationTools = createRawOperationTools(httpClient);

    for (const tool of [...readTools, ...writeTools, ...rawOperationTools]) {
      this.registerTool(tool, true);
    }
  }

  registerTool(tool: ToolDefinition, isCurated = false): void {
    this.toolsMap.set(tool.name, tool);
    if (isCurated) {
      this.curatedToolNames.add(tool.name);
    }
  }

  getTools(mode: ToolMode = (process.env.BANGUMI_TOOL_MODE as ToolMode) || 'curated'): ToolDefinition[] {
    if (mode === 'curated') {
      return Array.from(this.toolsMap.values()).filter((tool) =>
        this.curatedToolNames.has(tool.name)
      );
    }
    return Array.from(this.toolsMap.values());
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.toolsMap.get(name);
  }

  async executeTool(name: string, rawInput: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const parseResult = tool.input.safeParse(rawInput);
    if (!parseResult.success) {
      throw new Error(`Invalid input for tool ${name}: ${parseResult.error.message}`);
    }

    return await tool.execute(parseResult.data, context);
  }
}
