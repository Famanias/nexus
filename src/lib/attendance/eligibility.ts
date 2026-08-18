/**
 * Clock-eligibility module.
 *
 * Owns "who may clock in/out": only OJTs, by effective role
 * (`system_role ?? role`). An OJT promoted to supervisor or admin loses
 * clock eligibility; supervisors and admins never clock. Enforced at the
 * clock actions, in RLS, and by dashboard routing.
 */

/**
 * Whether a user may clock in/out under the effective role
 * (`system_role ?? role`). Returns false when the role is unknown.
 */
export function isOjt(role?: string | null, systemRole?: string | null): boolean {
  return (systemRole ?? role) === 'ojt';
}