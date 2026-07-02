'use client';

import React, { useState } from 'react';
import { Box, Alert, Stack, Typography } from '@mui/material';
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

// Integrated with wider (540px) layout to match RegisterForm and improve balance
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const role = profile?.role ?? 'ojt';
      router.push(`/dashboard/${role}`);
      router.refresh();
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
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
          <SocialButton icon={<GoogleIcon />} onClick={handleGoogleSignIn}>
            Continue with Google
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
              style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
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
