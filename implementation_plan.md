Implementation Task — Add Cloudflare Turnstile CAPTCHA to Supabase Authentication
Objective

Implement Cloudflare Turnstile CAPTCHA protection for the authentication system using Supabase Auth.

The implementation should follow Supabase's recommended approach while integrating cleanly with the existing authentication flow and UI.

Requirements
1. Supabase Configuration

Before implementing the frontend, ensure the following prerequisites are documented for manual configuration:

Navigate to Supabase Dashboard
Go to:
Project Settings
Authentication
Bot and Abuse Protection
Enable CAPTCHA Protection
Select Cloudflare Turnstile as the provider
Configure:
Site Key
Secret Key
Save the configuration.

Document any required environment variables.

2. Install Required Dependency

Install the official React Turnstile component:

npm install @marsidev/react-turnstile
3. Frontend Integration

Locate every authentication form that accepts user credentials, including:

Sign Up
Sign In
Password Reset (if supported)

Integrate the Turnstile widget into each applicable form.

The implementation should:

render the Turnstile widget
retrieve the verification token after successful completion
store the token in component state
prevent form submission until a valid token exists
gracefully handle expired or invalid tokens
reset the widget after authentication errors when appropriate
4. Supabase Authentication

Pass the CAPTCHA token to every supported Supabase authentication request.

Example:

await supabase.auth.signUp({
  email,
  password,
  options: {
    captchaToken,
  },
});

Apply the same approach wherever Supabase supports captchaToken.

5. User Experience

The CAPTCHA implementation should:

match the application's existing design
avoid unnecessary layout shifts
display clear validation messages if verification is missing
remain responsive on desktop and mobile
support light and dark themes if applicable

6. Environment Variables (I have already set this up)

NEXT_PUBLIC_TURNSTILE_SITE_KEY=...

additional (this is already configured in supabase so you might not need this, only including it for your reference):
NEXT_PUBLIC_TURNSTILE_SECRET_KEY=... 

Never hardcode the site key or secret key into the source code.

7. Local Development

Document any required localhost configuration, including:

adding localhost to the Cloudflare Turnstile allowlist
required environment variables
any Supabase configuration needed for local testing
Validation Checklist

Verify the following scenarios:

CAPTCHA renders successfully.
Users cannot submit authentication forms without completing the CAPTCHA.
Successful verification produces a valid captchaToken.
Authentication succeeds when a valid token is supplied.
Invalid or expired tokens are handled gracefully.
Authentication errors reset or refresh the CAPTCHA when necessary.
Existing authentication functionality continues to work without regressions.
Deliverables

Provide:

A summary of the implementation approach.
All modified files.
Any new dependencies.
Required environment variables.
Manual Supabase configuration steps.
Any additional setup required for Cloudflare Turnstile.
A brief explanation of how the CAPTCHA flow integrates with Supabase Auth.

Constraints

Follow Supabase's official CAPTCHA integration guidelines.
Use the @marsidev/react-turnstile package.
Keep the implementation modular and reusable.
Do not break the existing authentication flow.
Avoid duplicate CAPTCHA logic across components; extract reusable functionality where appropriate.