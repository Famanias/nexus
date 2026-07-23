import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    const cookieStore = await cookies();
    
    // We create a temporary response object to capture Set-Cookie headers
    const supabaseResponse = NextResponse.next();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
                supabaseResponse.cookies.set(name, value, options);
              });
            } catch {
              // Read-only context fallback
            }
          },
        },
      }
    );

    const { data: exchangeData, error: authError } = await supabase.auth.exchangeCodeForSession(code);
    
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
          
          const redirectErrorResponse = NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(
              'Your user profile could not be created automatically. Please contact an administrator.'
            )}`
          );
          
          // Copy any cookies set during signOut
          supabaseResponse.cookies.getAll().forEach((c) => {
            redirectErrorResponse.cookies.set(c.name, c.value, c);
          });
          
          return redirectErrorResponse;
        }

        // Check if this is a recovery session
        let isRecovery = false;
        const session = exchangeData?.session ?? (await supabase.auth.getSession()).data.session;
        if (session) {
          try {
            const token = session.access_token;
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            isRecovery = payload.amr?.some((a: { method?: string }) => a.method === 'recovery') ?? false;
          } catch (e) {
            console.error('[Callback] Failed to parse JWT amr claim:', e);
          }
        }

        // Determine destination
        let dest = `${origin}/dashboard/${profile.role}`;
        if (isRecovery) {
          dest = `${origin}/auth/reset-password`;
        } else if (next) {
          dest = `${origin}${next}`;
        }

        const redirectResponse = NextResponse.redirect(dest);
        
        // Copy cookies set during exchangeCodeForSession to the final redirect response
        supabaseResponse.cookies.getAll().forEach((c) => {
          redirectResponse.cookies.set(c.name, c.value, c);
        });

        return redirectResponse;
      }
    } else {
      console.error('Auth Error exchanging code for session:', authError);
      
      const redirectErrorResponse = NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(authError.message)}`
      );
      
      supabaseResponse.cookies.getAll().forEach((c) => {
        redirectErrorResponse.cookies.set(c.name, c.value, c);
      });
      
      return redirectErrorResponse;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}

