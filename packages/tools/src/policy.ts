import { DatabaseStore } from '@bangumi-agent-kit/db';
import { OperationRisk } from '@bangumi-agent-kit/bangumi-openapi';
import { ToolContext } from './define-tool.js';
import { createPendingAction, verifyAndConsumePendingAction } from './confirmation.js';

export interface AssertWriteOptions {
  db: DatabaseStore;
  context: ToolContext;
  actionType: string;
  summary: string;
  risk: OperationRisk;
  payload: unknown;
  isBulk?: boolean;
  affectedCount?: number;
}

export class PolicyManager {
  static assertWriteAllowed(options: AssertWriteOptions): { requiresConfirmation: boolean; confirmationId?: string } {
    const { db, context, actionType, summary, risk, payload, isBulk, affectedCount } = options;

    if (!context.accessToken) {
      throw new Error('AUTH_REQUIRED: 该写操作需要先绑定 Bangumi 账号。');
    }

    const requiresConfirmation =
      risk === 'destructive' ||
      Boolean(isBulk) ||
      (affectedCount !== undefined && affectedCount > 20);

    if (requiresConfirmation) {
      if (!context.confirmationId) {
        const pending = createPendingAction(db, context, actionType, summary, payload);
        throw new Error(
          `CONFIRMATION_REQUIRED: 操作具有破坏性或大批量变更 (${summary})。请再次确认。Confirmation ID: ${pending.confirmationId}`
        );
      }

      verifyAndConsumePendingAction(db, context, context.confirmationId, payload);
    }

    return { requiresConfirmation };
  }
}
