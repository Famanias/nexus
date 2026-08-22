import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CACHE_TAGS,
  revalidateSettingsTag,
  revalidateOjtsTag,
  getCachedSiteSettings,
  getCachedActiveOjts,
} from '@/lib/cache';

// Mock Next.js cache
const mockRevalidateTag = vi.fn();
const mockUnstableCache = vi.fn((fn: () => Promise<unknown>, ...args: unknown[]) => {
  void args;
  // Execute fn directly in tests while capturing the options passed
  return async () => fn();
});

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  unstable_cache: (fn: () => Promise<unknown>, keys: string[], opts: { tags?: string[]; revalidate?: number }) =>
    mockUnstableCache(fn, keys, opts),
}));


// Mock supabase client
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('cache subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CACHE_TAGS and revalidation helpers', () => {
    it('generates organization-scoped settings tags correctly', () => {
      expect(CACHE_TAGS.settings('org-123')).toBe('settings:org-123');
      expect(CACHE_TAGS.settings()).toBe('settings:global');
    });

    it('generates organization-scoped ojts tags correctly', () => {
      expect(CACHE_TAGS.ojts('org-456')).toBe('ojts:org-456');
      expect(CACHE_TAGS.ojts()).toBe('ojts:global');
    });

    it('triggers revalidateTag for settings with correct org tag', () => {
      revalidateSettingsTag('org-123');
      expect(mockRevalidateTag).toHaveBeenCalledWith('settings:org-123', 'default');

      revalidateSettingsTag(null);
      expect(mockRevalidateTag).toHaveBeenCalledWith('settings:global', 'default');
    });

    it('triggers revalidateTag for ojts with correct org tag', () => {
      revalidateOjtsTag('org-456');
      expect(mockRevalidateTag).toHaveBeenCalledWith('ojts:org-456', 'default');

      revalidateOjtsTag(undefined);
      expect(mockRevalidateTag).toHaveBeenCalledWith('ojts:global', 'default');
    });

  });

  describe('getCachedSiteSettings', () => {
    it('fetches site settings and applies org cache tag', async () => {
      const fakeSettings = {
        id: 'settings-1',
        org_id: 'org-1',
        site_name: 'HQ Office',
        latitude: 14.5995,
        longitude: 120.9842,
        radius_meters: 200,
        require_location_verification: true,
      };

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({ data: fakeSettings, error: null }),
            }),
          }),
        }),
      });

      const result = await getCachedSiteSettings('org-1');
      expect(result).toEqual(fakeSettings);
      expect(mockUnstableCache).toHaveBeenCalledWith(
        expect.any(Function),
        ['site_settings', 'org-1'],
        expect.objectContaining({
          tags: ['settings:org-1'],
        })
      );
    });

    it('returns null when settings are not found', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
          }),
        }),
      });

      const result = await getCachedSiteSettings(null);
      expect(result).toBeNull();
      expect(mockUnstableCache).toHaveBeenCalledWith(
        expect.any(Function),
        ['site_settings', 'global'],
        expect.objectContaining({
          tags: ['settings:global'],
        })
      );
    });
  });

  describe('getCachedActiveOjts', () => {
    it('fetches active OJT profiles and applies org cache tag', async () => {
      const fakeProfiles = [
        { id: 'user-1', full_name: 'OJT One', role: 'ojt', is_active: true, org_id: 'org-10' },
        { id: 'user-2', full_name: 'OJT Two', role: 'ojt', is_active: true, org_id: 'org-10' },
      ];

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockResolvedValueOnce({ data: fakeProfiles, error: null }),
            }),
          }),
        }),
      });

      const result = await getCachedActiveOjts('org-10');
      expect(result).toEqual(fakeProfiles);
      expect(mockUnstableCache).toHaveBeenCalledWith(
        expect.any(Function),
        ['active_ojts', 'org-10'],
        expect.objectContaining({
          tags: ['ojts:org-10'],
        })
      );
    });

    it('returns empty array when error occurs or no ojts found', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'DB Error' } }),
          }),
        }),
      });

      const result = await getCachedActiveOjts(null);
      expect(result).toEqual([]);
    });
  });
});
