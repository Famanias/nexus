'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Alert, Stack, Typography, Button } from '@mui/material';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import AuthPageShell from './AuthPageShell';
import AuthCard from './AuthCard';
import PasswordField from './PasswordField';
import PrimaryButton from './PrimaryButton';

type StrengthLabel = '' | 'Weak' | 'Medium' | 'Strong';

interface PasswordStrength {
  label: StrengthLabel;
  color: string;
  score: number;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { label: '', color: '', score: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', color: '#dc2626', score };
  if (score === 2) return { label: 'Medium', color: '#d97706', score };
  return { label: 'Strong', color: '#16a34a', score };
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      // 1. Check for 'code' query parameter (PKCE flow)
      const code = searchParams.get('code');

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (mounted) {
              setSessionError(exchangeError.message);
              setSessionValid(false);
              setCheckingSession(false);
            }
            return;
          }
          if (mounted) {
            setSessionValid(true);
            setCheckingSession(false);
          }
          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (mounted) {
            setSessionError(msg || 'Failed to verify reset link.');
            setSessionValid(false);
            setCheckingSession(false);
          }
          return;
        }
      }

      // 2. Check if a session already exists (e.g. exchanged server-side by callback route)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) {
            setSessionValid(true);
            setCheckingSession(false);
          }
          return;
        }
      } catch (err) {
        console.error('Failed to get session:', err);
      }

      // 3. Check for hash parameters (Implicit flow)
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
        setTimeout(async () => {
          const { data: { session: hashSession } } = await supabase.auth.getSession();
          if (mounted) {
            if (hashSession) {
              setSessionValid(true);
            } else {
              setSessionError('This password reset link is invalid or has expired.');
              setSessionValid(false);
            }
            setCheckingSession(false);
          }
        }, 1000);
        return;
      }

      // 4. Fallback: Listen to PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setSessionValid(true);
          setCheckingSession(false);
        }
      });

      const fallbackTimeout = setTimeout(() => {
        if (mounted) {
          setSessionError('This password reset link is invalid or has expired.');
          setSessionValid(false);
          setCheckingSession(false);
        }
      }, 1000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(fallbackTimeout);
      };
    }

    verifySession();

    return () => {
      mounted = false;
    };
  }, [searchParams, supabase]);

  // Handle countdown and redirect on success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      router.push('/login');
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must contain at least one special character.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Success - sign out recovery session and redirect
    await supabase.auth.signOut();
    setSuccess(true);
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <AuthPageShell>
        <AuthCard title="Verifying reset link" subtitle="Please wait while we check your reset link.">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <PrimaryButton disabled>Verifying...</PrimaryButton>
          </Box>
        </AuthCard>
      </AuthPageShell>
    );
  }

  if (!sessionValid) {
    return (
      <AuthPageShell>
        <AuthCard title="Reset Link Invalid" subtitle="Unable to reset password.">
          <Stack spacing={3}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {sessionError || 'This password reset link is invalid or has expired.'}
              <br />
              Please request another password reset email.
            </Alert>
            <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
              <Button variant="contained" fullWidth size="large" sx={{ py: 1.5, fontSize: 16 }}>
                Request New Link
              </Button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <Button variant="outlined" fullWidth size="large" sx={{ py: 1.5, fontSize: 16 }}>
                Back to Login
              </Button>
            </Link>
          </Stack>
        </AuthCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthCard title="Reset your password" subtitle="Set a new password for your Nexus account.">
        {success ? (
          <Stack spacing={3}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              <strong>Password updated successfully.</strong>
              <br />
              You will be redirected to the login page in {countdown} seconds...
            </Alert>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <Button variant="contained" fullWidth size="large" sx={{ py: 1.5, fontSize: 16 }}>
                Return to Login
              </Button>
            </Link>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleUpdatePassword}>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <PasswordField
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helperText="At least 8 characters, with a number and a special character."
            />

            {password && (
              <Box sx={{ mt: 1, mb: 2.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        height: 4,
                        flex: 1,
                        borderRadius: 2,
                        bgcolor: i < passwordStrength.score ? passwordStrength.color : '#e5e7eb',
                        transition: 'background-color 0.2s ease',
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 600 }}>
                  {passwordStrength.label} password
                </Typography>
              </Box>
            )}

            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
            />

            <PrimaryButton loading={loading}>Update Password</PrimaryButton>
          </Box>
        )}
      </AuthCard>
    </AuthPageShell>
  );
}
