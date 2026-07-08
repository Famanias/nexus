import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getInvitationByToken } from '@/lib/services/invitation';
import InviteClient from './InviteClient';
import { notFound } from 'next/navigation';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabaseAdmin = getAdminClient();
  const invitation = await getInvitationByToken(supabaseAdmin, token);

  if (!invitation) {
    return notFound();
  }

  // Get current user if logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || null;

  // Resolve inviter name
  let inviterName = 'An Administrator';
  if (invitation.invited_by) {
    const { data: inviter } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', invitation.invited_by)
      .single();
    if (inviter) {
      inviterName = inviter.full_name;
    }
  }

  return (
    <InviteClient
      token={token}
      invitation={invitation}
      userEmail={userEmail}
      inviterName={inviterName}
    />
  );
}
