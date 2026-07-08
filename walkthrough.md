# Walkthrough: Configurable GPS/Location Verification

We have implemented a configurable attendance verification system allowing organization administrators to enable or disable GPS/location verification for Clock In and Clock Out actions.

## Summary of Changes

### 1. Database Schema
- **[NEW] Migration [20260707000000_add_require_location_verification.sql](file:///D:/repos/ojt-tracker/supabase/migrations/20260707000000_add_require_location_verification.sql):** Adds `require_location_verification` boolean column to the `site_settings` table, defaulting to `true`.
- **[MODIFY] [schema.sql](file:///D:/repos/ojt-tracker/supabase/schema.sql):** Appended the column to the default schema definition of the `site_settings` table.

### 2. Types
- **[MODIFY] [types/index.ts](file:///D:/repos/ojt-tracker/src/types/index.ts):** Updated the `SiteSettings` interface to include `require_location_verification: boolean`.

### 3. Server Actions
- **[MODIFY] [actions/settings.ts](file:///D:/repos/ojt-tracker/src/actions/settings.ts):** Updated the `SiteSettingsInput` interface and `saveSiteSettings` server action to accept and update `require_location_verification` in the database.

### 4. Settings UI & UX
- **[MODIFY] [SettingsClient.tsx](file:///D:/repos/ojt-tracker/src/app/dashboard/admin/settings/SettingsClient.tsx):**
  - Integrated `require_location_verification` in state management.
  - Added a new **Attendance Verification Card** with a switch above the "Office Location" section.
  - Added a Warning Alert when verification is disabled.
  - Dynamically disabled "Office Address", "Latitude", "Longitude", "Use My Current Location", "Preview on Google Maps", and the radius text field/chips when verification is turned off.

### 5. Attendance Flow
- **[MODIFY] [ClockButton.tsx](file:///D:/repos/ojt-tracker/src/components/attendance/ClockButton.tsx):**
  - Updated the clock-in/out button logic to bypass location checking and radius checks when `require_location_verification` is disabled.
  - Inserts and updates database attendance records with `NULL` coordinates and distance when location check is skipped.
  - Dynamically shows a green "Location Not Required" chip in place of the location coordinates and radius rules when verification is disabled.

---

## Verification Results
- Database update executed and applied successfully.
- Code compiles clean via `tsc --noEmit` and Turbopack builds successfully.
