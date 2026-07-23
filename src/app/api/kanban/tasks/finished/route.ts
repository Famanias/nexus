import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all'; // today, 7days, 30days, month, all
    const sort = searchParams.get('sort') || 'newest'; // newest, oldest, a-z, z-a
    
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org_id
    const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single();
    if (!profile?.org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    let query = supabase
      .from('kanban_tasks')
      .select(`
        *,
        assignee:profiles!kanban_tasks_assignee_id_fkey(*),
        completed_by_profile:profiles!kanban_tasks_completed_by_fkey(*),
        column:kanban_columns!inner(title)
      `)
      .eq('org_id', profile.org_id)
      .not('completed_at', 'is', null);

    // If user is OJT, they only see tasks assigned to them
    if (profile.role === 'ojt') {
      query = query.eq('assignee_id', user.id);
    }

    // Time filter
    if (timeRange !== 'all') {
      const now = new Date();
      const fromDate = new Date();
      if (timeRange === 'today') {
        fromDate.setHours(0, 0, 0, 0);
      } else if (timeRange === '7days') {
        fromDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30days') {
        fromDate.setDate(now.getDate() - 30);
      } else if (timeRange === 'month') {
        fromDate.setDate(1);
        fromDate.setHours(0, 0, 0, 0);
      }
      query = query.gte('completed_at', fromDate.toISOString());
    }

    // Sorting
    if (sort === 'newest') {
      query = query.order('completed_at', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('completed_at', { ascending: true });
    } else if (sort === 'a-z') {
      query = query.order('title', { ascending: true });
    } else if (sort === 'z-a') {
      query = query.order('title', { ascending: false });
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || 'Internal Server Error' }, { status: 500 });
  }
}
