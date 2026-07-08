import { SupabaseClient } from '@supabase/supabase-js';
import { Invitation, UserRole } from '@/types';
import crypto from 'crypto';

export async function createInvitation(
  supabaseAdmin: SupabaseClient,
  params: {
    orgId: string;
    email: string;
    role: UserRole;
    invitedBy: string;
    expiresInDays?: number;
  }
): Promise<Invitation> {
  const { orgId, email, role, invitedBy, expiresInDays = 7 } = params;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if user is already a member of this organization
  const { data: existingMember, error: memberError } = await supabaseAdmin
    .from('profiles')
    .select('id, org_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (memberError) {
    throw new Error(`Database error checking membership: ${memberError.message}`);
  }

  if (existingMember && existingMember.org_id === orgId) {
    throw new Error('User is already a member of this organization.');
  }

  // 2. Check for duplicate pending invitations
  const { data: pendingInvite, error: inviteError } = await supabaseAdmin
    .from('invitations')
    .select('id, status, expires_at')
    .eq('organization_id', orgId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (inviteError) {
    throw new Error(`Database error checking invitations: ${inviteError.message}`);
  }

  if (pendingInvite) {
    // Check if it's expired
    if (new Date(pendingInvite.expires_at) > new Date()) {
      throw new Error('A pending invitation already exists for this email address.');
    } else {
      // Mark it as expired so we can create a new one
      await supabaseAdmin
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', pendingInvite.id);
    }
  }

  // 3. Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // 4. Insert invitation
  const { data: invitation, error: insertError } = await supabaseAdmin
    .from('invitations')
    .insert({
      organization_id: orgId,
      email: normalizedEmail,
      role,
      invited_by: invitedBy,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError || !invitation) {
    throw new Error(insertError?.message ?? 'Failed to create invitation record.');
  }

  try {
    const { createNotification } = await import('./notification');
    await createNotification(supabaseAdmin, {
      orgId,
      userId: invitedBy,
      title: 'Invitation Sent',
      message: `An invitation has been sent to ${normalizedEmail} as an ${role.toUpperCase()}.`,
      type: 'invitation_sent',
    });
  } catch (err) {
    console.error('Failed to create invitation_sent notification:', err);
  }

  return invitation as Invitation;
}

export async function getInvitationByToken(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<(Invitation & { organization: { name: string } }) | null> {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .select('*, organization:organizations(name)')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  return data as any;
}

export async function validateInvitation(
  supabaseAdmin: SupabaseClient,
  token: string,
  userEmail?: string
): Promise<{ valid: boolean; error?: string; invitation?: Invitation & { organization: { name: string } } }> {
  const invitation = await getInvitationByToken(supabaseAdmin, token);

  if (!invitation) {
    return { valid: false, error: 'Invitation not found or invalid link.' };
  }

  if (invitation.status !== 'pending') {
    return { valid: false, error: `This invitation has already been ${invitation.status}.` };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Update status to expired in db
    await supabaseAdmin
      .from('invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);

    try {
      const { notifyAdmins } = await import('./notification');
      await notifyAdmins(supabaseAdmin, invitation.organization_id, {
        title: 'Invitation Expired',
        message: `Invitation sent to ${invitation.email} has expired.`,
        type: 'invitation_expired',
      });
    } catch (err) {
      console.error('Failed to notify admins about expiration:', err);
    }

    return { valid: false, error: 'This invitation has expired.' };
  }

  if (userEmail && invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { valid: false, error: `This invitation was sent to ${invitation.email}, but you are signed in as ${userEmail}.` };
  }

  return { valid: true, invitation };
}

export async function acceptInvitation(
  supabaseAdmin: SupabaseClient,
  token: string,
  userId: string
): Promise<Invitation> {
  // 1. Get authenticated user's email
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !user || !user.email) {
    throw new Error('Authenticated user not found.');
  }

  // 2. Validate invitation
  const validation = await validateInvitation(supabaseAdmin, token, user.email);
  if (!validation.valid || !validation.invitation) {
    throw new Error(validation.error ?? 'Invalid invitation.');
  }

  const invite = validation.invitation;

  // 3. Update profile role and org_id
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      role: invite.role,
      org_id: invite.organization_id,
      is_active: true, // Make sure profile is active
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to join organization profile: ${profileError.message}`);
  }

  // 4. Update auth user metadata
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role: invite.role, org_id: invite.organization_id }
  });
  if (authUpdateError) {
    console.error('Failed to update auth user metadata:', authUpdateError);
  }

  // 5. Mark invitation accepted
  const { data: updatedInvite, error: updateInviteError } = await supabaseAdmin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .select()
    .single();

  if (updateInviteError || !updatedInvite) {
    throw new Error(`Failed to update invitation status: ${updateInviteError?.message}`);
  }

  try {
    const { notifyAdmins } = await import('./notification');
    await notifyAdmins(supabaseAdmin, invite.organization_id, {
      title: 'Invitation Accepted',
      message: `${invite.email} accepted the invitation and joined as an ${invite.role.toUpperCase()}.`,
      type: 'invitation_accepted',
    });
  } catch (err) {
    console.error('Failed to notify admins about acceptance:', err);
  }

  return updatedInvite as Invitation;
}

export async function revokeInvitation(
  supabaseAdmin: SupabaseClient,
  invitationId: string,
  orgId: string
): Promise<void> {
  // 1. Fetch invitation email for notification
  const { data: invite } = await supabaseAdmin
    .from('invitations')
    .select('email')
    .eq('id', invitationId)
    .eq('organization_id', orgId)
    .single();

  const email = invite?.email || 'User';

  const { error } = await supabaseAdmin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('organization_id', orgId);

  if (error) {
    throw new Error(`Failed to revoke invitation: ${error.message}`);
  }

  // 2. Notify admins about revocation
  try {
    const { notifyAdmins } = await import('./notification');
    await notifyAdmins(supabaseAdmin, orgId, {
      title: 'Invitation Revoked',
      message: `Invitation for ${email} was revoked.`,
      type: 'invitation_revoked',
    });
  } catch (err) {
    console.error('Failed to notify admins about revocation:', err);
  }
}

export async function listInvitations(
  supabaseAdmin: SupabaseClient,
  orgId: string
): Promise<Invitation[]> {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to retrieve invitations: ${error.message}`);
  }

  return data as Invitation[];
}
