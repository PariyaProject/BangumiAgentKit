import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { TokenBroker, OAuthService } from '@bangumi-agent-kit/auth';

export function createAuthTools(tokenBroker: TokenBroker, oauthService: OAuthService) {
  const authStatus = defineTool({
    name: 'bangumi.auth_status',
    description: '查询当前平台用户与 Bangumi 账号的绑定及授权凭证状态。不会暴露任何明文 Token。',
    input: z.object({}),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (_input, context) => {
      return await tokenBroker.getAuthStatus(context.principalId);
    },
  });

  const authStart = defineTool({
    name: 'bangumi.auth_start',
    description: '生成 Bangumi OAuth 账号绑定授权 URL。返回引导用户在浏览器中打开的认证链接。',
    input: z.object({
      capabilities: z
        .array(z.string())
        .optional()
        .describe('申请的能力/权限范围列表 (如 ["write:collection"])'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, context) => {
      const caps =
        input.capabilities && input.capabilities.length > 0
          ? input.capabilities
          : ['write:collection'];

      const result = await oauthService.createAuthorizationUrl(
        context.principalId,
        context.botInstanceId,
        context.conversationId,
        caps,
      );

      return {
        authorizationUrl: result.url,
        expiresAt: result.expiresAt.toISOString(),
      };
    },
  });

  const authListAccounts = defineTool({
    name: 'bangumi.auth_list_accounts',
    description: '列出当前平台用户绑定的所有 Bangumi 账号及当前激活状态。不会暴露任何明文 Token。',
    input: z.object({}),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (_input, context) => {
      return await tokenBroker.listAccounts(context.principalId);
    },
  });

  const authSwitchAccount = defineTool({
    name: 'bangumi.auth_switch_account',
    description: '切换当前平台用户的活跃 Bangumi 账号。只能选择已绑定至当前平台用户的账号。',
    input: z.object({
      accountId: z.string().describe('需要切换为活跃状态的 Bangumi 账号 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'write',
    execute: async (input, context) => {
      return await tokenBroker.switchAccount(context.principalId, input.accountId);
    },
  });

  const authRemoveAccount = defineTool({
    name: 'bangumi.auth_remove_account',
    description: '移除当前平台用户已绑定的指定 Bangumi 账号。需要二次确认。',
    input: z.object({
      accountId: z.string().describe('需要解绑的 Bangumi 账号 ID'),
    }),
    auth: 'required',
    scopes: [],
    risk: 'destructive',
    execute: async (input, context) => {
      await tokenBroker.removeAccount(context.principalId, input.accountId);
      return { success: true, message: `Bangumi 账号 ${input.accountId} 已解绑` };
    },
  });

  const authDisconnect = defineTool({
    name: 'bangumi.auth_disconnect',
    description: '解绑当前平台用户的 Bangumi 账号并清除凭证。属于破坏性操作，需要二次确认。',
    input: z.object({}),
    auth: 'required',
    scopes: [],
    risk: 'destructive',
    execute: async (_input, context) => {
      await tokenBroker.disconnect(context.principalId);
      return { success: true, message: 'Bangumi 账号已成功解绑' };
    },
  });

  return [
    authStatus,
    authStart,
    authListAccounts,
    authSwitchAccount,
    authRemoveAccount,
    authDisconnect,
  ] as const;
}
