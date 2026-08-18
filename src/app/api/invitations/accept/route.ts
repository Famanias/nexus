import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { acceptInvitation } from '@/lib/services/invitation';
import { revalidateOjtsTag } from '@/lib/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getSession();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: login required.' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing invitation token.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const invitation = await acceptInvitation(supabaseAdmin, token, user.id);

    if (invitation.organization_id) {
      revalidateOjtsTag(invitation.organization_id);
    }

    return NextResponse.json({ success: true, role: invitation.role });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

