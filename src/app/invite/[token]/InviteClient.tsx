'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Card, CardContent, Divider, Stack } from '@mui/material';
import { CheckCircle as SuccessIcon, Error as ErrorIcon, Group as OrgIcon, Person as PersonIcon, Security as RoleIcon, ExitToApp as SignOutIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AuthPageShell from '@/components/auth/AuthPageShell';
import AuthCard from '@/components/auth/AuthCard';
import PrimaryButton from '@/components/auth/PrimaryButton';
import { Invitation } from '@/types';

interface InviteClientProps {
  token: string;
  invitation: Invitation & { organization: { name: string } };
  userEmail: string | null;
  inviterName: string;
}

export default function InviteClient({ token, invitation, userEmail, inviterName }: InviteClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const isExpired = new Date(invitation.expires_at) < new Date();

  // 1. Determine error states
  let initialError: string | null = null;
  if (invitation.status === 'accepted') {
    initialError = 'This invitation has already been accepted.';
  } else if (invitation.status === 'revoked') {
    initialError = 'This invitation has been revoked by the administrator.';
  } else if (invitation.status === 'expired' || isExpired) {
    initialError = 'This invitation has expired.';
  }

  // 2. Automatically accept invitation if logged in with matching email
  useEffect(() => {
    if (initialError || !userEmail) return;

    // Check email match
    if (userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      return; // Handled in UI below
    }

    const autoAccept = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to accept invitation.');
        }

        setSuccess(true);
        // Wait 1.5s then redirect to dashboard
        setTimeout(() => {
          router.push(`/dashboard/${json.role}`);
          router.refresh();
        }, 1500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'An error occurred while accepting the invitation.');
        setLoading(false);
      }
    };

    autoAccept();
  }, [token, userEmail, invitation.email, initialError, router]);

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.refresh();
    setLoading(false);
  };

  // If there's an active DB status error, show the error state UI
  if (initialError) {
    return (
      <AuthPageShell>
        <AuthCard title="Invitation Invalid" subtitle="We were unable to process this invitation.">
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3, borderRadius: 3 }}>
            {initialError}
          </Alert>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => router.push('/')}
            sx={{ borderRadius: 2.5, textTransform: 'none', py: 1.2, fontWeight: 600 }}
          >
            Go to Homepage
          </Button>
        </AuthCard>
      </AuthPageShell>
    );
  }

  // If logged in with matching email, show processing state
  if (userEmail && userEmail.toLowerCase() === invitation.email.toLowerCase()) {
    return (
      <AuthPageShell>
        <AuthCard title="Joining Organization" subtitle="Please wait while we set up your account.">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, textAlign: 'center' }}>
            {success ? (
              <>
                <SuccessIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Invitation Accepted!
                </Typography>
                <Typography color="text.secondary">
                  Redirecting to your dashboard...
                </Typography>
              </>
            ) : error ? (
              <>
                <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom color="error">
                  Failed to Join
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  {error}
                </Typography>
                <Button variant="contained" onClick={() => router.refresh()}>
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <CircularProgress size={56} sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Accepting Invitation...
                </Typography>
                <Typography color="text.secondary">
                  Linking your account to <strong>{invitation.organization.name}</strong> as a <strong>{invitation.role.toUpperCase()}</strong>.
                </Typography>
              </>
            )}
          </Box>
        </AuthCard>
      </AuthPageShell>
    );
  }

  // If logged in but email mismatches
  if (userEmail && userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <AuthPageShell>
        <AuthCard title="Email Mismatch" subtitle="The active account does not match the invitation email.">
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Account Email Mismatch
            </Typography>
            This invitation was sent to <strong>{invitation.email}</strong>, but you are currently signed in as <strong>{userEmail}</strong>.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Please sign out of this account and sign in or sign up using the invited email address.
          </Typography>

          <Stack spacing={2}>
            <Button
              variant="contained"
              color="error"
              onClick={handleSignOut}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SignOutIcon />}
              fullWidth
              sx={{ borderRadius: 2.5, textTransform: 'none', py: 1.2, fontWeight: 600 }}
            >
              Sign Out of {userEmail}
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard`)}
              fullWidth
              sx={{ borderRadius: 2.5, textTransform: 'none', py: 1.2, fontWeight: 600 }}
            >
              Go to Dashboard
            </Button>
          </Stack>
        </AuthCard>
      </AuthPageShell>
    );
  }

  // If NOT logged in, show details and login/signup prompts
  return (
    <AuthPageShell>
      <AuthCard
        title={`Join ${invitation.organization.name}`}
        subtitle={`${inviterName} has invited you to join their organization.`}
      >
        <Card variant="outlined" sx={{ mb: 4, borderRadius: 3, bgcolor: '#fafafa', borderColor: '#eaeaea' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
              Invitation Details
            </Typography>

            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <OrgIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Organization</Typography>
                  <Typography variant="body2" fontWeight={600}>{invitation.organization.name}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <RoleIcon sx={{ color: 'warning.main', fontSize: 24 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Assigned Role</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                    {invitation.role}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PersonIcon sx={{ color: 'info.main', fontSize: 24 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Invited By</Typography>
                  <Typography variant="body2" fontWeight={600}>{inviterName}</Typography>
                </Box>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
              This secure invitation was sent to <strong>{invitation.email}</strong>.<br />
              Expires on {new Date(invitation.expires_at).toLocaleDateString()} at {new Date(invitation.expires_at).toLocaleTimeString()}.
            </Typography>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <PrimaryButton
            onClick={() => router.push(`/register?invite_token=${token}`)}
            disabled={loading}
          >
            Create Account to Accept
          </PrimaryButton>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)}
            disabled={loading}
            sx={{ borderRadius: 2.5, textTransform: 'none', py: 1.2, fontWeight: 600 }}
          >
            Log In to Accept
          </Button>
        </Stack>
      </AuthCard>
    </AuthPageShell>
  );
}
