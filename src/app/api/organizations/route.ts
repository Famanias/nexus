import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orgName, inviteCode, fullName, email, password } = body;

    if (!fullName?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required.' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    if (action === 'create') {
      if (!orgName?.trim()) {
        return NextResponse.json(
          { error: 'Organization name is required.' },
          { status: 400 }
        );
      }

      const baseSlug = generateSlug(orgName.trim());
      let uniqueSlug = baseSlug;
      let uniqueCode = generateInviteCode();

      // Ensure slug uniqueness
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('slug', uniqueSlug)
          .maybeSingle();
        if (!existing) break;
        uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      // Ensure invite code uniqueness
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('invite_code', uniqueCode)
          .maybeSingle();
        if (!existing) break;
        uniqueCode = generateInviteCode();
      }

      // Create organization (created_by set after user creation)
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({ name: orgName.trim(), slug: uniqueSlug, invite_code: uniqueCode })
        .select()
        .single();

      if (orgError || !org) {
        return NextResponse.json(
          { error: orgError?.message ?? 'Failed to create organization.' },
          { status: 400 }
        );
      }

      // Create auth user with admin role and this org
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'admin', org_id: org.id },
      });

      if (authError) {
        // Clean up the org we just created
        await supabaseAdmin.from('organizations').delete().eq('id', org.id);
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const userId = authData.user.id;

      // Upsert profile (handles trigger edge cases)
      await supabaseAdmin.from('profiles').upsert(
        { id: userId, full_name: fullName.trim(), email: email.trim(), role: 'admin', org_id: org.id },
        { onConflict: 'id' }
      );

      // Link the org back to the creator
      await supabaseAdmin
        .from('organizations')
        .update({ created_by: userId })
        .eq('id', org.id);

      // Create default site settings for new org
      await supabaseAdmin.from('site_settings').insert({
        org_id: org.id,
        site_name: orgName.trim(),
        latitude: 14.5995,
        longitude: 120.9842,
        radius_meters: 150,
        address: '',
      });

      // Create default kanban columns for new org
      await supabaseAdmin.from('kanban_columns').insert([
        { org_id: org.id, title: 'To Do', color: '#ef4444', position: 0 },
        { org_id: org.id, title: 'Doing', color: '#f59e0b', position: 1 },
        { org_id: org.id, title: 'Done', color: '#22c55e', position: 2 },
      ]);

      return NextResponse.json({ success: true, role: 'admin' });
    } else if (action === 'join') {
      if (!inviteCode?.trim()) {
        return NextResponse.json(
          { error: 'Invite code is required.' },
          { status: 400 }
        );
      }

      // Find org by invite code
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();

      if (orgError || !org) {
        return NextResponse.json(
          { error: 'Invalid invite code. Please check and try again.' },
          { status: 400 }
        );
      }

      // Create auth user as OJT in this org
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'ojt', org_id: org.id },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Upsert profile
      await supabaseAdmin.from('profiles').upsert(
        { id: authData.user.id, full_name: fullName.trim(), email: email.trim(), role: 'ojt', org_id: org.id },
        { onConflict: 'id' }
      );

      return NextResponse.json({ success: true, role: 'ojt' });
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
