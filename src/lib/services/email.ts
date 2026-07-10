import { Resend } from 'resend';
import InvitationEmail from '@/emails/InvitationEmail';
import React from 'react';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email Service] RESEND_API_KEY is not defined in process.env.');
    return null;
  }
  const trimmed = apiKey.trim();
  if (trimmed === 'placeholder') {
    console.warn('[Email Service] RESEND_API_KEY is set to "placeholder".');
    return null;
  }
  if (trimmed.startsWith('your_')) {
    console.warn(`[Email Service] RESEND_API_KEY is a placeholder prefix: "${trimmed.substring(0, 10)}..."`);
    return null;
  }

  // Safe logging of the key prefix/suffix for verification
  const maskedKey = trimmed.length > 10 
    ? `${trimmed.substring(0, 5)}...${trimmed.substring(trimmed.length - 4)}`
    : '***';
  console.log(`[Email Service] Initializing Resend client with key: ${maskedKey}`);
  return new Resend(trimmed);
}

interface SendInvitationEmailParams {
  email: string;
  orgName: string;
  role: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { email, orgName, role, inviterName, inviteUrl, expiresAt } = params;

  const isProduction = process.env.NODE_ENV === 'production';
  const resend = getResendClient();
  const emailFrom = process.env.EMAIL_FROM || 'Nexus <onboarding@nexxus.lol>';

  console.log(`[Email Service] Attempting to send invitation email to ${email}`);
  console.log(`[Email Service] Using inviteUrl: ${inviteUrl}`);

  if (!resend) {
    const errorMsg = 'Resend API key is not configured or is a placeholder.';
    console.error(`[Email Service] Error: ${errorMsg}`);

    if (isProduction) {
      // In production, do not mock success! Show a failure to the user.
      return { success: false, error: errorMsg };
    }

    // In development/test environments, fallback to mock logs and return success
    console.log('\n============================================================');
    console.log('[MOCK EMAIL DELIVERY - NO RESEND API KEY]');
    console.log(`To: ${email}`);
    console.log(`From: ${emailFrom}`);
    console.log(`Subject: Invitation to join ${orgName}`);
    console.log(`Role: ${role.toUpperCase()}`);
    console.log(`Accept Invitation Link: ${inviteUrl}`);
    console.log(`Expires At: ${expiresAt}`);
    console.log('============================================================\n');
    return { success: true, error: `Mock Success: ${errorMsg}` };
  }

  try {
    console.log(`[Email Service] Sending email via Resend API to ${email} (from: ${emailFrom})...`);
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: `Invitation to join ${orgName} on Nexus`,
      react: React.createElement(InvitationEmail, {
        orgName,
        role,
        inviterName,
        inviteUrl,
        expiresAt,
        email,
      }),
    });

    if (error) {
      console.error('[Email Service] Resend email delivery failure:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email Service] Resend email delivery success. Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email Service] Unexpected exception during sending:', err);
    return { success: false, error: err.message ?? String(err) };
  }
}
