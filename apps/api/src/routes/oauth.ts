import { OAuthService } from '@bangumi-agent-kit/auth';
import { BangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';

export function handleOAuthCallbackRoute(oauthService: OAuthService) {
  return async (code?: string, state?: string) => {
    if (!code || !state) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>绑定失败</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 40px;">
  <h2 style="color: #e53e3e;">Bangumi 账号绑定失败</h2>
  <p>缺少必要的 code 或 state 参数，请重新在聊天窗口发起绑定。</p>
</body>
</html>`,
      };
    }

    try {
      const authorized = await oauthService.handleCallback(code, state);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>绑定成功</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 40px;">
  <h2 style="color: #38a169;">Bangumi 账号绑定成功！</h2>
  <p>账号 <strong>${escapeHtml(authorized.nickname)}</strong> (@${escapeHtml(authorized.username)}) 已成功关联。</p>
  <p>现在可以关闭此页面，返回聊天窗口使用 Bangumi 机器人。</p>
</body>
</html>`,
        user: {
          username: authorized.username,
          nickname: authorized.nickname,
        },
      };
    } catch (err: unknown) {
      if (!(err instanceof BangumiError)) {
        console.error('[OAuth Callback Internal Error]', err);
      }
      const publicErr = toPublicError(err);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>绑定失败</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 40px;">
  <h2 style="color: #e53e3e;">Bangumi 账号绑定失败</h2>
  <p>${escapeHtml(publicErr.message)}</p>
  <p>请返回聊天窗口重新发起授权。</p>
</body>
</html>`,
      };
    }
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
