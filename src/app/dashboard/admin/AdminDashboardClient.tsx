'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import {
  Box, Grid, Typography, Card,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Autocomplete, TextField, Alert, Tooltip, CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  AccessTime as ClockIcon,
  TrendingUp as TrendIcon,
  Edit as EditIcon,
  PublicOutlined as GlobeIcon,
} from '@mui/icons-material';
import StatCard from '@/components/shared/StatCard';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import { formatHours } from '@/lib/utils/format';
import { Attendance, Profile } from '@/types';
import { saveTimezone } from '@/actions/settings';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';

// Build a list of all IANA timezone names
const ALL_TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return [
      'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
      'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
      'America/Noronha', 'Atlantic/Azores', 'UTC', 'Europe/London', 'Europe/Paris',
      'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
      'Asia/Dhaka', 'Asia/Rangoon', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Manila',
      'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Adelaide', 'Australia/Sydney',
      'Pacific/Auckland', 'Pacific/Tongatapu',
    ];
  }
})();

interface AdminStats {
  total_ojts: number;
  total_supervisors: number;
  present_today: number;
  total_hours_all: number;
}

interface Props {
  stats: AdminStats;
  initialAttendance: (Attendance & { profile?: Profile })[];
  settingsId: string;
  initialTimezone: string;
}

function formatInTz(d: Date, tz: string) {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(d);
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, timeZoneName: 'shortOffset',
  }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  return { date, time, offset };
}

const subscribe = () => () => {};

export default function AdminDashboardClient({ stats, initialAttendance, settingsId, initialTimezone }: Props) {
  const [now, setNow] = useState(new Date());
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingTz, setPendingTz] = useState(timezone);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { date, time, offset } = formatInTz(now, timezone);

  const handleOpenDialog = () => {
    setPendingTz(timezone);
    setSaveError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!pendingTz) return;
    setSaving(true);
    setSaveError('');
    const result = await saveTimezone(settingsId, pendingTz);
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setTimezone(pendingTz);
      setDialogOpen(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Org setup banner */}
      {profile && !profile.org_id && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            borderRadius: 3,
            bgcolor: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: 'text.primary',
            '& .MuiAlert-icon': { color: 'primary.main' }
          }}
          action={
            <Button
              color="primary"
              size="small"
              onClick={() => router.push('/onboarding')}
              sx={{ fontWeight: 600, textTransform: 'none' }}
            >
              Set Up Now
            </Button>
          }
        >
          You are currently using the application in Personal Mode. Set up or join an organization to start managing OJT trainee workflows.
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Admin Dashboard</Typography>
          <Typography color="text.secondary">System Overview</Typography>
        </Box>

        {/* Live Clock + Timezone */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 2, px: 2.5, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 2,
            bgcolor: '#f8fafc', borderColor: '#e2e8f0',
          }}
        >
          <GlobeIcon sx={{ color: '#6366f1', flexShrink: 0 }} />
          <Box>
            <Typography variant="body1" fontWeight={800} sx={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
              {mounted ? time : '--:--:--'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
              {mounted ? date : 'Loading...'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600, display: 'block' }}>
              {mounted ? `${timezone}  ${offset}` : timezone}
            </Typography>
          </Box>
          <Tooltip title="Edit Timezone">
            <IconButton size="small" onClick={handleOpenDialog} sx={{ color: '#94a3b8', '&:hover': { color: '#6366f1' } }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Card>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total OJTs" value={stats.total_ojts} subtitle="Active trainees" icon={<PeopleIcon />} color="#6366f1" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Supervisors" value={stats.total_supervisors} subtitle="Active supervisors" icon={<PeopleIcon />} color="#f59e0b" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Present Today" value={stats.present_today} subtitle="Clocked in today" icon={<ClockIcon />} color="#22c55e" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard title="Total Hours" value={formatHours(stats.total_hours_all)} subtitle="All time (all OJTs)" icon={<TrendIcon />} color="#ec4899" />
        </Grid>
      </Grid>

      {/* All Attendance */}
      <AttendanceTable showUser={true} initialRecords={initialAttendance} />

      {/* Timezone Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Timezone</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the timezone used across the system for attendance and reports.
          </Typography>
          <Autocomplete
            options={ALL_TIMEZONES}
            value={pendingTz}
            onChange={(_, v) => { if (v) setPendingTz(v); }}
            renderInput={(params) => (
              <TextField {...params} label="Timezone" size="small" autoFocus />
            )}
            fullWidth
            disableClearable
            getOptionLabel={(tz) => {
              try {
                const off = new Intl.DateTimeFormat('en-US', {
                  timeZone: tz, timeZoneName: 'shortOffset',
                }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
                return `${tz}  (${off})`;
              } catch {
                return tz;
              }
            }}
            isOptionEqualToValue={(a, b) => a === b}
          />
          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !pendingTz}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
