# OJT Tracker Context

An on-the-job training tracker: OJTs clock in/out, accrue hours toward a required target, and work tasks on a kanban board under supervisors and admins.

## Language

**OJT**:
A trainee performing on-the-job training. The only role that clocks in/out and accrues attendance hours.
_Avoid_: trainee (when role-specific), intern

**Supervisor**:
A role that monitors OJTs' attendance and tasks. Does not clock in/out and carries no required hours.
_Avoid_: monitor, mentor

**Admin**:
A system role that manages organizations, users, and settings. Like a supervisor, it does not clock in/out and carries no required hours.
_Avoid_: system admin (when the role type is meant)

**Effective role**:
The role that governs dashboard routing and eligibility: `system_role ?? role`. An OJT promoted to admin is an admin for routing and eligibility.
_Avoid_: role (when the override matters)

**Attendance day**:
The calendar day an attendance row is bucketed by (`yyyy-MM-dd`). Determined by the clocking OJT's computer timezone, resolved by the server from its own clock plus the client's timezone signal so clients cannot choose their bucket.
_Avoid_: today, date (when referring to the bucketing concept)

**Clock event**:
A clock-in or clock-out performed by an OJT, recorded with the server's authoritative timestamp.
_Avoid_: attendance record (that is the row, not the act)

**Clock eligibility**:
The rule that only OJTs — by effective role — may clock in or out. Enforced at the clock actions, at the database, and by dashboard routing.
_Avoid_: attendance permission, can clock

**Attendance summary**:
The hours progress computed for an OJT: total days, total hours, required hours, remaining hours, completion percentage. It is undefined — null — for supervisors and admins.
_Avoid_: hours summary, OJT progress

**Required hours**:
The OJT's hours target (`profiles.required_hours`, default 600). Supervisors and admins do not carry a requirement; their value is 0.
_Avoid_: hours requirement, quota

**Completion percentage**:
`min(100, totalHours / requiredHours × 100)`. The single formula shared by dashboards and reports.
_Avoid_: progress percent (when the formula is meant)