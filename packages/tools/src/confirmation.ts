import crypto from 'node:crypto';
import { DatabaseStore, PendingActionRecord } from '@bangumi-agent-kit/db';
import { ToolContext } from './define-tool.js';

export function computePayloadHash(payload: unknown): string {
  const jsonStr = JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

export function createPendingAction(
  db: DatabaseStore,
  context: ToolContext,
  actionType: string,
  summary: string,
  payload: unknown,
  ttlMinutes = 10
): { confirmationId: string; summary: string; expiresAt: Date; pendingAction: PendingActionRecord } {
  const confirmationId = `cfm_${crypto.randomBytes(8).toString('hex')}`;
  const payloadHash = computePayloadHash(payload);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const pendingAction: PendingActionRecord = {
    id: confirmationId,
    principalId: context.principalId,
    conversationKey: context.conversationId,
    actionType,
    normalizedPayloadJson: JSON.stringify(payload),
    payloadHash,
    expiresAt,
    confirmedAt: null,
    executedAt: null,
  };

  db.pendingActions.set(confirmationId, pendingAction);

  return {
    confirmationId,
    summary,
    expiresAt,
    pendingAction,
  };
}

export function verifyAndConsumePendingAction(
  db: DatabaseStore,
  context: ToolContext,
  confirmationId: string,
  payload: unknown
): PendingActionRecord {
  const action = db.pendingActions.get(confirmationId);

  if (!action) {
    throw new Error(`Invalid confirmationId: ${confirmationId}`);
  }

  if (action.principalId !== context.principalId) {
    throw new Error('Confirmation ID does not belong to current user');
  }

  if (action.executedAt) {
    throw new Error('Confirmation ID has already been executed');
  }

  if (new Date() > action.expiresAt) {
    throw new Error('Confirmation ID has expired');
  }

  const currentPayloadHash = computePayloadHash(payload);
  if (action.payloadHash !== currentPayloadHash) {
    throw new Error('Action payload has changed since confirmation was issued');
  }

  action.executedAt = new Date();
  return action;
}
