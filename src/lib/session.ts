import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types';

export interface SessionData {
  user: User | null;
  profile: Profile | null;
}

/**
 * Resolves the authenticated user and their profile, memoized per request lifecycle using React cache().
 * Multiple callers in the same request (e.g. layout, page, server actions) share a single database lookup.
 */
export const getSession = cache(async (): Promise<SessionData> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return {
    user,
    profile: (profile as Profile) ?? null,
  };
});

/**
 * Returns the effective role for dashboard routing and eligibility: `system_role ?? role`.
 * An OJT promoted to supervisor/admin operates under that effective role.
 */
export function getEffectiveRole(
  profile?: { role?: string | null; system_role?: string | null } | null,
  fallbackRole?: string | null
): UserRole {
  const effective = (profile?.system_role ?? profile?.role) ?? fallbackRole ?? 'ojt';
  return effective as UserRole;
}

/**
 * Enforces an active session and valid profile row, redirecting to login on null.
 * Replaces bespoke error screens and ad-hoc null checks across dashboard pages and layouts.
 */
export async function requireProfile(
  redirectTo: string = '/login'
): Promise<{ user: User; profile: Profile }> {
  const { user, profile } = await getSession();
  if (!user || !profile) {
    redirect(redirectTo);
  }
  return { user, profile };
}

/**
 * Enforces an active user session (profile may still be null, e.g. during onboarding).
 */
export async function requireSession(
  redirectTo: string = '/login'
): Promise<{ user: User; profile: Profile | null }> {
  const { user, profile } = await getSession();
  if (!user) {
    redirect(redirectTo);
  }
  return { user, profile };
}
