import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  scope?: string | null;
  token_type?: string;
}

export class BangumiOAuthClient {
  private userAgent =
    'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)';

  async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tokenUrl = 'https://bgm.tv/oauth/access_token',
  ): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body,
    });

    if (!res.ok) {
      throw new BangumiError(
        'OAUTH_EXCHANGE_FAILED',
        `OAuth token exchange failed with status ${res.status}`,
        false,
        res.status,
        '重新尝试绑定授权',
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new BangumiError(
        'OAUTH_EXCHANGE_FAILED',
        'OAuth token exchange returned invalid JSON payload',
        false,
        500,
        '重新尝试绑定授权',
      );
    }
    if (!hasAccessToken(data)) {
      throw new BangumiError(
        'OAUTH_EXCHANGE_FAILED',
        'OAuth token exchange returned a payload without access_token',
        false,
        500,
        '重新尝试绑定授权',
      );
    }
    return data;
  }

  async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tokenUrl = 'https://bgm.tv/oauth/access_token',
  ): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body,
    });

    if (!res.ok) {
      throw new BangumiError(
        'AUTH_EXPIRED',
        `OAuth token refresh rejected with status ${res.status}`,
        false,
        401,
        '调用 bangumi.auth_start',
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new BangumiError(
        'AUTH_EXPIRED',
        'OAuth token refresh returned invalid JSON payload',
        false,
        401,
        '调用 bangumi.auth_start',
      );
    }
    if (!hasAccessToken(data)) {
      throw new BangumiError(
        'AUTH_EXPIRED',
        'OAuth token refresh returned a payload without access_token',
        false,
        401,
        '调用 bangumi.auth_start',
      );
    }
    return data;
  }
}

function hasAccessToken(value: unknown): value is OAuthTokenResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const accessToken = (value as Partial<OAuthTokenResponse>).access_token;
  return typeof accessToken === 'string' && accessToken.trim().length > 0;
}
