'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Alert, Typography, Tabs, Tab, Chip,
  InputAdornment, CircularProgress, Link, Button
} from '@mui/material';
import {
  Business as OrgIcon,
  VpnKey as InviteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import AuthPageShell from '@/components/auth/AuthPageShell';
import AuthCard from '@/components/auth/AuthCard';
import InputField from '@/components/auth/InputField';
import PrimaryButton from '@/components/auth/PrimaryButton';

interface OnboardingClientProps {
  fullName: string;
  email: string;
}

interface InviteVerifyResult {
  valid: boolean;
  orgName?: string;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export default function OnboardingClient({ fullName, email }: OnboardingClientProps) {
  const [tab, setTab] = useState<0 | 1>(0); // 0 = create org, 1 = join org
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<InviteVerifyResult | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 1. Check for cookie-based registration intent
  useEffect(() => {
    const rawIntent = getCookie('nexus_register_intent');
    if (rawIntent) {
      try {
        const intent = JSON.parse(decodeURIComponent(rawIntent));
        // Clear the cookie immediately
        document.cookie = 'nexus_register_intent=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax; Secure';
        
        if (intent.action === 'create' && intent.orgName) {
          executeAutoOnboard('create', intent.orgName);
        } else if (intent.action === 'join' && intent.inviteCode) {
          executeAutoOnboard('join', undefined, intent.inviteCode);
        }
      } catch (err) {
        console.error('Error parsing registration intent cookie:', err);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeAutoOnboard = async (action: 'create' | 'join', autoOrgName?: string, autoInviteCode?: string) => {
    setAutoLoading(true);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          orgName: autoOrgName,
          inviteCode: autoInviteCode,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Onboarding failed.');
      }

      await supabase.auth.refreshSession();
      router.refresh();
      router.push(`/dashboard/${json.role}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'An error occurred during automatic onboarding. Please try manually below.');
      setAutoLoading(false);
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 0 && !orgName.trim()) {
      setError('Please enter an organization name.');
      return;
    }
    if (tab === 1 && (!inviteCode.trim() || !inviteValid?.valid)) {
      setError('Please enter a valid invite code.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: tab === 0 ? 'create' : 'join',
          orgName: tab === 0 ? orgName.trim() : undefined,
          inviteCode: tab === 1 ? inviteCode.trim().toUpperCase() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Onboarding failed.');
      }

      await supabase.auth.refreshSession();
      router.refresh();
      router.push(`/dashboard/${json.role}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to complete onboarding. Please try again.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  if (autoLoading) {
    return (
      <AuthPageShell>
        <AuthCard title="Setting up your account..." subtitle="Please wait while we configure your workspace.">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 3 }}>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary">
              Provisioning organization settings and workspace components...
            </Typography>
          </Box>
        </AuthCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthCard
        title="Complete Setup"
        subtitle={`Welcome, ${fullName || email}! Choose how you want to configure your Nexus workspace.`}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
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
              sx={{ mb: 3 }}
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
              <Box sx={{ mb: 3, minHeight: 24 }}>
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

          <PrimaryButton loading={loading}>
            {tab === 0 ? 'Create Workspace & Continue' : 'Join Workspace & Continue'}
          </PrimaryButton>
        </Box>

        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
          sx={{
            mt: 2,
            py: 1.5,
            fontSize: 16,
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            borderColor: 'divider',
            color: 'text.primary',
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'text.primary',
            }
          }}
        >
          Continue in Personal Mode
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Link
            component="button"
            onClick={handleSignOut}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              fontSize: 14,
              fontWeight: 600,
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { color: 'error.main' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 16 }} />
            Sign Out
          </Link>
        </Box>
      </AuthCard>
    </AuthPageShell>
  );
}
