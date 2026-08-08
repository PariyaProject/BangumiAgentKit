import crypto from 'node:crypto';
import { Storage, PendingActionRecord } from '@bangumi-agent-kit/db';
import { ToolContext } from './define-tool.js';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

export function toCanonicalJson(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(toCanonicalJson);
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      result[key] = toCanonicalJson(obj[key]);
    }
  }
  return result;
}

export function computeCanonicalPayloadHash(payload: unknown): string {
  const canonical = toCanonicalJson(payload ?? {});
  const jsonStr = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

export async function createPendingAction(
  storage: Storage,
  context: ToolContext,
  actionType: string,
  summary: string,
  payload: unknown,
  ttlMinutes = 10,
): Promise<{
  confirmationId: string;
  summary: string;
  expiresAt: Date;
  pendingAction: PendingActionRecord;
}> {
  const confirmationId = `cfm_${crypto.randomBytes(8).toString('hex')}`;
  const payloadHash = computeCanonicalPayloadHash(payload);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const pendingAction: PendingActionRecord = {
    id: confirmationId,
    principalId: context.principalId,
    botInstanceId: context.botInstanceId,
    conversationKey: context.conversationId,
    actionType,
    summary,
    normalizedPayloadJson: JSON.stringify(toCanonicalJson(payload)),
    payloadHash,
    status: 'pending',
    expiresAt,
    confirmedAt: null,
    executionStartedAt: null,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await storage.createPendingAction(pendingAction);

  return {
    confirmationId,
    summary,
    expiresAt,
    pendingAction,
  };
}

export async function claimPendingAction(
  storage: Storage,
  context: ToolContext,
  confirmationId: string,
  payload: unknown,
): Promise<PendingActionRecord> {
  const payloadHash = computeCanonicalPayloadHash(payload);
  try {
    return await storage.claimPendingAction({
      confirmationId,
      principalId: context.principalId,
      botInstanceId: context.botInstanceId,
      conversationId: context.conversationId,
      payloadHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CONFIRMATION_EXPIRED')) {
      throw new BangumiError(
        'CONFIRMATION_EXPIRED',
        '二次确认已超时失效，请重新发起请求',
        false,
        400,
        '重新调用原工具发起操作',
      );
    }
    throw new BangumiError(
      'CONFIRMATION_INVALID',
      `二次确认校验失败: ${msg}`,
      false,
      400,
      '检查 confirmationId 及请求参数',
    );
  }
}
