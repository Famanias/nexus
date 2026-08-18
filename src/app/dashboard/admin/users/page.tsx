import { createClient } from '@/lib/supabase/server';
import UsersClient from './UsersClient';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { requireProfile } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <RequireOrganization featureName="User Management" serverProfile={profile}>
      <UsersClient initialUsers={users ?? []} />
    </RequireOrganization>
  );
}

