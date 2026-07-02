import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_URL = isValidUrl(rawUrl) ? rawUrl! : PLACEHOLDER_URL;
const SUPABASE_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').length > 20
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  : PLACEHOLDER_KEY;
const SUPABASE_SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length > 20
  ? process.env.SUPABASE_SERVICE_ROLE_KEY!
  : PLACEHOLDER_KEY;

export async function createClient() {
  const cookieStore = await cookies();

  if (SUPABASE_URL === PLACEHOLDER_URL || SUPABASE_ANON === PLACEHOLDER_KEY) {
    console.error(
      '❌ [Supabase Server Client] Environment variables are missing or invalid! ' +
      'Using placeholder URL/Key. Please check your .env.local file.'
    );
  }

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies can be read-only
          }
        },
      },
    }
  );
}

export async function createAdminClient() {
  const cookieStore = await cookies();

  if (SUPABASE_URL === PLACEHOLDER_URL || SUPABASE_SERVICE === PLACEHOLDER_KEY) {
    console.error(
      '❌ [Supabase Server Admin Client] Environment variables are missing or invalid! ' +
      'Using placeholder URL/Key. Please check your .env.local file.'
    );
  }

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
