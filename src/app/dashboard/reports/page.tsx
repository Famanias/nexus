import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types';
import { completionPercent, getAttendanceSummaries } from '@/lib/attendance/summary';
import ReportsClient from './ReportsClient';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { requireProfile } from '@/lib/session';
import { getCachedActiveOjts } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [ojts, summaryMap] = await Promise.all([
    getCachedActiveOjts(profile.org_id),
    getAttendanceSummaries(supabase, profile.org_id),
  ]);

  const reports = (ojts ?? []).map((ojt: Profile) => {
    const userSummary = summaryMap.get(ojt.id);
    const total_hours = userSummary?.total_hours ?? 0;
    const total_days = userSummary?.total_days ?? 0;
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
    <RequireOrganization featureName="Reports" serverProfile={profile}>
      <ReportsClient initialReports={reports} />
    </RequireOrganization>
  );
}

