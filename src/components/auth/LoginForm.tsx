'use client';

import React, { useState, useRef } from 'react';
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
import { validateEmail, validateRequired } from '@/lib/utils/validation';

import { Turnstile } from '@marsidev/react-turnstile';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turnstileRef = useRef<any>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const errorParam = searchParams.get('error');
  const next = searchParams.get('next');
  const supabase = createClient();

  const emailError = emailTouched ? validateEmail(email) : null;
  const passwordError = passwordTouched ? validateRequired(password, 'Password') : null;

  React.useEffect(() => {
    if (errorParam) {
      setError(errorParam);
    }
  }, [errorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailTouched(true);
    setPasswordTouched(true);

    const emailValidation = validateEmail(email);
    const passwordValidation = validateRequired(password, 'Password');

    if (emailValidation) {
      emailInputRef.current?.focus();
      return;
    }

    if (passwordValidation) {
      passwordInputRef.current?.focus();
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} role="status">
            Account created successfully! Please sign in.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert">
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
        </Stack>

        <AuthDivider label="Or continue with email" />

        <Box component="form" onSubmit={handleLogin} noValidate>
          <InputField
            id="login-email"
            inputRef={emailInputRef}
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailTouched) setEmailTouched(true);
            }}
            onBlur={() => setEmailTouched(true)}
            error={!!emailError}
            helperText={emailError}
            required
            autoComplete="email"
            slotProps={{
              htmlInput: {
                'aria-invalid': !!emailError,
                'aria-describedby': emailError ? 'login-email-helper-text' : undefined,
              }
            }}
          />

          <PasswordField
            id="login-password"
            inputRef={passwordInputRef}
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordTouched) setPasswordTouched(true);
            }}
            onBlur={() => setPasswordTouched(true)}
            error={!!passwordError}
            helperText={passwordError}
            required
            sx={{ mb: 1 }}
            autoComplete="current-password"
            slotProps={{
              htmlInput: {
                'aria-invalid': !!passwordError,
                'aria-describedby': passwordError ? 'login-password-helper-text' : undefined,
              }
            }}
          />

          <Box sx={{ textAlign: 'right', mb: 3 }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: '#818cf8' }}
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
                  theme: 'dark',
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
