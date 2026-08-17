'use client';

import React from 'react';
import {
  Box, Grid, Typography, Alert, Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  AccessTime as ClockIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import StatCard from '@/components/shared/StatCard';
import { formatHours } from '@/lib/utils/format';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';

interface AdminStats {
  total_ojts: number;
  total_supervisors: number;
  present_today: number;
  total_hours_all: number;
}

interface Props {
  stats: AdminStats;
}

export default function AdminDashboardClient({ stats }: Props) {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <Box sx={{ p: 3 }}>
      {/* Org setup banner */}
      {profile && !profile.org_id && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
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
    </Box>
  );
}
