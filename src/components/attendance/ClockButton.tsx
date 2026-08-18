'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Alert, Chip,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as ClockInIcon,
  Stop as ClockOutIcon,
  LocationOn as LocationIcon,
  LocationOff as LocationOffIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useLocation } from '@/lib/hooks/useLocation';
import { getClientTimezone } from '@/lib/attendance/day';
import { createClient } from '@/lib/supabase/client';
import { formatTime, formatHours } from '@/lib/utils/format';
import { Attendance, SiteSettings } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/lib/context/AuthContext';
import { emitClientEvent } from '@/lib/automation/client-emitter';
import { clockIn, clockOut } from '@/actions/attendance';

interface Props {
  userId: string;
  todayRecord?: Attendance | null;
  todayRecords?: Attendance[];
  onSuccess: () => void;
}

export default function ClockButton({ userId, todayRecord, todayRecords, onSuccess }: Props) {
  const { location, getLocation } = useLocation();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const { profile } = useAuth();
  const isPersonalMode = !profile?.org_id;
  const supabase = createClient();

  const records = todayRecords && todayRecords.length > 0
    ? todayRecords
    : (todayRecord ? [todayRecord] : []);

  const activeRecord = records.find((r) => !r.clock_out) ?? (todayRecord && !todayRecord.clock_out ? todayRecord : null);
  const isClockedIn = !!activeRecord;
  const completedTodaySessions = records.filter((r) => !!r.clock_out);
  const totalTodayHours = completedTodaySessions.reduce((acc, r) => acc + (r.total_hours ?? 0), 0);

  // Update clock every second
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch site settings
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSiteSettings(data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClockAction = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    const isLocationRequired = isPersonalMode ? false : (siteSettings?.require_location_verification ?? true);
    let lat: number | null = null;
    let lng: number | null = null;

    if (isLocationRequired) {
      // Get current location
      const loc = await getLocation();

      if (loc.error || loc.latitude === null || loc.longitude === null) {
        setError(loc.error ?? 'Could not retrieve your location. Please enable GPS.');
        setLoading(false);
        return;
      }

      lat = loc.latitude;
      lng = loc.longitude;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const timezone = getClientTimezone();

    if (!isClockedIn) {
      // CLOCK IN
      const result = await clockIn({ latitude: lat, longitude: lng, timezone });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Successfully clocked in! Have a productive session.');
        // Emit attendance.clocked_in event
        emitClientEvent('attendance.clocked_in', {
          userId,
          clockIn: result.data?.clock_in,
          date: today,
          latitude: lat,
          longitude: lng,
        });
        onSuccess();
      }
    } else {
      // CLOCK OUT
      const result = await clockOut({
        attendanceId: activeRecord?.id,
        latitude: lat,
        longitude: lng,
        timezone,
      });

      if (result.error) {
        setError(result.error);
      } else {
        const sessionHours = result.data?.total_hours ?? 0;
        setSuccess(
          `Successfully clocked out! You logged ${formatHours(sessionHours)} in this session.`
        );
        // Emit attendance.clocked_out event
        emitClientEvent('attendance.clocked_out', {
          attendanceId: activeRecord?.id,
          userId,
          clockIn: activeRecord?.clock_in!,
          clockOut: result.data?.clock_out,
          totalHours: sessionHours,
          date: today,
        });
        onSuccess();
      }
    }

    setLoading(false);
  };

  const locationStatus = () => {
    if (location.loading) return { label: 'Getting location...', color: 'default' as const, icon: <LocationIcon /> };
    if (location.error) return { label: 'Location unavailable', color: 'error' as const, icon: <LocationOffIcon /> };
    if (location.latitude) return { label: 'Location acquired', color: 'success' as const, icon: <LocationIcon /> };
    return { label: 'Click to get location', color: 'default' as const, icon: <LocationIcon /> };
  };

  const locStatus = locationStatus();

  return (
    <Card sx={{ overflow: 'hidden' }}>
      {/* Header Banner */}
      <Box
        sx={{
          background: isClockedIn
            ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          py: 4,
          textAlign: 'center',
          transition: 'background 0.5s ease',
        }}
      >
        <Typography variant="h2" fontWeight={800} color="#fff" letterSpacing={2}>
          {mounted && currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}
        </Typography>
        <Typography variant="body1" color="rgba(255,255,255,0.7)">
          {mounted && currentTime ? format(currentTime, 'EEEE, MMMM dd, yyyy') : 'Loading...'}
        </Typography>
        {isClockedIn ? (
          <Chip
            label="● Currently Clocked In"
            sx={{ mt: 1.5, bgcolor: 'rgba(255,255,255,0.2)', color: '#6ee7b7', border: 'none', fontWeight: 600 }}
          />
        ) : completedTodaySessions.length > 0 ? (
          <Chip
            label={`✓ Clocked Out (${completedTodaySessions.length} session${completedTodaySessions.length > 1 ? 's' : ''} today)`}
            sx={{ mt: 1.5, bgcolor: 'rgba(255,255,255,0.15)', color: '#e0e7ff', border: 'none' }}
          />
        ) : null}
      </Box>

      <CardContent sx={{ p: 3 }}>
        {/* Today's sessions breakdown */}
        {records.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Today&apos;s Sessions ({records.length})
              </Typography>
              {totalTodayHours > 0 && (
                <Typography variant="caption" fontWeight={700} color="primary.main">
                  Total Today: {formatHours(totalTodayHours)}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {records.map((rec, idx) => {
                const isActive = !rec.clock_out;
                return (
                  <Box
                    key={rec.id || idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: isActive ? 'rgba(16, 185, 129, 0.08)' : 'action.hover',
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(16, 185, 129, 0.3)' : 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        label={`#${idx + 1}`}
                        size="small"
                        sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {rec.clock_in ? formatTime(rec.clock_in) : '—'}
                          {' → '}
                          {rec.clock_out ? formatTime(rec.clock_out) : 'In Progress'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      {rec.clock_out ? (
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {rec.total_hours ? formatHours(rec.total_hours) : '—'}
                        </Typography>
                      ) : (
                        <Chip label="Active" color="success" size="small" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} icon={<WarningIcon />}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} icon={<CheckIcon />}>
            {success}
          </Alert>
        )}

        {/* Location chip */}
        {siteSettings && !isPersonalMode && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {siteSettings.require_location_verification ? (
              <>
                <Chip
                  icon={locStatus.icon}
                  label={locStatus.label}
                  color={locStatus.color}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                  Required within {siteSettings.radius_meters}m of {siteSettings.site_name}
                </Typography>
              </>
            ) : (
              <Chip
                icon={<LocationIcon />}
                label="Location Not Required"
                color="success"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        )}

        {/* Personal Mode chip */}
        {isPersonalMode && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<LocationIcon />}
              label="Personal Mode (GPS Bypass)"
              color="info"
              size="small"
              variant="outlined"
            />
          </Box>
        )}

        {/* Clock button — Always available to toggle between Clock In and Clock Out */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleClockAction}
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : isClockedIn ? (
              <ClockOutIcon />
            ) : (
              <ClockInIcon />
            )
          }
          sx={{
            py: 1.5,
            fontSize: 16,
            fontWeight: 700,
            bgcolor: isClockedIn ? '#dc2626' : '#6366f1',
            '&:hover': { bgcolor: isClockedIn ? '#b91c1c' : '#4338ca' },
            borderRadius: 2,
          }}
        >
          {loading ? 'Processing...' : isClockedIn ? 'Clock Out' : (completedTodaySessions.length > 0 ? 'Clock In Again' : 'Clock In')}
        </Button>
      </CardContent>
    </Card>
  );
}
