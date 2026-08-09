export const MODULE_NAME = 'config';
export { loadRuntimeEnv } from './env';

export const BANGUMI_OAUTH_CALLBACK_PATH = '/oauth/bangumi/callback';
export const DEFAULT_BANGUMI_OAUTH_REDIRECT_URI = `http://localhost:3000${BANGUMI_OAUTH_CALLBACK_PATH}`;
