import { Storage } from '@bangumi-agent-kit/db';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import { ToolContext, ToolDefinition, ResolvedToolPolicy } from './define-tool.js';
import { createPendingAction, claimPendingAction } from './confirmation.js';

export interface AssertWriteOptions {
  storage: Storage;
  context: ToolContext;
  actionType: string;
  summary: string;
  policy: ResolvedToolPolicy;
  payload: unknown;
}

export class PolicyManager {
  static resolvePolicyForTool(
    tool: ToolDefinition,
    input: unknown,
    context: ToolContext,
  ): ResolvedToolPolicy {
    if (typeof tool.resolvePolicy === 'function') {
      return tool.resolvePolicy(input, context);
    }
    return {
      auth: tool.auth,
      requiredCapabilities: tool.scopes || [],
      risk: tool.risk,
    };
  }

  static async assertAndClaimWritePolicy(
    options: AssertWriteOptions,
  ): Promise<{ requiresConfirmation: boolean; confirmationId?: string; pendingActionId?: string }> {
    const { storage, context, actionType, summary, policy, payload } = options;

    const requiresConfirmation =
      policy.risk === 'destructive' ||
      Boolean(policy.requiresConfirmation) ||
      (policy.affectedCount !== undefined && policy.affectedCount > 20);

    if (requiresConfirmation) {
      if (!context.confirmationId) {
        const pending = await createPendingAction(storage, context, actionType, summary, payload);
        throw new BangumiError(
          'CONFIRMATION_REQUIRED',
          `该操作具有破坏性或包含大批量变更 (${summary})，需要确认后才能继续。Confirmation ID: ${pending.confirmationId}`,
          false,
          400,
          `在 ToolContext 中传入 confirmationId: "${pending.confirmationId}" 并重新发起请求`,
        );
      }

      const claimedAction = await claimPendingAction(
        storage,
        context,
        context.confirmationId,
        payload,
      );
      return {
        requiresConfirmation: true,
        confirmationId: context.confirmationId,
        pendingActionId: claimedAction.id,
      };
    }

    return { requiresConfirmation: false };
  }
}
