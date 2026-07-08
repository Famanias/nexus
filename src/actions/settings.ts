'use server';

import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

export async function saveTimezone(id: string, timezone: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If we don't have an id, update the single row without filtering
  let query = supabase
    .from('site_settings')
    .update({ timezone, updated_by: user?.id });

  if (id) {
    query = query.eq('id', id) as typeof query;
  }

  const { error } = await query;

  if (error) return { error: error.message };
  return {};
}

export async function regenerateInviteCode(): Promise<{ code?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || !profile.org_id) {
    return { error: 'Only organization admins can regenerate the invite code.' };
  }

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
