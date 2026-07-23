'use server';

// ============================================================
// Server Actions — Organization Integrations
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { validateWebhookUrl, maskWebhookUrl, IntegrationProvider } from '@/lib/integrations/validation';
import { invalidateOrgIntegrationsCache } from '@/lib/integrations/cache';
import { encryptSecret, decryptSecret } from '@/lib/services/encryption';

export interface OrgIntegrationData {
  id?: string;
  provider: IntegrationProvider;
  enabled: boolean;
  maskedWebhookUrl: string;
  config: Record<string, unknown>;
  lastTestedAt?: string | null;
  lastStatus?: 'success' | 'failed' | null;
  lastError?: string | null;
}

/**
 * Fetches all organization integrations for the currently authenticated admin's organization.
 */
export async function getOrgIntegrations(): Promise<{ data?: OrgIntegrationData[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Unauthorized: Not authenticated.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return { error: 'User does not belong to an organization.' };
    }

    const { data: integrations, error: fetchError } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', profile.org_id)
      .is('deleted_at', null);

    if (fetchError) {
      return { error: fetchError.message };
    }

    const formatted: OrgIntegrationData[] = (integrations || []).map((row) => {
      const decryptedUrl = row.secrets?.webhook_url ? decryptSecret(row.secrets.webhook_url) : '';
      return {
        id: row.id,
        provider: row.provider as IntegrationProvider,
        enabled: row.enabled,
        maskedWebhookUrl: maskWebhookUrl(decryptedUrl),
        config: row.config || {},
        lastTestedAt: row.last_tested_at,
        lastStatus: row.last_status,
        lastError: row.last_error,
      };
    });

    return { data: formatted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

/**
 * Saves or updates an organization integration settings.
 */
export async function saveOrgIntegration(params: {
  provider: IntegrationProvider;
  enabled: boolean;
  webhookUrl?: string; // If provided, updates secret
  config?: Record<string, unknown>;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { provider, enabled, webhookUrl, config } = params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id || profile.role !== 'admin') {
      return { error: 'Forbidden: Admin access required.' };
    }

    const orgId = profile.org_id;

    // Validate webhook URL if provided or toggled on
    let updateSecrets: Record<string, unknown> | undefined = undefined;
    if (webhookUrl && webhookUrl.trim()) {
      const val = validateWebhookUrl(provider, webhookUrl);
      if (!val.isValid) {
        return { error: val.error };
      }
      updateSecrets = { webhook_url: encryptSecret(webhookUrl.trim()) };
    }

    // Check existing integration row
    const { data: existing } = await supabase
      .from('organization_integrations')
      .select('id, secrets, config')
      .eq('organization_id', orgId)
      .eq('provider', provider)
      .maybeSingle();

    if (existing) {
      const mergedSecrets = updateSecrets ? { ...existing.secrets, ...updateSecrets } : existing.secrets;
      const mergedConfig = config ? { ...existing.config, ...config } : existing.config;

      const { error: updateErr } = await supabase
        .from('organization_integrations')
        .update({
          enabled,
          secrets: mergedSecrets,
          config: mergedConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateErr) return { error: updateErr.message };
    } else {
      if (!updateSecrets?.webhook_url) {
        return { error: 'Webhook URL is required when adding a new integration.' };
      }

      const { error: insertErr } = await supabase
        .from('organization_integrations')
        .insert({
          organization_id: orgId,
          provider,
          enabled,
          secrets: updateSecrets,
          config: config || {},
        });

      if (insertErr) return { error: insertErr.message };
    }

    // Invalidate in-memory resolution cache for this org
    invalidateOrgIntegrationsCache(orgId);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
