import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clockIn, clockOut } from '@/actions/attendance';
import * as sessionModule from '@/lib/session';
import * as cacheModule from '@/lib/cache';
import type { User } from '@supabase/supabase-js';
import type { Profile, SiteSettings } from '@/types';

// Mock session module
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  getEffectiveRole: vi.fn(),
}));

// Mock cache module
vi.mock('@/lib/cache', () => ({
  getCachedSiteSettings: vi.fn(),
  revalidateSettingsTag: vi.fn(),
  revalidateOjtsTag: vi.fn(),
}));

// Mock admin client
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

const mockUser: User = {
  id: 'user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-08-01T00:00:00Z',
} as unknown as User;

const createMockProfile = (overrides?: Partial<Profile>): Profile => ({
  id: 'user-1',
  full_name: 'Test User',
  email: 'test@example.com',
  role: 'ojt',
  required_hours: 600,
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  ...overrides,
});

const createMockSiteSettings = (overrides?: Partial<SiteSettings>): SiteSettings => ({
  id: 'settings-1',
  org_id: 'org-1',
  site_name: 'Main Office',
  latitude: 14.5995,
  longitude: 120.9842,
  radius_meters: 500,
  require_location_verification: false,
  updated_at: '2026-08-01T00:00:00Z',
  ...overrides,
});

describe('Attendance Server Actions (clockIn / clockOut)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clockIn', () => {
    it('returns error if user is not authenticated', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: null,
        profile: null,
      });

      const result = await clockIn();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('returns error if user effective role is not ojt', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: mockUser,
        profile: createMockProfile({ role: 'supervisor' }),
      });
      vi.mocked(sessionModule.getEffectiveRole).mockReturnValueOnce('supervisor');

      const result = await clockIn();
      expect(result).toEqual({ error: 'Only OJTs can clock in/out.' });
    });

    it('returns error if user already has an active session for today', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: mockUser,
        profile: createMockProfile({ role: 'ojt', org_id: 'org-1' }),
      });
      vi.mocked(sessionModule.getEffectiveRole).mockReturnValueOnce('ojt');
      vi.mocked(cacheModule.getCachedSiteSettings).mockResolvedValueOnce(null);

      // Active rows query returns an existing row
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'active-1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await clockIn({ timezone: 'Asia/Manila' });
      expect(result).toEqual({
        error: 'You are already clocked in. Please clock out of your active session first.',
      });
    });

    it('successfully clocks in when validations pass', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: mockUser,
        profile: createMockProfile({ role: 'ojt', org_id: 'org-1' }),
      });
      vi.mocked(sessionModule.getEffectiveRole).mockReturnValueOnce('ojt');
      vi.mocked(cacheModule.getCachedSiteSettings).mockResolvedValueOnce(
        createMockSiteSettings({ require_location_verification: false })
      );

      // Active rows query returns empty
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      // Insert query returns created row
      const fakeAttendance = {
        id: 'att-1',
        user_id: 'user-1',
        clock_in: new Date().toISOString(),
        date: '2026-08-18',
      };
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: fakeAttendance,
              error: null,
            }),
          }),
        }),
      });

      const result = await clockIn({ timezone: 'Asia/Manila' });
      expect(result).toEqual({ data: fakeAttendance });
    });
  });

  describe('clockOut', () => {
    it('returns error if no active session is found', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: mockUser,
        profile: createMockProfile({ role: 'ojt', org_id: 'org-1' }),
      });
      vi.mocked(sessionModule.getEffectiveRole).mockReturnValueOnce('ojt');
      vi.mocked(cacheModule.getCachedSiteSettings).mockResolvedValueOnce(null);

      // Query returns no active record
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await clockOut({ timezone: 'Asia/Manila' });
      expect(result).toEqual({ error: 'No active clock-in session found.' });
    });

    it('successfully clocks out active session', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: mockUser,
        profile: createMockProfile({ role: 'ojt', org_id: 'org-1' }),
      });
      vi.mocked(sessionModule.getEffectiveRole).mockReturnValueOnce('ojt');
      vi.mocked(cacheModule.getCachedSiteSettings).mockResolvedValueOnce(null);

      // Active record found
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'att-1', user_id: 'user-1', clock_out: null },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const updatedRecord = {
        id: 'att-1',
        user_id: 'user-1',
        clock_in: '2026-08-18T08:00:00Z',
        clock_out: '2026-08-18T17:00:00Z',
      };

      // Update call
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedRecord,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await clockOut({ timezone: 'Asia/Manila' });
      expect(result).toEqual({ data: updatedRecord });
    });
  });
});
