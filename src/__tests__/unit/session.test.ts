import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEffectiveRole, getSession, requireProfile, requireSession } from '@/lib/session';
import type { Profile } from '@/types';

// Mock Next.js navigation redirect
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw err;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockSingle, single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe('session module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEffectiveRole', () => {
    it('prefers system_role over role', () => {
      expect(getEffectiveRole({ role: 'ojt', system_role: 'admin' })).toBe('admin');
      expect(getEffectiveRole({ role: 'supervisor', system_role: 'admin' })).toBe('admin');
      expect(getEffectiveRole({ role: 'admin', system_role: 'ojt' })).toBe('ojt');
    });

    it('falls back to role when system_role is undefined or null', () => {
      expect(getEffectiveRole({ role: 'supervisor', system_role: null })).toBe('supervisor');
      expect(getEffectiveRole({ role: 'ojt', system_role: undefined })).toBe('ojt');
    });

    it('falls back to fallbackRole when profile and roles are missing', () => {
      expect(getEffectiveRole(null, 'supervisor')).toBe('supervisor');
      expect(getEffectiveRole({ role: undefined, system_role: undefined }, 'admin')).toBe('admin');
    });

    it('defaults to ojt when nothing is provided', () => {
      expect(getEffectiveRole(null)).toBe('ojt');
      expect(getEffectiveRole(undefined)).toBe('ojt');
    });
  });

  describe('getSession', () => {
    it('returns null user and profile when unauthenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

      const session = await getSession();
      expect(session.user).toBeNull();
      expect(session.profile).toBeNull();
    });

    it('returns user and profile when authenticated and profile exists', async () => {
      const fakeUser = { id: 'user-123', email: 'test@example.com' };
      const fakeProfile: Profile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'ojt',
        system_role: undefined,
        org_id: 'org-1',
        required_hours: 600,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
      mockSingle.mockResolvedValueOnce({ data: fakeProfile, error: null });

      const session = await getSession();
      expect(session.user).toEqual(fakeUser);
      expect(session.profile).toEqual(fakeProfile);
    });

    it('returns user and null profile when profile row is not found', async () => {
      const fakeUser = { id: 'user-456', email: 'noprofile@example.com' };

      mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const session = await getSession();
      expect(session.user).toEqual(fakeUser);
      expect(session.profile).toBeNull();
    });
  });

  describe('requireProfile', () => {
    it('redirects to /login when user is not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT:/login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to custom path when specified and profile is missing', async () => {
      const fakeUser = { id: 'user-789', email: 'user@example.com' };
      mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(requireProfile('/custom-login')).rejects.toThrow('NEXT_REDIRECT:/custom-login');
      expect(mockRedirect).toHaveBeenCalledWith('/custom-login');
    });

    it('returns user and profile when both exist', async () => {
      const fakeUser = { id: 'user-789', email: 'user@example.com' };
      const fakeProfile: Profile = {
        id: 'user-789',
        email: 'user@example.com',
        full_name: 'Valid User',
        role: 'admin',
        org_id: 'org-1',
        required_hours: 0,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
      mockSingle.mockResolvedValueOnce({ data: fakeProfile, error: null });

      const result = await requireProfile();
      expect(result.user).toEqual(fakeUser);
      expect(result.profile).toEqual(fakeProfile);
    });
  });

  describe('requireSession', () => {
    it('redirects when user is not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/login');
    });

    it('returns user even if profile is null', async () => {
      const fakeUser = { id: 'user-999', email: 'onboarding@example.com' };
      mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await requireSession();
      expect(result.user).toEqual(fakeUser);
      expect(result.profile).toBeNull();
    });
  });
});
