# Walkthrough — Ticket #18: Org-Scoped Cache Wrapper & Tag Revalidation

## Summary of Work

Implemented an organization-scoped server caching layer using Next.js \`unstable_cache\` and tag-based on-demand invalidation (\`revalidateTag\`) for low-churn, read-heavy data (\`site_settings\` and active OJT rosters). Integrated cache readers into pages and wired tag purging into mutation server actions and API routes.

## Key Changes

### 1. Cache Subsystem
- **[tags.ts](file:///d:/repos/ojt-tracker/src/lib/cache/tags.ts)**:
  - Defined canonical tags: \`settings:{orgId}\` and \`ojts:{orgId}\`.
  - \`revalidateSettingsTag(orgId)\`: Purges settings cache on demand.
  - \`revalidateOjtsTag(orgId)\`: Purges active OJT roster cache on demand.
- **[cached-queries.ts](file:///d:/repos/ojt-tracker/src/lib/cache/cached-queries.ts)**:
  - \`getCachedSiteSettings(orgId)\`: Cached fetcher for organization site settings.
  - \`getCachedActiveOjts(orgId)\`: Cached fetcher for active OJT profiles.
  - Utilizes stateless Supabase client to avoid dynamic cookie reads within \`unstable_cache\`.
- **[index.ts](file:///d:/repos/ojt-tracker/src/lib/cache/index.ts)**: Central barrel export for cache functions.

### 2. Readers Integrated
- **[admin/settings/page.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/admin/settings/page.tsx)**: Now calls \`getCachedSiteSettings(profile.org_id)\`.
- **[kanban/page.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/kanban/page.tsx)**: Replaced raw profile query with \`getCachedActiveOjts(profile.org_id)\`.
- **[reports/page.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/reports/page.tsx)**: Replaced raw profile query with \`getCachedActiveOjts(profile.org_id)\`.
- **[supervisor/page.tsx](file:///d:/repos/ojt-tracker/src/app/dashboard/supervisor/page.tsx)**: Replaced raw profile query with \`getCachedActiveOjts(profile.org_id)\`.

### 3. Mutation Triggers Wired
- **[actions/settings.ts](file:///d:/repos/ojt-tracker/src/actions/settings.ts)**: \`saveSiteSettings\` and \`regenerateInviteCode\` call \`revalidateSettingsTag(orgId)\`.
- **[actions/integrations.ts](file:///d:/repos/ojt-tracker/src/actions/integrations.ts)**: \`saveOrgIntegration\` calls \`revalidateSettingsTag(orgId)\`.
- **[actions/users.ts](file:///d:/repos/ojt-tracker/src/actions/users.ts)**: \`syncUserRoleMetadata\` calls \`revalidateOjtsTag(orgId)\`.
- **[api/users/route.ts](file:///d:/repos/ojt-tracker/src/app/api/users/route.ts)**: User creation and deletion call \`revalidateOjtsTag(orgId)\`.
- **[api/onboarding/route.ts](file:///d:/repos/ojt-tracker/src/app/api/onboarding/route.ts)**: Organization creation calls \`revalidateSettingsTag\` & \`revalidateOjtsTag\`; org joining calls \`revalidateOjtsTag\`.
- **[api/invitations/accept/route.ts](file:///d:/repos/ojt-tracker/src/app/api/invitations/accept/route.ts)**: Calls \`revalidateOjtsTag\`.

### 4. Architecture Documentation
- **[docs/ARCHITECTURE.md](file:///d:/repos/ojt-tracker/docs/ARCHITECTURE.md)**: Documented **ADR-007: Org-Scoped Cache Wrapper with Tag Revalidation**.

---

## Verification Results

### Unit Tests
- Created **[cache.test.ts](file:///d:/repos/ojt-tracker/src/__tests__/unit/cache.test.ts)** (8 tests) testing tag generation, revalidation calls, cache fetchers, and fallbacks.
- Full test suite passed: **16 test files passed, 106 tests passed**.

```
 ✓ src/__tests__/unit/automation.test.ts (11 tests)
 ✓ src/__tests__/unit/toast.test.tsx (4 tests)
 ✓ src/__tests__/unit/confirm-dialog.test.tsx (3 tests)
 ✓ src/__tests__/unit/clock-button.test.tsx (4 tests)
 ✓ src/__tests__/unit/attendance-day.test.ts (6 tests)
 ✓ src/__tests__/unit/components.test.tsx (3 tests)
 ✓ src/__tests__/unit/security.test.ts (12 tests)
 ✓ src/__tests__/unit/encryption.test.ts (4 tests)
 ✓ src/__tests__/unit/session.test.ts (12 tests)
 ✓ src/__tests__/unit/cache.test.ts (8 tests)
 ✓ src/__tests__/unit/helpers.test.ts (11 tests)
 ✓ src/__tests__/unit/validation.test.ts (12 tests)
 ✓ src/__tests__/unit/redis.test.ts (2 tests)
 ✓ src/__tests__/unit/attendance-summary.test.ts (8 tests)
 ✓ src/__tests__/unit/rate-limit.test.ts (2 tests)
 ✓ src/__tests__/unit/eligibility.test.ts (4 tests)

 Test Files  16 passed (16)
      Tests  106 passed (106)
```

### Production Build
- \`next build\` compiled with Turbopack and completed all 49 routes successfully with 0 errors.

---

## Issue Status Update

- **[#18](https://github.com/Famanias/nexus/issues/18)** closed as resolved.
- **Unblocked on frontier**:
  - **[#19](https://github.com/Famanias/nexus/issues/19)**: Attendance summary: Database-level aggregation RPC and unified summary module
  - **[#20](https://github.com/Famanias/nexus/issues/20)**: Clock actions: Parallelize validation checks and leverage session seam
