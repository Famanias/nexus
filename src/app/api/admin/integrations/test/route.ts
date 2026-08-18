// ============================================================
// Integration Live Test & Verification API
// ============================================================
// Sends a live HTTP notification ping to Slack or Discord webhook,
// enforcing a 10-second rate-limit window per organization and
// updating last_tested_at, last_status, and last_error in DB.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateWebhookUrl, IntegrationProvider } from '@/lib/integrations/validation';
import { decryptSecret } from '@/lib/services/encryption';

// Rate limit memory map: orgId -> timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10 * 1000; // 10 seconds

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const orgId = profile.org_id;

    // Rate limiting check
    const lastTime = rateLimitMap.get(orgId) || 0;
    const now = Date.now();
    if (now - lastTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastTime)) / 1000);
      return NextResponse.json(
        { error: `Rate limited: Please wait ${waitSec} second(s) before testing again.` },
        { status: 429 }
      );
    }
    rateLimitMap.set(orgId, now);

    const body = await request.json();
    const { provider, webhookUrl } = body as { provider: IntegrationProvider; webhookUrl?: string };

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    let targetUrl = webhookUrl;

    // If webhookUrl wasn't passed in body, fetch stored secret from DB
    if (!targetUrl) {
      const { data: integration } = await supabase
        .from('organization_integrations')
        .select('id, secrets')
        .eq('organization_id', orgId)
        .eq('provider', provider)
        .maybeSingle();

      targetUrl = integration?.secrets?.webhook_url ? decryptSecret(integration.secrets.webhook_url) : undefined;
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'No webhook URL configured or provided for testing.' }, { status: 400 });
    }

    // Validate URL syntax
    const val = validateWebhookUrl(provider, targetUrl);
    if (!val.isValid) {
      return NextResponse.json({ error: val.error }, { status: 400 });
    }

    // Prepare payload based on provider
    let testPayload: Record<string, unknown> = {};
    if (provider === 'slack') {
      testPayload = { text: '🌌 *Nexus Integration Test*: Your Slack webhook is working successfully!' };
    } else if (provider === 'discord') {
      testPayload = { content: '🌌 **Nexus Integration Test**: Your Discord webhook is working successfully!' };
    } else {
      testPayload = { event: 'test.notification', message: 'Nexus integration test successful!' };
    }

    // Perform live HTTP request
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    const isSuccess = response.ok;
    const responseText = await response.text();

    // Update DB health status
    const statusResult: 'success' | 'failed' = isSuccess ? 'success' : 'failed';
    const errorMessage = isSuccess ? null : `HTTP ${response.status}: ${responseText.slice(0, 200)}`;

    await supabase
      .from('organization_integrations')
      .update({
        last_tested_at: new Date().toISOString(),
        last_status: statusResult,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', orgId)
      .eq('provider', provider);

    if (!isSuccess) {
      return NextResponse.json(
        { success: false, error: `Webhook returned error (${response.status}): ${responseText}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Test alert sent successfully!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
