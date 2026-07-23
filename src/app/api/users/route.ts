import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { emitEvent } from '@/lib/automation';
import type { UserCreatedPayload, UserDeletedPayload } from '@/lib/automation';

// Uses service role key to create users bypassing email confirmation
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

async function getCallerOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, system_role')
    .eq('id', user.id)
    .single();
  const callerRole = profile?.system_role ?? profile?.role;
  if (!profile || callerRole !== 'admin') return null;
  return profile.org_id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getCallerOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: admin access required.' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { full_name, email, password, role, department, required_hours, is_active } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, org_id: orgId },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Upsert the profile with all required fields (covers trigger failure edge cases)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name,
        email,
        role,
        org_id: orgId,
        department: department || null,
        required_hours: required_hours ?? 600,
        is_active: is_active ?? true,
      }, { onConflict: 'id' });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // Emit user.created event
    emitEvent<UserCreatedPayload>('user.created', authData.user.id, {
      userId: authData.user.id,
      email,
      fullName: full_name,
      role,
    }, orgId);

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const orgId = await getCallerOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: admin access required.' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const orgId = await getCallerOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized: admin access required.' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter.' }, { status: 400 });
    }

    // Verify target user belongs to caller's organization before deletion
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (!targetProfile || targetProfile.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete user from another organization.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Emit user.deleted event
    emitEvent<UserDeletedPayload>('user.deleted', userId, {
      userId,
    }, orgId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
