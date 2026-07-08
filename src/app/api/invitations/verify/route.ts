import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { validateInvitation } from '@/lib/services/invitation';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Missing token parameter.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const result = await validateInvitation(supabaseAdmin, token);

    if (!result.valid || !result.invitation) {
      return NextResponse.json({ valid: false, error: result.error ?? 'Invalid invitation.' });
    }

    return NextResponse.json({
      valid: true,
      email: result.invitation.email,
      orgName: result.invitation.organization?.name || 'Nexus Organization',
      role: result.invitation.role,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ valid: false, error: msg }, { status: 500 });
  }
}
