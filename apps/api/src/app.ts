import { DatabaseStore } from '@bangumi-agent-kit/db';
import { OAuthService, TokenBroker } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { handleOAuthCallbackRoute } from './routes/oauth.js';

export function createApiApp(config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  secretKey: string;
}) {
  const db = new DatabaseStore();
  const httpClient = new HttpClient();
  const oauthService = new OAuthService(db, config, httpClient);
  const tokenBroker = new TokenBroker(db, config.secretKey);
  const oauthCallback = handleOAuthCallbackRoute(oauthService);

  return {
    db,
    httpClient,
    oauthService,
    tokenBroker,
    oauthCallback,
  };
}
