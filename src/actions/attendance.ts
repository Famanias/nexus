'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { isWithinRadius } from '@/lib/utils/distance';
import { resolveDay, isValidTimezone } from '@/lib/attendance/day';
import { getSession, getEffectiveRole } from '@/lib/session';
import type { Attendance } from '@/types';

interface ClockActionParams {
  latitude?: number | null;
  longitude?: number | null;
  /**
   * The clocking OJT's computer timezone (IANA name, e.g. "Asia/Manila",
   * with a UTC/Etc offset fallback). The attendance day is derived by the
   * server from its own clock plus this timezone, so clients cannot choose
   * their bucket date.
   */
  timezone?: string;
}

interface ClockInResult {
  data?: Attendance;
  error?: string;
}

interface ClockOutParams extends ClockActionParams {
  attendanceId?: string;
}

/**
 * Clock-in. Timestamps are always derived from the server clock so
 * clients cannot backdate or forge attendance rows. The attendance day
 * is resolved from the server clock plus the client's timezone.
 */
export async function clockIn(params: ClockActionParams = {}): Promise<ClockInResult> {
  const { user, profile } = await getSession();
  if (!user) return { error: 'Unauthorized' };

  const effectiveRole = getEffectiveRole(profile);
  if (effectiveRole !== 'ojt') {
    return { error: 'Only OJTs can clock in/out.' };
  }

  const admin = await createAdminClient();

  const now = new Date();
  let date: string;
  try {
    date = resolveDay(now, params.timezone ?? '').date;
  } catch {
    return { error: 'Your timezone could not be determined. Please enable timezone access and try again.' };
  }

  // Ensure user is not currently in an active open session for today
  const { data: activeRows } = await admin
    .from('attendance')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1);

  if (activeRows && activeRows.length > 0) {
    return { error: 'You are already clocked in. Please clock out of your active session first.' };
  }

  const loc = await resolveLocation(admin, profile?.org_id, params);
  if (loc.error) return { error: loc.error };

  const { data, error } = await admin
    .from('attendance')
    .insert({
      user_id: user.id,
      clock_in: now.toISOString(),
      date,
      timezone: params.timezone,
      clock_in_latitude: loc.latitude,
      clock_in_longitude: loc.longitude,
      clock_in_distance_meters: loc.distance,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as Attendance };
}

/**
 * Clock-out. The server records the clock-out timestamp and recomputes
 * the total hours via the DB trigger.
 */
export async function clockOut(params: ClockOutParams = {}): Promise<ClockInResult> {
  const { user, profile } = await getSession();
  if (!user) return { error: 'Unauthorized' };

  const effectiveRole = getEffectiveRole(profile);
  if (effectiveRole !== 'ojt') {
    return { error: 'Only OJTs can clock in/out.' };
  }

  const admin = await createAdminClient();

  let targetId = params.attendanceId;
  if (!targetId) {
    const { data: activeRows } = await admin
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);

    if (!activeRows || activeRows.length === 0) {
      return { error: 'No active clock-in session found.' };
    }
    targetId = activeRows[0].id;
  }

  const { data: record } = await admin
    .from('attendance')
    .select('id, user_id, clock_out')
    .eq('id', targetId)
    .single();

  if (!record) return { error: 'Attendance record not found.' };
  if (record.user_id !== user.id) return { error: 'Forbidden' };
  if (record.clock_out) return { error: 'You have already clocked out.' };


  const loc = await resolveLocation(admin, profile?.org_id, params);
  if (loc.error) return { error: loc.error };

  const { data, error } = await admin
    .from('attendance')
    .update({
      clock_out: new Date().toISOString(),
      clock_out_latitude: loc.latitude,
      clock_out_longitude: loc.longitude,
      clock_out_distance_meters: loc.distance,
      ...(params.timezone && isValidTimezone(params.timezone)
        ? { timezone: params.timezone }
        : {}),
    })
    .eq('id', targetId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as Attendance };
}

interface ResolvedLocation {
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  error?: string;
}

/**
 * Enforce the location radius server-side when the org requires it.
 * GPS coordinates are still reported by the client, but the radius check
 * runs against the DB's authoritative site settings so it cannot be
 * bypassed by posting fake coordinates directly to the API.
 */
async function resolveLocation(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string | null | undefined,
  params: ClockActionParams
): Promise<ResolvedLocation> {
  if (!orgId) return { latitude: params.latitude ?? null, longitude: params.longitude ?? null, distance: null };

  const { data: settings } = await admin
    .from('site_settings')
    .select('latitude, longitude, radius_meters, require_location_verification')
    .eq('org_id', orgId)
    .maybeSingle();

  if (!settings?.require_location_verification) {
    return { latitude: params.latitude ?? null, longitude: params.longitude ?? null, distance: null };
  }

  if (params.latitude == null || params.longitude == null) {
    return { latitude: null, longitude: null, distance: null, error: 'Could not retrieve your location. Please enable GPS.' };
  }

  const { allowed, distance } = isWithinRadius(
    params.latitude,
    params.longitude,
    settings.latitude,
    settings.longitude,
    settings.radius_meters
  );

  if (!allowed) {
    return {
      latitude: params.latitude,
      longitude: params.longitude,
      distance: Math.round(distance),
      error: `You are ${Math.round(distance)}m away from the office. ` +
        `You must be within ${settings.radius_meters}m to clock in/out.`,
    };
  }

  return { latitude: params.latitude, longitude: params.longitude, distance: Math.round(distance) };
}
