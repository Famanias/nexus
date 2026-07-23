import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden: user not found.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, color } = body;

    const updates: Record<string, string> = {};
    if (title && title.trim()) updates.title = title.trim();
    if (color) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const query = supabase
      .from('kanban_columns')
      .update(updates)
      .eq('id', id);

    if (profile.org_id) {
      query.eq('org_id', profile.org_id);
    } else {
      query.is('org_id', null).eq('created_by', user.id);
    }

    const { data: updatedCol, error: updateError } = await query
      .select()
      .single();

    if (updateError || !updatedCol) {
      return NextResponse.json({ error: updateError?.message ?? 'Failed to update column.' }, { status: 400 });
    }

    return NextResponse.json(updatedCol);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden: user not found.' }, { status: 403 });
    }

    // Read the body for task handling (move destination)
    let moveTasksTo: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      moveTasksTo = body.moveTasksTo || null;
    } catch {
      // Body might be empty or invalid
    }

    // Call the PostgreSQL delete_kanban_column function
    const { error: rpcError } = await supabase.rpc('delete_kanban_column', {
      column_to_delete: id,
      move_tasks_to: moveTasksTo,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
