import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types';
import { completionPercent } from '@/lib/attendance/summary';
import ReportsClient from './ReportsClient';
import RequireOrganization from '@/components/shared/RequireOrganization';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: ojts }, { data: allAtt }, { data: profile }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'ojt').eq('is_active', true),
      supabase.from('attendance').select('user_id, total_hours, date').not('total_hours', 'is', null),
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
    ]);

  const reports = (ojts ?? []).map((ojt: Profile) => {
    const all = (allAtt ?? []).filter((a) => a.user_id === ojt.id);
    const total_hours = all.reduce((s: number, a) => s + (a.total_hours ?? 0), 0);
    const total_days = all.length;
    return {
      profile: ojt,
      total_hours,
      total_days,
      completion_pct: completionPercent(total_hours, ojt.required_hours),
      this_month_hours: total_hours,
      this_month_days: total_days,
      avg_daily_hours: total_days > 0 ? total_hours / total_days : 0,
    };
  }).sort((a, b) => b.total_hours - a.total_hours);

  return (
    <RequireOrganization featureName="Reports" serverProfile={profile as Profile}>
      <ReportsClient initialReports={reports} />
    </RequireOrganization>
  );
}
