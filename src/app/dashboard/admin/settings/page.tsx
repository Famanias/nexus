import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';
import { Organization, Profile } from '@/types';
import RequireOrganization from '@/components/shared/RequireOrganization';

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const supabase = await createClient();
  
  // Fetch current user and their organization
  const { data: { user } } = await supabase.auth.getUser();
  let organization: Organization | null = null;
  let hasOrg = false;
  let fullProfile: Profile | null = null;
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      fullProfile = profile;
      if (profile.org_id) {
        hasOrg = true;
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .single();
        if (orgData) {
          organization = orgData;
        }
      }
    }
  }

  const { data: settings } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!settings && hasOrg) {
    return <div>No site settings found. Please contact an administrator.</div>;
  }

  return (
    <RequireOrganization featureName="Site Settings" serverProfile={fullProfile}>
      <SettingsClient initialSettings={settings!} serverOrganization={organization} />
    </RequireOrganization>
  );
}
