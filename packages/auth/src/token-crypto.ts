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

export function encryptToken(plaintext: string, secretKey: string, keyVersion = 'v1'): EncryptedTokenPayload {
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
    keyVersion,
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

