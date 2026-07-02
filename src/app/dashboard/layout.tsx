// app/dashboard/layout.tsx
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/shared/DashboardShell';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("LAYOUT");
  console.log({
    user: user?.id,
    error,
  });

  if (!user) redirect('/login');

  const [profileResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
  ]);

  const profile = profileResponse.data;
  const profileError = profileResponse.error;

  if (!profile) {
    console.log("No profile found, redirecting to login");
    redirect('/login');
  }

  if (profileError) {
    console.log("Profile error:", profileError);
    redirect('/login');
  }

  if (!profile) redirect('/login');

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}