import { createBrowserClient } from '@supabase/ssr';

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

export function createClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = isValidUrl(rawUrl) ? rawUrl! : 'https://placeholder.supabase.co';
  const key = rawKey && rawKey.length > 20 ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
  
  if (url === 'https://placeholder.supabase.co' || key === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder') {
    console.error(
      '❌ [Supabase Client] Environment variables are missing or invalid! ' +
      'Using placeholder URL/Key. Please check your .env.local file and RESTART your dev server (npm run dev).'
    );
  }

  return createBrowserClient(url, key);
}
