import type { AttendanceSummary } from '@/types';
import { isOjt } from '@/lib/attendance/eligibility';

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
  rows: { total_hours?: number | null }[];
  requiredHours: number;
  role?: string | null;
  systemRole?: string | null;
}

/**
 * Compute an OJT's attendance summary. Returns null for non-OJT roles
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
  return {
    total_days: rows.length,
    total_hours: totalHours,
    required_hours: requiredHours,
    remaining_hours: Math.max(0, requiredHours - totalHours),
    completion_percentage: completionPercent(totalHours, requiredHours),
  };
}