import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runNode(args: string[], env: NodeJS.ProcessEnv, input?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function main(): Promise<void> {
  const root = process.cwd();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-standalone-smoke-home-'));
  const dataDir = path.join(tempHome, 'data');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: tempHome,
    BANGUMI_DATA_DIR: dataDir,
    BANGUMI_DB_DRIVER: 'sqlite',
    BANGUMI_TOKEN_ENCRYPTION_KEY: 'standalone-smoke-key-012345678901234567890123',
    BANGUMI_STANDALONE_OAUTH_PORT: '0',
  };
  const mainFile = path.join(root, 'apps/standalone/dist/main.js');
  try {
    const repl = await runNode([mainFile], env, 'status\ntool list\nexit\n');
    if (repl.code !== 0 || !repl.stdout.includes('bangumi.search_subjects')) {
      throw new Error(`standalone REPL smoke failed: ${repl.stderr || repl.stdout}`);
    }

    const json = await runNode([mainFile, '--json', 'status'], env);
    if (json.code !== 0)
      throw new Error(`standalone JSON smoke failed: ${json.stderr || json.stdout}`);
    const parsed = JSON.parse(json.stdout) as {
      storage?: { driver?: string };
      oauthCallback?: { host?: string };
    };
    if (parsed.storage?.driver !== 'sqlite' || parsed.oauthCallback?.host !== '127.0.0.1') {
      throw new Error(`standalone JSON smoke returned unexpected status: ${json.stdout}`);
    }
    process.stdout.write('smoke:standalone PASS\n');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
});
