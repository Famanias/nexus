import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/services/notification';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: login required.' }, { status: 401 });
    }

    const notifications = await listNotifications(supabase, user.id);
    return NextResponse.json(notifications);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: login required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, id } = body;

    if (action === 'mark_read') {
      if (!id) {
        return NextResponse.json({ error: 'Missing notification ID.' }, { status: 400 });
      }
      await markNotificationAsRead(supabase, id, user.id);
      return NextResponse.json({ success: true });
    } else if (action === 'mark_all_read') {
      await markAllNotificationsAsRead(supabase, user.id);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
