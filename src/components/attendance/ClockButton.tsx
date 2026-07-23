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
import { createClient } from '@/lib/supabase/client';
import { isWithinRadius } from '@/lib/utils/distance';
import { formatTime, formatHours } from '@/lib/utils/format';
import { Attendance, SiteSettings } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/lib/context/AuthContext';
import { emitClientEvent } from '@/lib/automation/client-emitter';

interface Props {
  userId: string;
  todayRecord: Attendance | null;
  onSuccess: () => void;
}

export default function ClockButton({ userId, todayRecord, onSuccess }: Props) {
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

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;

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
    let distance: number | null = null;

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

      // Verify location for OJT
      if (siteSettings) {
        const { allowed, distance: calculatedDistance } = isWithinRadius(
          lat,
          lng,
          siteSettings.latitude,
          siteSettings.longitude,
          siteSettings.radius_meters
        );

        if (!allowed) {
          setError(
            `You are ${Math.round(calculatedDistance)}m away from the office. ` +
            `You must be within ${siteSettings.radius_meters}m to clock in/out.`
          );
          setLoading(false);
          return;
        }
        distance = Math.round(calculatedDistance);
      }
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    if (!isClockedIn) {
      // CLOCK IN
      if (todayRecord) {
        // Already has a record but both in/out exist — new shift not needed
        setError('You have already completed your attendance for today.');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('attendance').insert({
        user_id: userId,
        clock_in: new Date().toISOString(),
        clock_in_latitude: lat,
        clock_in_longitude: lng,
        clock_in_distance_meters: distance,
        date: today,
      });

      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess('Successfully clocked in! Have a productive day.');
        // Emit attendance.clocked_in event
        emitClientEvent('attendance.clocked_in', {
          userId,
          clockIn: new Date().toISOString(),
          date: today,
          latitude: lat,
          longitude: lng,
        });
        onSuccess();
      }
    } else {
      // CLOCK OUT
      const clockOut = new Date();
      const clockIn = new Date(todayRecord!.clock_in!);
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / 3600000;

      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          clock_out: clockOut.toISOString(),
          clock_out_latitude: lat,
          clock_out_longitude: lng,
          clock_out_distance_meters: distance,
          total_hours: totalHours,
        })
        .eq('id', todayRecord!.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(`Successfully clocked out! You worked ${formatHours(totalHours)} today.`);
        // Emit attendance.clocked_out event
        emitClientEvent('attendance.clocked_out', {
          attendanceId: todayRecord!.id,
          userId,
          clockIn: todayRecord!.clock_in!,
          clockOut: clockOut.toISOString(),
          totalHours,
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
    <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
      {/* Time display */}
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
        {isClockedIn && (
          <Chip
            label="● Currently Clocked In"
            sx={{ mt: 1.5, bgcolor: 'rgba(255,255,255,0.2)', color: '#6ee7b7', border: 'none' }}
          />
        )}
      </Box>

      <CardContent sx={{ p: 3 }}>
        {/* Today's attendance info */}
        {todayRecord && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              mb: 3,
              p: 2,
              bgcolor: '#f8fafc',
              borderRadius: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">Clock In</Typography>
              <Typography variant="body1" fontWeight={600}>
                {todayRecord.clock_in ? formatTime(todayRecord.clock_in) : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Clock Out</Typography>
              <Typography variant="body1" fontWeight={600}>
                {todayRecord.clock_out ? formatTime(todayRecord.clock_out) : '—'}
              </Typography>
            </Box>
            {todayRecord.total_hours && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="caption" color="text.secondary">Total Hours Today</Typography>
                <Typography variant="body1" fontWeight={700} color="primary.main">
                  {formatHours(todayRecord.total_hours)}
                </Typography>
              </Box>
            )}
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

        {/* Clock button */}
        {!todayRecord?.clock_out && (
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
            {loading ? 'Processing...' : isClockedIn ? 'Clock Out' : 'Clock In'}
          </Button>
        )}

        {todayRecord?.clock_out && (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            You have completed your attendance for today. See you tomorrow!
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
