'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession, getEffectiveRole } from '@/lib/session';

export interface SiteSettingsInput {
  id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string | null;
  require_location_verification: boolean;
}

export async function saveSiteSettings(input: SiteSettingsInput): Promise<{ error?: string }> {
  const { user } = await getSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('site_settings')
    .update({
      site_name: input.site_name,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_meters: input.radius_meters,
      address: input.address,
      require_location_verification: input.require_location_verification,
      updated_by: user?.id,
    })
    .eq('id', input.id);

  if (error) return { error: error.message };
  return {};
}

export async function regenerateInviteCode(): Promise<{ code?: string; error?: string }> {
  const { user, profile } = await getSession();
  if (!user) return { error: 'Unauthorized' };

  const effectiveRole = getEffectiveRole(profile);
  if (!profile || effectiveRole !== 'admin' || !profile.org_id) {
    return { error: 'Only organization admins can regenerate the invite code.' };
  }

  const supabase = await createClient();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  const { error } = await supabase
    .from('organizations')
    .update({ invite_code: code })
    .eq('id', profile.org_id);

  if (error) return { error: error.message };
  return { code };
}

