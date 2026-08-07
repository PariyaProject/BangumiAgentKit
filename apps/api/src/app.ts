import { Storage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies, RuntimeDependencies, CreateRuntimeDependenciesConfig } from '@bangumi-agent-kit/tools';
import { handleOAuthCallbackRoute } from './routes/oauth.js';

export interface ApiAppOptions extends Partial<CreateRuntimeDependenciesConfig> {
  dependencies?: RuntimeDependencies;
  storage?: Storage;
}

export function createApiApp(options: ApiAppOptions) {
  const deps = options.dependencies || createRuntimeDependencies({
    storage: options.storage,
    databaseUrl: options.databaseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    secretKey: options.secretKey,
    keyVersion: options.keyVersion,
    tokenUrl: options.tokenUrl,
    authorizeUrl: options.authorizeUrl,
    publicHttpClient: options.publicHttpClient,
  });

  const oauthCallback = handleOAuthCallbackRoute(deps.oauthService);

  const handleHealthLive = async () => ({ status: 'live', uptime: process.uptime() });
  const handleHealthReady = async () => ({ status: 'ready' });

  return {
    deps,
    storage: deps.storage,
    httpClient: deps.publicHttpClient,
    oauthService: deps.oauthService,
    tokenBroker: deps.tokenBroker,
    clientProvider: deps.clientProvider,
    auditService: deps.auditService,
    oauthCallback,
    handleHealthLive,
    handleHealthReady,
  };
}
