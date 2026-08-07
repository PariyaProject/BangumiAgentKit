import crypto from 'node:crypto';

export interface EncryptedTokenPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion?: string;
}

function deriveKey(secretKey: string): Buffer {
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

export function decryptToken(payload: EncryptedTokenPayload, secretKey: string): string {
  const key = deriveKey(secretKey);
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}
