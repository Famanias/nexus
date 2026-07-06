Implementation Plan: Configurable GPS/Location Verification
Goal

Implement a configurable attendance verification system that allows an organization administrator to enable or disable GPS/location verification for Clock In and Clock Out.

When enabled, the existing GPS validation flow remains unchanged.

When disabled, users can clock in and clock out without granting location permission or being within the configured radius.

Phase 1 — Database
Objective

Extend site_settings to store whether location verification is required.

Tasks
Create a migration adding a new boolean column:
require_location_verification BOOLEAN NOT NULL DEFAULT TRUE
Ensure existing organizations default to enabled so current behavior is preserved.
Expected Result

Each organization now has its own configurable GPS requirement.

Phase 2 — Types
Objective

Expose the new field throughout the application.

Tasks

Update every shared type that represents Site Settings.

Examples:

types/index.ts
DTOs
API response types
Server action types

Add:

require_location_verification: boolean;
Expected Result

The frontend and backend can safely access the new setting.

Phase 3 — Server Actions
Objective

Allow the new setting to be saved and retrieved.

Tasks

Update:

saveSiteSettings()

Include:

require_location_verification

Update validation to ensure the value is a boolean.

Update the Supabase update statement.

Expected Result

Saving Settings now also persists GPS verification preferences.

Phase 4 — Settings UI
Objective

Allow administrators to control attendance verification.

4.1 Create a new Attendance Verification Card

Place this above the Office Location section.

Contents:

Attendance Verification

Require users to be within the office location

[ Switch ]

Description:

When disabled, users may clock in and clock out without GPS verification.
4.2 Update Form State

Extend the existing form.

Current:

{
    site_name,
    latitude,
    longitude,
    radius_meters,
    address
}

New:

{
    site_name,
    latitude,
    longitude,
    radius_meters,
    address,
    require_location_verification
}
4.3 Update Initial Values

Populate the switch using

initialSettings.require_location_verification
4.4 Update Save Logic

Include the new property when saving.

Expected Result

Administrators can enable or disable GPS verification from Settings.

Phase 5 — Improve the Settings Experience
Objective

Prevent administrators from editing settings that are currently inactive.

Disable Office Location

When GPS verification is OFF:

Latitude
Longitude
Address
Current Location button
Google Maps Preview

should appear disabled.

Disable Verification Radius

Disable:

Radius field
Radius chips
Show Contextual Alert

Display:

GPS verification is currently disabled. Office location and radius settings are ignored until GPS verification is enabled again.

Expected Result

The UI clearly reflects the active attendance verification mode.

Phase 6 — Attendance Flow
Objective

Skip GPS entirely when it isn't required.

Current Flow

Clock In

↓

Request GPS

↓

Calculate Distance

↓

Validate Radius

↓

Save Attendance

New Flow

Clock In

↓

Load Site Settings

↓

Is GPS Required?

YES
↓

Request GPS

↓

Calculate Distance

↓

Validate Radius

↓

Save Attendance


NO

↓

Skip GPS

↓

Save Attendance
Expected Result

Users are never asked for location permission when GPS verification is disabled.

Phase 7 — Attendance API
Objective

Update backend validation.

Tasks

Before any location validation:

Retrieve

site_settings.require_location_verification

If

false

Immediately continue with attendance processing.

Skip:

Location validation
Distance calculation
Radius comparison
Expected Result

The backend supports both verification modes.

Phase 8 — Attendance Data
Objective

Handle GPS-disabled attendance records.

When GPS is disabled:

Store

clock_in_latitude = NULL

clock_in_longitude = NULL

clock_in_distance_meters = NULL

clock_out_latitude = NULL

clock_out_longitude = NULL

clock_out_distance_meters = NULL

No schema changes are required.

Phase 9 — Attendance History
Objective

Improve clarity when GPS is disabled.

Instead of displaying

N/A

or

0 m

display

GPS Verification Disabled

or

Location Not Required

for those attendance records.

Phase 10 — Testing
Scenario 1

GPS Enabled

Expected:

Browser requests location permission
Distance calculated
Radius enforced
Coordinates saved
Scenario 2

GPS Disabled

Expected:

No browser permission prompt
No location lookup
Attendance succeeds
GPS fields remain NULL
Scenario 3

Administrator Toggles Setting

Expected:

Save succeeds
Reload persists switch state
Attendance behavior changes immediately
Scenario 4

Multi-Organization

Organization A

GPS Enabled

Organization B

GPS Disabled

Expected:

Each organization behaves independently according to its own site_settings.

Files to Modify
Database
site_settings table migration
Types
types/index.ts
Any shared SiteSettings interfaces
Settings
SettingsClient.tsx
saveSiteSettings()
Attendance
Clock In API/Server Action
Clock Out API/Server Action
Attendance validation utilities
GPS helper (if applicable)
Reports (Optional UX Improvement)
Attendance history page
Attendance details modal
Success Criteria
Administrators can toggle GPS verification on or off per organization.
Users are not prompted for location access when GPS verification is disabled.
Existing GPS and radius validation remains unchanged when enabled.
Office Location and Radius settings are clearly inactive when GPS verification is disabled.
The implementation is fully compatible with your existing multi-organization architecture and requires only a single additional field in site_settings.