import net from 'node:net';
import { createApiApp } from '@bangumi-agent-kit/app-api/app';
import type { RuntimeDependencies } from '@bangumi-agent-kit/tools';

type ApiApp = Awaited<ReturnType<typeof createApiApp>>;

export interface StandaloneOAuthStatus {
  ready: boolean;
  host: string;
  port: number;
  callbackUrl: string;
}

export interface StandaloneOAuthControllerOptions {
  dependencies: RuntimeDependencies;
  host: string;
  port: number;
  callbackPath: string;
  warn?: (message: string) => void;
}

export async function reserveTcpPort(host: string): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host, port: 0 }, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : undefined;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  if (!port) throw new Error('RUNTIME_ERROR: failed to reserve a local OAuth port');
  return port;
}

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export class StandaloneOAuthController {
  private apiApp: ApiApp | undefined;
  private actualPort: number;

  constructor(private readonly options: StandaloneOAuthControllerOptions) {
    this.actualPort = options.port;
  }

  async start(): Promise<StandaloneOAuthStatus> {
    if (this.apiApp) return this.status();
    if (!isLoopbackHost(this.options.host)) {
      this.options.warn?.(
        `Standalone OAuth is binding to non-loopback host ${this.options.host}; use a loopback host unless remote access is intentional.`,
      );
    }

    const api = await createApiApp({ dependencies: this.options.dependencies });
    try {
      const address = await api.app.listen({ host: this.options.host, port: this.options.port });
      const portFromAddress = api.app.server.address();
      if (typeof portFromAddress === 'object' && portFromAddress) {
        this.actualPort = portFromAddress.port;
      } else {
        const parsed = Number(new URL(address).port);
        if (Number.isInteger(parsed) && parsed > 0) this.actualPort = parsed;
      }
      this.apiApp = api;
      return this.status();
    } catch (err) {
      await api.app.close().catch(() => undefined);
      const code = (err as { code?: string }).code;
      if (code === 'EADDRINUSE') {
        throw new Error(
          `RUNTIME_ERROR: Standalone OAuth port ${this.options.port} is already in use. Set BANGUMI_STANDALONE_OAUTH_PORT to another local port.`,
        );
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    if (!this.apiApp) return;
    await this.apiApp.app.close();
    this.apiApp = undefined;
  }

  isReady(): boolean {
    return Boolean(this.apiApp);
  }

  async injectHealth(): Promise<{ statusCode: number; body: string }> {
    if (!this.apiApp) throw new Error('RUNTIME_ERROR: OAuth listener is not running');
    const response = await this.apiApp.app.inject({ method: 'GET', url: '/health/ready' });
    return { statusCode: response.statusCode, body: response.body };
  }

  status(): StandaloneOAuthStatus {
    return {
      ready: this.isReady(),
      host: this.options.host,
      port: this.actualPort,
      callbackUrl: `http://${formatHost(this.options.host)}:${this.actualPort}${this.options.callbackPath}`,
    };
  }
}
