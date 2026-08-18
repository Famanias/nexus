'use client';

import React from 'react';
import { Box, Grid, Typography, Alert, Button } from '@mui/material';
import {
  AccessTime as ClockIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendIcon,
  Task as TaskIcon,
} from '@mui/icons-material';
import { useAttendance } from '@/lib/hooks/useAttendance';
import ClockButton from '@/components/attendance/ClockButton';
import HoursProgress from '@/components/attendance/HoursProgress';
import StatCard from '@/components/shared/StatCard';
import { formatHours } from '@/lib/utils/format';
import { Profile, Attendance, AttendanceSummary } from '@/types';
import { useRouter } from 'next/navigation';

interface Props {
  profile: Profile;
  initialTodayRecord?: Attendance | null;
  initialTodayRecords?: Attendance[];
  initialSummary: AttendanceSummary;
}

export default function OJTClient({
  profile,
  initialTodayRecord = null,
  initialTodayRecords = [],
  initialSummary,
}: Props) {
  // useAttendance still provides refresh / real-time updates after clock in/out
  const { todayRecord, todayRecords, summary, refresh } = useAttendance(profile.id);
  const router = useRouter();

  // Use initial data if the hook hasn't loaded yet
  const displayRecords = todayRecords.length > 0 ? todayRecords : initialTodayRecords;
  const displayRecord = todayRecord ?? initialTodayRecord;
  const displaySummary = summary ?? initialSummary;

  return (
    <Box sx={{ p: 3 }}>
      {/* Org setup banner */}
      {!profile.org_id && (
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
          You are currently using the application in Personal Mode. Set up or join an organization to collaborate with your team.
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} color="text.primary">
          Welcome back, {profile.full_name?.split(' ')[0]}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your attendance and monitor your OJT progress.
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Total Days"
            value={displaySummary.total_days}
            subtitle="Days rendered"
            icon={<CalendarIcon />}
            color="#6366f1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Total Hours"
            value={formatHours(displaySummary.total_hours)}
            subtitle="Hours logged"
            icon={<ClockIcon />}
            color="#f59e0b"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Required Hours"
            value={formatHours(displaySummary.required_hours)}
            subtitle="Total requirement"
            icon={<TrendIcon />}
            color="#22c55e"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Completion"
            value={`${displaySummary.completion_percentage.toFixed(1)}%`}
            subtitle="OJT progress"
            icon={<TaskIcon />}
            color={displaySummary.completion_percentage >= 100 ? '#22c55e' : '#6366f1'}
          />
        </Grid>
      </Grid>

      {/* Clock + Progress */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <ClockButton
            userId={profile.id}
            todayRecord={displayRecord}
            todayRecords={displayRecords}
            onSuccess={refresh}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <HoursProgress summary={displaySummary} />
        </Grid>
      </Grid>
    </Box>
  );
}
