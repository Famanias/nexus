'use client';

import React, { useState } from 'react';
import { Box, Alert, Stack, Typography, Button } from '@mui/material';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

import AuthPageShell from './AuthPageShell';
import AuthCard from './AuthCard';
import InputField from './InputField';
import PrimaryButton from './PrimaryButton';
import AuthFooter from './AuthFooter';
import { Turnstile } from '@marsidev/react-turnstile';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turnstileRef = React.useRef<any>(null);
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);

    const options: { redirectTo: string; captchaToken?: string } = {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    };

    if (captchaToken) {
      options.captchaToken = captchaToken;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      options
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <AuthPageShell>
      <AuthCard
        title="Forgot your password?"
        subtitle="Enter your email address and we'll send you a password reset link."
      >
        {success ? (
          <Stack spacing={3}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              <strong>Password reset email sent.</strong>
              <br />
              If an account exists with that email, you&apos;ll receive a password reset link shortly.
            </Alert>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Please check your inbox (and spam folder) for the reset link.
            </Typography>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <Button variant="contained" fullWidth size="large" sx={{ py: 1.5, fontSize: 16 }}>
                Return to Login
              </Button>
            </Link>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleResetPassword}>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <InputField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 3 }}
            />

            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', minHeight: '65px' }}>
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => {
                    setCaptchaToken(null);
                    setError('CAPTCHA verification expired. Please verify again.');
                  }}
                  onError={() => {
                    setCaptchaToken(null);
                    setError('CAPTCHA verification failed. Please try again.');
                  }}
                  options={{
                    theme: 'light',
                  }}
                />
              ) : (
                <Typography color="error" variant="body2" sx={{ alignSelf: 'center', textAlign: 'center' }}>
                  CAPTCHA configuration error: Turnstile Site Key is missing.
                </Typography>
              )}
            </Box>

            <PrimaryButton loading={loading}>Send Reset Link</PrimaryButton>

            <Link href="/login" style={{ textDecoration: 'none', display: 'block', marginTop: '12px' }}>
              <Button variant="outlined" fullWidth size="large" sx={{ py: 1.5, fontSize: 16 }}>
                Back to Login
              </Button>
            </Link>
          </Box>
        )}

        <AuthFooter promptText="Remembered your password?" linkText="Log In" href="/login" />

        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          textAlign="center"
          mt={3}
        >
          © {new Date().getFullYear()} Nexus. All rights reserved.
        </Typography>
      </AuthCard>
    </AuthPageShell>
  );
}
