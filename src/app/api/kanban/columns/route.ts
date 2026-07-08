import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: login required.' }, { status: 401 });
    }

    // Check user profile for organization association
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, org_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.org_id) {
      return NextResponse.json({ error: 'Forbidden: user has no organization.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, color } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Missing column title.' }, { status: 400 });
    }

    // Find the highest position of columns in this organization
    const { data: columns, error: fetchError } = await supabase
      .from('kanban_columns')
      .select('position')
      .eq('org_id', profile.org_id)
      .order('position', { ascending: false })
      .limit(1);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const nextPosition = columns && columns.length > 0 ? columns[0].position + 1 : 0;

    // Insert the column
    const { data: newCol, error: insertError } = await supabase
      .from('kanban_columns')
      .insert({
        title: title.trim(),
        color: color || '#6366f1',
        position: nextPosition,
        created_by: profile.id,
        org_id: profile.org_id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newCol);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
