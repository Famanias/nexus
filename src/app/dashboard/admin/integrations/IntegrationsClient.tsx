'use client';

// ============================================================
// Admin Integrations Dashboard Client Component
// ============================================================

import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, Grid, CircularProgress, Switch, Chip, Tooltip, IconButton, InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Hub as IntegrationIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getOrgIntegrations, saveOrgIntegration, OrgIntegrationData } from '@/actions/integrations';
import { IntegrationProvider } from '@/lib/integrations/validation';

export default function IntegrationsClient({
  initialIntegrations = [],
}: {
  initialIntegrations?: OrgIntegrationData[];
}) {
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Record<string, OrgIntegrationData>>(() => {
    const map: Record<string, OrgIntegrationData> = {};
    for (const item of initialIntegrations) {
      map[item.provider] = item;
    }
    return map;
  });
  const [formState, setFormState] = useState<Record<string, { enabled: boolean; urlInput: string; showUrl: boolean }>>(() => {
    const state: Record<string, { enabled: boolean; urlInput: string; showUrl: boolean }> = {
      slack: { enabled: false, urlInput: '', showUrl: false },
      discord: { enabled: false, urlInput: '', showUrl: false },
    };
    for (const item of initialIntegrations) {
      state[item.provider] = {
        enabled: item.enabled,
        urlInput: item.maskedWebhookUrl,
        showUrl: false,
      };
    }
    return state;
  });
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    setStatusMsg(null);
    const res = await getOrgIntegrations();
    if (res.error) {
      setStatusMsg({ type: 'error', message: res.error });
    } else if (res.data) {
      const map: Record<string, OrgIntegrationData> = {};
      const newForm: Record<string, { enabled: boolean; urlInput: string; showUrl: boolean }> = {
        slack: { enabled: false, urlInput: '', showUrl: false },
        discord: { enabled: false, urlInput: '', showUrl: false },
      };

      for (const item of res.data) {
        map[item.provider] = item;
        newForm[item.provider] = {
          enabled: item.enabled,
          urlInput: item.maskedWebhookUrl,
          showUrl: false,
        };
      }

      setIntegrations(map);
      setFormState(newForm);
    }
    setLoading(false);
  };

  const handleToggle = (provider: IntegrationProvider) => {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: !prev[provider]?.enabled,
      },
    }));
  };

  const handleUrlChange = (provider: IntegrationProvider, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        urlInput: value,
      },
    }));
  };

  const handleSave = async (provider: IntegrationProvider) => {
    setSavingProvider(provider);
    setStatusMsg(null);
    const state = formState[provider];

    // Only pass webhookUrl if user edited it (not masked string)
    const isMasked = state.urlInput.includes('••••');
    const webhookUrlToSave = isMasked ? undefined : state.urlInput;

    const res = await saveOrgIntegration({
      provider,
      enabled: state.enabled,
      webhookUrl: webhookUrlToSave,
    });

    if (res.error) {
      setStatusMsg({ type: 'error', message: res.error });
    } else {
      setStatusMsg({ type: 'success', message: `${provider.toUpperCase()} integration saved successfully!` });
      await fetchIntegrations();
    }
    setSavingProvider(null);
  };

  const handleTest = async (provider: IntegrationProvider) => {
    setTestingProvider(provider);
    setStatusMsg(null);

    const state = formState[provider];
    const isMasked = state.urlInput.includes('••••');
    const webhookUrl = isMasked ? undefined : state.urlInput;

    try {
      const res = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, webhookUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', message: data.error || 'Failed to send test notification.' });
      } else {
        setStatusMsg({ type: 'success', message: `Test alert sent successfully to ${provider.toUpperCase()}!` });
        await fetchIntegrations();
      }
    } catch (e) {
      setStatusMsg({ type: 'error', message: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderIntegrationCard = (provider: IntegrationProvider, name: string, icon: string, description: string) => {
    const existing = integrations[provider];
    const state = formState[provider] || { enabled: false, urlInput: '', showUrl: false };
    const isSaving = savingProvider === provider;
    const isTesting = testingProvider === provider;

    return (
      <Grid size={{ xs: 12, md: 6 }} key={provider}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ flexGrow: 1, p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h4" component="span">{icon}</Typography>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {description}
                  </Typography>
                </Box>
              </Box>

              <Switch
                checked={state.enabled}
                onChange={() => handleToggle(provider)}
                color="primary"
              />
            </Box>

            {existing?.lastStatus && (
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  size="small"
                  icon={existing.lastStatus === 'success' ? <SuccessIcon fontSize="small" /> : <ErrorIcon fontSize="small" />}
                  label={existing.lastStatus === 'success' ? 'Healthy' : 'Error'}
                  color={existing.lastStatus === 'success' ? 'success' : 'error'}
                  variant="outlined"
                />
                {existing.lastTestedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Last tested: {new Date(existing.lastTestedAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
            )}

            {existing?.lastError && (
              <Alert severity="error" sx={{ mb: 2, py: 0.5, fontSize: '0.75rem' }}>
                {existing.lastError}
              </Alert>
            )}

            <TextField
              fullWidth
              size="small"
              label={`${name} Webhook URL`}
              type={state.showUrl ? 'text' : 'password'}
              value={state.urlInput}
              onChange={(e) => handleUrlChange(provider, e.target.value)}
              placeholder={provider === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://discord.com/api/webhooks/...'}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          [provider]: { ...prev[provider], showUrl: !prev[provider]?.showUrl },
                        }))
                      }
                    >
                      {state.showUrl ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={isTesting ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
                disabled={isTesting || !state.urlInput}
                onClick={() => handleTest(provider)}
              >
                Send Test Alert
              </Button>

              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
                disabled={isSaving}
                onClick={() => handleSave(provider)}
              >
                Save
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IntegrationIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Organization Webhook Integrations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure real-time Slack and Discord alerts for your organization&apos;s tasks, attendance, and reports.
            </Typography>
          </Box>
        </Box>

        <Tooltip title="Refresh Integrations">
          <IconButton onClick={fetchIntegrations}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {statusMsg && (
        <Alert severity={statusMsg.type} sx={{ mb: 3 }} onClose={() => setStatusMsg(null)}>
          {statusMsg.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {renderIntegrationCard(
          'slack',
          'Slack Integrations',
          '💬',
          'Receive automatic updates in your team Slack channels when events occur.'
        )}

        {renderIntegrationCard(
          'discord',
          'Discord Integrations',
          '🎮',
          'Post automated event updates to specified Discord server text channels.'
        )}
      </Grid>
    </Box>
  );
}
