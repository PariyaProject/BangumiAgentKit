import { z } from 'zod';
import type { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import type { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import type { Storage } from '@bangumi-agent-kit/db';
import type { OAuthService, TokenBroker, BangumiClientProvider } from '@bangumi-agent-kit/auth';
import type { AuditService } from '@bangumi-agent-kit/bangumi-core';

export type OperationRisk = 'read' | 'write' | 'destructive';
export type ToolAuthRequirement = 'none' | 'optional' | 'required';

export interface ToolContext {
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  confirmationId?: string;
  requestId?: string;
}

export interface AuthenticatedExecutionSession {
  account?: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
  };
  client: GeneratedBangumiOpenApiClient;
}

export interface ToolExecutionDependencies {
  storage?: Storage;
  publicHttpClient?: HttpClient;
  oauthService?: OAuthService;
  tokenBroker?: TokenBroker;
  clientProvider?: BangumiClientProvider;
  auditService?: AuditService;

  executionSession?: AuthenticatedExecutionSession;
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
  execute: (
    input: z.infer<TSchema>,
    context: ToolContext,
    deps?: ToolExecutionDependencies,
  ) => Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(
  def: ToolDefinition<TSchema>,
): ToolDefinition<TSchema> {
  return def;
}

