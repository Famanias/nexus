import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { createOrganization, joinOrganization } from '@/lib/services/organization';
import { emitEvent } from '@/lib/automation';
import type { OrganizationCreatedPayload } from '@/lib/automation';
import { revalidateSettingsTag, revalidateOjtsTag } from '@/lib/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user from active session
    const { user } = await getSession();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, orgName, inviteCode } = body;

    const supabaseAdmin = getAdminClient();

    if (action === 'create') {
      if (!orgName?.trim()) {
        return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
      }

      // Create organization and link to existing user
      const org = await createOrganization(supabaseAdmin, orgName, user.id);

      // Emit organization.created event
      emitEvent<OrganizationCreatedPayload>('organization.created', user.id, {
        orgId: org.id,
        orgName: orgName.trim(),
        createdBy: user.id,
      }, org.id);

      revalidateSettingsTag(org.id);
      revalidateOjtsTag(org.id);

      return NextResponse.json({ success: true, role: 'admin', orgId: org.id });
    } else if (action === 'join') {
      if (!inviteCode?.trim()) {
        return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 });
      }

      // Join organization using invite code
      const org = await joinOrganization(supabaseAdmin, inviteCode, user.id);

      revalidateOjtsTag(org.id);

      return NextResponse.json({ success: true, role: 'ojt', orgId: org.id });
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

