import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface ChildResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runBuilt(args: string[], env: NodeJS.ProcessEnv, input?: string): Promise<ChildResult> {
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
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}

describe('PR-6R-C built Standalone integration', () => {
  let tempHome: string;
  let env: NodeJS.ProcessEnv;
  const mainFile = path.resolve('apps/standalone/dist/main.js');
  const selfTestFile = path.resolve('apps/standalone/dist/self-test-main.js');

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-standalone-built-'));
    env = {
      ...process.env,
      HOME: tempHome,
      BANGUMI_DATA_DIR: path.join(tempHome, 'data'),
      BANGUMI_DB_DRIVER: 'sqlite',
      BANGUMI_TOKEN_ENCRYPTION_KEY: 'standalone-built-key-012345678901234567890123',
      BANGUMI_STANDALONE_OAUTH_PORT: '0',
    };
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('ST-32/ST-46: exits cleanly after status, tool list, and exit input', async () => {
    const result = await runBuilt([mainFile], env, 'status\ntool list\nexit\n');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('bangumi.search_subjects');
    expect(result.stderr).not.toContain('secret');
  });

  it('ST-46: --json status is parseable JSON without banners or secrets', async () => {
    const result = await runBuilt([mainFile, '--json', 'status'], env);
    expect(result.code).toBe(0);
    const status = JSON.parse(result.stdout) as {
      storage: { driver: string };
      oauthCallback: { host: string; ready: boolean };
    };
    expect(status.storage.driver).toBe('sqlite');
    expect(status.oauthCallback).toMatchObject({ host: '127.0.0.1', ready: true });
    expect(result.stdout).not.toMatch(/token|secret|password/i);
  });

  it('ST-29/ST-30/ST-31: offline self-test report is valid and records zero remote writes', async () => {
    const result = await runBuilt([selfTestFile, '--json'], env);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as {
      checks: Array<{ id: string; status: string }>;
      fail: number;
      remoteWrites: number;
    };
    expect(report.fail).toBe(0);
    expect(report.remoteWrites).toBe(0);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'sqlite', status: 'PASS' }),
        expect.objectContaining({ id: 'oauth-routes', status: 'PASS' }),
      ]),
    );
    expect(result.stdout).not.toMatch(/accessToken|clientSecret|encryption/i);
  });
});
