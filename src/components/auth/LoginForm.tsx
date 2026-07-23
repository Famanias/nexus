'use client';

import React, { useState } from 'react';
import { Box, Alert, Stack, Typography, CircularProgress } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import AuthPageShell from './AuthPageShell';
import AuthCard from './AuthCard';
import SocialButton from './SocialButton';
import AuthDivider from './AuthDivider';
import InputField from './InputField';
import PasswordField from './PasswordField';
import PrimaryButton from './PrimaryButton';
import AuthFooter from './AuthFooter';

import { Turnstile } from '@marsidev/react-turnstile';

// Integrated with wider (540px) layout to match RegisterForm and improve balance
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turnstileRef = React.useRef<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const errorParam = searchParams.get('error');
  const next = searchParams.get('next');
  const supabase = createClient();

  React.useEffect(() => {
    if (errorParam) {
      setError(errorParam);
    }
  }, [errorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

      const role = profile?.role ?? 'ojt';
      router.push(next || `/dashboard/${role}`);
      router.refresh();
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    const redirectToUrl = new URL('/auth/callback', window.location.origin);
    if (next) {
      redirectToUrl.searchParams.set('next', next);
    }

    const { error: oAuthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectToUrl.toString() },
    });

    if (oAuthError) {
      setError(oAuthError.message);
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard title="Welcome back" subtitle="Sign in to continue to Nexus.">
        {registered && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            Account created successfully! Please sign in.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={1.5} sx={{ mb: 1 }}>
          <SocialButton
            icon={googleLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
          </SocialButton>
          {/* Add more providers here, e.g.:
              <SocialButton icon={<GitHubIcon />} onClick={handleGitHubSignIn}>
                Continue with GitHub
              </SocialButton> */}
        </Stack>

        <AuthDivider label="Or continue with email" />

        <Box component="form" onSubmit={handleLogin}>
          <InputField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <PasswordField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 1 }}
          />

          <Box sx={{ textAlign: 'right', mb: 3 }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: '#6366f1' }}
            >
              Forgot password?
            </Link>
          </Box>

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

          <PrimaryButton loading={loading}>Sign In</PrimaryButton>
        </Box>

        <AuthFooter promptText="Don't have an account?" linkText="Create one" href="/register" />

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
