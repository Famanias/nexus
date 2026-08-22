import React from 'react';
import IntegrationsClient from './IntegrationsClient';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { getOrgIntegrations } from '@/actions/integrations';
import { requireProfile } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminIntegrationsPage() {
  const { profile } = await requireProfile();
  const { data: initialIntegrations } = await getOrgIntegrations();

  return (
    <RequireOrganization featureName="Integrations" serverProfile={profile}>
      <IntegrationsClient initialIntegrations={initialIntegrations ?? []} />
    </RequireOrganization>
  );
}

