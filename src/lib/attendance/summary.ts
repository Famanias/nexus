import type { AttendanceSummary, Profile } from '@/types';
import { isOjt } from '@/lib/attendance/eligibility';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Attendance-summary module.
 *
 * Owns the single hours-progress computation for an OJT — total days,
 * total hours, required hours, remaining hours, completion percentage.
 * Supervisors and admins (by effective role) carry no requirement: their
 * summary is null.
 */

/**
 * Completion percentage: min(100, total / required × 100), shared by
 * dashboards and reports. Returns 0 when required is missing or zero.
 */
export function completionPercent(total: number, required: number): number {
  if (required <= 0) return 0;
  return Math.min(100, (total / required) * 100);
}

export interface AttendanceSummaryInput {
  rows: { total_hours?: number | null; date?: string }[];
  requiredHours: number;
  role?: string | null;
  systemRole?: string | null;
}

/**
 * Compute an OJT's attendance summary in-memory. Returns null for non-OJT roles
 * (by effective role, `system_role ?? role`).
 */
export function computeAttendanceSummary({
  rows,
  requiredHours,
  role,
  systemRole,
}: AttendanceSummaryInput): AttendanceSummary | null {
  if (!isOjt(role, systemRole)) return null;
  const totalHours = rows.reduce((acc, row) => acc + (row.total_hours ?? 0), 0);
  const dates = rows.map((r) => r.date).filter(Boolean);
  const totalDays = dates.length > 0 ? new Set(dates).size : rows.length;

  return {
    total_days: totalDays,
    total_hours: totalHours,
    required_hours: requiredHours,
    remaining_hours: Math.max(0, requiredHours - totalHours),
    completion_percentage: completionPercent(totalHours, requiredHours),
  };
}

/**
 * Fetches an OJT's attendance summary directly from the database using the
 * `get_attendance_summary` RPC, avoiding downloading raw attendance rows.
 */
export async function getAttendanceSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  userId: string,
  profile?: Profile | null
): Promise<AttendanceSummary | null> {
  if (profile && !isOjt(profile.role, profile.system_role)) {
    return null;
  }

  const requiredHours = profile?.required_hours ?? 600;

  try {
    const { data, error } = await supabase.rpc('get_attendance_summary', {
      target_user_id: userId,
    });

    if (!error && data && data.length > 0) {
      const row = data[0];
      const totalHours = Number(row.total_hours ?? 0);
      const totalDays = Number(row.total_days ?? 0);

      return {
        total_days: totalDays,
        total_hours: totalHours,
        required_hours: requiredHours,
        remaining_hours: Math.max(0, requiredHours - totalHours),
        completion_percentage: completionPercent(totalHours, requiredHours),
      };
    }
  } catch {
    // Fallback to table query if RPC is unavailable in current environment
  }

  // Fallback query
  const { data: rows } = await supabase
    .from('attendance')
    .select('total_hours, date')
    .eq('user_id', userId)
    .not('total_hours', 'is', null);

  return computeAttendanceSummary({
    rows: rows ?? [],
    requiredHours,
    role: profile?.role ?? 'ojt',
    systemRole: profile?.system_role,
  });
}

export interface AggregatedUserSummary {
  total_hours: number;
  total_days: number;
}

/**
 * Fetches aggregated attendance summaries for all active OJTs in an organization (or all if null)
 * using the `get_attendance_summaries` RPC.
 */
export async function getAttendanceSummaries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  orgId?: string | null
): Promise<Map<string, AggregatedUserSummary>> {
  const summaryMap = new Map<string, AggregatedUserSummary>();

  try {
    const { data, error } = await supabase.rpc('get_attendance_summaries', {
      target_org_id: orgId || null,
    });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        summaryMap.set(row.user_id, {
          total_hours: Number(row.total_hours ?? 0),
          total_days: Number(row.total_days ?? 0),
        });
      }
      return summaryMap;
    }
  } catch {
    // Fallback if RPC unavailable
  }

  // Fallback table query
  const { data: allAtt } = await supabase
    .from('attendance')
    .select('user_id, total_hours, date')
    .not('total_hours', 'is', null);

  if (Array.isArray(allAtt)) {
    const userDatesMap = new Map<string, Set<string>>();
    for (const record of allAtt) {
      const uid = record.user_id;
      if (!summaryMap.has(uid)) {
        summaryMap.set(uid, { total_hours: 0, total_days: 0 });
        userDatesMap.set(uid, new Set<string>());
      }
      const item = summaryMap.get(uid)!;
      item.total_hours += record.total_hours ?? 0;
      if (record.date) {
        userDatesMap.get(uid)!.add(record.date);
      }
    }
    for (const [uid, dateSet] of userDatesMap.entries()) {
      const item = summaryMap.get(uid);
      if (item) {
        item.total_days = dateSet.size;
      }
    }
  }

  return summaryMap;
}