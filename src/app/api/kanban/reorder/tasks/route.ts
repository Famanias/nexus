import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reorderTasks } from '@/lib/services/kanban';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: login required.' }, { status: 401 });
    }

    const body = await request.json();
    const { tasks } = body || {};

    if (!Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Invalid payload: expected an array of tasks.' }, { status: 400 });
    }

    await reorderTasks(supabase, tasks);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
