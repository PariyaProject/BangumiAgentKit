import { describe, expect, it, vi } from 'vitest';
import type { OAuthService } from '@bangumi-agent-kit/auth';
import { handleOAuthCallbackRoute } from '../../apps/api/src/routes/oauth.js';

function buildService() {
  return {
    consumeCallbackState: vi.fn(async (_state: string) => undefined),
    handleCallback: vi.fn(async (_code: string, _state: string) => ({
      accountId: 'account-fixture',
      principalId: 'principal-fixture',
      username: 'fixture&user',
      nickname: 'Synthetic <User>',
    })),
  };
}

describe('OAuth callback route', () => {
  it('consumes valid provider denials and renders a responsive cancellation page', async () => {
    const service = buildService();
    const handler = handleOAuthCallbackRoute(service as unknown as OAuthService);
    const response = await handler(undefined, 'synthetic-state', 'access_denied');

    expect(response.statusCode).toBe(200);
    expect(service.consumeCallbackState).toHaveBeenCalledWith('synthetic-state');
    expect(service.handleCallback).not.toHaveBeenCalled();
    expect(response.body).toContain('授权已取消');
    expect(response.body).toContain('name="viewport"');
    expect(response.body).not.toContain('synthetic-state');
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(response.headers['Referrer-Policy']).toBe('no-referrer');
    expect(response.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('consumes unrecognized provider errors without reflecting the raw error value', async () => {
    const service = buildService();
    const handler = handleOAuthCallbackRoute(service as unknown as OAuthService);
    const response = await handler(undefined, 'synthetic-state', 'server_error_SECRET');

    expect(response.statusCode).toBe(400);
    expect(service.consumeCallbackState).toHaveBeenCalledWith('synthetic-state');
    expect(service.handleCallback).not.toHaveBeenCalled();
    expect(response.body).toContain('没有完成这次授权');
    expect(response.body).not.toContain('server_error_SECRET');
  });

  it('consumes a valid state on a malformed callback that omitted the code', async () => {
    const service = buildService();
    const handler = handleOAuthCallbackRoute(service as unknown as OAuthService);
    const response = await handler(undefined, 'synthetic-state');

    expect(response.statusCode).toBe(400);
    expect(service.consumeCallbackState).toHaveBeenCalledWith('synthetic-state');
    expect(service.handleCallback).not.toHaveBeenCalled();
  });

  it('escapes returned identity and does not expose an unexpected exception', async () => {
    const service = buildService();
    const handler = handleOAuthCallbackRoute(service as unknown as OAuthService);
    const response = await handler('synthetic-code', 'synthetic-state');

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('绑定成功');
    expect(response.body).toContain('Synthetic &lt;User&gt; (@fixture&amp;user)');
    expect(response.body).not.toContain('synthetic-code');
    expect(response.body).not.toContain('synthetic-state');

    service.handleCallback.mockRejectedValueOnce(new Error('token=secret-fixture'));
    const failed = await handler('synthetic-code', 'synthetic-state-2');
    expect(failed.statusCode).toBe(400);
    expect(failed.body).not.toContain('token=secret-fixture');
    expect(failed.body).not.toContain('synthetic-state-2');
  });
});
