import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createInvitation, listInvitations } from '@/lib/services/invitation';
import { sendInvitationEmail } from '@/lib/services/email';
import { getSiteUrl } from '@/lib/utils/url';
import { emitEvent } from '@/lib/automation';
import type { UserInvitedPayload } from '@/lib/automation';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

async function getCallerAdmin(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin' || !profile.org_id) return null;
  return profile;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await getCallerAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: admin access required.' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const invitations = await listInvitations(supabaseAdmin, admin.org_id);
    return NextResponse.json(invitations);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await getCallerAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Missing email or role.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Get organization name and admin name to show in the email
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', admin.org_id)
      .single();

    const orgName = org?.name || 'Nexus Organization';

    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', admin.id)
      .single();
    const inviterName = inviterProfile?.full_name || 'An Administrator';

    // 2. Create the invitation
    const invitation = await createInvitation(supabaseAdmin, {
      orgId: admin.org_id,
      email,
      role,
      invitedBy: admin.id,
    });

    // 3. Send the email via Resend (falls back to console if no API key)
    const siteUrl = getSiteUrl(request);
    const inviteUrl = `${siteUrl}/invite/${invitation.token}`;
    const expiresAtStr = new Date(invitation.expires_at).toLocaleString();

    const emailResult = await sendInvitationEmail({
      email,
      orgName,
      role,
      inviterName,
      inviteUrl,
      expiresAt: expiresAtStr,
    });

    if (!emailResult.success) {
      return NextResponse.json({
        success: true,
        invitation,
        warning: 'Invitation created successfully, but the email could not be delivered. Please try resending the invitation.'
      });
    }

    // Emit user.invited event (regardless of email delivery status)
    emitEvent<UserInvitedPayload>('user.invited', admin.id, {
      invitationId: invitation.id,
      email,
      role,
      inviterName,
      orgName,
      inviteUrl,
      expiresAt: expiresAtStr,
    }, admin.org_id);

    return NextResponse.json({ success: true, invitation });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
