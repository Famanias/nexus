import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardIndex() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const role = (user.user_metadata?.role as string) ?? 'ojt';
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, system_role')
    .eq('id', user.id)
    .single();

  const effectiveRole = (profile?.system_role ?? profile?.role) ?? role;
  redirect(`/dashboard/${effectiveRole}`);
}
