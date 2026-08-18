import { describe, it, expect } from 'vitest';
import { computeAttendanceSummary, completionPercent } from '@/lib/attendance/summary';

const rows = [
  { total_hours: 8 },
  { total_hours: 4.5 },
  { total_hours: null },
  { total_hours: 3.5 },
];

describe('completionPercent', () => {
  it('caps at 100', () => {
    expect(completionPercent(50, 40)).toBe(100);
    expect(completionPercent(40, 40)).toBe(100);
  });

  it('computes the raw ratio', () => {
    expect(completionPercent(20, 40)).toBe(50);
    expect(completionPercent(0, 600)).toBe(0);
  });

  it('returns 0 when required hours are missing or zero', () => {
    expect(completionPercent(10, 0)).toBe(0);
    expect(completionPercent(10, -5)).toBe(0);
  });
});

describe('computeAttendanceSummary', () => {
  it('returns null for non-OJT roles', () => {
    expect(computeAttendanceSummary({ rows, requiredHours: 600, role: 'supervisor' })).toBeNull();
    expect(computeAttendanceSummary({ rows, requiredHours: 600, role: 'admin' })).toBeNull();
    expect(computeAttendanceSummary({ rows, requiredHours: 600, role: 'ojt', systemRole: 'admin' })).toBeNull();
  });

  it('honors the effective role (system_role wins)', () => {
    const summary = computeAttendanceSummary({ rows, requiredHours: 10, role: 'admin', systemRole: 'ojt' });
    expect(summary).not.toBeNull();
    expect(summary?.required_hours).toBe(10);
  });

  it('computes totals, remaining hours, and capped completion for OJTs', () => {
    const summary = computeAttendanceSummary({ rows, requiredHours: 10, role: 'ojt' });
    expect(summary).toEqual({
      total_days: 4,
      total_hours: 16,
      required_hours: 10,
      remaining_hours: 0,
      completion_percentage: 100,
    });
  });

  it('keeps remaining hours at zero when the target is exceeded', () => {
    const summary = computeAttendanceSummary({ rows, requiredHours: 600, role: 'ojt' });
    expect(summary?.remaining_hours).toBe(584);
    expect(summary?.completion_percentage).toBeCloseTo((16 / 600) * 100);
  });
});