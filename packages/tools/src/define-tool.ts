import { z } from 'zod';

export type OperationRisk = 'read' | 'write' | 'destructive';
export type ToolAuthRequirement = 'none' | 'optional' | 'required';

export interface ToolContext {
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  confirmationId?: string;
  requestId?: string;
}

export interface ResolvedToolPolicy {
  auth: ToolAuthRequirement;
  requiredCapabilities: string[];
  risk: OperationRisk;
  requiresConfirmation?: boolean;
  affectedCount?: number;
  actionType?: string;
  summary?: string;
}

export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: TSchema;
  auth: ToolAuthRequirement;
  scopes: string[];
  risk: OperationRisk;
  resolvePolicy?: (input: z.infer<TSchema>, context: ToolContext) => ResolvedToolPolicy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (input: z.infer<TSchema>, context: ToolContext, deps?: any) => Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(
  def: ToolDefinition<TSchema>
): ToolDefinition<TSchema> {
  return def;
}
