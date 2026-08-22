import { describe, it, expect, vi } from 'vitest';
import {
  computeAttendanceSummary,
  completionPercent,
  getAttendanceSummary,
  getAttendanceSummaries,
} from '@/lib/attendance/summary';
import type { Profile } from '@/types';

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

  it('aggregates multiple sessions on the same date as 1 unique day', () => {
    const multiSessionRows = [
      { total_hours: 4, date: '2026-08-18' },
      { total_hours: 3.5, date: '2026-08-18' },
      { total_hours: 8, date: '2026-08-19' },
    ];
    const summary = computeAttendanceSummary({ rows: multiSessionRows, requiredHours: 100, role: 'ojt' });
    expect(summary).toEqual({
      total_days: 2,
      total_hours: 15.5,
      required_hours: 100,
      remaining_hours: 84.5,
      completion_percentage: 15.5,
    });
  });
});

describe('getAttendanceSummary (RPC)', () => {
  const fakeOjtProfile: Profile = {
    id: 'user-1',
    email: 'ojt@example.com',
    full_name: 'Test OJT',
    role: 'ojt',
    is_active: true,
    required_hours: 100,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };

  it('returns null for non-OJT profiles without querying RPC', async () => {
    const mockRpc = vi.fn();
    const mockSupabase = { rpc: mockRpc };

    const nonOjtProfile: Profile = { ...fakeOjtProfile, role: 'supervisor' };
    const result = await getAttendanceSummary(mockSupabase, 'user-1', nonOjtProfile);

    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fetches summary from get_attendance_summary RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ total_hours: 45.5, total_days: 6 }],
      error: null,
    });
    const mockSupabase = { rpc: mockRpc };

    const result = await getAttendanceSummary(mockSupabase, 'user-1', fakeOjtProfile);

    expect(mockRpc).toHaveBeenCalledWith('get_attendance_summary', {
      target_user_id: 'user-1',
    });
    expect(result).toEqual({
      total_days: 6,
      total_hours: 45.5,
      required_hours: 100,
      remaining_hours: 54.5,
      completion_percentage: 45.5,
    });
  });

  it('falls back to table query when RPC fails or returns no data', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function not found' },
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({
          data: [
            { total_hours: 8, date: '2026-08-01' },
            { total_hours: 4, date: '2026-08-02' },
          ],
        }),
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockSupabase = { rpc: mockRpc, from: mockFrom };

    const result = await getAttendanceSummary(mockSupabase, 'user-1', fakeOjtProfile);

    expect(result).toEqual({
      total_days: 2,
      total_hours: 12,
      required_hours: 100,
      remaining_hours: 88,
      completion_percentage: 12,
    });
  });
});

describe('getAttendanceSummaries (RPC)', () => {
  it('fetches organization-wide summaries and builds a Map', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'user-1', total_hours: 120, total_days: 15 },
        { user_id: 'user-2', total_hours: 80.5, total_days: 10 },
      ],
      error: null,
    });
    const mockSupabase = { rpc: mockRpc };

    const map = await getAttendanceSummaries(mockSupabase, 'org-123');

    expect(mockRpc).toHaveBeenCalledWith('get_attendance_summaries', {
      target_org_id: 'org-123',
    });
    expect(map.size).toBe(2);
    expect(map.get('user-1')).toEqual({ total_hours: 120, total_days: 15 });
    expect(map.get('user-2')).toEqual({ total_hours: 80.5, total_days: 10 });
  });

  it('falls back to raw table query when RPC errors', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });
    const mockSelect = vi.fn().mockReturnValue({
      not: vi.fn().mockResolvedValue({
        data: [
          { user_id: 'user-1', total_hours: 4, date: '2026-08-10' },
          { user_id: 'user-1', total_hours: 4, date: '2026-08-10' },
          { user_id: 'user-2', total_hours: 8, date: '2026-08-11' },
        ],
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockSupabase = { rpc: mockRpc, from: mockFrom };

    const map = await getAttendanceSummaries(mockSupabase, 'org-123');

    expect(map.size).toBe(2);
    expect(map.get('user-1')).toEqual({ total_hours: 8, total_days: 1 });
    expect(map.get('user-2')).toEqual({ total_hours: 8, total_days: 1 });
  });
});