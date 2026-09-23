import { afterEach, describe, expect, it, vi } from 'vitest';
import { BangumiOAuthClient } from '../../packages/auth/src/oauth-client.js';

const TOKEN_URL = 'https://oauth.example.test/access_token';

describe('BangumiOAuthClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exchanges an authorization code using the form-encoded OAuth contract', async () => {
    const token = {
      access_token: 'fixture-access-token',
      refresh_token: 'fixture-refresh-token',
      expires_in: 3600,
      user_id: 12345,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(token), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new BangumiOAuthClient();
    const result = await client.exchangeAuthorizationCode(
      'fixture-authorization-code',
      'fixture-client-id',
      'fixture-client-secret',
      'http://127.0.0.1:43123/oauth/callback',
      TOKEN_URL,
    );

    expect(result).toEqual(token);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected token endpoint request');
    const [url, init] = call;
    expect(url).toBe(TOKEN_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': expect.stringContaining('BangumiAgentKit'),
    });
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    const form = init?.body as URLSearchParams;
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'fixture-client-id',
      client_secret: 'fixture-client-secret',
      code: 'fixture-authorization-code',
      redirect_uri: 'http://127.0.0.1:43123/oauth/callback',
    });
  });

  it('maps token endpoint failures without exposing the response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('fixture provider error with sensitive detail', { status: 502 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new BangumiOAuthClient().exchangeAuthorizationCode(
      'fixture-code', 'fixture-client', 'fixture-secret', 'http://127.0.0.1/callback', TOKEN_URL,
    )).rejects.toThrow('OAuth token exchange failed with status 502');
  });

  it.each([
    ['invalid JSON', 'not-json', 'OAuth token exchange returned invalid JSON payload'],
    [
      'missing access token',
      JSON.stringify({ refresh_token: 'fixture-refresh-token' }),
      'OAuth token exchange returned a payload without access_token',
    ],
    [
      'empty access token',
      JSON.stringify({ access_token: '  ' }),
      'OAuth token exchange returned a payload without access_token',
    ],
  ])('rejects a successful token response with %s', async (_name, responseBody, message) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(responseBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new BangumiOAuthClient().exchangeAuthorizationCode(
      'fixture-code', 'fixture-client', 'fixture-secret', 'http://127.0.0.1/callback', TOKEN_URL,
    )).rejects.toThrow(message);
  });

  it('refreshes a token with the refresh-token grant', async () => {
    const token = { access_token: 'fixture-refreshed-access-token', expires_in: 7200 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(token), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new BangumiOAuthClient().refreshToken(
      'fixture-old-refresh-token',
      'fixture-client-id',
      'fixture-client-secret',
      'http://127.0.0.1:43123/oauth/callback',
      TOKEN_URL,
    );

    expect(result).toEqual(token);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected token endpoint request');
    const [url, init] = call;
    expect(url).toBe(TOKEN_URL);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    const form = init?.body as URLSearchParams;
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe('fixture-old-refresh-token');
    expect(form.get('client_id')).toBe('fixture-client-id');
    expect(form.get('client_secret')).toBe('fixture-client-secret');
    expect(form.get('redirect_uri')).toBe('http://127.0.0.1:43123/oauth/callback');
  });

  it('maps refresh rejection to AUTH_EXPIRED without exposing the response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('fixture refresh failure detail', { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new BangumiOAuthClient().refreshToken(
      'fixture-refresh-token', 'fixture-client', 'fixture-secret',
      'http://127.0.0.1/callback', TOKEN_URL,
    )).rejects.toThrow('OAuth token refresh rejected with status 401');
  });

  it('reports a missing refresh access token as a malformed credential payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: 'fixture-next-refresh-token' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new BangumiOAuthClient().refreshToken(
      'fixture-refresh-token', 'fixture-client', 'fixture-secret',
      'http://127.0.0.1/callback', TOKEN_URL,
    )).rejects.toThrow('OAuth token refresh returned a payload without access_token');
  });
});
