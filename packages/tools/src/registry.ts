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

export function createRuntimeDependencies(config: CreateRuntimeDependenciesConfig = {}): RuntimeDependencies {
  const isProd = process.env.NODE_ENV === 'production';
  const secretKey = config.secretKey || process.env.BANGUMI_TOKEN_ENCRYPTION_KEY;
  if (isProd && !secretKey) {
    throw new Error('CONFIG_ERROR: BANGUMI_TOKEN_ENCRYPTION_KEY is required in production environment.');
  }
  const effectiveSecretKey = secretKey || 'default-test-secret-key-123456';
  validateEncryptionKey(effectiveSecretKey);

  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
  const clientId = config.clientId || process.env.BANGUMI_OAUTH_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.BANGUMI_OAUTH_CLIENT_SECRET;
  const redirectUri = config.redirectUri || process.env.BANGUMI_OAUTH_REDIRECT_URI;

  if (isProd) {
    if (!databaseUrl) throw new Error('CONFIG_ERROR: DATABASE_URL is required in production environment.');
    if (!clientId) throw new Error('CONFIG_ERROR: BANGUMI_OAUTH_CLIENT_ID is required in production environment.');
    if (!clientSecret) throw new Error('CONFIG_ERROR: BANGUMI_OAUTH_CLIENT_SECRET is required in production environment.');
    if (!redirectUri) throw new Error('CONFIG_ERROR: BANGUMI_OAUTH_REDIRECT_URI is required in production environment.');
  }

  const storage = config.storage || (databaseUrl ? new PostgresStorage(databaseUrl) : new MemoryStorage());
  const publicHttpClient = config.publicHttpClient || new HttpClient();
  const keyVersion = config.keyVersion || process.env.BANGUMI_TOKEN_KEY_VERSION || 'v1';

  const oauthService = new OAuthService(
    storage,
    {
      clientId: clientId || 'test_client_id',
      clientSecret: clientSecret || 'test_client_secret',
      redirectUri: redirectUri || 'http://localhost:3000/oauth/bangumi/callback',
      secretKey: effectiveSecretKey,
      keyVersion,
      tokenUrl: config.tokenUrl,
      authorizeUrl: config.authorizeUrl,
    },
    publicHttpClient
  );

  const tokenBroker = new TokenBroker(
    storage,
    {
      secretKey: effectiveSecretKey,
      keyVersion,
      clientId,
      clientSecret,
      redirectUri,
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
  private toolsMap: Map<string, ToolDefinition> = new Map();
  private deps: RuntimeDependencies;

  constructor(optionsOrDeps?: RuntimeDependencies | CreateRuntimeDependenciesConfig) {
    if (optionsOrDeps && 'storage' in optionsOrDeps && 'tokenBroker' in optionsOrDeps) {
      this.deps = optionsOrDeps as RuntimeDependencies;
    } else {
      this.deps = createRuntimeDependencies((optionsOrDeps as CreateRuntimeDependenciesConfig) || {});
    }

    this.registerCoreTools();
  }

  private registerCoreTools(): void {
    const readTools = createReadTools(this.deps.publicHttpClient);
    for (const tool of readTools) {
      this.registerTool(tool);
    }

    const rawTools = createRawOperationTools(this.deps.clientProvider);
    for (const tool of rawTools) {
      this.registerTool(tool);
    }

    const writeTools = createWriteTools(this.deps.clientProvider, this.deps.storage);
    for (const tool of writeTools) {
      this.registerTool(tool);
    }

    const authTools = createAuthTools(this.deps.tokenBroker, this.deps.oauthService);
    for (const tool of authTools) {
      this.registerTool(tool);
    }
  }

  public registerTool(tool: ToolDefinition): void {
    this.toolsMap.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.toolsMap.get(name);
  }

  public getTools(): ToolDefinition[] {
    return Array.from(this.toolsMap.values());
  }

  public async executeTool(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new BangumiError('NOT_FOUND', `Tool "${name}" is not registered in ToolRegistry.`, false, 404);
    }

    // 1. Zod Parse
    const parseResult = tool.input.safeParse(input);
    if (!parseResult.success) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `Input parameters validation failed for tool "${name}": ${parseResult.error.message}`,
        false,
        400,
        JSON.stringify(parseResult.error.format())
      );
    }

    // 2. Policy Evaluation
    const policy = PolicyManager.resolvePolicyForTool(tool, parseResult.data, context);

    // 3. Confirmation Evaluation & Execution Gate
    let confirmationId: string | undefined;
    let pendingActionId: string | undefined;

    try {
      const claimResult = await PolicyManager.assertAndClaimWritePolicy({
        storage: this.deps.storage,
        context,
        actionType: policy.actionType || name,
        summary: policy.summary || `${name} execution`,
        policy,
        payload: parseResult.data,
      });

      confirmationId = claimResult.confirmationId;
      pendingActionId = claimResult.pendingActionId;

      // 4. API Execution
      const result = await tool.execute(parseResult.data, context, this.deps);

      // 5. Success handling
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
    } catch (err: unknown) {
      const isNetworkUnknown = err instanceof BangumiError && err.code === 'WRITE_RESULT_UNKNOWN';

      if (pendingActionId) {
        if (isNetworkUnknown) {
          await this.deps.storage.markPendingActionUnknown(pendingActionId, err instanceof Error ? err.message : String(err));
        } else {
          await this.deps.storage.markPendingActionFailed(pendingActionId, err instanceof Error ? err.message : String(err), 'EXECUTION_FAILED');
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
  }
}
