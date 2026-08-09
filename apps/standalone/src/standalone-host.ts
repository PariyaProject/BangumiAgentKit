import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BANGUMI_OAUTH_CALLBACK_PATH, loadRuntimeEnv } from '@bangumi-agent-kit/config';
import {
  ArtifactRef,
  ArtifactStore,
  LocalArtifactStore,
  RenderService,
  resolveArtifactDir,
} from '@bangumi-agent-kit/renderer';
import {
  createRuntimeDependenciesWithStorage,
  RuntimeDependencies,
  ToolContext,
  ToolRegistry,
} from '@bangumi-agent-kit/tools';
import { resolveSqlitePath, SQLiteStorage, Storage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { StandaloneCliError } from './errors.js';
import { createStandaloneIdentity, findStandalonePrincipal } from './identity.js';
import {
  reserveTcpPort,
  StandaloneOAuthController,
  StandaloneOAuthStatus,
} from './oauth-controller.js';

export interface ConfirmationDetails {
  confirmationId: string;
  summary: string;
  message: string;
}

export interface StandaloneHostOptions {
  profile?: string;
  dataDir?: string;
  dbPath?: string;
  oauthHost?: string;
  oauthPort?: number;
  publicHttpClient?: HttpClient;
  storage?: Storage;
  dependencies?: RuntimeDependencies;
  registry?: ToolRegistry;
  artifactStore?: ArtifactStore;
  renderService?: RenderService;
  warn?: (message: string) => void;
  startOAuthServer?: boolean;
}

export interface StandaloneStatus {
  version: string;
  storage: {
    driver: 'sqlite';
    databasePath: string;
    migration: 'ready';
  };
  profile: string;
  principal?: string;
  oauth: {
    bound: boolean;
    accountCount: number;
    account?: {
      username: string;
      nickname: string;
    };
  };
  renderer: 'ready' | 'unavailable';
  oauthCallback:
    StandaloneOAuthStatus | { ready: false; host: string; port: number; callbackUrl: string };
  providers: Array<{
    id: string;
    sourceClass: string;
    state: string;
    capabilities: string[];
  }>;
}

const DEFAULT_VERSION = '0.1.0';

function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new StandaloneCliError('USAGE_ERROR: OAuth port must be an integer from 0 to 65535.', 2);
  }
  return parsed;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

function expandDestination(destination: string): string {
  if (destination === '~') return os.homedir();
  if (destination.startsWith('~/')) return path.join(os.homedir(), destination.slice(2));
  return path.resolve(destination);
}

