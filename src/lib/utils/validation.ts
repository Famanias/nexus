export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  hasMinLength: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  // Standard RFC 5322 regex approximation for email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  const errors: string[] = [];
  if (!hasMinLength) {
    errors.push('Must be at least 8 characters');
  }
  if (!hasNumber) {
    errors.push('Must contain at least 1 number');
  }
  if (!hasSpecialChar) {
    errors.push('Must contain at least 1 special character');
  }

  return {
    valid: hasMinLength && hasNumber && hasSpecialChar,
    errors,
    hasMinLength,
    hasNumber,
    hasSpecialChar,
  };
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) {
    return 'Please confirm your password.';
  }
  if (password !== confirm) {
    return 'Passwords do not match.';
  }
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || !value.trim()) {
    return `${fieldName} is required.`;
  }
  return null;
}
