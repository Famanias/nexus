import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Fetch user's current profile to get role and org_id
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !profile) {
      return NextResponse.json({ error: 'Failed to retrieve profile.' }, { status: 400 });
    }

    const userOrgId = profile.org_id;
    if (!userOrgId) {
      return NextResponse.json({ error: 'You are not a member of any organization.' }, { status: 400 });
    }

    // 2. Enforce administrator rules
    if (profile.role === 'admin') {
      const { data: admins, error: adminsError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('org_id', userOrgId)
        .eq('role', 'admin');

      if (adminsError) {
        return NextResponse.json({ error: 'Failed to verify organization administrators.' }, { status: 400 });
      }

      if (admins && admins.length <= 1) {
        return NextResponse.json({
          error: 'You are the last administrator of this organization. You cannot leave until you assign another user as admin.'
        }, { status: 400 });
      }
    }

    // 3. Update profiles table - remove org_id relation
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ org_id: null })
      .eq('id', user.id);

    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 400 });
    }

    // 4. Update auth user metadata - set org_id to null
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        org_id: null,
      }
    });

    if (authUpdateError) {
      // Rollback profile update if auth metadata update fails
      await supabaseAdmin
        .from('profiles')
        .update({ org_id: userOrgId })
        .eq('id', user.id);
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
