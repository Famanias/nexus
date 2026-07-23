import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { emitEvent } from '@/lib/automation/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
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
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore if called from Server Component
            }
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Attempt to mark as completed. RLS will protect against unauthorized updates.
    const { data: updatedTask, error: updateError } = await supabase
      .from('kanban_tasks')
      .update({ completed_at: new Date().toISOString(), completed_by: user.id })
      .eq('id', id)
      .is('completed_at', null)
      .select(`
        *,
        creator:profiles!kanban_tasks_assignee_id_fkey(id, email, full_name)
      `)
      .single();

    if (updateError || !updatedTask) {
      return NextResponse.json({ error: 'Task not found, already completed, or permission denied' }, { status: 403 });
    }

    // Fetch user profile for event payload
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // Emit the automation event in the background (fire-and-forget)
    emitEvent('task.completed', user.id, {
      taskId: updatedTask.id,
      title: updatedTask.title,
      description: updatedTask.description,
      priority: updatedTask.priority,
      completedBy: profile?.full_name || profile?.email || user.id,
      completedAt: updatedTask.completed_at,
      creatorEmail: updatedTask.creator?.email,
      creatorName: updatedTask.creator?.full_name,
      organizationId: updatedTask.org_id,
      timestamp: new Date().toISOString()
    }, updatedTask.org_id).catch(console.error);

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || 'Internal Server Error' }, { status: 500 });
  }
}
