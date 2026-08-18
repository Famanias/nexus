# Walkthrough — Nexus UI/UX Architectural Improvements

All four architectural UI/UX improvements identified in the design audit have been implemented, tested, and verified across the codebase.

---

## 1. Accomplishments & Changes Summary

### Phase 1: Toast & Confirmation Dialog System (C3 / M1)
- **Eliminated all native `alert()` and `confirm()` calls** across the entire codebase.
- Created [ToastContext.tsx](file:///d:/repos/ojt-tracker/src/lib/context/ToastContext.tsx) providing `useToast()` hook (`showSuccess`, `showError`, `showWarning`, `showInfo`) rendering accessible MUI `<Snackbar>` and `<Alert>` with `role="alert"` (for errors/warnings) and `role="status"` (for success/info).
- Created [ConfirmDialog.tsx](file:///d:/repos/ojt-tracker/src/components/shared/ConfirmDialog.tsx) for accessible, non-blocking confirmation flows.
- Integrated `<ToastProvider>` at the root level in [layout.tsx](file:///d:/repos/ojt-tracker/src/app/layout.tsx).
- Refactored 13+ sites across:
  - [Sidebar.tsx](file:///d:/repos/ojt-tracker/src/components/shared/Sidebar.tsx) (Leave organization & admin promotion flows)
  - [UsersClient.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/admin/users/UsersClient.tsx) (Invitations send, resend, revoke, and user editing)
  - [AutomationLogsClient.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/admin/automation/AutomationLogsClient.tsx) (Replay and discard dead-letter events)
  - [KanbanBoard.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/KanbanBoard.tsx) (Column deletion and task movement error recovery)
  - [KanbanTask.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/KanbanTask.tsx) (Mark task complete)
  - [FinishedTasksDrawer.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/FinishedTasksDrawer.tsx) (Task reopen flow)

---

### Phase 2: Proper Dark Mode in MUI & Design System Tokens (H1 / M3)
- Configured `palette.mode: 'dark'` in [MuiThemeProvider.tsx](file:///d:/repos/ojt-tracker/src/components/shared/MuiThemeProvider.tsx) with tailored dark neutral surfaces (`#09090b` default background, `#121215` paper background, indigo `#6366f1` accent, `#27272a` dividers, `#f4f4f5` primary text, and `#a1a1aa` secondary text).
- Cleaned up [globals.css](file:///d:/repos/ojt-tracker/src/app/globals.css) to retire `!important` cascade hacks, allowing MUI `CssBaseline` to deterministically manage theme surfaces and contrast.
- Tokenized [Sidebar.tsx](file:///d:/repos/ojt-tracker/src/components/shared/Sidebar.tsx), [FinishedTasksDrawer.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/FinishedTasksDrawer.tsx), and [AutomationLogsClient.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/admin/automation/AutomationLogsClient.tsx) to use MUI theme palette tokens instead of hardcoded hex values.

---

### Phase 3: Form Validation UX & Field Accessibility (H5)
- Created [validation.ts](file:///d:/repos/ojt-tracker/src/lib/utils/validation.ts) with pure validation rules for email formatting, password criteria, confirm password equality, and required field constraints.
- Updated [LoginForm.tsx](file:///d:/repos/ojt-tracker/src/components/auth/LoginForm.tsx):
  - Field-level touched tracking and inline validation on blur.
  - Automatic focus movement to the first invalid field upon submit.
  - Connected `aria-invalid` and `aria-describedby` attributes.
- Updated [RegisterForm.tsx](file:///d:/repos/ojt-tracker/src/components/auth/RegisterForm.tsx):
  - Real-time password strength checklist indicating fulfilled requirements (minimum 8 characters, at least 1 number, at least 1 special character).
  - Inline error feedback per field on blur and upon submit.
  - Automatic focus management moving to the first failing input.

---

### Phase 4: Accessible Kanban Drag & Drop (C2 — WCAG Blocker)
- In [KanbanBoard.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/KanbanBoard.tsx):
  - Registered `KeyboardSensor` with `sortableKeyboardCoordinates` in `useSensors`.
  - Added accessibility screen reader announcements (`onDragStart`, `onDragOver`, `onDragEnd`, `onDragCancel`) on `DndContext`.
  - Added programmatic move handlers `handleMoveTaskProgrammatic`, `handleMoveTaskDirection`, and `handleMoveColumn`.
- In [KanbanTask.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/KanbanTask.tsx):
  - Added `aria-roledescription="sortable task"`.
  - In the task card context menu, added "Move Up", "Move Down", and "Move to [Column Name]" single-pointer / keyboard menu actions.
- In [KanbanColumn.tsx](file:///d:/repos/ojt-tracker/src/components/kanban/KanbanColumn.tsx):
  - Added `aria-roledescription="sortable column"`.
  - In the column context menu, added "Move Left" and "Move Right" options for column reordering without dragging.

---

## 2. Verification & Test Results

### Automated Tests
1. **Vitest Unit Test Suite**:
   ```
   ✓ src/__tests__/unit/validation.test.ts (8 tests)
   ✓ src/__tests__/unit/toast.test.tsx (4 tests)
   ✓ src/__tests__/unit/confirm-dialog.test.tsx (3 tests)
   ✓ src/__tests__/unit/components.test.tsx (3 tests)
   ✓ src/__tests__/unit/helpers.test.ts (11 tests)
   ✓ src/__tests__/unit/rate-limit.test.ts (4 tests)
   ✓ src/__tests__/unit/redis.test.ts (2 tests)
   ✓ src/__tests__/unit/security.test.ts (8 tests)
   ✓ src/__tests__/unit/encryption.test.ts (7 tests)
   ✓ src/__tests__/unit/automation.test.ts (7 tests)

   Test Files  10 passed (10)
        Tests  57 passed (57)
   ```

2. **TypeScript Compilation (`tsc --noEmit`)**:
   - Exit code 0 (zero errors).

3. **ESLint (`eslint src/`)**:
   - Exit code 0 (zero lint errors or warnings).

4. **Next.js Production Build (`next build`)**:
   - Exit code 0 (compiled and built successfully).

---

# Attendance Clock Seam — Architecture Deepening (3 Phases)

Deepening the attendance/clock cluster per the architecture review: an attendance-day module (server-authoritative timezone bucketing), clock eligibility (OJT-only), and a shared attendance summary module.

## Phase 1: Attendance-day module (timezone-aware clock)

### Implementation summary
- New `src/lib/attendance/day.ts` — the attendance-day module:
  - `isValidTimezone(tz)` — validates an IANA (or UTC/Etc) timezone via `Intl`.
  - `resolveDay(now, timezone)` — resolves the attendance day (`yyyy-MM-dd`) for a server clock instant in the client's timezone. Throws `TypeError` on invalid timezone.
  - `getClientTimezone()` — the browser's IANA timezone, with whole-hour `Etc/GMT` offset fallback.
  - `formatTimeInZone(iso, timezone)` — renders an instant as the OJT's local clock time (e.g. "08:30 AM").
- `src/actions/attendance.ts`:
  - `ClockActionParams.date` removed, replaced with `timezone`.
  - `clockIn` derives the bucket date from the **server clock** + client timezone (`resolveDay`), falling back to an error (not UTC) when the timezone is missing/invalid. Inserts the `timezone` on the row.
  - `clockOut` records the validated `timezone` on the row (no re-bucketing).
- `src/types/index.ts` — `Attendance` gains `timezone?: string`.
- `supabase/schema.sql` — `attendance.timezone text` column (in `CREATE TABLE` + idempotent `ALTER`).
- `src/components/attendance/ClockButton.tsx` — sends `getClientTimezone()` to the actions instead of a client-computed date.
- `src/components/attendance/AttendanceTable.tsx` — renders clock times in the OJT's stored timezone (`formatTimeInZone`), falling back to viewer-local for pre-migration rows; CSV export matches.
- `src/app/dashboard/supervisor/SupervisorClient.tsx` — "Today" column renders the OJT's local clock-in time.

### Files changed
- `src/lib/attendance/day.ts` (new)
- `src/actions/attendance.ts`
- `src/types/index.ts`
- `supabase/schema.sql`
- `src/components/attendance/ClockButton.tsx`
- `src/components/attendance/AttendanceTable.tsx`
- `src/app/dashboard/supervisor/SupervisorClient.tsx`
- `src/__tests__/unit/attendance-day.test.ts` (new)

### Automated verification
- `npx vitest run src/__tests__/unit/attendance-day.test.ts` — 6/6 passed.
- `npm test` — 11 files, 70/70 passed.
- `npx tsc --noEmit` — 0 errors.
- `npm run lint` — 0 errors (3 pre-existing warnings in untouched files).

### Manual QA
1. Apply the schema change to your Supabase instance (run the new `alter table attendance add column if not exists timezone text;`).
2. As an OJT, open `/dashboard/ojt` and clock in. Verify the success message appears and the button flips to "Clock Out" immediately (this is the day-bucket consistency fix).
3. Clock out. Verify the "You worked X today" message appears.
4. In the `attendance` table, verify the new row has a `timezone` set to your browser's IANA name (e.g. `Asia/Manila`), `clock_in`/`clock_out` stored in UTC, and `date` matching your local day.
5. With a second user in a different timezone (or by temporarily changing your OS timezone), have them clock in, then view `/dashboard/attendance` as a supervisor and confirm their clock-in shows in *their* local time (not your viewer's).
6. Temporarily set your browser's timezone to something 12+ hours ahead and clock in — verify the `date` column matches that timezone's calendar day.

### Expected results / pass criteria
- Clock-in always lands in the OJT's local calendar day regardless of server timezone; no UTC-midnight mis-bucketing (the button flip matches the stored row).
- The attendance row records the OJT's timezone; supervisors see OJT-local clock times.
- No regression in the full test suite, typecheck, or lint.

**NOT validated until the manual QA above is performed.**

---

## Phase 2: Clock eligibility (OJT-only)

### Implementation summary
- New `src/lib/attendance/eligibility.ts` — the clock-eligibility module:
  - `isOjt(role, systemRole)` — whether a user may clock in/out under the **effective role** (`system_role ?? role`). An OJT promoted to supervisor/admin loses eligibility; supervisors/admins never clock.
- `src/actions/attendance.ts`:
  - `clockIn`/`clockOut` now select `role, system_role` on the caller's profile and reject non-OJTs with `Only OJTs can clock in/out.` (the actions write via the service-role admin client, so RLS does not protect them — the check lives in the action).
- `supabase/schema.sql`:
  - `profiles` gains the idempotent `system_role user_role` column (matches the role-enum migration) so fresh installs are self-consistent.
  - Attendance insert/update policies narrowed from `auth.uid() = user_id` to also require `coalesce(system_role, role) = 'ojt'` against `profiles` — closing direct anon writes for supervisors/admins. Admin org-level update policy is unchanged.
- `src/app/dashboard/ojt/page.tsx` — route guard: missing profile redirects to `/login`; non-OJT effective role redirects to that role's dashboard.

### Files changed
- `src/lib/attendance/eligibility.ts` (new)
- `src/actions/attendance.ts`
- `supabase/schema.sql`
- `src/app/dashboard/ojt/page.tsx`
- `src/__tests__/unit/eligibility.test.ts` (new)

### Automated verification
- `npx vitest run src/__tests__/unit/eligibility.test.ts` — 4/4 passed (effective-role matrix).
- `npm test` — 12 files, 74/74 passed.
- `npx tsc --noEmit` — 0 errors.
- `npm run lint` — 0 errors (3 pre-existing warnings in untouched files).

### Manual QA
1. Apply the schema change to your Supabase instance (run the updated attendance insert/update policy block and the profiles `system_role` line from `supabase/schema.sql`).
2. As an OJT, open `/dashboard/ojt` and clock in/out — normal behavior, no `Only OJTs...` error.
3. As a supervisor (or an OJT promoted to supervisor/admin), attempt to call `clockIn`/`clockOut` directly (e.g. via a script or the browser console against the server action): verify the action returns `Only OJTs can clock in/out.` and no row is written.
4. Try inserting/updating an `attendance` row directly through the REST API with a supervisor/admin JWT: verify the RLS policy rejects it (permission denied).
5. As a supervisor, open `/dashboard/ojt` directly in the browser: verify you are redirected to `/dashboard/supervisor`.

### Expected results / pass criteria
- Only OJTs (by effective role) can clock in/out — enforced in the action, at the database, and by routing.
- Supervisors and admins never clock; a promoted OJT cannot clock under their old role.
- No regression in the full test suite, typecheck, or lint.

**NOT validated until the manual QA above is performed.**

---

*(Phase 3 — attendance summary, lands here as it is implemented.)*
