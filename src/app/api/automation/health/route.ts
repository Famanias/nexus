import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedisClient } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check Redis Queue length & health
    let redisConnected = false;
    let mainQueueLength = 0;
    let dlqLength = 0;

    const redis = getRedisClient();
    if (redis) {
      try {
        mainQueueLength = (await redis.llen('automation:queue')) || 0;
        dlqLength = (await redis.llen('automation:dlq')) || 0;
        redisConnected = true;
      } catch (err) {
        console.error('[Automation Health] Redis error:', err);
      }
    }

    // Check Supabase connectivity
    const { data: dbHealth, error: dbError } = await supabase
      .from('site_settings')
      .select('id')
      .limit(1);

    const supabaseConnected = !dbError && Boolean(dbHealth);

    return NextResponse.json({
      status: redisConnected && supabaseConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          connected: redisConnected,
          mainQueueLength,
          dlqLength,
        },
        supabase: {
          connected: supabaseConnected,
        },
        gateway: {
          configured: Boolean(process.env.N8N_WEBHOOK_URL || process.env.AUTOMATION_WEBHOOK_URL),
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
