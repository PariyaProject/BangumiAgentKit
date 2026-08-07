import crypto from 'node:crypto';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';

export interface EncryptedTokenPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion?: string;
}

export class TokenKeyring {
  private keys = new Map<string, string>();

  constructor(keys: Record<string, string> | string) {
    if (typeof keys === 'string') {
      validateEncryptionKey(keys);
      this.keys.set('v1', keys);
    } else {
      for (const [v, k] of Object.entries(keys)) {
        validateEncryptionKey(k);
        this.keys.set(v, k);
      }
    }
  }

  resolve(keyVersion = 'v1'): string {
    const key = this.keys.get(keyVersion);
    if (!key) {
      throw new BangumiError(
        'KEY_VERSION_UNAVAILABLE',
        `Encryption key version "${keyVersion}" is unavailable in TokenKeyring`,
        false,
        401,
        '请检查服务密钥配置'
      );
    }
    return key;
  }
}

export interface TokenEncryptionConfig {
  keyring: TokenKeyring;
  activeKeyVersion: string;
}

export function validateEncryptionKey(secretKey: string): void {
  if (!secretKey || secretKey.trim().length < 16) {
    throw new Error(
      'INVALID_ENCRYPTION_KEY: BANGUMI_TOKEN_ENCRYPTION_KEY must be configured with a secure key (at least 16 characters).'
    );
  }
}

function deriveKey(secretKey: string): Buffer {
  validateEncryptionKey(secretKey);
  return crypto.createHash('sha256').update(secretKey).digest();
}

export function encryptToken(
  plaintext: string,
  keyringOrSecret: TokenKeyring | string,
  activeKeyVersion = 'v1'
): EncryptedTokenPayload {
  const keyring = keyringOrSecret instanceof TokenKeyring ? keyringOrSecret : new TokenKeyring(keyringOrSecret);
  const secretKey = keyring.resolve(activeKeyVersion);
  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf-8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
    keyVersion: activeKeyVersion,
  };
}

export function decryptToken(payload: EncryptedTokenPayload, keyringOrSecret: TokenKeyring | string): string {
  const keyring = keyringOrSecret instanceof TokenKeyring ? keyringOrSecret : new TokenKeyring(keyringOrSecret);
  const version = payload.keyVersion || 'v1';
  const secretKey = keyring.resolve(version);
  const key = deriveKey(secretKey);
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}

export interface ResolveTokenEncryptionConfigOptions {
  secretKey?: string;
  keyVersion?: string;
  tokenEncryptionKeysJson?: string;
  tokenActiveKeyVersion?: string;
  tokenEncryption?: TokenEncryptionConfig;
}

export function resolveTokenEncryptionConfig(
  options: ResolveTokenEncryptionConfigOptions = {},
  env: Record<string, string | undefined> = process.env
): TokenEncryptionConfig {
  if (options.tokenEncryption) {
    options.tokenEncryption.keyring.resolve(options.tokenEncryption.activeKeyVersion);
    return options.tokenEncryption;
  }

  const keysJson = options.tokenEncryptionKeysJson || env.BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON;
  if (keysJson && keysJson.trim().length > 0) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(keysJson);
    } catch {
      throw new Error('INVALID_CONFIG: BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON must be valid JSON object.');
    }
    const keyring = new TokenKeyring(parsed);
    const activeKeyVersion =
      options.tokenActiveKeyVersion ||
      env.BANGUMI_TOKEN_ACTIVE_KEY_VERSION ||
      options.keyVersion ||
      env.BANGUMI_TOKEN_KEY_VERSION ||
      'v1';
    keyring.resolve(activeKeyVersion);
    return { keyring, activeKeyVersion };
  }

  const secretKey = options.secretKey || env.BANGUMI_TOKEN_ENCRYPTION_KEY;
  const isProd = env.NODE_ENV === 'production';
  if (isProd && !secretKey) {
    throw new Error(
      'CONFIG_ERROR: BANGUMI_TOKEN_ENCRYPTION_KEY or BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON is required in production environment.'
    );
  }

  const effectiveSecretKey = secretKey || 'default-test-secret-key-123456';
  const activeKeyVersion = options.keyVersion || env.BANGUMI_TOKEN_KEY_VERSION || 'v1';
  const keyring = new TokenKeyring({ [activeKeyVersion]: effectiveSecretKey });
  keyring.resolve(activeKeyVersion);
  return { keyring, activeKeyVersion };
}


