import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types';
import { format } from 'date-fns';
import { completionPercent, getAttendanceSummaries } from '@/lib/attendance/summary';
import SupervisorClient from './SupervisorClient';
import { requireProfile } from '@/lib/session';
import { getCachedActiveOjts } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export default async function SupervisorPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [ojts, { data: todayAttendance }, summaryMap] =
    await Promise.all([
      getCachedActiveOjts(profile.org_id),
      supabase.from('attendance').select('*').eq('date', today),
      getAttendanceSummaries(supabase, profile.org_id),
    ]);

  const summaries = (ojts ?? []).map((ojt: Profile) => {
    const userSummary = summaryMap.get(ojt.id);
    const total_hours = userSummary?.total_hours ?? 0;
    const total_days = userSummary?.total_days ?? 0;
    const userToday = (todayAttendance ?? []).filter((a) => a.user_id === ojt.id);
    const activeToday = userToday.find((a) => !a.clock_out);
    const latestToday = userToday.length > 0 ? userToday[userToday.length - 1] : undefined;
    const today_record = activeToday ?? latestToday;
    const completion_pct = completionPercent(total_hours, ojt.required_hours);
    return { profile: ojt, total_hours, total_days, today_record, completion_pct };
  });


  const present = summaries.filter((s) => s.today_record?.clock_in).length;
  const completed = summaries.filter((s) => s.completion_pct >= 100).length;
  const avg_hours = summaries.length
    ? summaries.reduce((acc, s) => acc + s.total_hours, 0) / summaries.length
    : 0;

  const stats = { total: (ojts ?? []).length, present, completed, avg_hours };

  return <SupervisorClient summaries={summaries} stats={stats} />;
}
