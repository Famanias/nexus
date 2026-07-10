# Implementation Plan — Google OAuth Callback Redirect Fix

This plan addresses the issue where first-time Google OAuth sign-in redirects users back to the landing page with the code in the URL (`/?code=<oauth_code>`) instead of successfully logging them in and redirecting to their dashboard.

## User Review Required

> [!IMPORTANT]
> **Supabase Allowed Redirect URLs:**
> For Google OAuth to redirect correctly when accessing the site via different subdomains, **both** the `www.` and non-`www.` domains must be whitelisted in your Supabase Auth settings.
> 
> Please ensure the following Redirect URLs are added in your **Supabase Dashboard** > **Authentication** > **URL Configuration** > **Redirect URLs**:
> - `https://www.nexxus.lol/auth/callback`
> - `https://nexxus.lol/auth/callback`
> - `http://localhost:3000/auth/callback` (for local development)

## Proposed Changes

### Callback Handler

#### [MODIFY] [route.ts](file:///d:/repos/ojt-tracker/src/app/auth/callback/route.ts)
- Initialize a local `createServerClient` in the GET handler.
- Pass the Next.js `cookies()` helper as the cookie store.
- Intercept the `setAll` cookie modifications on a temporary `NextResponse` object.
- Copy all of the set cookies explicitly onto the returned redirect `NextResponse` response object. This guarantees that the session cookies are correctly set in the browser's cookies when performing a redirect from a Route Handler in Next.js.

## Verification Plan

### Automated Tests
- Run type checker `npx tsc --noEmit` to verify type safety.
- Run `npm run build` to verify there are no compilation errors.

### Manual Verification
- Test OAuth login in an incognito window starting from:
  - `https://nexxus.lol/` (non-www)
  - `https://www.nexxus.lol/` (www)
- Verify the first login redirects directly to the `/onboarding` page or `/dashboard/ojt` instead of loading the landing page with the code in the URL.
