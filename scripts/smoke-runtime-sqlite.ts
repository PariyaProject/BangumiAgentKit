import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { ChildProcess, spawn } from 'node:child_process';

const repoRoot = process.cwd();
const apiEntry = path.join(repoRoot, 'apps/api/dist/main.js');
const mcpEntry = path.join(repoRoot, 'apps/mcp/dist/main.js');

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate a local TCP port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function buildRuntimeEnv(dataDir: string, homeDir: string, port: number): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries({ ...process.env }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.DATABASE_URL;
  delete env.BANGUMI_SQLITE_PATH;
  env.HOME = homeDir;
  env.BANGUMI_DATA_DIR = dataDir;
  env.BANGUMI_DB_DRIVER = 'sqlite';
  env.NODE_ENV = 'production';
  env.PORT = String(port);
  env.HOST = '127.0.0.1';
  env.BANGUMI_OAUTH_CLIENT_ID = 'runtime-smoke-client';
  env.BANGUMI_OAUTH_CLIENT_SECRET = 'runtime-smoke-secret';
  env.BANGUMI_OAUTH_REDIRECT_URI = `http://127.0.0.1:${port}/oauth/bangumi/callback`;
  env.BANGUMI_TOKEN_ENCRYPTION_KEY = 'runtime-smoke-key-012345678901234567890123456789';
  return env;
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Child process did not exit cleanly')),
      timeoutMs,
    );
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForHealth(child: ChildProcess, url: string, logs: () => string): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API exited before health check succeeded.\n${logs()}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}.\n${logs()}`);
}

async function stopCleanly(child: ChildProcess, logs: () => string): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await waitForExit(child, 5000);
  } catch {
    child.kill('SIGKILL');
    await waitForExit(child, 5000);
    throw new Error(`API did not terminate cleanly.\n${logs()}`);
  }
}

interface JsonRpcResponse {
  id?: number;
  result?: { tools?: unknown[] };
  error?: { code: number; message: string };
}

async function runMcpStdioSmoke(env: Record<string, string>): Promise<void> {
  const child = spawn(process.execPath, [mcpEntry], {
    cwd: repoRoot,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let logs = '';
  let buffer = '';
  const responses = new Map<number, (response: JsonRpcResponse) => void>();

  child.stderr?.on('data', (chunk: Buffer) => (logs += chunk.toString()));
  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const response = JSON.parse(line) as JsonRpcResponse;
      if (response.id !== undefined) responses.get(response.id)?.(response);
    }
  });

  const request = (id: number, method: string, params: Record<string, unknown>) =>
    new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        responses.delete(id);
        reject(new Error(`Timed out waiting for MCP ${method}.\n${logs}`));
      }, 10000);
      responses.set(id, (response) => {
        clearTimeout(timeout);
        responses.delete(id);
        resolve(response);
      });
      child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  try {
    const initialize = await request(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'bangumi-runtime-smoke', version: '0.1.0' },
    });
    if (initialize.error) {
      throw new Error(`MCP initialize failed: ${initialize.error.message}`);
    }
    child.stdin?.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`,
    );

    const listTools = await request(2, 'tools/list', {});
    if (listTools.error) {
      throw new Error(`MCP list_tools failed: ${listTools.error.message}`);
    }
    if (!Array.isArray(listTools.result?.tools) || listTools.result.tools.length === 0) {
      throw new Error('MCP initialize/list_tools returned no tools');
    }
  } finally {
    child.stdin?.end();
    await stopCleanly(child, () => logs);
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(apiEntry) || !fs.existsSync(mcpEntry)) {
    throw new Error(
      'Built runtime entrypoints are missing. Run `pnpm build` before the runtime smoke.',
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-runtime-smoke-'));
  const dataDir = path.join(tmpDir, 'data');
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  const port = await getFreePort();
  const env = buildRuntimeEnv(dataDir, homeDir, port);

  let apiLogs = '';
  const api = spawn(process.execPath, [apiEntry], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout?.on('data', (chunk: Buffer) => (apiLogs += chunk.toString()));
  api.stderr?.on('data', (chunk: Buffer) => (apiLogs += chunk.toString()));

  try {
    await waitForHealth(api, `http://127.0.0.1:${port}/health/live`, () => apiLogs);
    const dbPath = path.join(dataDir, 'bangumi-agent-kit.sqlite');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`API started but SQLite database was not created at ${dbPath}.\n${apiLogs}`);
    }
  } finally {
    await stopCleanly(api, () => apiLogs);
  }

  await runMcpStdioSmoke(env);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(
    'SQLite runtime smoke passed: API health, SQLite creation, MCP initialize/list_tools.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
