import { z } from 'zod';
import { AuthRequirement, OperationRisk } from '@bangumi-agent-kit/bangumi-openapi';

export interface ToolContext {
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  locale?: 'zh-CN' | 'ja-JP' | 'en';
  timezone?: string;
  outputMode?: 'auto' | 'text' | 'image' | 'mixed' | 'json';
  confirmationId?: string;
  accessToken?: string;
}

export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: TSchema;
  auth: AuthRequirement;
  scopes: string[];
  risk: OperationRisk;
  execute: (input: z.infer<TSchema>, context: ToolContext) => Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(
  tool: ToolDefinition<TSchema>
): ToolDefinition<TSchema> {
  return tool;
}
