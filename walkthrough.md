# Walkthrough - Google OAuth Authentication with Supabase

Google OAuth authentication has been successfully integrated into the OJT Tracker application. The implementation adheres to a clean separation of concerns, uses secure cookie-based intent preservation for register form actions, and introduces a premium onboarding experience for users without an organization.

## Changes Made

### 1. Database & Migrations
- **Trigger Update (`handle_new_user`):**
  - Updated [schema.sql](file:///d:/repos/ojt-tracker/supabase/schema.sql) trigger function.
  - Created SQL migration [20260703000000_update_handle_new_user.sql](file:///d:/repos/ojt-tracker/supabase/migrations/20260703000000_update_handle_new_user.sql) to apply the trigger updates in production.
  - Safe fields (`full_name`, `email`, `avatar_url`) are updated on conflict, while `role` and `org_id` (organization membership) are preserved, preventing roles from resetting to `'ojt'` on subsequent Google logins.
  - Profile `avatar_url` is now correctly mapped from Google metadata (`avatar_url` or `picture`).

### 2. Business Services
- **Extract Services:**
  - Created [organization.ts](file:///d:/repos/ojt-tracker/src/lib/services/organization.ts) containing shared business functions for `createOrganization` and `joinOrganization`.
  - Refactored [route.ts](file:///d:/repos/ojt-tracker/src/app/api/organizations/route.ts) to utilize these shared service functions, eliminating duplicate code.

### 3. Authentication UI Components
- **LoginForm (`LoginForm.tsx`):**
  - Added support for reading and preserving `next` query parameters.
  - Added URL search parameter parsing inside a `useEffect` to display OAuth error messages (e.g. cancelled authentication).
  - Added `googleLoading` indicator and loading state UI.
- **RegisterForm (`RegisterForm.tsx`):**
  - Added `googleLoading` state and support for displaying callback error messages.
  - When clicking "Continue with Google" with filled-out organization creation or join details, the user's intent is stored in a secure client-side cookie `nexus_register_intent` (expires in 10 mins). This completely avoids exposing sensitive data in browser history or URL parameters.

### 4. Session & Callback Handling
- **Callback Route (`src/app/auth/callback/route.ts`):**
  - Lightweight route handler. Exchanged code for a Supabase session.
  - Verified user profile exists (or raises an error if unexpectedly missing).
  - If the profile lacks an `org_id`, redirects to `/onboarding`. Otherwise, redirects to the `next` path or default role dashboard.
  - Handles cancelled authentication ("Google sign-in was cancelled") and other callback errors.
  - **Fixed Cookie Propagation Bug:** Updated the route handler to manually copy cookies set during the code exchange (`exchangeCodeForSession`) into the redirected response object. This guarantees that Next.js does not strip cookies when performing the callback redirect, ensuring users remain authenticated.
- **Proxy Routing (`src/proxy.ts`):**
  - Next.js 16 replaces `middleware.ts` with the new `proxy.ts` convention. We removed the temporary `src/middleware.ts` file to prevent duplicate route handler errors, and rely solely on `src/proxy.ts` which natively handles session restoration and route redirection.
  - **Fixed Callback Redirect Bug:** Allowed `/auth/callback` to bypass the `!user` routing check inside `src/proxy.ts`. This allows Supabase Auth to execute the code-exchange route handler and set cookies without intercepting the request and redirecting the user back to the login page.

### 5. Onboarding Flow
- **Dashboard Layout Redirect (`src/app/dashboard/layout.tsx`):**
  - Added a check: if an authenticated user does not have an `org_id`, they are redirected to `/onboarding`.
- **Onboarding Page (`src/app/onboarding/page.tsx` & `OnboardingClient.tsx`):**
  - Renders a premium setup experience wrapped in `AuthPageShell` and `AuthCard` for visual consistency.
  - If the `nexus_register_intent` cookie is found, it automatically executes the organization creation or join seamlessly behind a loading spinner.
  - Manual forms allow the user to create or join an organization with asynchronous validation on invite codes, error/success feedback, and a "Sign Out" button.
- **Onboarding API Route (`src/app/api/onboarding/route.ts`):**
  - REST POST handler executing onboarding operations by calling the shared services.

---

## Verification Results

### TypeScript Verification
- Run type checker `npx tsc --noEmit` to verify type safety.
