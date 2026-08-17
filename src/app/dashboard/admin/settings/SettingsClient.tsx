'use client';

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Card, TextField, Button,
  Alert, Grid, InputAdornment, CircularProgress, Divider, Chip, Tooltip, IconButton, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Save as SaveIcon,
  Map as MapIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SiteSettings, Organization, Profile } from '@/types';
import { roleLabel } from '@/lib/utils/format';
import { saveSiteSettings, regenerateInviteCode } from '@/actions/settings';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

function SettingRow({
  label,
  sub,
  children,
  labelColor,
}: {
  label: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  labelColor?: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 2,
        px: 0.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }} color={labelColor ?? 'text.primary'}>
          {label}
        </Typography>
        {sub && (
          <Box sx={{ mt: 0.5, fontSize: 12, color: 'text.secondary' }}>{sub}</Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

export default function SettingsClient({
  initialSettings,
  serverOrganization,
}: {
  initialSettings: SiteSettings;
  serverOrganization: Organization | null;
}) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [form, setForm] = useState({
    site_name: initialSettings.site_name,
    latitude: String(initialSettings.latitude),
    longitude: String(initialSettings.longitude),
    radius_meters: String(initialSettings.radius_meters),
    address: initialSettings.address ?? '',
    require_location_verification: initialSettings.require_location_verification ?? true,
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Leave-organization flow
  const [lastAdminDialogOpen, setLastAdminDialogOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leavingOrg, setLeavingOrg] = useState(false);
  const [eligibleMembers, setEligibleMembers] = useState<Profile[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [promotingAndLeaving, setPromotingAndLeaving] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = createClient();
  const toast = useToast();
  const { organization: authOrg, refreshProfile, profile } = useAuth();
  const organization = authOrg || serverOrganization;
  const router = useRouter();

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
        require_location_verification: data.require_location_verification ?? true,
      });
    }
  }, [supabase]);

  const handleCopyInviteCode = () => {
    if (organization?.invite_code) {
      navigator.clipboard.writeText(organization.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateInviteCode();
      if (result.error) {
        toast.showError(result.error);
      } else {
        toast.showSuccess('Invite code regenerated successfully!');
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
        setDialogError(`Could not get location: ${err.message}`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleToggleGps = async (checked: boolean) => {
    setForm((f) => ({ ...f, require_location_verification: checked }));
    setSaving(true);
    try {
      const result = await saveSiteSettings({
        id: settings.id,
        site_name: form.site_name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_meters: parseInt(form.radius_meters),
        address: form.address || null,
        require_location_verification: checked,
      });
      if (result.error) {
        toast.showError(result.error);
      } else {
        toast.showSuccess(checked ? 'GPS verification enabled.' : 'GPS verification disabled.');
        await fetchSettings();
      }
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDialog = async () => {
    setDialogError('');
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius_meters);

    if (isNaN(lat) || isNaN(lng)) {
      setDialogError('Please enter valid latitude and longitude values.');
      return;
    }
    if (isNaN(radius) || radius < 50) {
      setDialogError('Radius must be at least 50 meters.');
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
        require_location_verification: form.require_location_verification,
      });

      if (result.error) {
        setDialogError(result.error);
      } else {
        toast.showSuccess('Site settings saved successfully!');
        setEditDialogOpen(false);
        await fetchSettings();
      }
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveOrg = async () => {
    if (!profile?.org_id) return;

    try {
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('role', 'admin');

      if (adminsError) {
        toast.showError('Failed to verify organization administrators.');
        return;
      }

      if (profile.role === 'admin' && (!admins || admins.length <= 1)) {
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('org_id', profile.org_id)
          .neq('role', 'admin')
          .eq('is_active', true);

        if (membersError) {
          toast.showError('Failed to retrieve eligible members for promotion.');
          return;
        }

        setEligibleMembers(members ?? []);
        setSelectedMemberId('');
        setPromotionError('');
        setLastAdminDialogOpen(true);
        return;
      }

      setLeaveConfirmOpen(true);
    } catch (err) {
      console.error(err);
      toast.showError('An unexpected error occurred.');
    }
  };

  const executeLeaveOrg = async () => {
    setLeavingOrg(true);
    try {
      const res = await fetch('/api/organizations/leave', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        toast.showError(json.error ?? 'Failed to leave organization.');
      } else {
        toast.showSuccess('Left organization successfully.');
        setLeaveConfirmOpen(false);
        await supabase.auth.refreshSession();
        router.refresh();
        router.push(`/dashboard/${profile?.role}`);
      }
    } catch (err) {
      console.error(err);
      toast.showError('An unexpected error occurred.');
    } finally {
      setLeavingOrg(false);
    }
  };

  const handlePromoteAndLeave = async () => {
    if (!selectedMemberId) {
      setPromotionError('Please select a member to promote.');
      return;
    }

    setPromotingAndLeaving(true);
    setPromotionError('');

    try {
      const { error: promoteError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', selectedMemberId);

      if (promoteError) {
        setPromotionError(`Promotion failed: ${promoteError.message}`);
        setPromotingAndLeaving(false);
        return;
      }

      const res = await fetch('/api/organizations/leave', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        const originalRole = eligibleMembers.find(m => m.id === selectedMemberId)?.role || 'ojt';
        await supabase
          .from('profiles')
          .update({ role: originalRole })
          .eq('id', selectedMemberId);

        setPromotionError(json.error ?? 'Failed to leave organization after promotion.');
        setPromotingAndLeaving(false);
      } else {
        setLastAdminDialogOpen(false);
        toast.showSuccess('Admin promoted and organization left successfully.');
        await supabase.auth.refreshSession();
        router.refresh();
        router.push(`/dashboard/${profile?.role}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPromotionError(msg || 'An unexpected error occurred.');
      setPromotingAndLeaving(false);
    }
  };

  const mapsUrl = form.latitude && form.longitude
    ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=17`
    : null;

  const officeLocationText = form.address
    ? `${form.address} (${form.latitude}, ${form.longitude})`
    : `${form.latitude}, ${form.longitude}`;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={800}>Settings</Typography>
          <Typography color="text.secondary">
            Organization and attendance configuration.
          </Typography>
        </Box>

        {/* Settings card */}
        <Card sx={{ p: '8px 20px' }}>
          <SettingRow label="Organization name" sub={organization?.name} />
          <Divider sx={{ borderColor: 'divider' }} />
          <SettingRow
            label="Invite code"
            sub={(
              <Box
                component="span"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1,
                  py: 0.25,
                }}
              >
                {organization?.invite_code}
              </Box>
            )}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
          </SettingRow>
          <Divider sx={{ borderColor: 'divider' }} />
          <SettingRow
            label="Attendance GPS verification"
            sub="Require users to be within the office to clock in."
          >
            <Switch
              checked={form.require_location_verification}
              onChange={(e) => handleToggleGps(e.target.checked)}
              disabled={saving}
              color="primary"
            />
          </SettingRow>
          <Divider sx={{ borderColor: 'divider' }} />
          <SettingRow
            label="Office location"
            sub={officeLocationText}
          >
            <Tooltip title="Edit office location">
              <IconButton size="small" onClick={() => { setDialogError(''); setEditDialogOpen(true); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </SettingRow>
          <Divider sx={{ borderColor: 'divider' }} />
          <SettingRow
            label="GPS verification radius"
            sub={`${form.radius_meters} meters from the office location`}
          >
            <Tooltip title="Edit verification radius">
              <IconButton size="small" onClick={() => { setDialogError(''); setEditDialogOpen(true); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </SettingRow>
        </Card>

        {/* Danger zone */}
        <Box
          sx={{
            mt: 3,
            bgcolor: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 2,
            p: '8px 20px',
          }}
        >
          <SettingRow
            label="Leave organization"
            sub={`You'll lose access to ${organization?.name ?? 'the organization'}'s data. This can't be undone.`}
            labelColor="error.light"
          >
            <Button
              variant="outlined"
              color="error"
              onClick={handleLeaveOrg}
              sx={{ fontSize: 12, borderColor: 'rgba(239, 68, 68, 0.4)', whiteSpace: 'nowrap' }}
            >
              Leave organization
            </Button>
          </SettingRow>
        </Box>
      </Box>

      {/* Edit office location / radius dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !saving && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2, fontWeight: 700, fontSize: '1.25rem' }}>
          Office Location &amp; Verification Radius
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}

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
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveDialog}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Last Admin Leave Dialog */}
      <Dialog
        open={lastAdminDialogOpen}
        onClose={() => !promotingAndLeaving && setLastAdminDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2, fontWeight: 700, fontSize: '1.25rem' }}>
          Promote Administrator Before Leaving
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {promotionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {promotionError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
            Every organization must have at least one administrator. Since you are the only remaining administrator of this organization, you must promote another member to administrator before you can leave.
          </Typography>

          {eligibleMembers.length === 0 ? (
            <Alert severity="warning">
              There are no other active members in this organization to promote. You cannot leave until you invite and onboard another member.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search members by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <FormControl fullWidth>
                <InputLabel id="promote-member-label">Select Member *</InputLabel>
                <Select
                  labelId="promote-member-label"
                  value={selectedMemberId}
                  label="Select Member *"
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  {eligibleMembers
                    .filter(m =>
                      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" fontWeight={600}>{member.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {member.email} • Role: {roleLabel(member.role)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button
            onClick={() => setLastAdminDialogOpen(false)}
            disabled={promotingAndLeaving}
            color="inherit"
          >
            Cancel
          </Button>
          {eligibleMembers.length > 0 && (
            <Button
              variant="contained"
              onClick={handlePromoteAndLeave}
              disabled={!selectedMemberId || promotingAndLeaving}
              startIcon={promotingAndLeaving ? <CircularProgress size={18} color="inherit" /> : null}
              color="error"
            >
              Promote &amp; Leave
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave Organization"
        content="Are you sure you want to leave your organization? You will lose access to all organization-specific features and data."
        confirmText="Leave Organization"
        confirmColor="error"
        loading={leavingOrg}
        onConfirm={executeLeaveOrg}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </Box>
  );
}