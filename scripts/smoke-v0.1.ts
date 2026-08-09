import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setupLocal } from './lib/setup-local.js';
import { encryptToken, resolveTokenEncryptionConfig } from '../packages/auth/src/index.js';
import { resolveSqlitePath, SQLiteStorage } from '../packages/db/src/index.js';

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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

function runNode(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<ProcessResult> {
  return runProcess(process.execPath, [file, ...args], env, input);
}

async function expectSuccess(label: string, result: ProcessResult): Promise<void> {
  if (result.code !== 0) {
    throw new Error(`${label} failed (exit ${result.code}): ${result.stderr || result.stdout}`);
  }
}

function parseJson<T>(label: string, result: ProcessResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch (err) {
    throw new Error(`${label} did not return JSON: ${result.stdout}\n${String(err)}`);
  }
}

async function seedAccountFixtures(dbPath: string, secretKey: string): Promise<void> {
  const storage = await SQLiteStorage.create({ dbPath });
  const encryption = resolveTokenEncryptionConfig({ secretKey });
  const now = new Date();
  const alpha = await storage.findOrCreatePrincipal({
    provider: 'local',
    botInstanceId: 'standalone',
    externalUserId: 'alpha',
  });
  const beta = await storage.findOrCreatePrincipal({
    provider: 'local',
    botInstanceId: 'standalone',
    externalUserId: 'beta',
  });
  const accounts = [
    { id: 'fixture-alpha-1', userId: 9001, username: 'alpha-one', principalId: alpha.id },
    { id: 'fixture-alpha-2', userId: 9002, username: 'alpha-two', principalId: alpha.id },
    { id: 'fixture-beta-1', userId: 9003, username: 'beta-one', principalId: beta.id },
  ];
  for (const fixture of accounts) {
    const account = await storage.upsertBangumiAccount({
      id: fixture.id,
      bangumiUserId: fixture.userId,
      username: fixture.username,
      nickname: fixture.username,
    });
    await storage.bindAccount(fixture.principalId, account.id, fixture.id.endsWith('-1'));
    await storage.upsertCredential({
      id: `fixture-cred-${fixture.id}`,
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken(
        'fixture-token',
        encryption.keyring,
        encryption.activeKeyVersion,
      ),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: encryption.activeKeyVersion,
      createdAt: now,
      updatedAt: now,
    });
  }
  await storage.close();
}

async function main(): Promise<void> {
  const root = process.cwd();
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-v0.1-smoke-home-'));
  const configDir = path.join(tempHome, 'config');
  const dataDir = path.join(tempHome, 'data');
  const artifactDir = path.join(tempHome, 'artifacts');
  fs.mkdirSync(configDir, { recursive: true });
  const previousEnv = { ...process.env };
  try {
    const setup = await setupLocal({ cwd: configDir, dataDir });
    const dbPath = resolveSqlitePath(undefined, dataDir);
    if (!fs.existsSync(dbPath) || !fs.existsSync(setup.envLocalPath)) {
      throw new Error('v0.1 smoke setup did not create local configuration and SQLite');
    }
    const envFileContent = fs.readFileSync(setup.envLocalPath, 'utf8');
    const generatedKey = envFileContent.match(/^BANGUMI_TOKEN_ENCRYPTION_KEY=(.+)$/m)?.[1];
    if (!generatedKey) throw new Error('v0.1 smoke setup did not create an encryption key');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tempHome,
      BANGUMI_DATA_DIR: dataDir,
      BANGUMI_ARTIFACT_DIR: artifactDir,
      BANGUMI_ENV_FILE: setup.envLocalPath,
      BANGUMI_DB_DRIVER: 'sqlite',
      BANGUMI_TOKEN_ENCRYPTION_KEY: generatedKey,
      BANGUMI_OAUTH_CLIENT_ID: 'v0.1-smoke-client',
      BANGUMI_OAUTH_CLIENT_SECRET: 'v0.1-smoke-secret',
      BANGUMI_STANDALONE_OAUTH_PORT: '0',
    };

    const build = await runProcess('pnpm', ['build'], env);
    await expectSuccess('workspace build', build);

    const selfTest = await runNode(
      path.join(root, 'apps/standalone/dist/self-test-main.js'),
      ['--json'],
      env,
    );
    await expectSuccess('offline self-test', selfTest);
    const selfTestReport = parseJson<{ fail: number; remoteWrites: number }>('self-test', selfTest);
    if (selfTestReport.fail !== 0 || selfTestReport.remoteWrites !== 0) {
      throw new Error(`self-test report is not release-safe: ${selfTest.stdout}`);
    }

    const mainFile = path.join(root, 'apps/standalone/dist/main.js');
    const status = async (profile: string) => {
      const result = await runNode(
        mainFile,
        ['--json', '--verbose', 'status', '--profile', profile],
        env,
      );
      await expectSuccess(`status ${profile}`, result);
      return parseJson<{ principal?: string }>(`status ${profile}`, result);
    };
    const alphaFirst = await status('alpha');
    const alphaRestart = await status('alpha');
    const beta = await status('beta');
    if (
      !alphaFirst.principal ||
      alphaFirst.principal !== alphaRestart.principal ||
      alphaFirst.principal === beta.principal
    ) {
      throw new Error('profile principal persistence/isolation proof failed');
    }

    await seedAccountFixtures(dbPath, generatedKey);
    const alphaAccounts = await runNode(
      mainFile,
      ['--json', 'auth', 'accounts', '--profile', 'alpha'],
      env,
    );
    const betaAccounts = await runNode(
      mainFile,
      ['--json', 'auth', 'accounts', '--profile', 'beta'],
      env,
    );
    await expectSuccess('alpha account list', alphaAccounts);
    await expectSuccess('beta account list', betaAccounts);
    const alphaList = parseJson<Array<{ username: string }>>('alpha account list', alphaAccounts);
    const betaList = parseJson<Array<{ username: string }>>('beta account list', betaAccounts);
    if (alphaList.length !== 2 || betaList.length !== 1 || betaList[0]?.username !== 'beta-one') {
      throw new Error('multi-account fixture isolation proof failed');
    }

    const pending = await runNode(
      mainFile,
      ['--json', 'auth', 'remove', '1', '--profile', 'alpha'],
      env,
    );
    if (pending.code !== 4)
      throw new Error(`confirmation gate returned exit ${pending.code}: ${pending.stdout}`);
    const pendingResult = parseJson<{
      ok: false;
      error: { code: string; confirmationId?: string };
    }>('confirmation response', pending);
    if (
      pendingResult.error.code !== 'CONFIRMATION_REQUIRED' ||
      !pendingResult.error.confirmationId
    ) {
      throw new Error(`confirmation response was not safe: ${pending.stdout}`);
    }
    const continued = await runNode(
      mainFile,
      [
        '--json',
        'auth',
        'remove',
        '1',
        '--profile',
        'alpha',
        '--confirm',
        pendingResult.error.confirmationId,
      ],
      env,
    );
    await expectSuccess('exact confirmation continuation', continued);

    const renderTest = await runNode(
      path.join(root, 'apps/standalone/dist/self-test-main.js'),
      ['--json', '--render'],
      env,
    );
    await expectSuccess('optional renderer self-test', renderTest);
    const renderReport = parseJson<{ checks: Array<{ id: string; status: string }> }>(
      'renderer self-test',
      renderTest,
    );
    const rendererCheck = renderReport.checks.find((item) => item.id === 'renderer');
    if (!rendererCheck || !['PASS', 'SKIP'].includes(rendererCheck.status)) {
      throw new Error(`renderer optional gate failed: ${renderTest.stdout}`);
    }

    const mcpSmoke = await runProcess('pnpm', ['smoke:runtime:sqlite'], env);
    await expectSuccess('built MCP/runtime smoke', mcpSmoke);
    const hostSmoke = await runProcess('pnpm', ['smoke:host'], env);
    await expectSuccess('fake-Claude host smoke', hostSmoke);

    console.log('smoke:v0.1 PASS');
  } finally {
    process.env = previousEnv;
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
