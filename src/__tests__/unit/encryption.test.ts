import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/services/encryption';

describe('Integration Secrets Encryption (AES-256-GCM)', () => {
  const TEST_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts text cleanly', () => {
    const secret = 'https://discord.com/api/webhooks/12345/abcdef';
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toBe(secret);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('handles empty strings gracefully', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('returns unencrypted legacy string as-is on decrypt attempt', () => {
    const legacyUrl = 'https://hooks.slack.com/services/T00/B00/X00';
    expect(decryptSecret(legacyUrl)).toBe(legacyUrl);
  });

  it('falls back to dev key when env var is missing in development', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const secret = 'test-slack-webhook-key';
    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });
});
