'use client';

import React, { useState } from 'react';
import {
  Box, Alert, Stack, Typography, Tabs, Tab, Chip,
  InputAdornment, CircularProgress,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import {
  Business as OrgIcon,
  VpnKey as InviteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

import AuthPageShell from './AuthPageShell';
import AuthCard from './AuthCard';
import SocialButton from './SocialButton';
import AuthDivider from './AuthDivider';
import InputField from './InputField';
import PasswordField from './PasswordField';
import PrimaryButton from './PrimaryButton';
import AuthFooter from './AuthFooter';

interface InviteVerifyResult {
  valid: boolean;
  orgName?: string;
}

export default function RegisterForm() {
  const [tab, setTab] = useState<0 | 1>(0); // 0 = create org, 1 = join org
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<InviteVerifyResult | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const verifyInviteCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setInviteValid(null);
      return;
    }
    setVerifyingCode(true);
    try {
      const res = await fetch(`/api/organizations/verify/${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      setInviteValid(json);
    } catch {
      setInviteValid(null);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newVal: number) => {
    setTab(newVal as 0 | 1);
    setError('');
    setInviteValid(null);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (tab === 0 && !orgName.trim()) {
      setError('Please enter an organization name.');
      return;
    }
    if (tab === 1 && (!inviteCode.trim() || !inviteValid?.valid)) {
      setError('Please enter a valid invite code.');
      return;
    }

    setLoading(true);

    const payload =
      tab === 0
        ? { action: 'create', orgName: orgName.trim(), fullName, email, password }
        : { action: 'join', inviteCode: inviteCode.trim().toUpperCase(), fullName, email, password };

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    // Sign in immediately after account creation
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !signInData.user) {
      router.push('/login?registered=1');
      return;
    }

    const role = json.role ?? 'ojt';
    router.push(`/dashboard/${role}`);
    router.refresh();
    setLoading(false);
  };

  return (
    <AuthPageShell>
      <AuthCard
        title="Create your Nexus account"
        subtitle="Set up your account to start managing internship workflows."
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={1.5} sx={{ mb: 1 }}>
          <SocialButton icon={<GoogleIcon />} onClick={handleGoogleSignIn}>
            Continue with Google
          </SocialButton>
        </Stack>

        <AuthDivider label="Or continue with email" />

        {/* Organization: create vs join — required by the platform's
            multi-tenant model, kept alongside the requested field layout */}
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Create Organization" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Join with Code" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit}>
          {tab === 0 && (
            <InputField
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <OrgIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {tab === 1 && (
            <>
              <InputField
                label="Invite Code"
                value={inviteCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setInviteCode(val);
                  setInviteValid(null);
                }}
                onBlur={() => verifyInviteCode(inviteCode)}
                required
                sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <InviteIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: verifyingCode ? (
                    <InputAdornment position="end">
                      <CircularProgress size={18} />
                    </InputAdornment>
                  ) : inviteValid !== null ? (
                    <InputAdornment position="end">
                      {inviteValid.valid ? (
                        <CheckIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </InputAdornment>
                  ) : null,
                }}
              />
              <Box sx={{ mb: 2, minHeight: 24 }}>
                {inviteValid?.valid && (
                  <Chip
                    icon={<CheckIcon />}
                    label={`Joining: ${inviteValid.orgName}`}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                )}
                {inviteValid && !inviteValid.valid && (
                  <Typography variant="caption" color="error">
                    Invite code not found. Please check the code and try again.
                  </Typography>
                )}
              </Box>
            </>
          )}

          {/* First / Last name — side-by-side on desktop */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
            <InputField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <InputField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Stack>

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
            helperText="At least 8 characters."
          />

          <PasswordField
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
          />

          <PrimaryButton loading={loading}>Create Account</PrimaryButton>
        </Box>

        <AuthFooter promptText="Already have an account?" linkText="Log In" href="/login" />

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
