import { describe, it, expect } from 'vitest';
import { isOjt } from '@/lib/attendance/eligibility';

describe('clock eligibility', () => {
  it('lets OJTs clock in/out', () => {
    expect(isOjt('ojt', undefined)).toBe(true);
    expect(isOjt('ojt', null)).toBe(true);
  });

  it('rejects supervisors and admins', () => {
    expect(isOjt('supervisor', undefined)).toBe(false);
    expect(isOjt('admin', undefined)).toBe(false);
  });

  it('uses the effective role (system_role wins over role)', () => {
    expect(isOjt('ojt', 'admin')).toBe(false);
    expect(isOjt('admin', 'ojt')).toBe(true);
    expect(isOjt('supervisor', 'ojt')).toBe(true);
  });

  it('rejects unknown or missing roles', () => {
    expect(isOjt(undefined, undefined)).toBe(false);
    expect(isOjt(null, null)).toBe(false);
    expect(isOjt('', '')).toBe(false);
  });
});