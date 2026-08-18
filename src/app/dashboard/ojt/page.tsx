import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { Profile } from '@/types';
import { isOjt } from '@/lib/attendance/eligibility';
import { computeAttendanceSummary } from '@/lib/attendance/summary';
import OJTClient from './OJTClient';

export const dynamic = 'force-dynamic';

export default async function OJTPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  console.log("OJT PAGE");
  // console.log(user?.id);

  const userId = user!.id;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: profile }, { data: todayRecords }, { data: allAttendance }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('attendance').select('*').eq('user_id', userId).eq('date', today).order('clock_in', { ascending: true }),
      supabase.from('attendance').select('total_hours, date').eq('user_id', userId).not('total_hours', 'is', null),
    ]);

  if (!profile) redirect('/login');
  if (!isOjt((profile as Profile).role, (profile as Profile).system_role)) {
    redirect(`/dashboard/${(profile as Profile).system_role ?? (profile as Profile).role}`);
  }

  const summary = computeAttendanceSummary({
    rows: allAttendance ?? [],
    requiredHours: (profile as Profile).required_hours,
    role: (profile as Profile).role,
    systemRole: (profile as Profile).system_role,
  })!;

  const initialTodayList = todayRecords ?? [];
  const initialActive = initialTodayList.find((r) => !r.clock_out) ?? null;
  const initialLatest = initialTodayList.length > 0 ? initialTodayList[initialTodayList.length - 1] : null;

  return (
    <OJTClient
      profile={profile as Profile}
      initialTodayRecords={initialTodayList}
      initialTodayRecord={initialActive ?? initialLatest}
      initialSummary={summary}
    />
  );
}
