import { getSession, getEffectiveRole } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function DashboardIndex() {
  const { user, profile } = await getSession();

  if (!user) redirect('/login');

  const fallbackRole = (user.user_metadata?.role as string) ?? 'ojt';
  const effectiveRole = getEffectiveRole(profile, fallbackRole);
  redirect(`/dashboard/${effectiveRole}`);
}

