import { ToolDefinition, ToolContext, AuthenticatedExecutionSession } from './define-tool.js';
import {
  HttpClient,
  BangumiError,
  toPublicError,
  isBangumiError,
} from '@bangumi-agent-kit/bangumi-transport';
import { Storage, createStorageFromConfig, StorageDriver } from '@bangumi-agent-kit/db';
import { AuditService } from '@bangumi-agent-kit/bangumi-core';
import {
  TokenBroker,
  OAuthService,
  BangumiClientProvider,
  DefaultBangumiClientProvider,
  TokenEncryptionConfig,
  resolveTokenEncryptionConfig,
} from '@bangumi-agent-kit/auth';
import { PolicyManager } from './policy.js';
import { createReadTools } from './definitions/read-tools.js';
import { createRawOperationTools } from './definitions/raw-operation-tools.js';
import { createWriteTools } from './definitions/write-tools.js';
import { createAuthTools } from './definitions/auth-tools.js';
import { createRenderPresentationTools } from './definitions/render-presentation-tools.js';
import type { ArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';
import {
  OfficialLegacyCalendarProvider,
  OfficialV0Provider,
  ProviderRegistry,
} from '@bangumi-agent-kit/provider-core';
import { CalendarClient, GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';

export type ToolMode = 'curated' | 'full';

export interface RuntimeDependencies {
  storage: Storage;
  publicHttpClient: HttpClient;
  oauthService: OAuthService;
  tokenBroker: TokenBroker;
  clientProvider: BangumiClientProvider;
  auditService: AuditService;
  renderService?: RenderService;
  artifactStore?: ArtifactStore;
  providerRegistry?: ProviderRegistry;
}

export interface CreateRuntimeDependenciesConfig {
  storage?: Storage;
  databaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  secretKey?: string;
  keyVersion?: string;
  tokenEncryptionKeysJson?: string;
  tokenActiveKeyVersion?: string;
  tokenEncryption?: TokenEncryptionConfig;
  tokenUrl?: string;
  authorizeUrl?: string;
  publicHttpClient?: HttpClient;
  refreshSkewSeconds?: number;
  renderService?: RenderService;
  artifactStore?: ArtifactStore;
}

export function createRuntimeDependenciesWithStorage(
  storage: Storage,
  config: CreateRuntimeDependenciesConfig = {},
): RuntimeDependencies {
  const isProd = process.env.NODE_ENV === 'production';
  const tokenEncryption = resolveTokenEncryptionConfig({
    tokenEncryption: config.tokenEncryption,
    secretKey: config.secretKey,
    keyVersion: config.keyVersion,
    tokenEncryptionKeysJson: config.tokenEncryptionKeysJson,
    tokenActiveKeyVersion: config.tokenActiveKeyVersion,
  });

  const clientId = config.clientId || process.env.BANGUMI_OAUTH_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.BANGUMI_OAUTH_CLIENT_SECRET;
  const redirectUri = config.redirectUri || process.env.BANGUMI_OAUTH_REDIRECT_URI;

  if (isProd) {
    if (!clientId)
      throw new Error(
        'CONFIG_ERROR: BANGUMI_OAUTH_CLIENT_ID is required in production environment.',
      );
    if (!clientSecret)
      throw new Error(
        'CONFIG_ERROR: BANGUMI_OAUTH_CLIENT_SECRET is required in production environment.',
      );
    if (!redirectUri)
      throw new Error(
        'CONFIG_ERROR: BANGUMI_OAUTH_REDIRECT_URI is required in production environment.',
      );
  }

  const publicHttpClient = config.publicHttpClient || new HttpClient();
  const providerRegistry = new ProviderRegistry({
    v0: new OfficialV0Provider(new GeneratedBangumiOpenApiClient(publicHttpClient)),
    legacyCalendar: new OfficialLegacyCalendarProvider(new CalendarClient(publicHttpClient)),
  });

  const oauthService = new OAuthService(
    storage,
    {
      clientId: clientId || 'test_client_id',
      clientSecret: clientSecret || 'test_client_secret',
      redirectUri: redirectUri || 'http://localhost:3000/oauth/bangumi/callback',
      tokenEncryption,
      tokenUrl: config.tokenUrl,
      authorizeUrl: config.authorizeUrl || process.env.BANGUMI_OAUTH_AUTHORIZE_URL,
    },
    publicHttpClient,
  );

  const tokenBroker = new TokenBroker(
    storage,
    {
      tokenEncryption,
      clientId,
      clientSecret,
      redirectUri,
      tokenUrl: config.tokenUrl || process.env.BANGUMI_OAUTH_TOKEN_URL,
      refreshSkewSeconds: config.refreshSkewSeconds,
    },
    publicHttpClient,
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
    renderService: config.renderService,
    artifactStore: config.artifactStore,
    providerRegistry,
  };
}

export function createRuntimeDependencies(
  config: CreateRuntimeDependenciesConfig & { storage: Storage },
): RuntimeDependencies;
export function createRuntimeDependencies(
  config?: CreateRuntimeDependenciesConfig,
): Promise<RuntimeDependencies>;
export function createRuntimeDependencies(
  config: CreateRuntimeDependenciesConfig = {},
): RuntimeDependencies | Promise<RuntimeDependencies> {
  if (config.storage) {
    return createRuntimeDependenciesWithStorage(config.storage, config);
  }
  return createStorageFromConfig({
    databaseUrl: config.databaseUrl,
    driver: process.env.BANGUMI_DB_DRIVER as StorageDriver | undefined,
  }).then((storage) => createRuntimeDependenciesWithStorage(storage, config));
}

export class ToolRegistry {
  private toolsMap: Map<string, ToolDefinition> = new Map();
  private deps: RuntimeDependencies;

  constructor(
    optionsOrDeps: RuntimeDependencies | (CreateRuntimeDependenciesConfig & { storage: Storage }),
  ) {
    if (optionsOrDeps && 'tokenBroker' in optionsOrDeps) {
      this.deps = optionsOrDeps as RuntimeDependencies;
    } else if (optionsOrDeps && optionsOrDeps.storage) {
      this.deps = createRuntimeDependenciesWithStorage(optionsOrDeps.storage, optionsOrDeps);
    } else {
      throw new Error(
        'ToolRegistry requires explicit RuntimeDependencies or config with pre-created storage. Use ToolRegistry.create() for async initialization.',
      );
    }

    this.registerCoreTools();
  }

  static async create(
    optionsOrDeps?: RuntimeDependencies | CreateRuntimeDependenciesConfig,
  ): Promise<ToolRegistry> {
    if (optionsOrDeps && 'storage' in optionsOrDeps && 'tokenBroker' in optionsOrDeps) {
      return new ToolRegistry(optionsOrDeps as RuntimeDependencies);
    }
    if (optionsOrDeps && optionsOrDeps.storage) {
      return new ToolRegistry(
        optionsOrDeps as CreateRuntimeDependenciesConfig & { storage: Storage },
      );
    }
    const deps = await createRuntimeDependencies(optionsOrDeps);
    return new ToolRegistry(deps);
  }

  private registerCoreTools(): void {
    const readTools = createReadTools(this.deps.clientProvider);
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

    const renderTools = createRenderPresentationTools(
      this.deps.renderService,
      this.deps.artifactStore,
    );
    for (const tool of renderTools) {
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
      throw new BangumiError(
        'NOT_FOUND',
        `Tool "${name}" is not registered in ToolRegistry.`,
        false,
        404,
      );
    }

    // 1. Zod Parse
    const parseResult = tool.input.safeParse(input);
    if (!parseResult.success) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `Input parameters validation failed for tool "${name}": ${parseResult.error.message}`,
        false,
        400,
        JSON.stringify(parseResult.error.format()),
      );
    }

    // 2. Resolve Policy
    const policy = PolicyManager.resolvePolicyForTool(tool, parseResult.data, context);

    // 3. Resolve Authentication & Capabilities BEFORE Confirmation / PendingAction
    let executionSession: AuthenticatedExecutionSession | undefined;
    if (policy.auth === 'required') {
      const authed = await this.deps.clientProvider.requireAuthenticatedClient(
        context.principalId,
        policy.requiredCapabilities,
      );
      executionSession = { account: authed.account, client: authed.client };
    } else if (policy.auth === 'optional') {
      const client = await this.deps.clientProvider.getOptionalAuthenticatedClient(
        context.principalId,
      );
      executionSession = { client };
    } else {
      const client = await this.deps.clientProvider.getPublicClient();
      executionSession = { client };
    }

    // 4. Confirmation Evaluation & Execution Gate
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

      // 5. API Execution
      const result = await tool.execute(parseResult.data, context, {
        ...this.deps,
        executionSession,
      });

      // 6. Success handling
      if (pendingActionId) {
        await this.deps.storage.markPendingActionSucceeded(pendingActionId);
      }

      if (policy.risk !== 'read') {
        await this.deps.auditService.recordWrite({
          principalId: context.principalId,
          bangumiAccountId: executionSession?.account?.id,
          operationId: name,
          riskLevel: policy.risk,
          resourceType: name.split('.')[1] || 'resource',
          resourceId: String(
            (parseResult.data as Record<string, unknown>)?.subjectId ||
              (parseResult.data as Record<string, unknown>)?.characterId ||
              (parseResult.data as Record<string, unknown>)?.personId ||
              (parseResult.data as Record<string, unknown>)?.indexId ||
              '0',
          ),
          changeSummary: parseResult.data,
          confirmationId,
          result: 'success',
          requestId: context.requestId,
        });
      }

      return result;
    } catch (err: unknown) {
      if (!isBangumiError(err)) {
        console.error('[Tool Execution Error]', err);
      }
      const isNetworkUnknown =
        isBangumiError(err) && (err as BangumiError).code === 'WRITE_RESULT_UNKNOWN';
      const publicErr = toPublicError(err);

      if (pendingActionId) {
        if (isNetworkUnknown) {
          await this.deps.storage.markPendingActionUnknown(pendingActionId, publicErr.message);
        } else {
          await this.deps.storage.markPendingActionFailed(
            pendingActionId,
            publicErr.message,
            publicErr.code,
          );
        }
      }

      if (policy.risk !== 'read') {
        await this.deps.auditService.recordWrite({
          principalId: context.principalId,
          bangumiAccountId: executionSession?.account?.id,
          operationId: name,
          riskLevel: policy.risk,
          resourceType: name.split('.')[1] || 'resource',
          resourceId: String(
            (parseResult.data as Record<string, unknown>)?.subjectId ||
              (parseResult.data as Record<string, unknown>)?.characterId ||
              (parseResult.data as Record<string, unknown>)?.personId ||
              (parseResult.data as Record<string, unknown>)?.indexId ||
              '0',
          ),
          changeSummary: parseResult.data,
          confirmationId,
          result: isNetworkUnknown ? 'unknown' : 'failed',
          requestId: context.requestId,
        });
      }

      throw err;
    }
  }

  public async close(): Promise<void> {
    await this.deps.renderService?.close();
  }
}
