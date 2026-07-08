'use client';

import React, { useState, useMemo } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';

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

type StrengthLabel = '' | 'Weak' | 'Medium' | 'Strong';

interface PasswordStrength {
  label: StrengthLabel;
  color: string;
  score: number; // 0-3, number of criteria met
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<InviteVerifyResult | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const supabase = createClient();

  // Invite Token state
  const inviteToken = searchParams.get('invite_token');
  const [inviteTokenValid, setInviteTokenValid] = useState<boolean | null>(null);
  const [inviteTokenDetails, setInviteTokenDetails] = useState<{ email: string; orgName: string; role: string } | null>(null);
  const [verifyingInviteToken, setVerifyingInviteToken] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  React.useEffect(() => {
    if (errorParam) {
      setError(errorParam);
    }
  }, [errorParam]);

  React.useEffect(() => {
    if (!inviteToken) return;

    const verifyToken = async () => {
      setVerifyingInviteToken(true);
      try {
        const res = await fetch(`/api/invitations/verify?token=${encodeURIComponent(inviteToken)}`);
        const json = await res.json();
        if (json.valid) {
          setInviteTokenValid(true);
          setInviteTokenDetails(json);
          setEmail(json.email);
        } else {
          setInviteTokenValid(false);
          setError(json.error ?? 'Invalid or expired invitation link.');
        }
      } catch {
        setInviteTokenValid(false);
        setError('Failed to verify the invitation link.');
      } finally {
        setVerifyingInviteToken(false);
      }
    };

    verifyToken();
  }, [inviteToken]);

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
    setGoogleLoading(true);
    setError('');

    // If they typed details for organization creation or joining, store it in a secure cookie
    // to preserve intent without exposing it in the browser history/query parameters
    const intent: { action?: 'create' | 'join'; orgName?: string; inviteCode?: string } = {};
    if (tab === 0 && orgName.trim()) {
      intent.action = 'create';
      intent.orgName = orgName.trim();
    } else if (tab === 1 && inviteCode.trim() && inviteValid?.valid) {
      intent.action = 'join';
      intent.inviteCode = inviteCode.trim().toUpperCase();
    }

    if (intent.action) {
      document.cookie = `nexus_register_intent=${encodeURIComponent(
        JSON.stringify(intent)
      )}; path=/; max-age=600; SameSite=Lax; Secure`;
    }

    const redirectToUrl = new URL('/auth/callback', window.location.origin);
    if (inviteToken) {
      redirectToUrl.searchParams.set('next', `/invite/${inviteToken}`);
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
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must contain at least one special character.');
      return;
    }

    if (inviteToken) {
      if (!inviteTokenValid || !inviteTokenDetails) {
        setError('Cannot register: invitation is invalid or expired.');
        return;
      }
    } else {
      if (tab === 0 && !orgName.trim()) {
        setError('Please enter an organization name.');
        return;
      }
      if (tab === 1 && (!inviteCode.trim() || !inviteValid?.valid)) {
        setError('Please enter a valid invite code.');
        return;
      }
    }

    setLoading(true);

    let payload;
    if (inviteToken) {
      payload = { action: 'accept_invite', inviteToken, fullName, password };
    } else if (tab === 0) {
      payload = { action: 'create', orgName: orgName.trim(), fullName, email, password };
    } else {
      payload = { action: 'join', inviteCode: inviteCode.trim().toUpperCase(), fullName, email, password };
    }

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
    const signInEmail = (inviteToken && inviteTokenDetails) ? inviteTokenDetails.email : email;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
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

        {verifyingInviteToken && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Verifying invitation details...</Typography>
          </Box>
        )}

        <Stack spacing={1.5} sx={{ mb: 1 }}>
          <SocialButton
            icon={googleLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading || verifyingInviteToken}
          >
            {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
          </SocialButton>
        </Stack>

        <AuthDivider label="Or continue with email" />

        {inviteToken ? (
          <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f0fdf4', borderRadius: 3, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckIcon color="success" />
            <Box>
              <Typography variant="body2" fontWeight={600} color="#166534">
                Accepting Invitation
              </Typography>
              <Typography variant="caption" color="#15803d">
                Joining <strong>{inviteTokenDetails?.orgName ?? 'loading...'}</strong> as a <strong>{inviteTokenDetails?.role.toUpperCase() ?? 'loading...'}</strong>.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Create Organization" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Join with Code" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {!inviteToken && tab === 0 && (
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

          {!inviteToken && tab === 1 && (
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ mb: 2.5 }}>
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
            sx={{ mb: 2.5 }}
            InputProps={{
              readOnly: !!inviteToken,
            }}
          />

          <PasswordField
            label="Password"
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