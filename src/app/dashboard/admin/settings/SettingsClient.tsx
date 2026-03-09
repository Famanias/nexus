'use client';

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, Grid, InputAdornment, CircularProgress, Divider, Chip, Tooltip, IconButton,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Save as SaveIcon,
  Radar as RadiusIcon,
  Map as MapIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Business as OrgIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { SiteSettings } from '@/types';
import { saveSiteSettings, regenerateInviteCode } from '@/actions/settings';
import { useAuth } from '@/lib/context/AuthContext';

export default function SettingsClient({ initialSettings }: { initialSettings: SiteSettings }) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [form, setForm] = useState({
    site_name: initialSettings.site_name,
    latitude: String(initialSettings.latitude),
    longitude: String(initialSettings.longitude),
    radius_meters: String(initialSettings.radius_meters),
    address: initialSettings.address ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const supabase = createClient();
  const { organization, refreshProfile } = useAuth();

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').limit(1).single();
    if (data) {
      setSettings(data);
      setForm({
        site_name: data.site_name,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        radius_meters: String(data.radius_meters),
        address: data.address ?? '',
      });
    }
  }, []);

  const handleCopyInviteCode = () => {
    if (organization?.invite_code) {
      navigator.clipboard.writeText(organization.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    setError('');
    try {
      const result = await regenerateInviteCode();
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Invite code regenerated successfully!');
        await refreshProfile();
      }
    } finally {
      setRegenerating(false);
    }
  };

  const useCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
        setGettingLocation(false);
      },
      (err) => {
        setError(`Could not get location: ${err.message}`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius_meters);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude values.');
      return;
    }
    if (isNaN(radius) || radius < 50) {
      setError('Radius must be at least 50 meters.');
      return;
    }
    if (!settings) return;
    setSaving(true);
    try {
      const result = await saveSiteSettings({
        id: settings.id,
        site_name: form.site_name,
        latitude: lat,
        longitude: lng,
        radius_meters: radius,
        address: form.address || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Site settings saved successfully!');
        await fetchSettings();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const mapsUrl = form.latitude && form.longitude
    ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=17`
    : null;

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Site Settings</Typography>
        <Typography color="text.secondary">
          Configure the office location and attendance verification radius.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Organization Card */}
      {organization && (
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#6366f120', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                <OrgIcon />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>Organization</Typography>
                <Typography variant="body2" color="text.secondary">
                  Share the invite code with new members to let them join
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                  Organization Name
                </Typography>
                <Typography variant="body1" fontWeight={600}>{organization.name}</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                  Invite Code
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={organization.invite_code}
                    sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, letterSpacing: 2, px: 1 }}
                    color="primary"
                    variant="outlined"
                  />
                  <Tooltip title={copied ? 'Copied!' : 'Copy invite code'}>
                    <IconButton size="small" onClick={handleCopyInviteCode} color={copied ? 'success' : 'default'}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Generate a new invite code (old code will stop working)">
                    <IconButton size="small" onClick={handleRegenerateCode} disabled={regenerating}>
                      {regenerating ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#6366f120', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
              <LocationIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>Office Location</Typography>
              <Typography variant="body2" color="text.secondary">
                Set the exact GPS coordinates of the office/training site
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Site Name"
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Office Address (optional)"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Latitude"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="e.g. 14.5995124"
                InputProps={{
                  startAdornment: <InputAdornment position="start">N</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Longitude"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="e.g. 120.9842195"
                InputProps={{
                  startAdornment: <InputAdornment position="start">E</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={12}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={gettingLocation ? <CircularProgress size={16} /> : <LocationIcon />}
                  onClick={useCurrentLocation}
                  disabled={gettingLocation}
                >
                  Use My Current Location
                </Button>
                {mapsUrl && (
                  <Button
                    variant="outlined"
                    startIcon={<MapIcon />}
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview on Google Maps
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Radius Card */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <RadiusIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>Verification Radius</Typography>
              <Typography variant="body2" color="text.secondary">
                OJTs must be within this distance from the office to clock in/out
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Allowed Radius"
                type="number"
                value={form.radius_meters}
                onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">meters</InputAdornment>,
                  inputProps: { min: 50, max: 5000 },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[50, 100, 150, 200, 500].map((r) => (
                  <Chip
                    key={r}
                    label={`${r}m`}
                    clickable
                    variant={form.radius_meters === String(r) ? 'filled' : 'outlined'}
                    color={form.radius_meters === String(r) ? 'primary' : 'default'}
                    onClick={() => setForm({ ...form, radius_meters: String(r) })}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> Supervisors and System Admins are excluded from location restrictions.
              Only OJTs need to be within the radius to clock in/out.
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        size="large"
        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
        onClick={handleSave}
        disabled={saving}
        sx={{ px: 4 }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </Box>
  );
}
