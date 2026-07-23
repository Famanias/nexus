import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const DEFAULT_DEV_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Returns the 32-byte Buffer key derived from INTEGRATION_ENCRYPTION_KEY.
 * Falls back to DEFAULT_DEV_KEY with a warning if unspecified.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Encryption] INTEGRATION_ENCRYPTION_KEY environment variable is required in production.');
    }
    console.warn('[Encryption] WARNING: INTEGRATION_ENCRYPTION_KEY is unset. Using insecure default key for development.');
    return Buffer.from(DEFAULT_DEV_KEY, 'hex');
  }

  const trimmed = envKey.trim();
  if (trimmed.length !== 64) {
    throw new Error('[Encryption] INTEGRATION_ENCRYPTION_KEY must be a 64-character (32-byte) hex string.');
  }

  return Buffer.from(trimmed, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `iv_hex:auth_tag_hex:ciphertext_hex`
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string produced by `encryptSecret`.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';

  // If plaintext isn't encrypted (legacy format), return as-is or attempt split
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return cipherText;
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
