import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';
import { SQLiteStorage } from '../../packages/db/src/index.js';

const Database = require('better-sqlite3');

interface WorkerResult {
  ok: boolean;
  value?: Record<string, unknown>;
  error?: string;
}

interface WorkerHandle {
  child: ChildProcess;
  ready: Promise<void>;
  result: Promise<WorkerResult>;
  output: () => string;
}

const repoRoot = path.resolve(process.cwd());
const workerPath = path.join(repoRoot, 'tests/helpers/sqlite-cross-process-worker.ts');
const tsNodeCli = path.join(repoRoot, 'node_modules/ts-node/dist/bin.js');

function spawnWorker(
  mode: string,
  dbPath: string,
  barrierPath: string,
  payload: Record<string, unknown>,
): WorkerHandle {
  const child = spawn(
    process.execPath,
    [
      tsNodeCli,
      '--transpile-only',
      '--project',
      path.join(repoRoot, 'tsconfig.base.json'),
      workerPath,
      mode,
      dbPath,
      barrierPath,
      JSON.stringify(payload),
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  let buffer = '';
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let resultResolve!: (result: WorkerResult) => void;
  let resultReject!: (error: Error) => void;

  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const result = new Promise<WorkerResult>((resolve, reject) => {
    resultResolve = resolve;
    resultReject = reject;
  });

  const consume = (chunk: Buffer) => {
    output += chunk.toString();
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as {
          type: string;
          ok?: boolean;
          value?: Record<string, unknown>;
          error?: string;
        };
        if (event.type === 'ready') readyResolve();
        if (event.type === 'result') {
          resultResolve({ ok: Boolean(event.ok), value: event.value, error: event.error });
        }
      } catch (error) {
        readyReject(new Error(`Invalid worker output: ${line}: ${String(error)}`));
      }
    }
  };

  child.stdout?.on('data', consume);
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.on('error', (error) => {
    readyReject(error);
    resultReject(error);
  });
  child.on('exit', (code, signal) => {
    if (code !== 0) {
      const error = new Error(`Worker exited with code=${code} signal=${signal}: ${output}`);
      readyReject(error);
      resultReject(error);
    }
  });

  return { child, ready, result, output: () => output };
}

async function runWorkers(
  mode: string,
  dbPath: string,
  payloads: Array<Record<string, unknown>>,
): Promise<WorkerResult[]> {
  const barrierPath = `${dbPath}.${mode}.barrier`;
  const workers = payloads.map((payload) => spawnWorker(mode, dbPath, barrierPath, payload));

  try {
    await Promise.all(workers.map((worker) => worker.ready));
    fs.writeFileSync(barrierPath, 'go');
    const results = await Promise.all(workers.map((worker) => worker.result));
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
              resolve();
              return;
            }
            worker.child.once('exit', () => resolve());
          }),
      ),
    );
    return results;
  } finally {
    for (const worker of workers) {
      if (worker.child.exitCode === null) worker.child.kill('SIGTERM');
    }
    try {
      fs.unlinkSync(barrierPath);
    } catch {
      // Best-effort test cleanup.
    }
  }
}

async function createPrincipalFixture(dbPath: string) {
  const storage = await SQLiteStorage.create({ dbPath });
  const principal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'bot-cross-process',
    externalUserId: 'user-cross-process',
  });
  await storage.close();
  return principal;
}

