import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types';
import { format } from 'date-fns';
import { completionPercent } from '@/lib/attendance/summary';
import SupervisorClient from './SupervisorClient';

export const dynamic = 'force-dynamic';

export default async function SupervisorPage() {
  const supabase = await createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: ojts }, { data: todayAttendance }, { data: allAttendance }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'ojt').eq('is_active', true),
      supabase.from('attendance').select('*').eq('date', today),
      supabase.from('attendance').select('user_id, total_hours, date').not('total_hours', 'is', null),
    ]);

  const summaries = (ojts ?? []).map((ojt: Profile) => {
    const ojtAttendance = (allAttendance ?? []).filter((a) => a.user_id === ojt.id);
    const total_hours = ojtAttendance.reduce((acc: number, a) => acc + (a.total_hours ?? 0), 0);
    const total_days = ojtAttendance.length;
    const today_record = (todayAttendance ?? []).find((a) => a.user_id === ojt.id);
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
