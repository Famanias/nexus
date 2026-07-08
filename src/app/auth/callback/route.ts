import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '';
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  if (error) {
    console.error('OAuth Callback Error:', error, error_description);
    let friendlyMessage = 'Authentication failed. Please try again.';
    if (error === 'access_denied' || error_description?.toLowerCase().includes('cancel')) {
      friendlyMessage = 'Google sign-in was cancelled.';
    } else if (error_description) {
      friendlyMessage = error_description;
    }
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(friendlyMessage)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!authError) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile (must exist due to database trigger)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error('Unexpected missing profile on callback:', profileError);
          // Sign out the user and return to login with error
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(
              'Your user profile could not be created automatically. Please contact an administrator.'
            )}`
          );
        }

        // If user profile has no organization association, route them to onboarding (unless they are accepting an invite)
        if (!profile.org_id && (!next || !next.startsWith('/invite/'))) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // Redirect to original destination or default dashboard based on role
        if (next) {
          return NextResponse.redirect(`${origin}${next}`);
        }
        return NextResponse.redirect(`${origin}/dashboard/${profile.role}`);
      }
    } else {
      console.error('Auth Error exchanging code for session:', authError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(authError.message)}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}
