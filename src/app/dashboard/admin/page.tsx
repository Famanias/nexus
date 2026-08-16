import { createClient } from '@/lib/supabase/server';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import AdminDashboardClient from './AdminDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const [{ count: ojts }, { count: supervisors }, { data: todayAtt }, { data: allHours }, { data: attendance }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ojt').eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'supervisor').eq('is_active', true),
      supabase.from('attendance').select('id').eq('date', today).not('clock_in', 'is', null),
      supabase.from('attendance').select('total_hours').not('total_hours', 'is', null),
      supabase
        .from('attendance')
        .select('*, profile:profiles(id, full_name, email, avatar_url, department)')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false }),
    ]);

  const total_hours = (allHours ?? []).reduce((a: number, r: { total_hours: number | null }) => a + (r.total_hours ?? 0), 0);

  return (
    <AdminDashboardClient
      stats={{
        total_ojts: ojts ?? 0,
        total_supervisors: supervisors ?? 0,
        present_today: todayAtt?.length ?? 0,
        total_hours_all: total_hours,
      }}
      initialAttendance={attendance ?? []}
    />
  );
}
