// ============================================================
// Automation Batch Integrations Resolution API
// ============================================================
// Resolves all active notification integrations for a given organizationId
// in a single endpoint call with 60s in-memory caching.
// Authenticated via X-Automation-Key header.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCachedOrgIntegrations, setCachedOrgIntegrations, ResolvedOrgIntegrations } from '@/lib/integrations/cache';
import { decryptSecret } from '@/lib/services/encryption';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Validate automation API key
    const authHeader = request.headers.get('x-automation-key');
    const expectedKey = process.env.N8N_API_KEY;

    if (!expectedKey || authHeader !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid automation key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId query parameter is required' }, { status: 400 });
    }

    // Rate limit: 100 requests / 60-second sliding window per org
    const rateLimit = await checkRateLimit(`integrations:resolve:${orgId}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? 60) },
        }
      );
    }

    // 1. Check in-memory cache
    const cached = getCachedOrgIntegrations(orgId);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 2. Query database using Admin Client (bypassing RLS for service role)
    const supabase = await createAdminClient();
    const { data: integrations, error } = await supabase
      .from('organization_integrations')
      .select('provider, enabled, config, secrets')
      .eq('organization_id', orgId)
      .eq('enabled', true)
      .is('deleted_at', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resIntegrations: Record<string, { enabled: boolean; webhookUrl: string | null; config: Record<string, unknown> }> = {};

    for (const row of integrations || []) {
      resIntegrations[row.provider] = {
        enabled: row.enabled,
        webhookUrl: row.secrets?.webhook_url ? decryptSecret(row.secrets.webhook_url) : null,
        config: row.config || {},
      };
    }

    const result: ResolvedOrgIntegrations = {
      organizationId: orgId,
      integrations: resIntegrations,
    };

    // Store in cache
    setCachedOrgIntegrations(orgId, result);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
