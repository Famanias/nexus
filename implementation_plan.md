# Fix Email Invitation Flow and Link URLs in Production

This plan outlines the root cause and proposed fixes for the issue where email invitations work correctly on localhost but fail silently in production (reporting success but never sending emails via Resend). It also addresses generating correct production URLs for invitation links instead of `http://localhost:3000`.

## User Review Required

> [!IMPORTANT]
> The environment variable `RESEND_API_KEY` must be configured in your production hosting platform dashboard. If it is missing, invitations will now fail with a visible warning/error in production rather than silently succeeding.
>
> Additionally, it is highly recommended to configure `NEXT_PUBLIC_SITE_URL` (e.g. `https://nexus-ojt.vercel.app` or your custom domain) in the production dashboard so that all links generated in emails point to the correct production domain.

## Root Cause Analysis

1. **Module-level Client Initialization & Caching**:
   In `src/lib/services/email.ts`, the `Resend` client was initialized at the module level:
   ```typescript
   const resendApiKey = process.env.RESEND_API_KEY;
   const resend = resendApiKey && resendApiKey !== 'placeholder' && !resendApiKey.startsWith('your_')
     ? new Resend(resendApiKey)
     : null;
   ```
   During Next.js production building or startup initialization, if `process.env.RESEND_API_KEY` was missing, `resend` was permanently cached as `null` for the lifetime of the process/serverless container.
2. **Silent Failure Masking**:
   When `resend` was `null`, `sendInvitationEmail` returned `{ success: true, error: '...' }` (mimicking successful mock delivery for development).
   Since `success: true` was returned, the API routes (`/api/invitations` and `/api/invitations/[id]`) bypassed the error/warning logic and returned a `200 OK` response to the client. The frontend assumed success, surfaced no errors, and logged the invitation as sent, while the email was actually printed to the server logs and never sent to Resend.
3. **Host Origin Resolution**:
   Invitation links were built using `request.nextUrl.origin`. Behind reverse proxies, API Gateways, or Docker/serverless routers, this can resolve to `http://localhost:3000` or deployment-specific subdomains instead of the user-facing custom domain.

## Proposed Changes

### 1. New Site URL Utility
We will create a helper to dynamically determine the correct frontend origin.

#### [NEW] [url.ts](file:///d:/repos/ojt-tracker/src/lib/utils/url.ts)
- Implement `getSiteUrl(request?: NextRequest): string`.
- Prioritize `NEXT_PUBLIC_SITE_URL` and `SITE_URL` environment variables.
- Fall back to checking request headers (`x-forwarded-proto` and `x-forwarded-host`/`host`) if provided.
- Fall back to standard Vercel environment variables (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`).
- Fall back to `http://localhost:3000` for development.

### 2. Email Service
#### [MODIFY] [email.ts](file:///d:/repos/ojt-tracker/src/lib/services/email.ts)
- Initialize `Resend` dynamically/lazily inside the email sending function instead of at the module level.
- Log details of the Resend client initialization (safely obscuring the key).
- In production (`process.env.NODE_ENV === 'production'`), return `success: false` if `RESEND_API_KEY` is missing or invalid, so that failures are correctly surfaced.
- Retain the mock console-logging fallback only for development/test environments.

### 3. Invitation API Routes
#### [MODIFY] [route.ts](file:///d:/repos/ojt-tracker/src/app/api/invitations/route.ts)
- Import `getSiteUrl` from `@/lib/utils/url`.
- Use `getSiteUrl(request)` to generate the invitation link instead of `request.nextUrl.origin`.

#### [MODIFY] [route.ts](file:///d:/repos/ojt-tracker/src/app/api/invitations/[id]/route.ts)
- Import `getSiteUrl` from `@/lib/utils/url`.
- Use `getSiteUrl(request)` to generate the invitation link instead of `request.nextUrl.origin`.

---

## Verification Plan

### Automated Tests
- Build the Next.js project to ensure there are no compilation issues:
  ```powershell
  npm run build
  ```

### Manual Verification
- Simulate a missing key in development to verify that it outputs the mock log and returns success in development mode.
- Simulate production mode (temporarily set `process.env.NODE_ENV === 'production'`) and check that:
  - If `RESEND_API_KEY` is missing, it returns `success: false` and the UI shows the error/warning.
  - If `RESEND_API_KEY` is present, it uses the key and makes the Resend API request successfully.
- Verify invitation links are constructed correctly using `NEXT_PUBLIC_SITE_URL` or fallback values.
