import { Resend } from 'resend';
import InvitationEmail from '@/emails/InvitationEmail';
import React from 'react';

// Initialize the Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'Nexus <onboarding@nexxus.lol>';

// Resend is initialized only if the API key is present and not a placeholder
const resend = resendApiKey && resendApiKey !== 'placeholder' && !resendApiKey.startsWith('your_')
  ? new Resend(resendApiKey)
  : null;

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

  // Fallback to mock logs if Resend is not configured
  if (!resend) {
    console.log('\n============================================================');
    console.log('[MOCK EMAIL DELIVERY - NO RESEND API KEY]');
    console.log(`To: ${email}`);
    console.log(`Subject: Invitation to join ${orgName}`);
    console.log(`Role: ${role.toUpperCase()}`);
    console.log(`Accept Invitation Link: ${inviteUrl}`);
    console.log(`Expires At: ${expiresAt}`);
    console.log('============================================================\n');
    return { success: true, error: 'Resend API key not configured. Fallback to mock console logging.' };
  }

  try {
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
      console.error('Resend email delivery failure:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('Email service unexpected error:', err);
    return { success: false, error: err.message ?? String(err) };
  }
}
