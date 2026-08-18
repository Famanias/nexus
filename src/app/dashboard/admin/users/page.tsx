import { createClient } from '@/lib/supabase/server';
import UsersClient from './UsersClient';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { requireProfile } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const invitationsPromise = profile.org_id
    ? supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', profile.org_id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] });

  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    invitationsPromise,
  ]);

  return (
    <RequireOrganization featureName="User Management" serverProfile={profile}>
      <UsersClient
        initialUsers={users ?? []}
        initialInvitations={invitations ?? []}
      />
    </RequireOrganization>
  );
}