describe('SQLite independent-process concurrency', () => {
  it('returns one canonical principal for two independent processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-principal-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    await SQLiteStorage.create({ dbPath }).then((storage) => storage.close());

    const results = await runWorkers('principal', dbPath, [
      { provider: 'qq', botInstanceId: 'bot-1', externalUserId: 'user-1' },
      { provider: 'qq', botInstanceId: 'bot-1', externalUserId: 'user-1' },
    ]);

    expect(
      results.every((result) => result.ok),
      JSON.stringify(results),
    ).toBe(true);
    expect(results[0]!.value?.id).toBe(results[1]!.value?.id);

    const db = new Database(dbPath);
    const row = db
      .prepare(
        'SELECT COUNT(*) AS count FROM external_principals WHERE provider = ? AND bot_instance_id = ? AND external_user_id = ?',
      )
      .get('qq', 'bot-1', 'user-1') as { count: number };
    expect(row.count).toBe(1);
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);

  it('preserves the one-active-binding invariant across independent processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-binding-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    const storage = await SQLiteStorage.create({ dbPath });
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'bot-binding',
      externalUserId: 'user-binding',
    });
    await storage.upsertBangumiAccount({
      id: 'account-a',
      bangumiUserId: 101,
      username: 'a',
      nickname: 'A',
    });
    await storage.upsertBangumiAccount({
      id: 'account-b',
      bangumiUserId: 102,
      username: 'b',
      nickname: 'B',
    });
    await storage.bindAccount(principal.id, 'account-a', false);
    await storage.bindAccount(principal.id, 'account-b', false);
    await storage.close();

    const results = await runWorkers('binding', dbPath, [
      { principalId: principal.id, bangumiAccountId: 'account-a' },
      { principalId: principal.id, bangumiAccountId: 'account-b' },
    ]);
    expect(results.some((result) => result.ok)).toBe(true);

    const db = new Database(dbPath);
    const row = db
      .prepare(
        'SELECT COUNT(*) AS count FROM account_bindings WHERE principal_id = ? AND is_active = 1',
      )
      .get(principal.id) as { count: number };
    expect(row.count).toBe(1);
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);

  it('consumes one OAuth session across independent processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-oauth-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    const principal = await createPrincipalFixture(dbPath);
    const storage = await SQLiteStorage.create({ dbPath });
    await storage.createOAuthSession({
      id: 'session-cross-process',
      stateHash: 'state-cross-process',
      principalId: principal.id,
      requestedCapabilities: ['read'],
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
    });
    await storage.close();

    const results = await runWorkers('oauth', dbPath, [
      { stateHash: 'state-cross-process' },
      { stateHash: 'state-cross-process' },
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);

  it('claims one pending action across independent processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-pending-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    const principal = await createPrincipalFixture(dbPath);
    const storage = await SQLiteStorage.create({ dbPath });
    const now = new Date();
    await storage.createPendingAction({
      id: 'pending-cross-process',
      principalId: principal.id,
      botInstanceId: 'bot-pending',
      conversationKey: 'conversation-pending',
      actionType: 'test',
      summary: 'test',
      normalizedPayloadJson: '{}',
      payloadHash: 'hash-cross-process',
      status: 'pending',
      expiresAt: new Date(now.getTime() + 60000),
      createdAt: now,
      updatedAt: now,
    });
    await storage.close();

    const payload = {
      confirmationId: 'pending-cross-process',
      principalId: principal.id,
      botInstanceId: 'bot-pending',
      conversationId: 'conversation-pending',
      payloadHash: 'hash-cross-process',
    };
    const results = await runWorkers('pending', dbPath, [payload, payload]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);

  it('serializes migrations when two processes initialize an empty database', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-migration-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const results = await runWorkers('migration', dbPath, [{}, {}]);
    expect(
      results.every((result) => result.ok),
      JSON.stringify(results),
    ).toBe(true);

    const db = new Database(dbPath);
    const migrations = db.prepare('SELECT id FROM _schema_migrations ORDER BY id').all() as Array<{
      id: string;
    }>;
    expect(migrations.map((row) => row.id)).toEqual([
      '0000_initial.sql',
      '0001_integrity_constraints.sql',
      '0002_subject_stats_observations.sql',
      '0003_subject_stats_observation_meta.sql',
    ]);
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);

  it('serializes subject observation admission across independent processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-stats-lock-process-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    await SQLiteStorage.create({ dbPath }).then((storage) => storage.close());

    const results = await runWorkers('stats-lock', dbPath, [
      { subjectId: 123, holdMs: 120 },
      { subjectId: 123, holdMs: 120 },
    ]);
    expect(
      results.every((result) => result.ok),
      JSON.stringify(results),
    ).toBe(true);
    const elapsed = results
      .map((result) => Number(result.value?.elapsedMs || 0))
      .sort((a, b) => a - b);
    expect(elapsed[1]).toBeGreaterThanOrEqual(90);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);
});
