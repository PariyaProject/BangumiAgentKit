import { SQLiteStorage } from '../../packages/db/src/index';
import fs from 'node:fs';

const mode = process.argv[2] || '';
const dbPath = process.argv[3] || '';
const barrierPath = process.argv[4] || '';
const payloadJson = process.argv[5] || '{}';
const payload = JSON.parse(payloadJson || '{}') as Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBarrier(): Promise<void> {
  while (true) {
    if (fs.existsSync(barrierPath)) return;
    await sleep(10);
  }
}

async function main(): Promise<void> {
  let storage: SQLiteStorage | undefined;

  if (mode !== 'migration') {
    storage = await SQLiteStorage.create({ dbPath });
  }

  process.stdout.write(`${JSON.stringify({ type: 'ready' })}\n`);
  await waitForBarrier();

  if (mode === 'migration') {
    storage = await SQLiteStorage.create({ dbPath });
  }

  if (!storage) {
    throw new Error(`Unknown worker mode: ${mode}`);
  }

  let value: unknown;
  switch (mode) {
    case 'principal':
      value = await storage.findOrCreatePrincipal({
        provider: String(payload.provider),
        botInstanceId: String(payload.botInstanceId),
        externalUserId: String(payload.externalUserId),
      });
      break;
    case 'binding':
      value = await storage.setActiveBinding(
        String(payload.principalId),
        String(payload.bangumiAccountId),
      );
      break;
    case 'oauth':
      value = await storage.consumeOAuthSession(String(payload.stateHash));
      break;
    case 'pending':
      value = await storage.claimPendingAction({
        confirmationId: String(payload.confirmationId),
        principalId: String(payload.principalId),
        botInstanceId: String(payload.botInstanceId),
        conversationId: String(payload.conversationId),
        payloadHash: String(payload.payloadHash),
      });
      break;
    case 'migration':
      value = { migrated: true };
      break;
    case 'stats-lock': {
      const startedAt = Date.now();
      await storage.withSubjectStatsObservationLock(Number(payload.subjectId), async () => {
        await sleep(Number(payload.holdMs || 0));
      });
      value = { elapsedMs: Date.now() - startedAt };
      break;
    }
    case 'stats-host-lock': {
      const startedAt = Date.now();
      await storage.withSubjectStatsObservationHostLock(async () => {
        await sleep(Number(payload.holdMs || 0));
      });
      value = { elapsedMs: Date.now() - startedAt };
      break;
    }
    default:
      throw new Error(`Unknown worker mode: ${mode}`);
  }

  process.stdout.write(`${JSON.stringify({ type: 'result', ok: true, value })}\n`);
  await storage.close();
}

main().catch(async (error: unknown) => {
  process.stdout.write(
    `${JSON.stringify({ type: 'result', ok: false, error: error instanceof Error ? error.message : String(error) })}\n`,
  );
  process.exitCode = 0;
});
