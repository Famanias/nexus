'use client';

import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress, Tabs, Tab, Chip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  AccessTime as ClockIcon,
  Business as OrgIcon,
  VpnKey as InviteIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface InviteVerifyResult {
  valid: boolean;
  orgName?: string;
}

export default function RegisterForm() {
  const [tab, setTab] = useState<0 | 1>(0); // 0 = create org, 1 = join org
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Account was created; direct them to login
      router.push('/login?registered=1');
      return;
    }

    const role = json.role ?? 'ojt';
    router.push(`/dashboard/${role}`);
    router.refresh();
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 460 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              bgcolor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: 3,
              mb: 2,
            }}
          >
            <ClockIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} color="#fff">
            OJT Tracker
          </Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.7)" mt={0.5}>
            Create or join an organization to get started
          </Typography>
        </Box>

        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid #e2e8f0',
              '& .MuiTab-root': { py: 2, fontWeight: 600, fontSize: 13 },
            }}
          >
            <Tab label="Create Organization" />
            <Tab label="Join with Code" />
          </Tabs>

          <CardContent sx={{ p: 4 }}>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {tab === 0
                ? "Start a new organization — you'll be the system admin."
                : 'Join an existing organization using an invite code.'}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {/* Organization Name (Create tab) */}
              {tab === 0 && (
                <TextField
                  fullWidth
                  label="Organization Name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OrgIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              {/* Invite Code (Join tab) */}
              {tab === 1 && (
                <>
                  <TextField
                    fullWidth
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
                          <InviteIcon color="action" />
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
                  {inviteValid !== null && (
                    <Box sx={{ mb: 2 }}>
                      {inviteValid.valid ? (
                        <Chip
                          icon={<CheckIcon />}
                          label={`Joining: ${inviteValid.orgName}`}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="error">
                          Invite code not found. Please check the code and try again.
                        </Typography>
                      )}
                    </Box>
                  )}
                  {inviteValid === null && <Box sx={{ mb: 2 }} />}
                </>
              )}

              {/* Full Name */}
              <TextField
                fullWidth
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Email */}
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Password */}
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Confirm Password */}
              <TextField
                fullWidth
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ py: 1.5, fontSize: 16 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : tab === 0 ? (
                  'Create Organization & Register'
                ) : (
                  'Join Organization & Register'
                )}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link
                  href="/login"
                  style={{ color: '#4338ca', fontWeight: 600, textDecoration: 'none' }}
                >
                  Sign In
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Typography
          variant="caption"
          color="rgba(255,255,255,0.5)"
          textAlign="center"
          display="block"
          mt={3}
        >
          © {new Date().getFullYear()} OJT Tracker System. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
