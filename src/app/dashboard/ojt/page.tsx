import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { Profile, AttendanceSummary } from '@/types';
import OJTClient from './OJTClient';

export const dynamic = 'force-dynamic';

export default async function OJTPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  console.log("OJT PAGE");
  // console.log(user?.id);

  const userId = user!.id;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: profile }, { data: todayRecord }, { data: allAttendance }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('attendance').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('attendance').select('total_hours').eq('user_id', userId).not('total_hours', 'is', null),
    ]);

  const required = (profile as Profile)?.required_hours ?? 600;
  const totalHours = (allAttendance ?? []).reduce((acc, row) => acc + (row.total_hours ?? 0), 0);

  const summary: AttendanceSummary = {
    total_days: (allAttendance ?? []).length,
    total_hours: totalHours,
    required_hours: required,
    remaining_hours: Math.max(0, required - totalHours),
    completion_percentage: Math.min(100, (totalHours / required) * 100),
  };

  return (
    <OJTClient
      profile={profile as Profile}
      initialTodayRecord={todayRecord}
      initialSummary={summary}
    />
  );
}
