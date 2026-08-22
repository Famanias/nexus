import DashboardShell from '@/components/shared/DashboardShell';
import { requireProfile } from '@/lib/session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}