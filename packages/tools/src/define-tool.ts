import { z } from 'zod';
import type { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import type { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import type { Storage } from '@bangumi-agent-kit/db';
import type { OAuthService, TokenBroker, BangumiClientProvider } from '@bangumi-agent-kit/auth';
import type { AuditService } from '@bangumi-agent-kit/bangumi-core';
import type { ProviderRegistry } from '@bangumi-agent-kit/provider-core';

export type OperationRisk = 'read' | 'write' | 'destructive';
export type ToolAuthRequirement = 'none' | 'optional' | 'required';

export interface ToolContext {
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  artifactPrincipalKey?: string;
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
  providerRegistry?: ProviderRegistry;

  executionSession?: AuthenticatedExecutionSession;
  preparedConfirmation?: ToolConfirmationPreview;
}

export interface ToolConfirmationPreview {
  /** A bounded user-visible summary of the current state and requested change. */
  summary: string;
  /** Current state used only to bind this preview to the confirmation claim. */
  snapshot: unknown;
  /** Optional deterministic data that execution must reuse after confirmation. */
  executionData?: unknown;
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
  prepareConfirmation?: (
    input: z.infer<TSchema>,
    context: ToolContext,
    deps: ToolExecutionDependencies,
  ) => Promise<ToolConfirmationPreview>;
  execute: (
    input: z.infer<TSchema>,
    context: ToolContext,
    deps?: ToolExecutionDependencies,
  ) => Promise<unknown>;
}

/** Adds runtime write-policy guidance to client catalogs without changing the evidence-bound catalog text. */
export function getUserFacingToolDescription(
  tool: Pick<ToolDefinition, 'name' | 'description' | 'auth' | 'risk' | 'scopes'>,
): string {
  const isAccountContentWrite =
    tool.name !== 'bangumi.call_operation' &&
    tool.auth === 'required' &&
    tool.risk !== 'read' &&
    tool.scopes.some((scope) => scope === 'write:collection' || scope === 'write:indices');

  if (!isAccountContentWrite) return tool.description;
  const description =
    tool.name === 'bangumi.update_episode_progress'
      ? tool.description.replace('超过 20 集的大批量变更将自动要求二次确认。', '')
      : tool.description;
  return `${description.trim()} 每次账户内容写入都必须先展示绑定账号、当前状态和请求变化，并通过服务端二次确认；确认前不会执行写入。`;
}

export function defineTool<TSchema extends z.ZodType>(
  def: ToolDefinition<TSchema>,
): ToolDefinition<TSchema> {
  return def;
}
