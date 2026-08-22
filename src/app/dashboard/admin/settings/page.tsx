import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';
import { Organization } from '@/types';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { requireProfile } from '@/lib/session';
import { getCachedSiteSettings } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  let organization: Organization | null = null;
  const hasOrg = Boolean(profile.org_id);

  if (profile.org_id) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.org_id)
      .single();
    if (orgData) {
      organization = orgData;
    }
  }

  const settings = await getCachedSiteSettings(profile.org_id);

  if (!settings && hasOrg) {
    return <div>No site settings found. Please contact an administrator.</div>;
  }

  return (
    <RequireOrganization featureName="Site Settings" serverProfile={profile}>
      <SettingsClient initialSettings={settings!} serverOrganization={organization} profile={profile} />
    </RequireOrganization>
  );
}


