'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  Check as CheckSimpleIcon,
  Close as CloseSimpleIcon,
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
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRequired,
} from '@/lib/utils/validation';
import { Turnstile } from '@marsidev/react-turnstile';

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

  if (score <= 1) return { label: 'Weak', color: '#ef4444', score };
  if (score === 2) return { label: 'Medium', color: '#f59e0b', score };
  return { label: 'Strong', color: '#10b981', score };
}

export default function RegisterForm() {
  const [tab, setTab] = useState<0 | 1 | 2>(0); // 0 = create org, 1 = join org, 2 = personal mode
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Touched states for inline validation
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
    orgName: false,
    inviteCode: false,
  });

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<InviteVerifyResult | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Field input refs for focus management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turnstileRef = useRef<any>(null);
  const orgNameRef = useRef<HTMLInputElement>(null);
  const inviteCodeRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const supabase = createClient();

  // Invite Token state
  const inviteToken = searchParams.get('invite_token');
  const [inviteTokenValid, setInviteTokenValid] = useState<boolean | null>(null);
  const [inviteTokenDetails, setInviteTokenDetails] = useState<{ email: string; orgName: string; role: string } | null>(null);
  const [verifyingInviteToken, setVerifyingInviteToken] = useState(false);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  // Real-time error calculations
  const errors = useMemo(() => ({
    firstName: touched.firstName ? validateRequired(firstName, 'First name') : null,
    lastName: touched.lastName ? validateRequired(lastName, 'Last name') : null,
    email: touched.email ? validateEmail(email) : null,
    password: touched.password
      ? (!password ? 'Password is required.' : !passwordValidation.valid ? 'Password does not meet all criteria.' : null)
      : null,
    confirmPassword: touched.confirmPassword
      ? validateConfirmPassword(password, confirmPassword)
      : null,
    orgName: touched.orgName && tab === 0 && !inviteToken ? validateRequired(orgName, 'Organization name') : null,
    inviteCode: touched.inviteCode && tab === 1 && !inviteToken
      ? (!inviteCode.trim() ? 'Invite code is required.' : inviteValid && !inviteValid.valid ? 'Invalid invite code.' : null)
      : null,
  }), [touched, firstName, lastName, email, password, confirmPassword, orgName, inviteCode, tab, inviteToken, passwordValidation, inviteValid]);

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
    setTab(newVal as 0 | 1 | 2);
    setError('');
    setInviteValid(null);
  };

  const markAllTouched = () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
      orgName: true,
      inviteCode: true,
    });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

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
    markAllTouched();

    // Validate in sequence and focus first invalid field
    if (!inviteToken && tab === 0) {
      const orgErr = validateRequired(orgName, 'Organization name');
      if (orgErr) {
        orgNameRef.current?.focus();
        return;
      }
    }

    if (!inviteToken && tab === 1) {
      const codeErr = !inviteCode.trim() ? 'Invite code is required.' : (inviteValid && !inviteValid.valid ? 'Invalid invite code.' : null);
      if (codeErr) {
        inviteCodeRef.current?.focus();
        return;
      }
    }

    const fnErr = validateRequired(firstName, 'First name');
    if (fnErr) {
      firstNameRef.current?.focus();
      return;
    }

    const lnErr = validateRequired(lastName, 'Last name');
    if (lnErr) {
      lastNameRef.current?.focus();
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      emailRef.current?.focus();
      return;
    }

    if (!passwordValidation.valid) {
      passwordRef.current?.focus();
      return;
    }

    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) {
      confirmPasswordRef.current?.focus();
      return;
    }

    if (inviteToken) {
      if (!inviteTokenValid || !inviteTokenDetails) {
        setError('Cannot register: invitation is invalid or expired.');
        return;
      }
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    let payload;
    if (inviteToken) {
      payload = { action: 'accept_invite', inviteToken, fullName, password };
    } else if (tab === 0) {
      payload = { action: 'create', orgName: orgName.trim(), fullName, email: email.trim(), password };
    } else if (tab === 1) {
      payload = { action: 'join', inviteCode: inviteCode.trim().toUpperCase(), fullName, email: email.trim(), password };
    } else {
      payload = { action: 'register_personal', fullName, email: email.trim(), password };
    }

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, captchaToken }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Registration failed. Please try again.');
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
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
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert">
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
          <Box
            sx={{
              mb: 2.5,
              p: 2,
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 3,
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <CheckIcon color="success" />
            <Box>
              <Typography variant="body2" fontWeight={600} color="success.main">
                Accepting Invitation
              </Typography>
              <Typography variant="caption" color="text.secondary">
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
            <Tab label="Personal Mode" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {!inviteToken && tab === 0 && (
            <InputField
              id="register-org-name"
              inputRef={orgNameRef}
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, orgName: true }))}
              error={!!errors.orgName}
              helperText={errors.orgName}
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <OrgIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  'aria-invalid': !!errors.orgName,
                }
              }}
            />
          )}

          {!inviteToken && tab === 1 && (
            <>
              <InputField
                id="register-invite-code"
                inputRef={inviteCodeRef}
                label="Invite Code"
                value={inviteCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setInviteCode(val);
                  setInviteValid(null);
                }}
                onBlur={() => {
                  setTouched(t => ({ ...t, inviteCode: true }));
                  verifyInviteCode(inviteCode);
                }}
                error={!!errors.inviteCode}
                helperText={errors.inviteCode}
                required
                sx={{ mb: 1 }}
                slotProps={{
                  input: {
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
                  },
                  htmlInput: {
                    'aria-invalid': !!errors.inviteCode,
                  }
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
              id="register-first-name"
              inputRef={firstNameRef}
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, firstName: true }))}
              error={!!errors.firstName}
              helperText={errors.firstName}
              required
              autoComplete="given-name"
              slotProps={{
                htmlInput: {
                  'aria-invalid': !!errors.firstName,
                }
              }}
            />
            <InputField
              id="register-last-name"
              inputRef={lastNameRef}
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, lastName: true }))}
              error={!!errors.lastName}
              helperText={errors.lastName}
              required
              autoComplete="family-name"
              slotProps={{
                htmlInput: {
                  'aria-invalid': !!errors.lastName,
                }
              }}
            />
          </Stack>

          <InputField
            id="register-email"
            inputRef={emailRef}
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            error={!!errors.email}
            helperText={errors.email}
            required
            sx={{ mb: 2.5 }}
            autoComplete="email"
            slotProps={{
              input: {
                readOnly: !!inviteToken,
              },
              htmlInput: {
                'aria-invalid': !!errors.email,
              }
            }}
          />

          <PasswordField
            id="register-password"
            inputRef={passwordRef}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, password: true }))}
            error={!!errors.password}
            helperText={errors.password}
            required
            autoComplete="new-password"
            slotProps={{
              htmlInput: {
                'aria-invalid': !!errors.password,
              }
            }}
          />

          {/* Password strength & requirements checklist */}
          {password && (
            <Box sx={{ mt: 1, mb: 2.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 4,
                      flex: 1,
                      borderRadius: 2,
                      bgcolor: i < passwordStrength.score ? passwordStrength.color : 'rgba(255, 255, 255, 0.1)',
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 600, display: 'block', mb: 1 }}>
                {passwordStrength.label} password
              </Typography>
              <Stack spacing={0.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {passwordValidation.hasMinLength ? (
                    <CheckSimpleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <CloseSimpleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                  <Typography variant="caption" color={passwordValidation.hasMinLength ? 'success.main' : 'text.secondary'}>
                    At least 8 characters
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {passwordValidation.hasNumber ? (
                    <CheckSimpleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <CloseSimpleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                  <Typography variant="caption" color={passwordValidation.hasNumber ? 'success.main' : 'text.secondary'}>
                    At least 1 number (0-9)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {passwordValidation.hasSpecialChar ? (
                    <CheckSimpleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <CloseSimpleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                  <Typography variant="caption" color={passwordValidation.hasSpecialChar ? 'success.main' : 'text.secondary'}>
                    At least 1 special character (!@#$%^&*...)
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          <PasswordField
            id="register-confirm-password"
            inputRef={confirmPasswordRef}
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, confirmPassword: true }))}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            required
            sx={{ mb: 3 }}
            autoComplete="new-password"
            slotProps={{
              htmlInput: {
                'aria-invalid': !!errors.confirmPassword,
              }
            }}
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
                  theme: 'dark',
                }}
              />
            ) : (
              <Typography color="error" variant="body2" sx={{ alignSelf: 'center', textAlign: 'center' }}>
                CAPTCHA configuration error: Turnstile Site Key is missing.
              </Typography>
            )}
          </Box>

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