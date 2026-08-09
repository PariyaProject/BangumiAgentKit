import Fastify, { FastifyInstance } from 'fastify';
import { Storage } from '@bangumi-agent-kit/db';
import {
  createRuntimeDependencies,
  createRuntimeDependenciesWithStorage,
  RuntimeDependencies,
  CreateRuntimeDependenciesConfig,
} from '@bangumi-agent-kit/tools';
import { handleOAuthCallbackRoute } from './routes/oauth.js';

export interface ApiAppOptions extends Partial<CreateRuntimeDependenciesConfig> {
  dependencies?: RuntimeDependencies;
  storage?: Storage;
}

export interface ApiAppInstance {
  app: FastifyInstance;
  deps: RuntimeDependencies;
  storage: Storage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oauthService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenBroker: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientProvider: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditService: any;
  handleHealthLive: () => Promise<{ status: string; uptime: number }>;
  handleHealthReady: () => Promise<{ status: string }>;
}

export async function createApiApp(options: ApiAppOptions = {}): Promise<ApiAppInstance> {
  const deps =
    options.dependencies ||
    (options.storage
      ? createRuntimeDependenciesWithStorage(options.storage, options)
      : await createRuntimeDependencies(options));

  const app = Fastify({ logger: false });
  const oauthHandler = handleOAuthCallbackRoute(deps.oauthService);

  const handleHealthLive = async () => ({ status: 'live', uptime: process.uptime() });
  const handleHealthReady = async () => ({ status: 'ready' });

  app.get('/health/live', async (_req, reply) => {
    const res = await handleHealthLive();
    return reply.status(200).send(res);
  });

  app.get('/health/ready', async (_req, reply) => {
    const res = await handleHealthReady();
    return reply.status(200).send(res);
  });

  app.get('/oauth/bangumi/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const res = await oauthHandler(code, state);
    return reply.status(res.statusCode).headers(res.headers).send(res.body);
  });

  app.get('/oauth/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const res = await oauthHandler(code, state);
    return reply.status(res.statusCode).headers(res.headers).send(res.body);
  });

  return {
    app,
    deps,
    storage: deps.storage,
    oauthService: deps.oauthService,
    tokenBroker: deps.tokenBroker,
    clientProvider: deps.clientProvider,
    auditService: deps.auditService,
    handleHealthLive,
    handleHealthReady,
  };
}
