import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client so we can sign URLs from the private bucket.
// This route is server-side only — the key is never sent to the client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase configuration is missing');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

  const { data, error } = await supabase.storage
    .from('task-attachments')
    .createSignedUrl(path, 60 * 60); // 1-hour signed URL

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }

  // Redirect to the signed URL so the browser can cache the image
  return NextResponse.redirect(data.signedUrl);
}