async function detectRenderer(): Promise<'ready' | 'unavailable'> {
  try {
    const playwright = await import('playwright');
    return fs.existsSync(playwright.chromium.executablePath()) ? 'ready' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export class StandaloneHost {
  private readonly profile: string;
  private readonly dataDir: string;
  private readonly databasePath: string;
  private readonly identity;
  private readonly principalId: string;
  private readonly storage: Storage;
  private readonly dependencies: RuntimeDependencies;
  private readonly registry: ToolRegistry;
  private readonly artifactStore: ArtifactStore;
  private readonly artifactDir: string;
  private readonly oauthController: StandaloneOAuthController;
  private readonly ownsStorage: boolean;
  private readonly ownsRegistry: boolean;

  private constructor(options: {
    profile: string;
    dataDir: string;
    databasePath: string;
    identity: ReturnType<typeof createStandaloneIdentity>;
    principalId: string;
    storage: Storage;
    dependencies: RuntimeDependencies;
    registry: ToolRegistry;
    artifactStore: ArtifactStore;
    artifactDir: string;
    oauthController: StandaloneOAuthController;
    ownsStorage: boolean;
    ownsRegistry: boolean;
  }) {
    this.profile = options.profile;
    this.dataDir = options.dataDir;
    this.databasePath = options.databasePath;
    this.identity = options.identity;
    this.principalId = options.principalId;
    this.storage = options.storage;
    this.dependencies = options.dependencies;
    this.registry = options.registry;
    this.artifactStore = options.artifactStore;
    this.artifactDir = options.artifactDir;
    this.oauthController = options.oauthController;
    this.ownsStorage = options.ownsStorage;
    this.ownsRegistry = options.ownsRegistry;
  }

  static async create(options: StandaloneHostOptions = {}): Promise<StandaloneHost> {
    loadRuntimeEnv();
    const profile = createStandaloneIdentity(
      options.profile || process.env.BANGUMI_PROFILE || 'default',
    );
    const dataDir =
      options.dataDir ||
      process.env.BANGUMI_DATA_DIR ||
      path.join(os.homedir(), '.bangumi-agent-kit');
    const databasePath = resolveSqlitePath(options.dbPath, dataDir);
    const storage =
      options.storage ||
      (await SQLiteStorage.create({
        dbPath: options.dbPath,
        dataDir: options.dbPath ? undefined : dataDir,
      }));
    const ownsStorage = !options.storage;

    const artifactDir = resolveArtifactDir();
    const artifactStore = options.artifactStore || new LocalArtifactStore({ artifactDir });
    const renderService = options.renderService || new RenderService();
    const ownsRegistry = !options.registry;

    const oauthHost = options.oauthHost || process.env.BANGUMI_STANDALONE_OAUTH_HOST || '127.0.0.1';
    let oauthPort = options.oauthPort ?? parsePort(process.env.BANGUMI_STANDALONE_OAUTH_PORT, 3000);
    if (oauthPort === 0) oauthPort = await reserveTcpPort(oauthHost);
    const redirectUri = `http://${oauthHost.includes(':') ? `[${oauthHost}]` : oauthHost}:${oauthPort}${BANGUMI_OAUTH_CALLBACK_PATH}`;

    const dependencies =
      options.dependencies ||
      createRuntimeDependenciesWithStorage(storage, {
        redirectUri,
        publicHttpClient: options.publicHttpClient,
        renderService,
        artifactStore,
      });
    const dependenciesWithRenderer = {
      ...dependencies,
      renderService: dependencies.renderService || renderService,
      artifactStore: dependencies.artifactStore || artifactStore,
    };
    const registry = options.registry || new ToolRegistry(dependenciesWithRenderer);
    const principal = await findStandalonePrincipal(storage, profile.externalUserId);
    const startOAuthServer = options.startOAuthServer !== false;
    const oauthController = new StandaloneOAuthController({
      dependencies: dependenciesWithRenderer,
      host: oauthHost,
      port: oauthPort,
      callbackPath: BANGUMI_OAUTH_CALLBACK_PATH,
      warn: options.warn,
    });
    const host = new StandaloneHost({
      profile: profile.externalUserId,
      dataDir,
      databasePath,
      identity: principal.identity,
      principalId: principal.principalId,
      storage,
      dependencies: dependenciesWithRenderer,
      registry,
      artifactStore,
      artifactDir,
      oauthController,
      ownsStorage,
      ownsRegistry,
    });
    if (startOAuthServer) await oauthController.start();
    return host;
  }

  getProfile(): string {
    return this.profile;
  }

  getPrincipalId(): string {
    return this.principalId;
  }

  getIdentity() {
    return this.identity;
  }

  getRegistry(): ToolRegistry {
    return this.registry;
  }

  getStorage(): Storage {
    return this.storage;
  }

  getDependencies(): RuntimeDependencies {
    return this.dependencies;
  }

  getOAuthStatus(): StandaloneOAuthStatus {
    return this.oauthController.status();
  }

  async startOAuth(): Promise<StandaloneOAuthStatus> {
    return this.oauthController.start();
  }

  async checkOAuthHealth(): Promise<{ statusCode: number; body: string }> {
    return this.oauthController.injectHealth();
  }

  async waitForAuthorization(timeoutMs = 120_000): Promise<StandaloneStatus['oauth']> {
    const before = await this.dependencies.tokenBroker.listAccounts(this.principalId);
    const beforeSnapshot = JSON.stringify(before);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const accounts = await this.dependencies.tokenBroker.listAccounts(this.principalId);
      if (JSON.stringify(accounts) !== beforeSnapshot && accounts.length > 0) {
        return this.getAuthSnapshot();
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return this.getAuthSnapshot();
  }

  async getStatus(includePrincipal = false): Promise<StandaloneStatus> {
    const auth = await this.getAuthSnapshot();
    return {
      version: DEFAULT_VERSION,
      storage: {
        driver: 'sqlite',
        databasePath: this.databasePath,
        migration: 'ready',
      },
      profile: this.profile,
      ...(includePrincipal ? { principal: this.principalId } : {}),
      oauth: auth,
      renderer: await detectRenderer(),
      oauthCallback: this.oauthController.status(),
      providers: this.dependencies.providerRegistry?.getStatus() ?? [],
    };
  }

  private async getAuthSnapshot(): Promise<StandaloneStatus['oauth']> {
    const auth = await this.dependencies.tokenBroker.getAuthStatus(this.principalId);
    return {
      bound: auth.bound,
      accountCount: auth.accountCount ?? 0,
      account: auth.account
        ? { username: auth.account.username, nickname: auth.account.nickname }
        : undefined,
    };
  }

  async executeTool(
    name: string,
    input: unknown,
    options: {
      confirmationId?: string;
      interactive?: boolean;
      confirm?: (details: ConfirmationDetails) => Promise<boolean>;
    } = {},
  ): Promise<unknown> {
    const context: ToolContext = {
      principalId: this.principalId,
      botInstanceId: this.identity.botInstanceId,
      conversationId: this.identity.conversationId,
      requestId: `req_${crypto.randomUUID()}`,
      confirmationId: options.confirmationId,
    };
    try {
      return await this.registry.executeTool(name, input, context);
    } catch (err: unknown) {
      const { toConfirmationDetails } = await import('./errors.js');
      const details = toConfirmationDetails(err);
      if (!details || !options.interactive || !options.confirm) throw err;
      const approved = await options.confirm(details);
      if (!approved) return { cancelled: true, confirmationId: details.confirmationId };
      return await this.registry.executeTool(name, input, {
        ...context,
        confirmationId: details.confirmationId,
        requestId: `req_${crypto.randomUUID()}`,
      });
    }
  }

  async exportArtifact(
    ref: unknown,
    destination: string,
    force = false,
  ): Promise<{ path: string; bytes: number }> {
    if (!ref || typeof ref !== 'object') {
      throw new StandaloneCliError(
        'VALIDATION_ERROR: render result did not contain an ArtifactRef.',
        2,
      );
    }
    const artifact = ref as Partial<ArtifactRef>;
    if (
      typeof artifact.id !== 'string' ||
      !/^art_[A-Za-z0-9_-]+$/u.test(artifact.id) ||
      artifact.mimeType !== 'image/png'
    ) {
      throw new StandaloneCliError('VALIDATION_ERROR: invalid ArtifactRef.', 2);
    }
    const metadata = await this.artifactStore.getArtifact(artifact.id);
    if (!metadata || metadata.id !== artifact.id || metadata.mimeType !== 'image/png') {
      throw new StandaloneCliError('NOT_FOUND: artifact is missing or expired.', 1);
    }
    const trustedSource = path.resolve(this.artifactDir, `${artifact.id}.png`);
    const source = path.resolve((await this.artifactStore.resolveFilePath(artifact.id)) || '');
    if (source !== trustedSource || !fs.existsSync(trustedSource)) {
      throw new StandaloneCliError('INTERNAL_ERROR: artifact source failed validation.', 1);
    }
    const bytes = fs.readFileSync(trustedSource);
    if (!isPng(bytes)) throw new StandaloneCliError('INTERNAL_ERROR: artifact is not a PNG.', 1);

    const target = expandDestination(destination);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    if (fs.existsSync(target) && !force) {
      throw new StandaloneCliError(
        `VALIDATION_ERROR: destination already exists; pass --force to replace it: ${target}`,
        2,
      );
    }
    fs.copyFileSync(trustedSource, target);
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // Best effort on platforms without chmod semantics.
    }
    return { path: target, bytes: bytes.length };
  }

  async close(): Promise<void> {
    await this.oauthController.close();
    if (this.ownsRegistry) await this.registry.close();
    if (this.ownsStorage) await this.storage.close();
  }
}
