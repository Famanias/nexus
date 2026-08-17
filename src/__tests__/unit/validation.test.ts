import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRequired,
} from '@/lib/utils/validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('returns error when email is empty or whitespace', () => {
      expect(validateEmail('')).toBe('Email address is required.');
      expect(validateEmail('   ')).toBe('Email address is required.');
    });

    it('returns error when email format is invalid', () => {
      expect(validateEmail('invalid')).toBe('Please enter a valid email address.');
      expect(validateEmail('user@')).toBe('Please enter a valid email address.');
      expect(validateEmail('@domain.com')).toBe('Please enter a valid email address.');
      expect(validateEmail('user@domain')).toBe('Please enter a valid email address.');
    });

    it('returns null when email is valid', () => {
      expect(validateEmail('user@example.com')).toBeNull();
      expect(validateEmail('first.last+tag@sub.domain.org')).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('checks length requirement (minimum 8 chars)', () => {
      const short = validatePassword('Pass1!');
      expect(short.hasMinLength).toBe(false);
      expect(short.valid).toBe(false);
      expect(short.errors).toContain('Must be at least 8 characters');

      const long = validatePassword('Password123!');
      expect(long.hasMinLength).toBe(true);
    });

    it('checks number requirement', () => {
      const noNumber = validatePassword('Password!');
      expect(noNumber.hasNumber).toBe(false);
      expect(noNumber.valid).toBe(false);
      expect(noNumber.errors).toContain('Must contain at least 1 number');

      const withNumber = validatePassword('Password1!');
      expect(withNumber.hasNumber).toBe(true);
    });

    it('checks special character requirement', () => {
      const noSpecial = validatePassword('Password123');
      expect(noSpecial.hasSpecialChar).toBe(false);
      expect(noSpecial.valid).toBe(false);
      expect(noSpecial.errors).toContain('Must contain at least 1 special character');

      const withSpecial = validatePassword('Password123#');
      expect(withSpecial.hasSpecialChar).toBe(true);
    });

    it('returns valid: true when all criteria are met', () => {
      const strong = validatePassword('SecurePass123!');
      expect(strong.valid).toBe(true);
      expect(strong.hasMinLength).toBe(true);
      expect(strong.hasNumber).toBe(true);
      expect(strong.hasSpecialChar).toBe(true);
      expect(strong.errors).toHaveLength(0);
    });
  });

  describe('validateConfirmPassword', () => {
    it('returns error when confirm is empty', () => {
      expect(validateConfirmPassword('Secret123!', '')).toBe('Please confirm your password.');
    });

    it('returns error when passwords do not match', () => {
      expect(validateConfirmPassword('Secret123!', 'Different123!')).toBe('Passwords do not match.');
    });

    it('returns null when passwords match', () => {
      expect(validateConfirmPassword('Secret123!', 'Secret123!')).toBeNull();
    });
  });

  describe('validateRequired', () => {
    it('returns error when string is empty or whitespace', () => {
      expect(validateRequired('', 'First name')).toBe('First name is required.');
      expect(validateRequired('  ', 'Organization name')).toBe('Organization name is required.');
    });

    it('returns null when string has content', () => {
      expect(validateRequired('Acme Corp', 'Organization name')).toBeNull();
    });
  });
});
