import { OAuthService } from '@bangumi-agent-kit/auth';

export function handleOAuthCallbackRoute(oauthService: OAuthService) {
  return async (code: string, state: string) => {
    if (!code || !state) {
      return {
        ok: false,
        error: 'Missing code or state query parameter',
      };
    }

    try {
      const authorized = await oauthService.handleCallback(code, state);
      return {
        ok: true,
        message: 'Bangumi 账号绑定成功！可以返回聊天终端使用 Bangumi 机器人。',
        user: {
          username: authorized.username,
          nickname: authorized.nickname,
        },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}
