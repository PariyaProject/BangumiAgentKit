import { OAuthService } from '@bangumi-agent-kit/auth';
import { BangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';

const CALLBACK_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

interface CallbackPageOptions {
  statusCode: number;
  title: string;
  heading: string;
  message: string;
  nextAction: string;
  tone: 'success' | 'cancelled' | 'failure';
}

function renderCallbackPage(options: CallbackPageOptions) {
  const statusClass = `status status-${options.tone}`;
  return {
    statusCode: options.statusCode,
    headers: { ...CALLBACK_HEADERS },
    body: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(options.title)}</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f3f5f9; }
    * { box-sizing: border-box; }
    body { min-width: 0; min-height: 100vh; margin: 0; padding: clamp(16px, 4vw, 40px); display: grid; place-items: center; line-height: 1.6; }
    main { width: min(100%, 38rem); padding: clamp(20px, 5vw, 40px); background: #fff; border: 1px solid #d9deea; border-radius: 18px; box-shadow: 0 12px 36px rgb(25 38 66 / 8%); }
    .eyebrow { margin: 0 0 12px; color: #526078; font-size: .9rem; font-weight: 650; }
    .status { padding: 16px 18px; border-radius: 12px; border: 1px solid; }
    .status-success { color: #14532d; background: #f0fdf4; border-color: #86efac; }
    .status-cancelled { color: #713f12; background: #fffbeb; border-color: #fcd34d; }
    .status-failure { color: #7f1d1d; background: #fef2f2; border-color: #fca5a5; }
    h1 { margin: 0; font-size: clamp(1.35rem, 5vw, 1.8rem); line-height: 1.25; overflow-wrap: anywhere; }
    .message { margin: 18px 0 0; overflow-wrap: anywhere; }
    .next-action { margin: 12px 0 0; color: #34425a; overflow-wrap: anywhere; }
    .next-action strong { color: #172033; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
  </style>
</head>
<body>
  <main id="main-content">
    <p class="eyebrow">Bangumi 账号授权</p>
    <section class="${statusClass}" role="status" aria-live="polite">
      <h1>${escapeHtml(options.heading)}</h1>
    </section>
    <p class="message">${escapeHtml(options.message)}</p>
    <p class="next-action"><strong>下一步：</strong>${escapeHtml(options.nextAction)}</p>
  </main>
</body>
</html>`,
  };
}

function invalidCallbackPage() {
  return renderCallbackPage({
    statusCode: 400,
    title: '授权未完成',
    heading: '授权未完成',
    message: '无法确认这次 Bangumi 授权请求，绑定状态没有因此改变。',
    nextAction: '返回聊天窗口查看账号状态；需要时再发起一次新的授权。',
    tone: 'failure',
  });
}

function failedCallbackPage(message: string) {
  return renderCallbackPage({
    statusCode: 400,
    title: '授权未完成',
    heading: '授权未完成',
    message,
    nextAction: '返回聊天窗口查看账号状态；需要时再发起一次新的授权。',
    tone: 'failure',
  });
}

export function handleOAuthCallbackRoute(oauthService: OAuthService) {
  return async (code?: string, state?: string, providerError?: string) => {
    if (providerError !== undefined) {
      if (!state) return invalidCallbackPage();

      try {
        await oauthService.consumeCallbackState(state);
      } catch {
        return invalidCallbackPage();
      }

      if (providerError === 'access_denied') {
        return renderCallbackPage({
          statusCode: 200,
          title: '授权已取消',
          heading: '授权已取消',
          message: '这次 Bangumi 授权没有完成，已有绑定状态没有改变。',
          nextAction: '关闭此页并返回聊天窗口查看账号状态；需要时再重新发起授权。',
          tone: 'cancelled',
        });
      }

      return failedCallbackPage('Bangumi 没有完成这次授权。没有收到可用于绑定的授权结果。');
    }

    if (!code || !state) {
      if (state) {
        try {
          await oauthService.consumeCallbackState(state);
        } catch {
          return invalidCallbackPage();
        }
      }
      return invalidCallbackPage();
    }

    try {
      const authorized = await oauthService.handleCallback(code, state);
      return {
        ...renderCallbackPage({
          statusCode: 200,
          title: '授权成功',
          heading: '绑定成功',
          message: `账号 ${authorized.nickname} (@${authorized.username}) 已成功关联。`,
          nextAction: '关闭此页并返回聊天窗口继续原来的操作，或查询账号状态。',
          tone: 'success',
        }),
        user: {
          username: authorized.username,
          nickname: authorized.nickname,
        },
      };
    } catch (err: unknown) {
      if (!(err instanceof BangumiError)) {
        console.error('[OAuth Callback Internal Error]');
      }
      const publicErr = toPublicError(err);
      return failedCallbackPage(publicErr.message);
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
