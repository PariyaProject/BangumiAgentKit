import { ToolDefinition, ToolContext } from './define-tool.js';
import { HttpClient, BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import { Storage, MemoryStorage, PostgresStorage } from '@bangumi-agent-kit/db';
import { AuditService } from '@bangumi-agent-kit/bangumi-core';
import {
  TokenBroker,
  OAuthService,
  BangumiClientProvider,
  DefaultBangumiClientProvider,
  validateEncryptionKey,
} from '@bangumi-agent-kit/auth';
import { PolicyManager } from './policy.js';
import { createReadTools } from './definitions/read-tools.js';
import { createRawOperationTools } from './definitions/raw-operation-tools.js';
import { createWriteTools } from './definitions/write-tools.js';
import { createAuthTools } from './definitions/auth-tools.js';

export type ToolMode = 'curated' | 'full';

export interface RuntimeDependencies {
  storage: Storage;
  publicHttpClient: HttpClient;
  oauthService: OAuthService;
  tokenBroker: TokenBroker;
  clientProvider: BangumiClientProvider;
  auditService: AuditService;
}

export interface CreateRuntimeDependenciesConfig {
  storage?: Storage;
  databaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  secretKey?: string;
  keyVersion?: string;
  tokenUrl?: string;
  authorizeUrl?: string;
  publicHttpClient?: HttpClient;
  refreshSkewSeconds?: number;
}

export function createRuntimeDependencies(config: CreateRuntimeDependenciesConfig): RuntimeDependencies {
  const secretKey = config.secretKey || process.env.BANGUMI_TOKEN_ENCRYPTION_KEY || 'default-test-secret-key-123456';
  validateEncryptionKey(secretKey);

  const storage = config.storage || (config.databaseUrl
    ? new PostgresStorage(config.databaseUrl)
    : new MemoryStorage());

  const publicHttpClient = config.publicHttpClient || new HttpClient();
  const keyVersion = config.keyVersion || process.env.BANGUMI_TOKEN_KEY_VERSION || 'v1';

  const oauthService = new OAuthService(
    storage,
    {
      clientId: config.clientId || process.env.BANGUMI_OAUTH_CLIENT_ID || 'test_client_id',
      clientSecret: config.clientSecret || process.env.BANGUMI_OAUTH_CLIENT_SECRET || 'test_client_secret',
      redirectUri: config.redirectUri || process.env.BANGUMI_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/bangumi/callback',
      secretKey,
      keyVersion,
      tokenUrl: config.tokenUrl,
      authorizeUrl: config.authorizeUrl,
    },
    publicHttpClient
  );

  const tokenBroker = new TokenBroker(
    storage,
    {
      secretKey,
      keyVersion,
      clientId: config.clientId || process.env.BANGUMI_OAUTH_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.BANGUMI_OAUTH_CLIENT_SECRET,
      redirectUri: config.redirectUri || process.env.BANGUMI_OAUTH_REDIRECT_URI,
      tokenUrl: config.tokenUrl,
      refreshSkewSeconds: config.refreshSkewSeconds,
    },
    publicHttpClient
  );

  const clientProvider = new DefaultBangumiClientProvider(tokenBroker);
  const auditService = new AuditService(storage);

  return {
    storage,
    publicHttpClient,
    oauthService,
    tokenBroker,
    clientProvider,
    auditService,
  };
}

export class ToolRegistry {
  private toolsMap = new Map<string, ToolDefinition>();
  private curatedToolNames = new Set<string>();
  public readonly deps: RuntimeDependencies;

  constructor(dependenciesOrHttpClient?: RuntimeDependencies | HttpClient, storage?: Storage) {
    if (dependenciesOrHttpClient && 'storage' in dependenciesOrHttpClient) {
      this.deps = dependenciesOrHttpClient;
    } else {
      const httpClient = (dependenciesOrHttpClient as HttpClient) || new HttpClient();
      this.deps = createRuntimeDependencies({
        storage,
        publicHttpClient: httpClient,
      });
    }

    const readTools = createReadTools(this.deps.publicHttpClient);
    const writeTools = createWriteTools(this.deps.clientProvider);
    const rawOperationTools = createRawOperationTools(this.deps.clientProvider);
    const authTools = createAuthTools(this.deps.tokenBroker, this.deps.oauthService);

    for (const tool of [...readTools, ...writeTools, ...rawOperationTools, ...authTools]) {
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
      throw new BangumiError('NOT_FOUND', `Tool not found: ${name}`, false, 404);
    }

    const parseResult = tool.input.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `Invalid input for tool ${name}: ${parseResult.error.message}`,
        false,
        400
      );
    }

    // 1. Resolve Policy
    const policy = PolicyManager.resolvePolicyForTool(tool, parseResult.data, context);

    // 2. Assert Write & Confirmation Policy
    const { confirmationId, pendingActionId } = await PolicyManager.assertAndClaimWritePolicy({
      storage: this.deps.storage,
      context,
      actionType: policy.actionType || name,
      summary: policy.summary || `${name} operation`,
      policy,
      payload: parseResult.data,
    });

    // 3. Execute Tool
    let result: unknown;
    try {
      result = await tool.execute(parseResult.data, context, this.deps);
    } catch (err: unknown) {
      const isNetworkUnknown = err instanceof BangumiError && err.code === 'NETWORK_ERROR' && !err.retryable;
      if (pendingActionId) {
        if (isNetworkUnknown) {
          await this.deps.storage.markPendingActionUnknown(pendingActionId, err instanceof Error ? err.message : String(err));
        } else {
          await this.deps.storage.markPendingActionFailed(
            pendingActionId,
            err instanceof Error ? err.message : String(err),
            err instanceof BangumiError ? err.code : 'EXECUTION_FAILED'
          );
        }
      }

      if (policy.risk !== 'read') {
        await this.deps.auditService.recordWrite({
          principalId: context.principalId,
          operationId: name,
          riskLevel: policy.risk,
          resourceType: name.split('.')[1] || 'resource',
          resourceId: String((parseResult.data as Record<string, unknown>)?.subjectId || (parseResult.data as Record<string, unknown>)?.characterId || (parseResult.data as Record<string, unknown>)?.personId || (parseResult.data as Record<string, unknown>)?.indexId || '0'),
          changeSummary: parseResult.data,
          confirmationId,
          result: isNetworkUnknown ? 'unknown' : 'failed',
          requestId: context.requestId,
        });
      }

      throw err;
    }

    // 4. Success handling
    if (pendingActionId) {
      await this.deps.storage.markPendingActionSucceeded(pendingActionId);
    }

    if (policy.risk !== 'read') {
      await this.deps.auditService.recordWrite({
        principalId: context.principalId,
        operationId: name,
        riskLevel: policy.risk,
        resourceType: name.split('.')[1] || 'resource',
        resourceId: String((parseResult.data as Record<string, unknown>)?.subjectId || (parseResult.data as Record<string, unknown>)?.characterId || (parseResult.data as Record<string, unknown>)?.personId || (parseResult.data as Record<string, unknown>)?.indexId || '0'),
        changeSummary: parseResult.data,
        confirmationId,
        result: 'success',
        requestId: context.requestId,
      });
    }

    return result;
  }
}
