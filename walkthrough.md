# Walkthrough: Fixed Email Invitation Flow and Link URLs in Production

We have resolved the issues preventing invitation emails from sending in production and ensured that invitation links always point to the correct production domain instead of `http://localhost:3000`.

## Root Cause Recap

1. **Static/Module-level Client Initialization**: 
   The Resend client in `src/lib/services/email.ts` was initialized at the module level. In Next.js, this means that if `process.env.RESEND_API_KEY` was not loaded during the container's build/pre-render or cold-start phase, it defaulted to `null` permanently for that process.
2. **Failure Masking**: 
   When the Resend client was `null`, the application printed the email to the console (for local development) but returned `success: true` to the caller. This caused the API routes to return a successful `200 OK` response to the client, masking the failure and leaving no visible warnings in the UI or Resend dashboard.
3. **Url Derivation**: 
   The invitation URLs were constructed using `request.nextUrl.origin`, which under reverse proxies or Docker hosts resolves to internal URLs (like `http://localhost:3000`) instead of the user-facing custom domain.

## Changes Made

### 1. Created Base URL Resolution Utility
- **[url.ts](file:///d:/repos/ojt-tracker/src/lib/utils/url.ts)** [NEW]
  Introduced `getSiteUrl(request?: NextRequest)` to resolve the base domain. It checks for:
  1. `NEXT_PUBLIC_SITE_URL` or `SITE_URL` env vars.
  2. Dynamic request headers (`x-forwarded-proto`, `x-forwarded-host`, and `host`).
  3. Built-in Vercel environment variables (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`).
  4. Localhost fallback (`http://localhost:3000`).

### 2. Dynamically Load Resend Client
- **[email.ts](file:///d:/repos/ojt-tracker/src/lib/services/email.ts)** [MODIFY]
  Refactored client creation to retrieve the `RESEND_API_KEY` lazily inside the email function. 
  Added detailed, safe logging of key configurations (masking the API key).
  Differentiated between environments: returns `success: false` in production when the key is missing (instead of silently simulating success), while retaining the mock behavior for development.

### 3. Updated API Route Handlers
- **[/api/invitations/route.ts](file:///d:/repos/ojt-tracker/src/app/api/invitations/route.ts)** [MODIFY]
  Updated POST handler to construct the `inviteUrl` with `getSiteUrl(request)`.
- **[/api/invitations/[id]/route.ts](file:///d:/repos/ojt-tracker/src/app/api/invitations/%5Bid%5D/route.ts)** [MODIFY]
  Updated PUT (resend) handler to construct the `inviteUrl` with `getSiteUrl(request)`.

### 4. Configuration Exclusions
- **[tsconfig.json](file:///d:/repos/ojt-tracker/tsconfig.json)** [MODIFY]
  Excluded the `scratch` folder from TypeScript compilation so one-off testing scripts do not interfere with Next.js builds.

---

## Verification Results

### 1. Scratch Execution Tests
We ran a test script `scratch/test-email.ts` with different environment mocks:
- **With `NEXT_PUBLIC_SITE_URL`**: Correctly generated `https://nexus.example.com` (trimmed trailing slashes).
- **With Proxy Headers**: Successfully retrieved `https://mycustomdomain.com`.
- **In Development (Missing Key)**: Correctly printed details to console and returned `success: true` with error information.
- **In Production (Missing Key)**: Successfully caught the missing configuration, logged `Error: Resend API key is not configured or is a placeholder.`, and returned `success: false` (to notify the user).

Test output log:
```
Test 1: getSiteUrl with NEXT_PUBLIC_SITE_URL -> https://nexus.example.com
Test 2: getSiteUrl with proxy headers -> https://mycustomdomain.com
Test 3: getSiteUrl dev fallback -> http://localhost:3000
Test 4: sendInvitationEmail in development (missing key) -> Mock success printed to logs, returns success: true
Test 5: sendInvitationEmail in production (missing key) -> Fails fast, returns success: false
```

### 2. Next.js Production Build
Ran `npm run build` which succeeded without errors:
```
▲ Next.js 16.1.6 (Turbopack)
✓ Compiled successfully in 8.2s
  Running TypeScript ...
✓ Generating static pages ...
Finalizing page optimization ...
Route (app)
├ ƒ /api/invitations
├ ƒ /api/invitations/[id]
...
```
All routes compiled and build output is clean.
