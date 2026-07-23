import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emitEvent } from '@/lib/automation/client';
import { AutomationEventName } from '@/lib/automation/types';

// Helper to authenticate and return user org info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function requireAdmin(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.org_id || (profile.role !== 'admin' && profile.role !== 'supervisor')) {
    throw new Error('Forbidden');
  }

  return { supabase, user, orgId: profile.org_id };
}

// GET: List dead letters
export async function GET(request: NextRequest) {
  try {
    const { supabase, orgId } = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'failed';

    const { data: deadLetters, error } = await supabase
      .from('automation_dead_letters')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ deadLetters });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (errorMsg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// POST: Replay dead letter
export async function POST(request: NextRequest) {
  try {
    const { supabase, orgId } = await requireAdmin(request);
    const { id } = await request.json();

    if (!id) return NextResponse.json({ error: 'Missing dead letter ID' }, { status: 400 });

    // Fetch the dead letter
    const { data: dl, error: dlError } = await supabase
      .from('automation_dead_letters')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (dlError || !dl) return NextResponse.json({ error: 'Dead letter not found' }, { status: 404 });
    if (dl.status !== 'failed') return NextResponse.json({ error: 'Only failed dead letters can be replayed' }, { status: 400 });

    // Mark as retried
    await supabase
      .from('automation_dead_letters')
      .update({ status: 'retried' })
      .eq('id', id);

    // Re-emit using the Gateway. We extract the payload and actor from the stored envelope.
    const envelope = dl.payload;
    
    // We send a NEW event containing the same payload, so it gets a fresh ID and timestamp,
    // which prevents idempotent unique constraints from blocking it, and tracks it as a fresh attempt.
    await emitEvent(
      envelope.event as AutomationEventName,
      envelope.actorId,
      envelope.payload,
      envelope.organizationId
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (errorMsg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// DELETE: Discard dead letter
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, orgId } = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing dead letter ID' }, { status: 400 });

    const { error } = await supabase
      .from('automation_dead_letters')
      .update({ status: 'discarded' })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (errorMsg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
