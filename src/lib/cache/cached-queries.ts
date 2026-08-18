import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from './tags';
import type { SiteSettings, Profile } from '@/types';

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

function getStatelessClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = isValidUrl(rawUrl) ? rawUrl! : PLACEHOLDER_URL;
  const key = rawKey && rawKey.length > 20 ? rawKey : PLACEHOLDER_KEY;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Retrieves site settings for an organization (or global fallback), cached via Next.js unstable_cache
 * and keyed by organization. Invalidated on-demand via revalidateSettingsTag().
 */
export async function getCachedSiteSettings(orgId?: string | null): Promise<SiteSettings | null> {
  const key = orgId || 'global';
  const tag = CACHE_TAGS.settings(key);

  const fetcher = unstable_cache(
    async (): Promise<SiteSettings | null> => {
      const supabase = getStatelessClient();
      let query = supabase.from('site_settings').select('*');

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return null;
      return data as SiteSettings;
    },
    ['site_settings', key],
    {
      tags: [tag],
      revalidate: 3600, // Background revalidation fallback (1h)
    }
  );

  return fetcher();
}

/**
 * Retrieves active OJT profiles for an organization (or all active OJTs if orgId not specified),
 * cached via Next.js unstable_cache and keyed by organization. Invalidated on-demand via revalidateOjtsTag().
 */
export async function getCachedActiveOjts(orgId?: string | null): Promise<Profile[]> {
  const key = orgId || 'global';
  const tag = CACHE_TAGS.ojts(key);

  const fetcher = unstable_cache(
    async (): Promise<Profile[]> => {
      const supabase = getStatelessClient();
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ojt')
        .eq('is_active', true);

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data as Profile[];
    },
    ['active_ojts', key],
    {
      tags: [tag],
      revalidate: 3600,
    }
  );

  return fetcher();
}
