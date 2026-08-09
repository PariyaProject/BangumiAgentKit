import { describe, it, expect, vi } from 'vitest';
import { createApiApp } from '../../apps/api/src/app.js';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies } from '@bangumi-agent-kit/tools';

describe('H. Fastify API Integration Test', () => {
  it('responds to health routes and handles OAuth callback validation via app.inject()', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });

    const { app } = await createApiApp({ dependencies: deps, storage });

    // 1. GET /health/live -> 200
    const liveRes = await app.inject({ method: 'GET', url: '/health/live' });
    expect(liveRes.statusCode).toBe(200);
    const liveBody = JSON.parse(liveRes.payload);
    expect(liveBody.status).toBe('live');

    // 2. GET /health/ready -> 200
    const readyRes = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(readyRes.statusCode).toBe(200);
    const readyBody = JSON.parse(readyRes.payload);
    expect(readyBody.status).toBe('ready');

    // 3. GET /oauth/bangumi/callback missing code/state -> 400
    const missingRes = await app.inject({ method: 'GET', url: '/oauth/bangumi/callback' });
    expect(missingRes.statusCode).toBe(400);
    expect(missingRes.payload).toContain('缺少必要的 code 或 state 参数');

    // 4. GET /oauth/bangumi/callback invalid state -> 400
    const invalidStateRes = await app.inject({
      method: 'GET',
      url: '/oauth/bangumi/callback?code=mock_code&state=invalid_state_123',
    });
    expect(invalidStateRes.statusCode).toBe(400);
    expect(invalidStateRes.payload).toContain('Bangumi 账号绑定失败');

    // 5. Valid mocked OAuth callback -> 200
    vi.spyOn(deps.oauthService, 'handleCallback').mockResolvedValue({
      principalId: 'p-1',
      accountId: 'bgm-1',
      username: 'testuser',
      nickname: 'Test User',
    });

    const validRes = await app.inject({
      method: 'GET',
      url: '/oauth/bangumi/callback?code=valid_code&state=valid_state',
    });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.payload).toContain('Bangumi 账号绑定成功！');
    expect(validRes.payload).toContain('Test User');
  });
});
