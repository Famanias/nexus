import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createOrganization, joinOrganization } from '@/lib/services/organization';
import { validateInvitation, acceptInvitation } from '@/lib/services/invitation';
import { emitEvent } from '@/lib/automation';
import type { UserCreatedPayload, OrganizationCreatedPayload } from '@/lib/automation';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orgName, inviteCode, fullName, email, password, inviteToken, captchaToken } = body;

    const secretKey = process.env.NEXT_PUBLIC_TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing Turnstile Secret Key.' },
        { status: 500 }
      );
    }

    if (!captchaToken) {
      return NextResponse.json(
        { error: 'CAPTCHA token is required.' },
        { status: 400 }
      );
    }

    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: secretKey,
          response: captchaToken,
        }),
      });

      const verifyResult = await verifyRes.json();
      if (!verifyResult.success) {
        return NextResponse.json(
          { error: 'CAPTCHA verification failed. Please try again.' },
          { status: 400 }
        );
      }
    } catch (verifyError) {
      console.error('Turnstile verification error:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify CAPTCHA. Please try again.' },
        { status: 500 }
      );
    }

    // Only 'create' and 'join' require an email up front. 'accept_invite'
    // derives the email from the invitation itself, so it must not be
    // required here.
    const requiresEmail = action === 'create' || action === 'join';

    if (!fullName?.trim() || !password || (requiresEmail && !email?.trim())) {
      return NextResponse.json(
        {
          error: requiresEmail
            ? 'Full name, email, and password are required.'
            : 'Full name and password are required.',
        },
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

      // 1. Create auth user first
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'admin' },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const userId = authData.user.id;

      try {
        // 2. Create organization and configure everything using the service
        await createOrganization(supabaseAdmin, orgName, userId);
      } catch (err: unknown) {
        // Clean up the auth user if creation fails
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // Emit domain events (fire-and-forget)
      emitEvent<UserCreatedPayload>('user.created', userId, {
        userId,
        email: email.trim(),
        fullName: fullName.trim(),
        role: 'admin',
        orgName: orgName.trim(),
      }, undefined);
      emitEvent<OrganizationCreatedPayload>('organization.created', userId, {
        orgId: '', // org ID is internal to createOrganization
        orgName: orgName.trim(),
        createdBy: userId,
        creatorName: fullName.trim(),
      }, undefined);

      return NextResponse.json({ success: true, role: 'admin' });
    } else if (action === 'join') {
      if (!inviteCode?.trim()) {
        return NextResponse.json(
          { error: 'Invite code is required.' },
          { status: 400 }
        );
      }

      // 1. Create auth user first
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'ojt' },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const userId = authData.user.id;

      try {
        // 2. Join organization using the service
        await joinOrganization(supabaseAdmin, inviteCode, userId);
      } catch (err: unknown) {
        // Clean up the auth user if join fails
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // Emit user.created event
      emitEvent<UserCreatedPayload>('user.created', userId, {
        userId,
        email: email.trim(),
        fullName: fullName.trim(),
        role: 'ojt',
      }, undefined);

      return NextResponse.json({ success: true, role: 'ojt' });
    } else if (action === 'accept_invite') {
      if (!inviteToken) {
        return NextResponse.json({ error: 'Invite token is required.' }, { status: 400 });
      }

      const validation = await validateInvitation(supabaseAdmin, inviteToken);
      if (!validation.valid || !validation.invitation) {
        return NextResponse.json({ error: validation.error ?? 'Invalid invitation.' }, { status: 400 });
      }

      const invite = validation.invitation;

      // Create the auth user with the invitation's email (ignore email from body for security)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: invite.role, org_id: invite.organization_id },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const userId = authData.user.id;

      try {
        await acceptInvitation(supabaseAdmin, inviteToken, userId);
      } catch (err: unknown) {
        // Clean up the auth user if accept fails
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // Emit user.created event
      emitEvent<UserCreatedPayload>('user.created', userId, {
        userId,
        email: invite.email,
        fullName: fullName.trim(),
        role: invite.role,
      }, invite.organization_id);

      return NextResponse.json({ success: true, role: invite.role });
    } else if (action === 'register_personal') {
      // 1. Create auth user with default role (ojt) and no organization
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), role: 'ojt' },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Emit user.created event (personal mode — no org)
      emitEvent<UserCreatedPayload>('user.created', authData.user.id, {
        userId: authData.user.id,
        email: email.trim(),
        fullName: fullName.trim(),
        role: 'ojt',
      }, null);

      return NextResponse.json({ success: true, role: 'ojt' });
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}