'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { isWithinRadius } from '@/lib/utils/distance';
import { resolveDay, isValidTimezone } from '@/lib/attendance/day';
import { getSession, getEffectiveRole } from '@/lib/session';
import { getCachedSiteSettings } from '@/lib/cache';
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
 *
 * Validation checks (active session and location radius) execute concurrently
 * to minimize latency.
 */
export async function clockIn(params: ClockActionParams = {}): Promise<ClockInResult> {
  const { user, profile } = await getSession();
  if (!user) return { error: 'Unauthorized' };

  const effectiveRole = getEffectiveRole(profile);
  if (effectiveRole !== 'ojt') {
    return { error: 'Only OJTs can clock in/out.' };
  }

  const now = new Date();
  let date: string;
  try {
    date = resolveDay(now, params.timezone ?? '').date;
  } catch {
    return { error: 'Your timezone could not be determined. Please enable timezone access and try again.' };
  }

  const admin = await createAdminClient();

  // Execute active session check and location resolution in parallel
  const [activeRowsResult, loc] = await Promise.all([
    admin
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', date)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1),
    resolveLocation(profile?.org_id, params),
  ]);

  if (activeRowsResult.data && activeRowsResult.data.length > 0) {
    return { error: 'You are already clocked in. Please clock out of your active session first.' };
  }

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
 *
 * Record lookup and location resolution run concurrently.
 */
export async function clockOut(params: ClockOutParams = {}): Promise<ClockInResult> {
  const { user, profile } = await getSession();
  if (!user) return { error: 'Unauthorized' };

  const effectiveRole = getEffectiveRole(profile);
  if (effectiveRole !== 'ojt') {
    return { error: 'Only OJTs can clock in/out.' };
  }

  const admin = await createAdminClient();

  // Single-query active record fetch running concurrently with location resolution
  const recordPromise = params.attendanceId
    ? admin
        .from('attendance')
        .select('id, user_id, clock_out')
        .eq('id', params.attendanceId)
        .maybeSingle()
    : admin
        .from('attendance')
        .select('id, user_id, clock_out')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

  const [recordResult, loc] = await Promise.all([
    recordPromise,
    resolveLocation(profile?.org_id, params),
  ]);

  const record = recordResult.data;
  if (!record) {
    return { error: params.attendanceId ? 'Attendance record not found.' : 'No active clock-in session found.' };
  }
  if (record.user_id !== user.id) return { error: 'Forbidden' };
  if (record.clock_out) return { error: 'You have already clocked out.' };

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
    .eq('id', record.id)
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
 * Leverages cached site settings to eliminate database round trips.
 */
async function resolveLocation(
  orgId: string | null | undefined,
  params: ClockActionParams
): Promise<ResolvedLocation> {
  if (!orgId) return { latitude: params.latitude ?? null, longitude: params.longitude ?? null, distance: null };

  const settings = await getCachedSiteSettings(orgId);

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
