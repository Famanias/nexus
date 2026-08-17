'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function syncUserRoleMetadata(
  userId: string,
  role: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('org_id, role, system_role')
    .eq('id', user.id)
    .single();

  const callerRole = callerProfile?.system_role ?? callerProfile?.role;
  if (!callerProfile || callerRole !== 'admin' || !callerProfile.org_id) {
    return { error: 'Only organization admins can change user roles.' };
  }

  const adminSupabase = await createAdminClient();
  const { data: targetProfile } = await adminSupabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .single();

  if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
    return { error: 'Forbidden: user is not part of your organization.' };
  }

  const [{ error: profileError }, { error: metadataError }] = await Promise.all([
    adminSupabase
      .from('profiles')
      .update({ system_role: role, role })
      .eq('id', userId),
    adminSupabase.auth.admin.getUserById(userId).then(async ({ data, error: getError }) => {
      if (getError || !data.user) return { error: getError?.message ?? 'User not found' };
      const merged = { ...(data.user.user_metadata ?? {}), role };
      return adminSupabase.auth.admin.updateUserById(userId, { user_metadata: merged });
    }),
  ]);

  if (profileError) return { error: profileError.message };
  if (metadataError) return { error: metadataError.message };
  return {};
}