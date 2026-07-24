import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders } from './lib/security/headers';

export async function proxy(request: NextRequest) {
  // Skip auth/session work for Next.js link-prefetch requests
  if (request.headers.get('Next-Router-Prefetch')) {
    return NextResponse.next();
  }

  // Intercept any requests carrying an auth 'code' that are not already pointing to the callback
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const { pathname } = request.nextUrl;
    if (pathname !== '/auth/callback') {
      const callbackUrl = new URL('/auth/callback', request.url);
      callbackUrl.search = request.nextUrl.search;
      
      // If landing on reset-password directly, set next parameter to preserve destination
      if (!request.nextUrl.searchParams.has('next') && pathname === '/auth/reset-password') {
        callbackUrl.searchParams.set('next', '/auth/reset-password');
      }
      const redirectResp = NextResponse.redirect(callbackUrl);
      return applySecurityHeaders(request, redirectResp).response;
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseUrl: string;
  try { new URL(rawUrl ?? ''); supabaseUrl = rawUrl!; } catch { supabaseUrl = 'https://placeholder.supabase.co'; }
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabaseKey = rawKey.length > 20 ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder') {
    console.error(
      '❌ [Supabase Proxy Middleware] Environment variables are missing or invalid! ' +
      'Using placeholder URL/Key. Please check your .env.local file.'
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const role: string = (user?.user_metadata?.role as string) ?? 'ojt';

  // Helper: build a redirect response while preserving any refreshed auth cookies
  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return applySecurityHeaders(request, redirectResponse).response;
  };

  const isInviteRoute = pathname.startsWith('/invite/');
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/docs',
    '/privacy',
    '/terms',
    '/contact',
    '/forgot-password',
    '/auth/reset-password',
  ];

  const finalResponse = supabaseResponse;

  if (publicRoutes.includes(pathname) || isInviteRoute) {
    if (user && !isInviteRoute && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
      return redirectWithCookies(new URL(`/dashboard/${role}`, request.url));
    }
    return applySecurityHeaders(request, finalResponse).response;
  }

  if (!user) {
    if (pathname.startsWith('/api/organizations') || pathname === '/auth/callback') {
      return applySecurityHeaders(request, finalResponse).response;
    }
    return redirectWithCookies(new URL('/login', request.url));
  }

  if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
    return redirectWithCookies(new URL(`/dashboard/${role}`, request.url));
  }

  if (
    pathname.startsWith('/dashboard/supervisor') &&
    !['admin', 'supervisor'].includes(role)
  ) {
    return redirectWithCookies(new URL(`/dashboard/${role}`, request.url));
  }

  return applySecurityHeaders(request, finalResponse).response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};