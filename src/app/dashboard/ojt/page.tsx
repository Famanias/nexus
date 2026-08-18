import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { requireProfile, getEffectiveRole } from '@/lib/session';
import { computeAttendanceSummary } from '@/lib/attendance/summary';
import OJTClient from './OJTClient';

export const dynamic = 'force-dynamic';

export default async function OJTPage() {
  const { user, profile } = await requireProfile();
  const effectiveRole = getEffectiveRole(profile);

  if (effectiveRole !== 'ojt') {
    redirect(`/dashboard/${effectiveRole}`);
  }

  const supabase = await createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: todayRecords }, { data: allAttendance }] = await Promise.all([
    supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('clock_in', { ascending: true }),
    supabase
      .from('attendance')
      .select('total_hours, date')
      .eq('user_id', user.id)
      .not('total_hours', 'is', null),
  ]);

  const summary = computeAttendanceSummary({
    rows: allAttendance ?? [],
    requiredHours: profile.required_hours,
    role: profile.role,
    systemRole: profile.system_role,
  })!;

  const initialTodayList = todayRecords ?? [];
  const initialActive = initialTodayList.find((r) => !r.clock_out) ?? null;
  const initialLatest = initialTodayList.length > 0 ? initialTodayList[initialTodayList.length - 1] : null;

  return (
    <OJTClient
      profile={profile}
      initialTodayRecords={initialTodayList}
      initialTodayRecord={initialActive ?? initialLatest}
      initialSummary={summary}
    />
  );
}

